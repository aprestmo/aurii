import { SQL } from "bun";
import type { Entity, EntityInput, EntityState } from "../entity/types";
import type { ExecutionPlan, ScanStep } from "../query/plan";
import type { SchemaDefinition, StoredSchema } from "../schema/types";
import {
	evaluateWhere,
	executePlan as runPlan,
	type PlanExecutorContext,
	type PlanResult,
	whereExprToSqlClauses,
} from "./plan-executor";
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
	data: Record<string, unknown>;
	state: string;
	created_at: string | Date;
	updated_at: string | Date;
}

function ts(v: string | Date): string {
	return v instanceof Date ? v.toISOString() : v;
}

/** Bun.sql may return JSONB as an object or a JSON string depending on version. */
function jsonb<T>(v: unknown): T {
	return (typeof v === "string" ? JSON.parse(v) : v) as T;
}

function rowToEntity(row: RawEntityRow): Entity {
	return {
		id: row.id,
		datasetId: row.dataset_id,
		schemaId: row.schema_id,
		data: jsonb<Record<string, unknown>>(row.data),
		state: row.state as EntityState,
		createdAt: ts(row.created_at),
		updatedAt: ts(row.updated_at),
	};
}

function buildScanSql(
	step: ScanStep,
	datasetId: string,
): { sql: string; params: unknown[] } {
	const params: unknown[] = [datasetId, step.schemaId];
	let sql =
		"SELECT id, dataset_id, schema_id, data, state, created_at, updated_at " +
		"FROM aurii_entities WHERE dataset_id = $1 AND schema_id = $2";

	if (step.where) {
		const bind = (v: unknown) => {
			params.push(v);
			return `$${params.length}`;
		};
		const clauses = whereExprToSqlClauses(
			step.where,
			(field) => {
				const safe = field.replace(/[^a-zA-Z0-9_]/g, "");
				return `data->>'${safe}'`;
			},
			bind,
			"postgres",
		);
		if (clauses.length > 0) sql += " AND " + clauses.join(" AND ");
	}

	if (step.orderBy) {
		const field = step.orderBy.field.replace(/[^a-zA-Z0-9_]/g, "");
		const dir = step.orderBy.direction.toUpperCase();
		sql += ` ORDER BY data->'${field}' ${dir}`;
	}

	if (step.limit !== undefined) {
		params.push(step.limit);
		sql += ` LIMIT $${params.length}`;
	}
	if (step.offset !== undefined) {
		params.push(step.offset);
		sql += ` OFFSET $${params.length}`;
	}

	return { sql, params };
}

export class PostgresAdapter implements StorageAdapter {
	readonly kind = "postgres" as const;
	private sql: SQL;

	constructor(url?: string) {
		const connectionUrl = url ?? process.env["DATABASE_URL"];
		if (!connectionUrl) {
			throw new Error("PostgreSQL storage requires DATABASE_URL");
		}
		this.sql = new SQL(connectionUrl);
	}

	async init(): Promise<void> {
		await this.sql.unsafe(`
      CREATE TABLE IF NOT EXISTS aurii_datasets (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        project_id  UUID NOT NULL DEFAULT '${LEGACY_PROJECT_ID}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS aurii_schemas (
        id          TEXT NOT NULL,
        dataset_id  TEXT NOT NULL REFERENCES aurii_datasets(id),
        name        TEXT NOT NULL,
        description TEXT,
        version     INTEGER NOT NULL DEFAULT 1,
        definition  JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (id, dataset_id)
      );

      CREATE TABLE IF NOT EXISTS aurii_entities (
        id         UUID PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES aurii_datasets(id),
        schema_id  TEXT NOT NULL,
        data       JSONB NOT NULL,
        state      TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_entities_dataset_schema
        ON aurii_entities(dataset_id, schema_id);
      CREATE INDEX IF NOT EXISTS idx_entities_data_gin
        ON aurii_entities USING GIN (data);
      CREATE INDEX IF NOT EXISTS idx_datasets_project_id
        ON aurii_datasets(project_id);

      CREATE TABLE IF NOT EXISTS aurii_import_runs (
        id            UUID PRIMARY KEY,
        definition_id TEXT,
        dataset_id    TEXT,
        schema_id     TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        dry_run       BOOLEAN NOT NULL DEFAULT false,
        total         INTEGER NOT NULL DEFAULT 0,
        imported      INTEGER NOT NULL DEFAULT 0,
        failed        INTEGER NOT NULL DEFAULT 0,
        errors        JSONB NOT NULL DEFAULT '[]',
        started_at    TIMESTAMPTZ,
        completed_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

		// Migrate pre-existing Postgres DBs that lack project_id (Drizzle
		// migration 0001 is preferred when projects table exists; this is a
		// safety net for adapter-only startups).
		await this.ensureProjectIdColumn();

		await this.sql`
      INSERT INTO aurii_datasets (id, name, description, project_id)
      VALUES (${DEFAULT_DATASET}, 'Default', 'Default dataset', ${LEGACY_PROJECT_ID}::uuid)
      ON CONFLICT (id) DO NOTHING
    `;
	}

	private async ensureProjectIdColumn(): Promise<void> {
		await this.sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'aurii_datasets' AND column_name = 'project_id'
        ) THEN
          ALTER TABLE aurii_datasets
            ADD COLUMN project_id UUID NOT NULL DEFAULT '${LEGACY_PROJECT_ID}';
        END IF;
      END $$;
      UPDATE aurii_datasets
        SET project_id = '${LEGACY_PROJECT_ID}'
        WHERE project_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON aurii_datasets(project_id);
    `);
	}

	async close(): Promise<void> {
		await this.sql.close();
	}

	// ── Datasets ───────────────────────────────────────────────────────────────

	private mapDatasetRow(row: Record<string, unknown>): Dataset {
		const description = row["description"] as string | null;
		return {
			id: row["id"] as string,
			name: row["name"] as string,
			...(description !== null && description !== undefined
				? { description }
				: {}),
			projectId: String(row["project_id"]),
			createdAt: ts(row["created_at"] as string | Date),
		};
	}

	async createDataset(input: DatasetInput): Promise<Dataset> {
		const projectId = input.projectId ?? LEGACY_PROJECT_ID;
		await this.sql`
      INSERT INTO aurii_datasets (id, name, description, project_id)
      VALUES (${input.id}, ${input.name}, ${input.description ?? null}, ${projectId}::uuid)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    `;
		return (await this.getDataset(input.id))!;
	}

	async getDataset(id: string): Promise<Dataset | null> {
		const rows = await this.sql`SELECT * FROM aurii_datasets WHERE id = ${id}`;
		const row = rows[0];
		if (!row) return null;
		return this.mapDatasetRow(row as Record<string, unknown>);
	}

	async listDatasets(projectId?: string): Promise<Dataset[]> {
		const rows = projectId
			? await this.sql`
          SELECT * FROM aurii_datasets
          WHERE project_id = ${projectId}::uuid
          ORDER BY created_at ASC
        `
			: await this.sql`SELECT * FROM aurii_datasets ORDER BY created_at ASC`;
		return rows.map((r: Record<string, unknown>) => this.mapDatasetRow(r));
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
		await this.sql`
      UPDATE aurii_datasets
      SET name = ${name}, description = ${description}
      WHERE id = ${id}
    `;
		return this.getDataset(id);
	}

	async reassignDatasetProject(
		datasetId: string,
		toProjectId: string,
	): Promise<Dataset | null> {
		const existing = await this.getDataset(datasetId);
		if (!existing) return null;
		await this.sql`
      UPDATE aurii_datasets
      SET project_id = ${toProjectId}::uuid
      WHERE id = ${datasetId}
    `;
		return this.getDataset(datasetId);
	}

	// ── Schemas ────────────────────────────────────────────────────────────────

	async upsertSchema(
		def: SchemaDefinition,
		datasetId: string,
	): Promise<StoredSchema> {
		await this.sql`
      INSERT INTO aurii_schemas (id, dataset_id, name, description, version, definition, updated_at)
      VALUES (${def.id}, ${datasetId}, ${def.name}, ${def.description ?? null},
              ${def.version ?? 1}, ${def as never}, now())
      ON CONFLICT (id, dataset_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        version = EXCLUDED.version,
        definition = EXCLUDED.definition,
        updated_at = now()
    `;
		return (await this.getSchema(def.id, datasetId))!;
	}

	async getSchema(id: string, datasetId: string): Promise<StoredSchema | null> {
		const rows = await this.sql`
      SELECT * FROM aurii_schemas WHERE id = ${id} AND dataset_id = ${datasetId}
    `;
		const row = rows[0];
		if (!row) return null;
		const def = jsonb<SchemaDefinition>(row.definition);
		return {
			id: row.id,
			datasetId: row.dataset_id,
			name: row.name,
			description: row.description ?? undefined,
			version: row.version,
			fields: def.fields,
			createdAt: ts(row.created_at),
			updatedAt: ts(row.updated_at),
		};
	}

	async listSchemas(datasetId?: string): Promise<StoredSchema[]> {
		const rows = datasetId
			? await this
					.sql`SELECT * FROM aurii_schemas WHERE dataset_id = ${datasetId} ORDER BY created_at DESC`
			: await this.sql`SELECT * FROM aurii_schemas ORDER BY created_at DESC`;

		return rows.map((row: Record<string, unknown>) => {
			const def = jsonb<SchemaDefinition>(row["definition"]);
			return {
				id: row["id"] as string,
				datasetId: row["dataset_id"] as string,
				name: row["name"] as string,
				description: (row["description"] as string | null) ?? undefined,
				version: row["version"] as number,
				fields: def.fields,
				createdAt: ts(row["created_at"] as string | Date),
				updatedAt: ts(row["updated_at"] as string | Date),
			};
		});
	}

	async deleteSchema(id: string, datasetId: string): Promise<boolean> {
		const result = await this.sql`
      DELETE FROM aurii_schemas WHERE id = ${id} AND dataset_id = ${datasetId}
    `;
		return (result as unknown as { count: number }).count > 0;
	}

	// ── Entities ───────────────────────────────────────────────────────────────

	async insertEntities(
		inputs: EntityInput[],
		datasetId: string,
	): Promise<Entity[]> {
		if (inputs.length === 0) return [];

		const ids: string[] = [];
		await this.sql.begin(async (tx: SQL) => {
			for (const input of inputs) {
				const id = crypto.randomUUID();
				await tx`
          INSERT INTO aurii_entities (id, dataset_id, schema_id, data, state)
          VALUES (${id}, ${datasetId}, ${input.schemaId},
                  ${input.data as never}, ${input.state ?? "active"})
        `;
				ids.push(id);
			}
		});

		const placeholders = ids.map((_, i) => `$${i + 1}::uuid`).join(",");
		const rows = await this.sql.unsafe(
			`SELECT * FROM aurii_entities WHERE id IN (${placeholders})`,
			ids as never[],
		);
		return (rows as unknown as RawEntityRow[]).map(rowToEntity);
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
		const existingRows = await this.sql.unsafe(
			`SELECT id, data->>'${safeField}' AS key
       FROM aurii_entities
       WHERE dataset_id = $1 AND schema_id = $2`,
			[datasetId, schemaId] as never[],
		);
		const existingMap = new Map(
			(existingRows as { id: string; key: string }[]).map((r) => [
				String(r.key),
				r.id,
			]),
		);

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

		if (toUpdate.length > 0) {
			await this.sql.begin(async (tx: SQL) => {
				for (const { id, data } of toUpdate) {
					await tx`
            UPDATE aurii_entities
            SET data = ${data as never}, updated_at = now()
            WHERE id = ${id}::uuid
          `;
				}
			});
		}

		if (toInsert.length > 0) {
			await this.insertEntities(toInsert, datasetId);
		}

		return { inserted: toInsert.length, updated: toUpdate.length };
	}

	async getEntity(id: string): Promise<Entity | null> {
		const rows = await this
			.sql`SELECT * FROM aurii_entities WHERE id = ${id}::uuid`;
		return rows[0] ? rowToEntity(rows[0] as RawEntityRow) : null;
	}

	async listEntities(
		schemaId: string,
		datasetId: string,
		limit = 50,
		offset = 0,
	): Promise<Entity[]> {
		const rows = await this.sql`
      SELECT * FROM aurii_entities
      WHERE dataset_id = ${datasetId} AND schema_id = ${schemaId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
		return rows.map((r: RawEntityRow) => rowToEntity(r));
	}

	async countEntities(schemaId: string, datasetId: string): Promise<number> {
		const rows = await this.sql`
      SELECT COUNT(*)::int AS count FROM aurii_entities
      WHERE dataset_id = ${datasetId} AND schema_id = ${schemaId}
    `;
		return rows[0].count as number;
	}

	// ── Query ──────────────────────────────────────────────────────────────────

	async executePlan(
		plan: ExecutionPlan,
		datasetId: string,
	): Promise<PlanResult> {
		const ctx: PlanExecutorContext = {
			datasetId,
			scan: async (step) => this.scanStep(step, datasetId),
			count: async (schemaId, where) => {
				const step: ScanStep = where
					? { kind: "scan", schemaId, alias: schemaId, where }
					: { kind: "scan", schemaId, alias: schemaId };
				const entities = await this.scanStep(step, datasetId);
				return entities.length;
			},
			getSchemaFields: async (schemaId) => {
				const s = await this.getSchema(schemaId, datasetId);
				return s?.fields ?? [];
			},
			findByField: async (schemaId, field, value) => {
				const entities = await this.listEntities(schemaId, datasetId, 10000, 0);
				return entities.find((e) => e.data[field] === value) ?? null;
			},
		};
		return runPlan(plan, ctx);
	}

	private async scanStep(
		step: ScanStep,
		datasetId: string,
	): Promise<Entity[]> {
		const { sql, params } = buildScanSql(step, datasetId);
		const rows = await this.sql.unsafe(sql, params as never[]);
		let entities = (rows as unknown as RawEntityRow[]).map(rowToEntity);

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
		await this.sql`
      INSERT INTO aurii_import_runs
        (id, definition_id, dataset_id, schema_id, status, dry_run, total, imported, failed, errors, started_at, completed_at)
      VALUES
        (${run.id}::uuid, ${run.definitionId}, ${run.datasetId}, ${run.schemaId},
         ${run.status}, ${run.dryRun}, ${run.total}, ${run.imported}, ${run.failed},
         ${run.errors as never}, ${run.startedAt}, ${run.completedAt})
    `;
	}

	async updateImportRun(
		id: string,
		patch: Partial<ImportRunRecord>,
	): Promise<void> {
		const sets: string[] = [];
		const params: unknown[] = [];

		const push = (col: string, value: unknown) => {
			params.push(value);
			sets.push(`${col} = $${params.length}`);
		};

		if (patch.status !== undefined) push("status", patch.status);
		if (patch.total !== undefined) push("total", patch.total);
		if (patch.imported !== undefined) push("imported", patch.imported);
		if (patch.failed !== undefined) push("failed", patch.failed);
		if (patch.completedAt !== undefined)
			push("completed_at", patch.completedAt);
		if (patch.errors !== undefined)
			push("errors", JSON.stringify(patch.errors));

		if (sets.length === 0) return;
		params.push(id);
		await this.sql.unsafe(
			`UPDATE aurii_import_runs SET ${sets.join(", ")} WHERE id = $${params.length}::uuid`,
			params as never[],
		);
	}

	async listImportRuns(
		datasetId?: string,
		limit = 20,
	): Promise<ImportRunRecord[]> {
		const rows = datasetId
			? await this.sql`
          SELECT * FROM aurii_import_runs WHERE dataset_id = ${datasetId}
          ORDER BY created_at DESC LIMIT ${limit}`
			: await this
					.sql`SELECT * FROM aurii_import_runs ORDER BY created_at DESC LIMIT ${limit}`;

		return rows.map((r: Record<string, unknown>) => ({
			id: r["id"] as string,
			definitionId: r["definition_id"] as string | null,
			datasetId: r["dataset_id"] as string | null,
			schemaId: r["schema_id"] as string | null,
			status: r["status"] as ImportRunRecord["status"],
			dryRun: r["dry_run"] as boolean,
			total: r["total"] as number,
			imported: r["imported"] as number,
			failed: r["failed"] as number,
			errors: jsonb<unknown[]>(r["errors"] ?? []),
			startedAt: r["started_at"] ? ts(r["started_at"] as string | Date) : null,
			completedAt: r["completed_at"]
				? ts(r["completed_at"] as string | Date)
				: null,
			createdAt: ts(r["created_at"] as string | Date),
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

			const sample = await this.listEntities(schema.id, datasetId, 1000, 0);
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
