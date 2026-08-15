/**
 * PostgreSQL-backed PlatformStore — durable DataSources, saved imports,
 * published routes, tokens, secrets, and audit events.
 *
 * Used when DATABASE_URL is the primary ops database. Table shapes mirror
 * SqlitePlatformStore (JSONB payload + lookup columns). Secrets stay
 * server-side only. Run locks remain in-process (ADR-0018; HA is out of beta).
 */

import { SQL } from "bun";
import type {
	AuditEvent,
	DataSource,
	ProjectToken,
	PublishedRouteState,
	SavedImportDefinition,
} from "@aurii/types";
import type { PlatformStore } from "./store";

function clone<T>(v: T): T {
	return structuredClone(v);
}

/** Bun.sql may return JSONB as an object or a JSON string. */
function jsonb<T>(v: unknown): T {
	return (typeof v === "string" ? JSON.parse(v) : v) as T;
}

function deleted(result: unknown): boolean {
	return (result as { count?: number }).count! > 0;
}

export class PostgresPlatformStore implements PlatformStore {
	readonly kind = "postgres" as const;
	private sql: SQL;
	private ready: Promise<void>;
	private runLocks = new Set<string>();

	constructor(url?: string) {
		const connectionUrl = url ?? process.env["DATABASE_URL"];
		if (!connectionUrl) {
			throw new Error("PostgreSQL platform store requires DATABASE_URL");
		}
		this.sql = new SQL(connectionUrl);
		this.ready = this.init();
	}

	async init(): Promise<void> {
		await this.sql.unsafe(`
      CREATE TABLE IF NOT EXISTS aurii_data_sources (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        payload JSONB NOT NULL,
        PRIMARY KEY (project_id, id)
      );

      CREATE TABLE IF NOT EXISTS aurii_saved_imports (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        dataset_id TEXT,
        payload JSONB NOT NULL,
        PRIMARY KEY (project_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_saved_imports_dataset
        ON aurii_saved_imports(project_id, dataset_id);

      CREATE TABLE IF NOT EXISTS aurii_published_routes (
        project_id TEXT NOT NULL,
        route_id TEXT NOT NULL,
        path TEXT,
        enabled BOOLEAN NOT NULL DEFAULT false,
        payload JSONB NOT NULL,
        PRIMARY KEY (project_id, route_id)
      );

      CREATE INDEX IF NOT EXISTS idx_published_routes_path
        ON aurii_published_routes(project_id, path, enabled);

      CREATE TABLE IF NOT EXISTS aurii_project_tokens (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_project_tokens_project
        ON aurii_project_tokens(project_id);

      CREATE TABLE IF NOT EXISTS aurii_secrets (
        secret_id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS aurii_audit_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_project_created
        ON aurii_audit_events(project_id, created_at);
    `);
	}

	private async ensureInit(): Promise<void> {
		await this.ready;
	}

	async insertDataSource(row: DataSource): Promise<DataSource> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_data_sources (project_id, id, payload)
      VALUES (${row.projectId}, ${row.id}, ${row as never})
    `;
		return clone(row);
	}

	async getDataSource(projectId: string, id: string): Promise<DataSource | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_data_sources
      WHERE project_id = ${projectId} AND id = ${id}
    `;
		const row = rows[0] as { payload: unknown } | undefined;
		return row ? clone(jsonb<DataSource>(row.payload)) : null;
	}

	async listDataSources(projectId: string, datasetId?: string): Promise<DataSource[]> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_data_sources WHERE project_id = ${projectId}
    `;
		return (rows as Array<{ payload: unknown }>)
			.map((r) => jsonb<DataSource>(r.payload))
			.filter((s) => !datasetId || s.datasetId === datasetId)
			.map(clone);
	}

	async updateDataSource(
		projectId: string,
		id: string,
		row: DataSource,
	): Promise<DataSource | null> {
		await this.ensureInit();
		const existing = await this.getDataSource(projectId, id);
		if (!existing) return null;
		await this.sql`
      UPDATE aurii_data_sources
      SET payload = ${row as never}
      WHERE project_id = ${projectId} AND id = ${id}
    `;
		return clone(row);
	}

	async deleteDataSource(projectId: string, id: string): Promise<boolean> {
		await this.ensureInit();
		const result = await this.sql`
      DELETE FROM aurii_data_sources WHERE project_id = ${projectId} AND id = ${id}
    `;
		return deleted(result);
	}

	async insertSavedImport(row: SavedImportDefinition): Promise<SavedImportDefinition> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_saved_imports (project_id, id, dataset_id, payload)
      VALUES (${row.projectId}, ${row.id}, ${row.datasetId}, ${row as never})
    `;
		return clone(row);
	}

	async getSavedImport(
		projectId: string,
		id: string,
	): Promise<SavedImportDefinition | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_saved_imports
      WHERE project_id = ${projectId} AND id = ${id}
    `;
		const row = rows[0] as { payload: unknown } | undefined;
		return row ? clone(jsonb<SavedImportDefinition>(row.payload)) : null;
	}

	async listSavedImports(
		projectId: string,
		datasetId?: string,
	): Promise<SavedImportDefinition[]> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_saved_imports WHERE project_id = ${projectId}
    `;
		return (rows as Array<{ payload: unknown }>)
			.map((r) => jsonb<SavedImportDefinition>(r.payload))
			.filter((s) => !datasetId || s.datasetId === datasetId)
			.map(clone);
	}

	async updateSavedImport(
		projectId: string,
		id: string,
		row: SavedImportDefinition,
	): Promise<SavedImportDefinition | null> {
		await this.ensureInit();
		const existing = await this.getSavedImport(projectId, id);
		if (!existing) return null;
		await this.sql`
      UPDATE aurii_saved_imports
      SET dataset_id = ${row.datasetId}, payload = ${row as never}
      WHERE project_id = ${projectId} AND id = ${id}
    `;
		return clone(row);
	}

	async deleteSavedImport(projectId: string, id: string): Promise<boolean> {
		await this.ensureInit();
		const result = await this.sql`
      DELETE FROM aurii_saved_imports WHERE project_id = ${projectId} AND id = ${id}
    `;
		return deleted(result);
	}

	async tryAcquireRunLock(definitionId: string): Promise<boolean> {
		if (this.runLocks.has(definitionId)) return false;
		this.runLocks.add(definitionId);
		return true;
	}

	async releaseRunLock(definitionId: string): Promise<void> {
		this.runLocks.delete(definitionId);
	}

	async upsertPublishedRoute(row: PublishedRouteState): Promise<PublishedRouteState> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_published_routes (project_id, route_id, path, enabled, payload)
      VALUES (
        ${row.projectId},
        ${row.routeId},
        ${row.definition.path},
        ${row.enabled},
        ${row as never}
      )
      ON CONFLICT (project_id, route_id) DO UPDATE SET
        path = EXCLUDED.path,
        enabled = EXCLUDED.enabled,
        payload = EXCLUDED.payload
    `;
		return clone(row);
	}

	async getPublishedRoute(
		projectId: string,
		routeId: string,
	): Promise<PublishedRouteState | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_published_routes
      WHERE project_id = ${projectId} AND route_id = ${routeId}
    `;
		const row = rows[0] as { payload: unknown } | undefined;
		return row ? clone(jsonb<PublishedRouteState>(row.payload)) : null;
	}

	async listPublishedRoutes(projectId: string): Promise<PublishedRouteState[]> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_published_routes WHERE project_id = ${projectId}
    `;
		return (rows as Array<{ payload: unknown }>).map((r) =>
			clone(jsonb<PublishedRouteState>(r.payload)),
		);
	}

	async deletePublishedRoute(projectId: string, routeId: string): Promise<boolean> {
		await this.ensureInit();
		const result = await this.sql`
      DELETE FROM aurii_published_routes
      WHERE project_id = ${projectId} AND route_id = ${routeId}
    `;
		return deleted(result);
	}

	async findEnabledRouteByPath(
		projectId: string,
		path: string,
	): Promise<PublishedRouteState | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_published_routes
      WHERE project_id = ${projectId} AND enabled = true
    `;
		for (const r of rows as Array<{ payload: unknown }>) {
			const row = jsonb<PublishedRouteState>(r.payload);
			if (row.definition.path === path) return clone(row);
		}
		return null;
	}

	async insertToken(row: ProjectToken): Promise<ProjectToken> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_project_tokens (id, project_id, token_hash, payload)
      VALUES (${row.id}, ${row.projectId}, ${row.tokenHash}, ${row as never})
    `;
		return clone(row);
	}

	async findTokenByHash(tokenHash: string): Promise<ProjectToken | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_project_tokens WHERE token_hash = ${tokenHash}
    `;
		const row = rows[0] as { payload: unknown } | undefined;
		if (!row) return null;
		const token = jsonb<ProjectToken>(row.payload);
		if (token.revokedAt) return null;
		return clone(token);
	}

	async listTokens(projectId: string): Promise<ProjectToken[]> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_project_tokens WHERE project_id = ${projectId}
        `;
		return (rows as Array<{ payload: unknown }>).map((r) =>
			clone(jsonb<ProjectToken>(r.payload)),
		);
	}

	async revokeToken(projectId: string, id: string): Promise<ProjectToken | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_project_tokens WHERE id = ${id}
    `;
		const row = rows[0] as { payload: unknown } | undefined;
		if (!row) return null;
		const token = jsonb<ProjectToken>(row.payload);
		if (token.projectId !== projectId) return null;
		const next = { ...token, revokedAt: new Date().toISOString() };
		await this.sql`
      UPDATE aurii_project_tokens SET payload = ${next as never} WHERE id = ${id}
    `;
		return clone(next);
	}

	async putSecret(secretId: string, value: string): Promise<void> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_secrets (secret_id, value)
      VALUES (${secretId}, ${value})
      ON CONFLICT (secret_id) DO UPDATE SET value = EXCLUDED.value
    `;
	}

	async getSecret(secretId: string): Promise<string | null> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT value FROM aurii_secrets WHERE secret_id = ${secretId}
    `;
		const row = rows[0] as { value: string } | undefined;
		return row?.value ?? null;
	}

	async deleteSecret(secretId: string): Promise<boolean> {
		await this.ensureInit();
		const result = await this.sql`
      DELETE FROM aurii_secrets WHERE secret_id = ${secretId}
    `;
		return deleted(result);
	}

	async appendAudit(event: AuditEvent): Promise<void> {
		await this.ensureInit();
		await this.sql`
      INSERT INTO aurii_audit_events (id, project_id, created_at, payload)
      VALUES (${event.id}, ${event.projectId}, ${event.createdAt}, ${event as never})
    `;
	}

	async listAudit(projectId: string, limit = 100): Promise<AuditEvent[]> {
		await this.ensureInit();
		const rows = await this.sql`
      SELECT payload FROM aurii_audit_events
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
		return (rows as Array<{ payload: unknown }>).map((r) =>
			clone(jsonb<AuditEvent>(r.payload)),
		);
	}

	async close(): Promise<void> {
		await this.ready.catch(() => undefined);
		await this.sql.close();
	}
}
