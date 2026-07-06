/**
 * Aurii SDK — shared type definitions.
 *
 * These mirror the HTTP API request/response shapes.
 * They are intentionally standalone (no import from @aurii/core) so the SDK
 * can be consumed by any environment: browser, Node.js, Bun, Deno, etc.
 */

// ── Datasets ─────────────────────────────────────────────────────────────────

export interface Dataset {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
}

export interface DatasetInput {
	id: string;
	name: string;
	description?: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

export type FieldType =
	| "string"
	| "number"
	| "boolean"
	| "date"
	| "reference"
	| "string[]"
	| "number[]";

export interface FieldDefinition {
	name: string;
	type: FieldType;
	required?: boolean;
	default?: unknown;
	reference?: string;
	description?: string;
}

export interface SchemaDefinition {
	id: string;
	name: string;
	description?: string;
	fields: FieldDefinition[];
}

export interface StoredSchema extends SchemaDefinition {
	datasetId: string;
	createdAt: string;
	updatedAt: string;
}

// ── Entities ──────────────────────────────────────────────────────────────────

export type EntityState = "active" | "archived" | "deleted";

export interface Entity {
	id: string;
	datasetId: string;
	schemaId: string;
	data: Record<string, unknown>;
	state: EntityState;
	createdAt: string;
	updatedAt: string;
}

export interface EntityPage {
	entities: Entity[];
	total: number;
	limit: number;
	offset: number;
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface FieldTransform {
	field: string;
	fn: string;
	args?: unknown[];
}

export interface ImportRunRequest {
	uploadId: string;
	filename?: string;
	schemaId: string;
	datasetId?: string;
	mapping: Record<string, string>;
	transforms?: FieldTransform[];
	dryRun?: boolean;
	delimiter?: string;
}

export interface ImportResult {
	definitionId: string;
	schemaId: string;
	datasetId: string;
	dryRun: boolean;
	total: number;
	imported: number;
	inserted: number;
	updated: number;
	failed: number;
	errors: Array<{ row: number; message: string; data: unknown }>;
	durationMs: number;
	sample?: Array<Record<string, unknown>>;
}

export interface ImportRunRecord {
	id: string;
	definitionId: string | null;
	datasetId: string | null;
	schemaId: string | null;
	status: "pending" | "running" | "completed" | "partial" | "failed";
	dryRun: boolean;
	total: number;
	imported: number;
	failed: number;
	errors: unknown[];
	startedAt: string | null;
	completedAt: string | null;
	createdAt: string;
}

export interface AnalysisResult {
	format: "csv" | "json";
	delimiter?: string;
	columns: string[];
	sample: Array<Record<string, unknown>>;
	rowCount: number;
	fieldTypes: Record<string, FieldType>;
}

export interface AnalyzeResponse extends AnalysisResult {
	uploadId: string;
	filename: string;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface QueryResult {
	entities: Entity[];
	total: number;
	query: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SchemaStats {
	schemaId: string;
	name: string;
	count: number;
	fieldCoverage: Array<{ field: string; pct: number }>;
}

export interface StorageStats {
	datasetId: string;
	totalEntities: number;
	schemas: SchemaStats[];
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
	status: "ok";
	phase: string;
	version: string;
	storage: "sqlite" | "postgres";
}

// ── SDK Config ────────────────────────────────────────────────────────────────

export interface AuriiClientConfig {
	/** Base URL of the Aurii Core HTTP API. */
	baseUrl: string;
	/** Bearer token for authentication. */
	token?: string;
	/** Default dataset to use when none is specified. */
	defaultDataset?: string;
}

export class AuriiError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
	) {
		super(message);
		this.name = "AuriiError";
	}
}
