/**
 * DataSource — origin of data flowing into Aurii Core.
 *
 * Core is the system of record. A DataSource describes where data comes from
 * (file, HTTP, database, manual Studio ops, automation, external product, …).
 * Secrets never appear on public API responses — use SecretRef for server-side only.
 */

export type DataSourceKind =
	| "file"
	| "http"
	| "database"
	| "manual"
	| "product"
	| "automation"
	| "other";

export const DATA_SOURCE_KINDS: readonly DataSourceKind[] = [
	"file",
	"http",
	"database",
	"manual",
	"product",
	"automation",
	"other",
] as const;

export type DataSourceStatus = "active" | "paused" | "error" | "disabled";

export const DATA_SOURCE_STATUSES: readonly DataSourceStatus[] = [
	"active",
	"paused",
	"error",
	"disabled",
] as const;

/** Opaque reference to a secret stored server-side. Never return the secret value. */
export interface SecretRef {
	/** Stable id of the secret vault entry. */
	secretId: string;
	/** Human label for Studio (e.g. "Bring API key"). */
	label?: string;
}

/**
 * Non-secret configuration for a data source.
 * Kind-specific fields live under `options`; secrets use SecretRef only.
 */
export interface DataSourceConfig {
	/** Target schema ids this source writes to (documentation + Studio). */
	targetSchemas?: string[];
	/** Public URL or path description (never credentials). */
	endpoint?: string;
	/** File glob or relative path for file sources. */
	path?: string;
	/** Linked saved import / sync definition ids. */
	definitionIds?: string[];
	/** Opaque non-secret options. */
	options?: Record<string, unknown>;
	/** Server-side secret references (ids only on read). */
	secrets?: SecretRef[];
}

export interface DataSource {
	id: string;
	projectId: string;
	datasetId: string;
	name: string;
	kind: DataSourceKind;
	status: DataSourceStatus;
	config: DataSourceConfig;
	/** Last successful run (ISO), if any. */
	lastSuccessAt: string | null;
	/** Last failed run (ISO), if any. */
	lastFailureAt: string | null;
	/** Next scheduled run (ISO), if any. */
	nextRunAt: string | null;
	/** Last error message (no secrets). */
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDataSourceInput {
	id?: string;
	datasetId: string;
	name: string;
	kind: DataSourceKind;
	status?: DataSourceStatus;
	config?: DataSourceConfig;
}

export interface UpdateDataSourceInput {
	name?: string;
	kind?: DataSourceKind;
	status?: DataSourceStatus;
	config?: DataSourceConfig;
	lastSuccessAt?: string | null;
	lastFailureAt?: string | null;
	nextRunAt?: string | null;
	lastError?: string | null;
}

export function isDataSourceKind(value: unknown): value is DataSourceKind {
	return (
		typeof value === "string" &&
		(DATA_SOURCE_KINDS as readonly string[]).includes(value)
	);
}

export function isDataSourceStatus(value: unknown): value is DataSourceStatus {
	return (
		typeof value === "string" &&
		(DATA_SOURCE_STATUSES as readonly string[]).includes(value)
	);
}
