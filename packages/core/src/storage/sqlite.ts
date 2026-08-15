import type { SQLQueryBindings } from "bun:sqlite";
import { Database } from "bun:sqlite";
import { join } from "path";
import type { Entity, EntityInput, EntityState } from "../entity/types";
import type { WhereExpr } from "../query/ast";
import type { ExecutionPlan, ScanStep } from "../query/plan";
import type { SchemaDefinition, StoredSchema } from "../schema/types";
import {
	canPushdownWhere,
	evaluateWhere,
	executePlan as runPlan,
	type PlanExecutorContext,
	type PlanResult,
	whereExprToSqlClauses,
} from "./plan-executor";

function jsonFieldName(field: string): string {
	return field.replace(/[^a-zA-Z0-9_]/g, "");
}
import { LEGACY_PROJECT_ID } from "@aurii/types";
import type {
	Dataset,
	DatasetInput,
	DatasetUpdateInput,
	ImportRunRecord,
	SchemaStats,
	StorageAdapter,
	StorageStats,
	UpsertByFieldResult,
} from "./types";
import { DEFAULT_DATASET } from "./types";

interface RawEntityRow {
	id: string;
	dataset_id: string;
	schema_id: string;
	data: string;
	state: string;
	created_at: string;
	updated_at: string;
}

interface RawSchemaRow {
	id: string;
	dataset_id: string;
	name: string;
	description: string | null;
	version: number;
	definition: string;
	created_at: string;
	updated_at: string;
}

function rowToEntity(row: RawEntityRow): Entity {
	return {
		id: row.id,
		datasetId: row.dataset_id,
		schemaId: row.schema_id,
		data: JSON.parse(row.data) as Record<string, unknown>,
		state: row.state as EntityState,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function rowToSchema(row: RawSchemaRow): StoredSchema {
	const def = JSON.parse(row.definition) as SchemaDefinition;
	return {
		id: row.id,
		datasetId: row.dataset_id,
		name: row.name,
		...(row.description !== null ? { description: row.description } : {}),
		version: row.version,
		fields: def.fields,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function buildScanSql(
	step: ScanStep,
	datasetId: string,
): { sql: string; params: SQLQueryBindings[] } {
	const params: SQLQueryBindings[] = [datasetId, step.schemaId];
	let sql =
		"SELECT id, dataset_id, schema_id, data, state, created_at, updated_at " +
		"FROM aurii_entities WHERE dataset_id = ? AND schema_id = ?";

	if (step.where) {
		const bind = (v: unknown) => {
			params.push(v as SQLQueryBindings);
			return "?";
		};
		const clauses = whereExprToSqlClauses(
			step.where,
			(field) => `json_extract(data, '$.${field}')`,
			bind,
		);
		if (clauses.length > 0) sql += " AND " + clauses.join(" AND ");
	}

	if (step.orderBy) {
		const dir = step.orderBy.direction.toUpperCase();
		sql += ` ORDER BY json_extract(data, '$.${step.orderBy.field}') ${dir}`;
	}

	if (step.limit !== undefined) {
		sql += " LIMIT ?";
		params.push(step.limit);
	}
	if (step.offset !== undefined) {
		sql += " OFFSET ?";
		params.push(step.offset);
	}

	return { sql, params };
}

export class SqliteAdapter implements StorageAdapter {
	readonly kind = "sqlite" as const;
	private db: Database;

	constructor(path?: string) {
		const dbPath =
			path ?? process.env["AURII_DB_PATH"] ?? join(process.cwd(), "aurii.db");
		this.db = new Database(dbPath);
		this.db.exec("PRAGMA journal_mode=WAL;");
		this.db.exec("PRAGMA foreign_keys=ON;");
	}

	async init(): Promise<void> {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS aurii_datasets (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        project_id  TEXT NOT NULL DEFAULT '${LEGACY_PROJECT_ID}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS aurii_schemas (
        id          TEXT NOT NULL,
        dataset_id  TEXT NOT NULL REFERENCES aurii_datasets(id),
        name        TEXT NOT NULL,
        description TEXT,
        version     INTEGER NOT NULL DEFAULT 1,
        definition  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (id, dataset_id)
      );

      CREATE TABLE IF NOT EXISTS aurii_entities (
        id         TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES aurii_datasets(id),
        schema_id  TEXT NOT NULL,
        data       TEXT NOT NULL,
        state      TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_dataset_schema
        ON aurii_entities(dataset_id, schema_id);

      CREATE INDEX IF NOT EXISTS idx_entities_natural_id
        ON aurii_entities(dataset_id, schema_id, json_extract(data, '$.id'));

      CREATE INDEX IF NOT EXISTS idx_datasets_project_id
        ON aurii_datasets(project_id);

      CREATE TABLE IF NOT EXISTS aurii_import_runs (
        id            TEXT PRIMARY KEY,
        definition_id TEXT,
        dataset_id    TEXT,
        schema_id     TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        dry_run       INTEGER NOT NULL DEFAULT 0,
        total         INTEGER NOT NULL DEFAULT 0,
        imported      INTEGER NOT NULL DEFAULT 0,
        failed        INTEGER NOT NULL DEFAULT 0,
        errors        TEXT NOT NULL DEFAULT '[]',
        started_at    TEXT,
        completed_at  TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        run_trigger   TEXT
      );
    `);

		// Migrate pre-existing SQLite DBs that lack project_id
		this.ensureProjectIdColumn();
		this.ensureImportRunTriggerColumn();

		// Ensure default dataset exists (owned by Legacy fallback project)
		this.db
			.prepare(
				`INSERT INTO aurii_datasets (id, name, description, project_id)
         VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
			)
			.run(
				DEFAULT_DATASET,
				"Default",
				"Default dataset",
				LEGACY_PROJECT_ID,
			);
	}

	/** Add run_trigger for databases created before import-run trigger persistence. */
	private ensureImportRunTriggerColumn(): void {
		const cols = this.db
			.prepare("PRAGMA table_info(aurii_import_runs)")
			.all() as { name: string }[];
		if (!cols.some((c) => c.name === "run_trigger")) {
			this.db.exec(`ALTER TABLE aurii_import_runs ADD COLUMN run_trigger TEXT`);
		}
	}

	/** Add and backfill project_id for databases created before project scoping. */
	private ensureProjectIdColumn(): void {
		const cols = this.db
			.prepare("PRAGMA table_info(aurii_datasets)")
			.all() as { name: string }[];
		const hasProjectId = cols.some((c) => c.name === "project_id");
		if (!hasProjectId) {
			this.db.exec(
				`ALTER TABLE aurii_datasets ADD COLUMN project_id TEXT NOT NULL DEFAULT '${LEGACY_PROJECT_ID}'`,
			);
		}
		this.db
			.prepare(
				`UPDATE aurii_datasets SET project_id = ? WHERE project_id IS NULL OR project_id = ''`,
			)
			.run(LEGACY_PROJECT_ID);
		this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON aurii_datasets(project_id)`,
		);
	}

	async close(): Promise<void> {
		this.db.close();
	}

	// ── Datasets ───────────────────────────────────────────────────────────────

	private mapDatasetRow(row: {
		id: string;
		name: string;
		description: string | null;
		project_id: string;
		created_at: string;
	}): Dataset {
		return {
			id: row.id,
			name: row.name,
			...(row.description !== null ? { description: row.description } : {}),
			projectId: row.project_id,
			createdAt: row.created_at,
		};
	}

	async createDataset(input: DatasetInput): Promise<Dataset> {
		const projectId = input.projectId ?? LEGACY_PROJECT_ID;
		this.db
			.prepare(
				`INSERT INTO aurii_datasets (id, name, description, project_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           project_id = COALESCE(aurii_datasets.project_id, excluded.project_id)`,
			)
			.run(input.id, input.name, input.description ?? null, projectId);
		return (await this.getDataset(input.id))!;
	}

	async getDataset(id: string): Promise<Dataset | null> {
		const row = this.db
			.prepare("SELECT * FROM aurii_datasets WHERE id = ?")
			.get(id) as {
			id: string;
			name: string;
			description: string | null;
			project_id: string;
			created_at: string;
		} | null;
		if (!row) return null;
		return this.mapDatasetRow(row);
	}

	async listDatasets(projectId?: string): Promise<Dataset[]> {
		const rows = (
			projectId
				? this.db
						.prepare(
							"SELECT * FROM aurii_datasets WHERE project_id = ? ORDER BY created_at ASC",
						)
						.all(projectId)
				: this.db
						.prepare("SELECT * FROM aurii_datasets ORDER BY created_at ASC")
						.all()
		) as {
			id: string;
			name: string;
			description: string | null;
			project_id: string;
			created_at: string;
		}[];
		return rows.map((r) => this.mapDatasetRow(r));
	}

	async updateDataset(
		id: string,
		input: DatasetUpdateInput,
	): Promise<Dataset | null> {
		const existing = await this.getDataset(id);
		if (!existing) return null;
		const name = input.name !== undefined ? input.name : existing.name;
		const description =
			input.description !== undefined
				? input.description
				: (existing.description ?? null);
		this.db
			.prepare(
				`UPDATE aurii_datasets SET name = ?, description = ? WHERE id = ?`,
			)
			.run(name, description, id);
		return this.getDataset(id);
	}

	async reassignDatasetProject(
		datasetId: string,
		toProjectId: string,
	): Promise<Dataset | null> {
		const existing = await this.getDataset(datasetId);
		if (!existing) return null;
		this.db
			.prepare(`UPDATE aurii_datasets SET project_id = ? WHERE id = ?`)
			.run(toProjectId, datasetId);
		return this.getDataset(datasetId);
	}

	// ── Schemas ────────────────────────────────────────────────────────────────

	async upsertSchema(
		def: SchemaDefinition,
		datasetId: string,
	): Promise<StoredSchema> {
		const now = new Date().toISOString();
		this.db
			.prepare(
				`INSERT INTO aurii_schemas (id, dataset_id, name, description, version, definition, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id, dataset_id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           version = excluded.version,
           definition = excluded.definition,
           updated_at = excluded.updated_at`,
			)
			.run(
				def.id,
				datasetId,
				def.name,
				def.description ?? null,
				def.version ?? 1,
				JSON.stringify(def),
				now,
				now,
			);
		return (await this.getSchema(def.id, datasetId))!;
	}

	async getSchema(id: string, datasetId: string): Promise<StoredSchema | null> {
		const row = this.db
			.prepare("SELECT * FROM aurii_schemas WHERE id = ? AND dataset_id = ?")
			.get(id, datasetId) as RawSchemaRow | null;
		return row ? rowToSchema(row) : null;
	}

	async listSchemas(datasetId?: string): Promise<StoredSchema[]> {
		const rows = (
			datasetId
				? this.db
						.prepare(
							"SELECT * FROM aurii_schemas WHERE dataset_id = ? ORDER BY created_at DESC",
						)
						.all(datasetId)
				: this.db
						.prepare("SELECT * FROM aurii_schemas ORDER BY created_at DESC")
						.all()
		) as RawSchemaRow[];
		return rows.map(rowToSchema);
	}

	async deleteSchema(id: string, datasetId: string): Promise<boolean> {
		const result = this.db
			.prepare("DELETE FROM aurii_schemas WHERE id = ? AND dataset_id = ?")
			.run(id, datasetId);
		return result.changes > 0;
	}

	// ── Entities ───────────────────────────────────────────────────────────────

	async insertEntities(
		inputs: EntityInput[],
		datasetId: string,
	): Promise<Entity[]> {
		const now = new Date().toISOString();
		const insert = this.db.prepare(
			`INSERT INTO aurii_entities (id, dataset_id, schema_id, data, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);

		const insertMany = this.db.transaction((rows: EntityInput[]) => {
			const ids: string[] = [];
			for (const input of rows) {
				const id = crypto.randomUUID();
				insert.run(
					id,
					datasetId,
					input.schemaId,
					JSON.stringify(input.data),
					input.state ?? "active",
					now,
					now,
				);
				ids.push(id);
			}
			return ids;
		});

		const ids = insertMany(inputs);
		if (ids.length === 0) return [];

		const placeholders = ids.map(() => "?").join(",");
		const rows = this.db
			.prepare(`SELECT * FROM aurii_entities WHERE id IN (${placeholders})`)
			.all(...ids) as RawEntityRow[];
		return rows.map(rowToEntity);
	}

	async upsertEntitiesByField(
		inputs: EntityInput[],
		datasetId: string,
		fieldName: string,
	): Promise<UpsertByFieldResult> {
		if (inputs.length === 0) return { inserted: 0, updated: 0 };

		const schemaId = inputs[0]!.schemaId;
		const safeField = fieldName.replace(/[^a-zA-Z0-9_]/g, "");

		// Fetch all existing natural-key values for this schema in one query.
		const existingRows = this.db
			.prepare(
				`SELECT id, json_extract(data, '$.${safeField}') AS key
         FROM aurii_entities
         WHERE dataset_id = ? AND schema_id = ?`,
			)
			.all(datasetId, schemaId) as { id: string; key: string }[];

		const existingMap = new Map(existingRows.map((r) => [String(r.key), r.id]));

		const toInsert: EntityInput[] = [];
		const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

		for (const input of inputs) {
			const keyValue = String(input.data[fieldName] ?? "");
			const existingId = existingMap.get(keyValue);
			if (existingId !== undefined) {
				toUpdate.push({ id: existingId, data: input.data });
			} else {
				toInsert.push(input);
			}
		}

		const now = new Date().toISOString();

		if (toUpdate.length > 0) {
			const update = this.db.prepare(
				"UPDATE aurii_entities SET data = ?, updated_at = ? WHERE id = ?",
			);
			this.db.transaction(() => {
				for (const { id, data } of toUpdate) {
					update.run(JSON.stringify(data), now, id);
				}
			})();
		}

		if (toInsert.length > 0) {
			await this.insertEntities(toInsert, datasetId);
		}

		return { inserted: toInsert.length, updated: toUpdate.length };
	}

	async getEntity(id: string): Promise<Entity | null> {
		const row = this.db
			.prepare("SELECT * FROM aurii_entities WHERE id = ?")
			.get(id) as RawEntityRow | null;
		return row ? rowToEntity(row) : null;
	}

	async listEntities(
		schemaId: string,
		datasetId: string,
		limit?: number,
		offset?: number,
	): Promise<Entity[]> {
		const params: SQLQueryBindings[] = [datasetId, schemaId];
		let sql =
			"SELECT * FROM aurii_entities WHERE dataset_id = ? AND schema_id = ? ORDER BY created_at DESC";
		if (limit !== undefined) {
			sql += " LIMIT ?";
			params.push(limit);
		}
		if (offset !== undefined) {
			sql += " OFFSET ?";
			params.push(offset);
		}
		const rows = this.db.prepare(sql).all(...params) as RawEntityRow[];
		return rows.map(rowToEntity);
	}

	async countEntities(schemaId: string, datasetId: string): Promise<number> {
		const row = this.db
			.prepare(
				"SELECT COUNT(*) as count FROM aurii_entities WHERE dataset_id = ? AND schema_id = ?",
			)
			.get(datasetId, schemaId) as { count: number };
		return row.count;
	}

	async findEntityByField(
		schemaId: string,
		datasetId: string,
		field: string,
		value: string,
	): Promise<Entity | null> {
		const safe = jsonFieldName(field);
		const row = this.db
			.prepare(
				`SELECT * FROM aurii_entities
         WHERE dataset_id = ? AND schema_id = ?
           AND json_extract(data, '$.${safe}') = ?
         LIMIT 1`,
			)
			.get(datasetId, schemaId, value) as RawEntityRow | null;
		return row ? rowToEntity(row) : null;
	}

	private async countMatching(
		schemaId: string,
		datasetId: string,
		where?: WhereExpr,
	): Promise<number> {
		if (where && !canPushdownWhere(where)) {
			const step: ScanStep = { kind: "scan", schemaId, alias: schemaId, where };
			const entities = await this.scanStep(step, datasetId);
			return entities.length;
		}
		const params: SQLQueryBindings[] = [datasetId, schemaId];
		let sql =
			"SELECT COUNT(*) as count FROM aurii_entities WHERE dataset_id = ? AND schema_id = ?";
		if (where) {
			const bind = (v: unknown) => {
				params.push(v as SQLQueryBindings);
				return "?";
			};
			const clauses = whereExprToSqlClauses(
				where,
				(field) => `json_extract(data, '$.${jsonFieldName(field)}')`,
				bind,
			);
			if (clauses.length > 0) sql += ` AND ${clauses.join(" AND ")}`;
		}
		const row = this.db.prepare(sql).get(...params) as { count: number };
		return row.count;
	}

	// ── Query ──────────────────────────────────────────────────────────────────

	async executePlan(
		plan: ExecutionPlan,
		datasetId: string,
	): Promise<PlanResult> {
		const ctx: PlanExecutorContext = {
			datasetId,
			scan: async (step) => this.scanStep(step, datasetId),
			count: async (schemaId, where) =>
				this.countMatching(schemaId, datasetId, where),
			getSchemaFields: async (schemaId) => {
				const s = await this.getSchema(schemaId, datasetId);
				return s?.fields ?? [];
			},
			findByField: async (schemaId, field, value) =>
				this.findEntityByField(schemaId, datasetId, field, value),
		};
		return runPlan(plan, ctx);
	}

	private async scanStep(
		step: ScanStep,
		datasetId: string,
	): Promise<Entity[]> {
		const { sql, params } = buildScanSql(step, datasetId);
		const rows = this.db.prepare(sql).all(...params) as RawEntityRow[];
		let entities = rows.map(rowToEntity);

		// Post-filter for NOT, EXISTS, and complex OR when SQL can't express them
		if (step.where) {
			entities = entities.filter((e) => evaluateWhere(step.where!, e.data));
		}

		if (step.select && step.select.length > 0) {
			const fields = step.select;
			entities = entities.map((e) => ({
				...e,
				data: Object.fromEntries(
					Object.entries(e.data).filter(([k]) => fields.includes(k)),
				),
			}));
		}

		return entities;
	}

	// ── Import runs ────────────────────────────────────────────────────────────

	async recordImportRun(
		run: Omit<ImportRunRecord, "createdAt">,
	): Promise<void> {
		this.db
			.prepare(
				`INSERT INTO aurii_import_runs
         (id, definition_id, dataset_id, schema_id, status, dry_run, total, imported, failed, errors, started_at, completed_at, run_trigger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				run.id,
				run.definitionId,
				run.datasetId,
				run.schemaId,
				run.status,
				run.dryRun ? 1 : 0,
				run.total,
				run.imported,
				run.failed,
				JSON.stringify(run.errors),
				run.startedAt,
				run.completedAt,
				run.trigger ?? null,
			);
	}

	async updateImportRun(
		id: string,
		patch: Partial<ImportRunRecord>,
	): Promise<void> {
		const sets: string[] = [];
		const params: SQLQueryBindings[] = [];
		const fields: [keyof ImportRunRecord, string][] = [
			["status", "status"],
			["total", "total"],
			["imported", "imported"],
			["failed", "failed"],
			["completedAt", "completed_at"],
		];
		for (const [key, col] of fields) {
			if (patch[key] !== undefined) {
				sets.push(`${col} = ?`);
				params.push(patch[key] as SQLQueryBindings);
			}
		}
		if (patch.errors !== undefined) {
			sets.push("errors = ?");
			params.push(JSON.stringify(patch.errors));
		}
		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE aurii_import_runs SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	async listImportRuns(
		datasetId?: string,
		limit = 20,
	): Promise<ImportRunRecord[]> {
		const rows = (
			datasetId
				? this.db
						.prepare(
							"SELECT * FROM aurii_import_runs WHERE dataset_id = ? ORDER BY created_at DESC LIMIT ?",
						)
						.all(datasetId, limit)
				: this.db
						.prepare(
							"SELECT * FROM aurii_import_runs ORDER BY created_at DESC LIMIT ?",
						)
						.all(limit)
		) as Record<string, unknown>[];

		return rows.map((r) => ({
			id: r["id"] as string,
			definitionId: r["definition_id"] as string | null,
			datasetId: r["dataset_id"] as string | null,
			schemaId: r["schema_id"] as string | null,
			status: r["status"] as ImportRunRecord["status"],
			dryRun: Boolean(r["dry_run"]),
			total: r["total"] as number,
			imported: r["imported"] as number,
			failed: r["failed"] as number,
			errors: JSON.parse(r["errors"] as string) as unknown[],
			startedAt: r["started_at"] as string | null,
			completedAt: r["completed_at"] as string | null,
			createdAt: r["created_at"] as string,
			trigger: (r["run_trigger"] as ImportRunRecord["trigger"]) ?? null,
		}));
	}

	// ── Stats ──────────────────────────────────────────────────────────────────

	async getStats(datasetId: string): Promise<StorageStats> {
		const schemas = await this.listSchemas(datasetId);
		const schemaStats: SchemaStats[] = [];
		let totalEntities = 0;

		for (const schema of schemas) {
			const count = await this.countEntities(schema.id, datasetId);
			totalEntities += count;

			const sample = await this.listEntities(schema.id, datasetId, 1000);
			const fieldCoverage = schema.fields.map((f) => {
				const populated = sample.filter((e) => {
					const v = e.data[f.name];
					return v !== undefined && v !== null && v !== "";
				}).length;
				return {
					field: f.name,
					pct:
						sample.length === 0
							? 0
							: Math.round((populated / sample.length) * 100),
				};
			});

			schemaStats.push({
				schemaId: schema.id,
				name: schema.name,
				count,
				fieldCoverage,
			});
		}

		return { datasetId, totalEntities, schemas: schemaStats };
	}
}
