/**
 * In-memory platform store for DataSources, saved imports, published routes,
 * project tokens, secrets, and audit events.
 */

import type {
	AuditEvent,
	DataSource,
	ProjectToken,
	PublishedRouteState,
	SavedImportDefinition,
} from "@aurii/types";

export type PlatformStoreMode = "memory" | "sqlite";

export interface PlatformStore {
	/** How platform ops (sources, schedules, routes) are persisted. */
	readonly kind: PlatformStoreMode;

	// Data sources
	insertDataSource(row: DataSource): Promise<DataSource>;
	getDataSource(projectId: string, id: string): Promise<DataSource | null>;
	listDataSources(projectId: string, datasetId?: string): Promise<DataSource[]>;
	updateDataSource(projectId: string, id: string, row: DataSource): Promise<DataSource | null>;
	deleteDataSource(projectId: string, id: string): Promise<boolean>;

	// Saved imports
	insertSavedImport(row: SavedImportDefinition): Promise<SavedImportDefinition>;
	getSavedImport(projectId: string, id: string): Promise<SavedImportDefinition | null>;
	listSavedImports(projectId: string, datasetId?: string): Promise<SavedImportDefinition[]>;
	updateSavedImport(
		projectId: string,
		id: string,
		row: SavedImportDefinition,
	): Promise<SavedImportDefinition | null>;
	deleteSavedImport(projectId: string, id: string): Promise<boolean>;

	/** Ids currently running (overlap prevention). */
	tryAcquireRunLock(definitionId: string): Promise<boolean>;
	releaseRunLock(definitionId: string): Promise<void>;

	// Published routes
	upsertPublishedRoute(row: PublishedRouteState): Promise<PublishedRouteState>;
	getPublishedRoute(projectId: string, routeId: string): Promise<PublishedRouteState | null>;
	listPublishedRoutes(projectId: string): Promise<PublishedRouteState[]>;
	deletePublishedRoute(projectId: string, routeId: string): Promise<boolean>;
	/** Lookup by project slug is done at service layer; store is by projectId. */
	findEnabledRouteByPath(
		projectId: string,
		path: string,
	): Promise<PublishedRouteState | null>;

	// Tokens
	insertToken(row: ProjectToken): Promise<ProjectToken>;
	findTokenByHash(tokenHash: string): Promise<ProjectToken | null>;
	listTokens(projectId: string): Promise<ProjectToken[]>;
	revokeToken(projectId: string, id: string): Promise<ProjectToken | null>;

	// Secrets (server-side only)
	putSecret(secretId: string, value: string): Promise<void>;
	getSecret(secretId: string): Promise<string | null>;
	deleteSecret(secretId: string): Promise<boolean>;

	// Audit
	appendAudit(event: AuditEvent): Promise<void>;
	listAudit(projectId: string, limit?: number): Promise<AuditEvent[]>;
}

function clone<T>(v: T): T {
	return structuredClone(v);
}

export class MemoryPlatformStore implements PlatformStore {
	readonly kind = "memory" as const;
	private sources = new Map<string, DataSource>();
	private imports = new Map<string, SavedImportDefinition>();
	private routes = new Map<string, PublishedRouteState>();
	private tokens = new Map<string, ProjectToken>();
	private secrets = new Map<string, string>();
	private audit: AuditEvent[] = [];
	private runLocks = new Set<string>();

	private key(projectId: string, id: string) {
		return `${projectId}::${id}`;
	}

	async insertDataSource(row: DataSource): Promise<DataSource> {
		this.sources.set(this.key(row.projectId, row.id), clone(row));
		return clone(row);
	}

	async getDataSource(projectId: string, id: string): Promise<DataSource | null> {
		const row = this.sources.get(this.key(projectId, id));
		return row ? clone(row) : null;
	}

	async listDataSources(projectId: string, datasetId?: string): Promise<DataSource[]> {
		return [...this.sources.values()]
			.filter(
				(s) => s.projectId === projectId && (!datasetId || s.datasetId === datasetId),
			)
			.map(clone);
	}

	async updateDataSource(
		projectId: string,
		id: string,
		row: DataSource,
	): Promise<DataSource | null> {
		const k = this.key(projectId, id);
		if (!this.sources.has(k)) return null;
		this.sources.set(k, clone(row));
		return clone(row);
	}

	async deleteDataSource(projectId: string, id: string): Promise<boolean> {
		return this.sources.delete(this.key(projectId, id));
	}

	async insertSavedImport(row: SavedImportDefinition): Promise<SavedImportDefinition> {
		this.imports.set(this.key(row.projectId, row.id), clone(row));
		return clone(row);
	}

	async getSavedImport(
		projectId: string,
		id: string,
	): Promise<SavedImportDefinition | null> {
		const row = this.imports.get(this.key(projectId, id));
		return row ? clone(row) : null;
	}

	async listSavedImports(
		projectId: string,
		datasetId?: string,
	): Promise<SavedImportDefinition[]> {
		return [...this.imports.values()]
			.filter(
				(s) => s.projectId === projectId && (!datasetId || s.datasetId === datasetId),
			)
			.map(clone);
	}

	async updateSavedImport(
		projectId: string,
		id: string,
		row: SavedImportDefinition,
	): Promise<SavedImportDefinition | null> {
		const k = this.key(projectId, id);
		if (!this.imports.has(k)) return null;
		this.imports.set(k, clone(row));
		return clone(row);
	}

	async deleteSavedImport(projectId: string, id: string): Promise<boolean> {
		return this.imports.delete(this.key(projectId, id));
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
		this.routes.set(this.key(row.projectId, row.routeId), clone(row));
		return clone(row);
	}

	async getPublishedRoute(
		projectId: string,
		routeId: string,
	): Promise<PublishedRouteState | null> {
		const row = this.routes.get(this.key(projectId, routeId));
		return row ? clone(row) : null;
	}

	async listPublishedRoutes(projectId: string): Promise<PublishedRouteState[]> {
		return [...this.routes.values()]
			.filter((r) => r.projectId === projectId)
			.map(clone);
	}

	async deletePublishedRoute(projectId: string, routeId: string): Promise<boolean> {
		return this.routes.delete(this.key(projectId, routeId));
	}

	async findEnabledRouteByPath(
		projectId: string,
		path: string,
	): Promise<PublishedRouteState | null> {
		for (const r of this.routes.values()) {
			if (r.projectId === projectId && r.enabled && r.definition.path === path) {
				return clone(r);
			}
		}
		return null;
	}

	async insertToken(row: ProjectToken): Promise<ProjectToken> {
		this.tokens.set(row.id, clone(row));
		return clone(row);
	}

	async findTokenByHash(tokenHash: string): Promise<ProjectToken | null> {
		for (const t of this.tokens.values()) {
			if (t.tokenHash === tokenHash && !t.revokedAt) return clone(t);
		}
		return null;
	}

	async listTokens(projectId: string): Promise<ProjectToken[]> {
		return [...this.tokens.values()]
			.filter((t) => t.projectId === projectId)
			.map((t) => clone(t));
	}

	async revokeToken(projectId: string, id: string): Promise<ProjectToken | null> {
		const t = this.tokens.get(id);
		if (!t || t.projectId !== projectId) return null;
		const next = { ...t, revokedAt: new Date().toISOString() };
		this.tokens.set(id, next);
		return clone(next);
	}

	async putSecret(secretId: string, value: string): Promise<void> {
		this.secrets.set(secretId, value);
	}

	async getSecret(secretId: string): Promise<string | null> {
		return this.secrets.get(secretId) ?? null;
	}

	async deleteSecret(secretId: string): Promise<boolean> {
		return this.secrets.delete(secretId);
	}

	async appendAudit(event: AuditEvent): Promise<void> {
		this.audit.push(clone(event));
	}

	async listAudit(projectId: string, limit = 100): Promise<AuditEvent[]> {
		return this.audit
			.filter((e) => e.projectId === projectId)
			.slice(-limit)
			.reverse()
			.map(clone);
	}
}

let defaultStore: PlatformStore | null = null;

export function getPlatformStore(): PlatformStore {
	if (!defaultStore) defaultStore = new MemoryPlatformStore();
	return defaultStore;
}

export function configurePlatformStore(store: PlatformStore): void {
	defaultStore = store;
}

export function resetPlatformStore(): void {
	defaultStore = new MemoryPlatformStore();
}
