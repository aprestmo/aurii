/**
 * SQLite-backed PlatformStore — durable DataSources, saved imports,
 * published routes, tokens, secrets, and audit events.
 *
 * Uses the same AURII_DB_PATH file as entity storage when configured.
 * Secrets remain server-side only (never returned by services).
 */

import { Database } from "bun:sqlite";
import { join } from "node:path";
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

export class SqlitePlatformStore implements PlatformStore {
	readonly kind = "sqlite" as const;
	private db: Database;
	private runLocks = new Set<string>();

	constructor(path?: string) {
		const dbPath =
			path ?? process.env["AURII_DB_PATH"] ?? join(process.cwd(), "aurii.db");
		this.db = new Database(dbPath);
		this.db.exec("PRAGMA journal_mode=WAL;");
		this.db.exec("PRAGMA foreign_keys=ON;");
	}

	init(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS aurii_data_sources (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (project_id, id)
      );

      CREATE TABLE IF NOT EXISTS aurii_saved_imports (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        dataset_id TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (project_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_saved_imports_dataset
        ON aurii_saved_imports(project_id, dataset_id);

      CREATE TABLE IF NOT EXISTS aurii_published_routes (
        project_id TEXT NOT NULL,
        route_id TEXT NOT NULL,
        path TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL,
        PRIMARY KEY (project_id, route_id)
      );

      CREATE INDEX IF NOT EXISTS idx_published_routes_path
        ON aurii_published_routes(project_id, path, enabled);

      CREATE TABLE IF NOT EXISTS aurii_project_tokens (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL
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
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_project_created
        ON aurii_audit_events(project_id, created_at);
    `);
	}

	async insertDataSource(row: DataSource): Promise<DataSource> {
		this.db
			.prepare(
				`INSERT INTO aurii_data_sources (project_id, id, payload) VALUES (?, ?, ?)`,
			)
			.run(row.projectId, row.id, JSON.stringify(row));
		return clone(row);
	}

	async getDataSource(projectId: string, id: string): Promise<DataSource | null> {
		const r = this.db
			.prepare(
				`SELECT payload FROM aurii_data_sources WHERE project_id = ? AND id = ?`,
			)
			.get(projectId, id) as { payload: string } | null;
		return r ? clone(JSON.parse(r.payload) as DataSource) : null;
	}

	async listDataSources(projectId: string, datasetId?: string): Promise<DataSource[]> {
		const rows = this.db
			.prepare(`SELECT payload FROM aurii_data_sources WHERE project_id = ?`)
			.all(projectId) as Array<{ payload: string }>;
		return rows
			.map((r) => JSON.parse(r.payload) as DataSource)
			.filter((s) => !datasetId || s.datasetId === datasetId)
			.map(clone);
	}

	async updateDataSource(
		projectId: string,
		id: string,
		row: DataSource,
	): Promise<DataSource | null> {
		const existing = await this.getDataSource(projectId, id);
		if (!existing) return null;
		this.db
			.prepare(
				`UPDATE aurii_data_sources SET payload = ? WHERE project_id = ? AND id = ?`,
			)
			.run(JSON.stringify(row), projectId, id);
		return clone(row);
	}

	async deleteDataSource(projectId: string, id: string): Promise<boolean> {
		const res = this.db
			.prepare(`DELETE FROM aurii_data_sources WHERE project_id = ? AND id = ?`)
			.run(projectId, id);
		return res.changes > 0;
	}

	async insertSavedImport(row: SavedImportDefinition): Promise<SavedImportDefinition> {
		this.db
			.prepare(
				`INSERT INTO aurii_saved_imports (project_id, id, dataset_id, payload) VALUES (?, ?, ?, ?)`,
			)
			.run(row.projectId, row.id, row.datasetId, JSON.stringify(row));
		return clone(row);
	}

	async getSavedImport(
		projectId: string,
		id: string,
	): Promise<SavedImportDefinition | null> {
		const r = this.db
			.prepare(
				`SELECT payload FROM aurii_saved_imports WHERE project_id = ? AND id = ?`,
			)
			.get(projectId, id) as { payload: string } | null;
		return r ? clone(JSON.parse(r.payload) as SavedImportDefinition) : null;
	}

	async listSavedImports(
		projectId: string,
		datasetId?: string,
	): Promise<SavedImportDefinition[]> {
		const rows = this.db
			.prepare(`SELECT payload FROM aurii_saved_imports WHERE project_id = ?`)
			.all(projectId) as Array<{ payload: string }>;
		return rows
			.map((r) => JSON.parse(r.payload) as SavedImportDefinition)
			.filter((s) => !datasetId || s.datasetId === datasetId)
			.map(clone);
	}

	async updateSavedImport(
		projectId: string,
		id: string,
		row: SavedImportDefinition,
	): Promise<SavedImportDefinition | null> {
		const existing = await this.getSavedImport(projectId, id);
		if (!existing) return null;
		this.db
			.prepare(
				`UPDATE aurii_saved_imports SET dataset_id = ?, payload = ? WHERE project_id = ? AND id = ?`,
			)
			.run(row.datasetId, JSON.stringify(row), projectId, id);
		return clone(row);
	}

	async deleteSavedImport(projectId: string, id: string): Promise<boolean> {
		const res = this.db
			.prepare(`DELETE FROM aurii_saved_imports WHERE project_id = ? AND id = ?`)
			.run(projectId, id);
		return res.changes > 0;
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
		this.db
			.prepare(
				`INSERT INTO aurii_published_routes (project_id, route_id, path, enabled, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id, route_id) DO UPDATE SET
           path = excluded.path,
           enabled = excluded.enabled,
           payload = excluded.payload`,
			)
			.run(
				row.projectId,
				row.routeId,
				row.definition.path,
				row.enabled ? 1 : 0,
				JSON.stringify(row),
			);
		return clone(row);
	}

	async getPublishedRoute(
		projectId: string,
		routeId: string,
	): Promise<PublishedRouteState | null> {
		const r = this.db
			.prepare(
				`SELECT payload FROM aurii_published_routes WHERE project_id = ? AND route_id = ?`,
			)
			.get(projectId, routeId) as { payload: string } | null;
		return r ? clone(JSON.parse(r.payload) as PublishedRouteState) : null;
	}

	async listPublishedRoutes(projectId: string): Promise<PublishedRouteState[]> {
		const rows = this.db
			.prepare(`SELECT payload FROM aurii_published_routes WHERE project_id = ?`)
			.all(projectId) as Array<{ payload: string }>;
		return rows.map((r) => clone(JSON.parse(r.payload) as PublishedRouteState));
	}

	async deletePublishedRoute(projectId: string, routeId: string): Promise<boolean> {
		const res = this.db
			.prepare(
				`DELETE FROM aurii_published_routes WHERE project_id = ? AND route_id = ?`,
			)
			.run(projectId, routeId);
		return res.changes > 0;
	}

	async findEnabledRouteByPath(
		projectId: string,
		path: string,
	): Promise<PublishedRouteState | null> {
		const rows = this.db
			.prepare(
				`SELECT payload FROM aurii_published_routes WHERE project_id = ? AND enabled = 1`,
			)
			.all(projectId) as Array<{ payload: string }>;
		for (const r of rows) {
			const row = JSON.parse(r.payload) as PublishedRouteState;
			if (row.definition.path === path) return clone(row);
		}
		return null;
	}

	async insertToken(row: ProjectToken): Promise<ProjectToken> {
		this.db
			.prepare(
				`INSERT INTO aurii_project_tokens (id, project_id, token_hash, payload) VALUES (?, ?, ?, ?)`,
			)
			.run(row.id, row.projectId, row.tokenHash, JSON.stringify(row));
		return clone(row);
	}

	async findTokenByHash(tokenHash: string): Promise<ProjectToken | null> {
		const r = this.db
			.prepare(
				`SELECT payload FROM aurii_project_tokens WHERE token_hash = ?`,
			)
			.get(tokenHash) as { payload: string } | null;
		if (!r) return null;
		const token = JSON.parse(r.payload) as ProjectToken;
		if (token.revokedAt) return null;
		return clone(token);
	}

	async listTokens(projectId: string): Promise<ProjectToken[]> {
		const rows = this.db
			.prepare(`SELECT payload FROM aurii_project_tokens WHERE project_id = ?`)
			.all(projectId) as Array<{ payload: string }>;
		return rows.map((r) => clone(JSON.parse(r.payload) as ProjectToken));
	}

	async revokeToken(projectId: string, id: string): Promise<ProjectToken | null> {
		const r = this.db
			.prepare(`SELECT payload FROM aurii_project_tokens WHERE id = ?`)
			.get(id) as { payload: string } | null;
		if (!r) return null;
		const token = JSON.parse(r.payload) as ProjectToken;
		if (token.projectId !== projectId) return null;
		const next = { ...token, revokedAt: new Date().toISOString() };
		this.db
			.prepare(`UPDATE aurii_project_tokens SET payload = ? WHERE id = ?`)
			.run(JSON.stringify(next), id);
		return clone(next);
	}

	async putSecret(secretId: string, value: string): Promise<void> {
		this.db
			.prepare(
				`INSERT INTO aurii_secrets (secret_id, value) VALUES (?, ?)
         ON CONFLICT(secret_id) DO UPDATE SET value = excluded.value`,
			)
			.run(secretId, value);
	}

	async getSecret(secretId: string): Promise<string | null> {
		const r = this.db
			.prepare(`SELECT value FROM aurii_secrets WHERE secret_id = ?`)
			.get(secretId) as { value: string } | null;
		return r?.value ?? null;
	}

	async deleteSecret(secretId: string): Promise<boolean> {
		const res = this.db
			.prepare(`DELETE FROM aurii_secrets WHERE secret_id = ?`)
			.run(secretId);
		return res.changes > 0;
	}

	async appendAudit(event: AuditEvent): Promise<void> {
		this.db
			.prepare(
				`INSERT INTO aurii_audit_events (id, project_id, created_at, payload) VALUES (?, ?, ?, ?)`,
			)
			.run(event.id, event.projectId, event.createdAt, JSON.stringify(event));
	}

	async listAudit(projectId: string, limit = 100): Promise<AuditEvent[]> {
		const rows = this.db
			.prepare(
				`SELECT payload FROM aurii_audit_events
         WHERE project_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
			)
			.all(projectId, limit) as Array<{ payload: string }>;
		return rows.map((r) => clone(JSON.parse(r.payload) as AuditEvent));
	}

	close(): void {
		this.db.close();
	}
}

/**
 * Create and initialize a durable platform store when AURII_DB_PATH is a
 * real file. Returns null for :memory: / explicit memory mode (tests).
 */
export function createDurablePlatformStore(
	path?: string,
): SqlitePlatformStore | null {
	if (process.env["AURII_PLATFORM_STORE"] === "memory") return null;
	const dbPath =
		path ?? process.env["AURII_DB_PATH"] ?? join(process.cwd(), "aurii.db");
	if (dbPath === ":memory:") return null;
	const store = new SqlitePlatformStore(dbPath);
	store.init();
	return store;
}
