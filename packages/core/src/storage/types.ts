import type { Entity, EntityInput } from "../entity/types";
import type { ParsedQuery } from "../query/parser";
import type { SchemaDefinition, StoredSchema } from "../schema/types";

export const DEFAULT_DATASET = "default";

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

export interface SchemaStats {
	schemaId: string;
	name: string;
	count: number;
	/** Percentage (0-100) of entities where each field is populated */
	fieldCoverage: { field: string; pct: number }[];
}

export interface StorageStats {
	datasetId: string;
	totalEntities: number;
	schemas: SchemaStats[];
}

export interface UpsertByFieldResult {
	inserted: number;
	updated: number;
}

/**
 * Storage adapter contract.
 *
 * The Query Language parser produces a storage-agnostic AST (ParsedQuery).
 * Each adapter translates that AST into its own SQL dialect.
 * No layer above this interface may know which storage engine is active.
 */
export interface StorageAdapter {
	readonly kind: "sqlite" | "postgres";

	init(): Promise<void>;
	close(): Promise<void>;

	// Datasets
	createDataset(input: DatasetInput): Promise<Dataset>;
	getDataset(id: string): Promise<Dataset | null>;
	listDatasets(): Promise<Dataset[]>;

	// Schemas
	upsertSchema(def: SchemaDefinition, datasetId: string): Promise<StoredSchema>;
	getSchema(id: string, datasetId: string): Promise<StoredSchema | null>;
	listSchemas(datasetId?: string): Promise<StoredSchema[]>;
	deleteSchema(id: string, datasetId: string): Promise<boolean>;

	// Entities
	insertEntities(inputs: EntityInput[], datasetId: string): Promise<Entity[]>;
	/**
	 * Upsert entities by a natural key field.
	 *
	 * For each input, if an entity with the same value in `fieldName` already
	 * exists (same schema + dataset), its `data` is updated in-place.
	 * Otherwise a new entity is inserted.  This is the foundation for
	 * idempotent imports: running the same import twice never creates duplicates.
	 */
	upsertEntitiesByField(
		inputs: EntityInput[],
		datasetId: string,
		fieldName: string,
	): Promise<UpsertByFieldResult>;
	getEntity(id: string): Promise<Entity | null>;
	listEntities(
		schemaId: string,
		datasetId: string,
		limit?: number,
		offset?: number,
	): Promise<Entity[]>;
	countEntities(schemaId: string, datasetId: string): Promise<number>;

	// Query
	executeQuery(query: ParsedQuery, datasetId: string): Promise<Entity[]>;

	// Import runs
	recordImportRun(run: Omit<ImportRunRecord, "createdAt">): Promise<void>;
	updateImportRun(id: string, patch: Partial<ImportRunRecord>): Promise<void>;
	listImportRuns(
		datasetId?: string,
		limit?: number,
	): Promise<ImportRunRecord[]>;

	// Dashboard
	getStats(datasetId: string): Promise<StorageStats>;
}
