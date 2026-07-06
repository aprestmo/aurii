import type { SQLQueryBindings } from "bun:sqlite";
import { Database } from "bun:sqlite";
import { join } from "path";
import type { Entity, EntityInput, EntityState } from "../entity/types";
import type { Condition, ParsedQuery } from "../query/parser";
import type { SchemaDefinition, StoredSchema } from "../schema/types";
import type {
	Dataset,
	DatasetInput,
	ImportRunRecord,
	SchemaStats,
	StorageAdapter,
	StorageStats,
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

function conditionToSql(
	condition: Condition,
	params: SQLQueryBindings[],
): string {
	const path = `json_extract(data, '$.${condition.field}')`;

	if (condition.op === "contains") {
		params.push(`%${condition.value}%`);
		return `${path} LIKE ?`;
	}

	const value =
		typeof condition.value === "boolean"
			? condition.value
				? 1
				: 0
			: condition.value;
	params.push(value);

	const ops: Record<string, string> = {
		"==": "=",
		"!=": "!=",
		">": ">",
		"<": "<",
		">=": ">=",
		"<=": "<=",
	};
	return `${path} ${ops[condition.op]} ?`;
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
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

		// Ensure default dataset exists
		this.db
			.prepare(
				`INSERT INTO aurii_datasets (id, name, description)
         VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`,
			)
			.run(DEFAULT_DATASET, "Default", "Default dataset");
	}

	async close(): Promise<void> {
		this.db.close();
	}

	// ── Datasets ───────────────────────────────────────────────────────────────

	async createDataset(input: DatasetInput): Promise<Dataset> {
		this.db
			.prepare(
				`INSERT INTO aurii_datasets (id, name, description) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description`,
			)
			.run(input.id, input.name, input.description ?? null);
		return (await this.getDataset(input.id))!;
	}

	async getDataset(id: string): Promise<Dataset | null> {
		const row = this.db
			.prepare("SELECT * FROM aurii_datasets WHERE id = ?")
			.get(id) as {
			id: string;
			name: string;
			description: string | null;
			created_at: string;
		} | null;
		if (!row) return null;
		return {
			id: row.id,
			name: row.name,
			...(row.description !== null ? { description: row.description } : {}),
			createdAt: row.created_at,
		};
	}

	async listDatasets(): Promise<Dataset[]> {
		const rows = this.db
			.prepare("SELECT * FROM aurii_datasets ORDER BY created_at ASC")
			.all() as {
			id: string;
			name: string;
			description: string | null;
			created_at: string;
		}[];
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			...(r.description !== null ? { description: r.description } : {}),
			createdAt: r.created_at,
		}));
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

	// ── Query ──────────────────────────────────────────────────────────────────

	async executeQuery(query: ParsedQuery, datasetId: string): Promise<Entity[]> {
		const params: SQLQueryBindings[] = [datasetId, query.from];
		let sql =
			"SELECT id, dataset_id, schema_id, data, state, created_at, updated_at " +
			"FROM aurii_entities WHERE dataset_id = ? AND schema_id = ?";

		if (query.where && query.where.length > 0) {
			const clauses = query.where.map((c) => conditionToSql(c, params));
			sql += " AND " + clauses.join(" AND ");
		}

		if (query.orderBy) {
			const dir = query.orderBy.direction.toUpperCase();
			sql += ` ORDER BY json_extract(data, '$.${query.orderBy.field}') ${dir}`;
		}

		if (query.limit !== undefined) {
			sql += " LIMIT ?";
			params.push(query.limit);
		}
		if (query.offset !== undefined) {
			sql += " OFFSET ?";
			params.push(query.offset);
		}

		const rows = this.db.prepare(sql).all(...params) as RawEntityRow[];
		let entities = rows.map(rowToEntity);

		if (query.select && query.select.length > 0) {
			const fields = query.select;
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
         (id, definition_id, dataset_id, schema_id, status, dry_run, total, imported, failed, errors, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
