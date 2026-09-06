export type EntityState = "active" | "archived" | "deleted";

export interface Entity {
	id: string;
	datasetId: string;
	schemaId: string;
	/**
	 * Schema version associated with this live entity state.
	 * Not the same as entityRevision. See docs/SCHEMA_EVOLUTION.md.
	 */
	schemaVersion: number;
	/**
	 * Monotonic optimistic-concurrency / pinned-addressing revision.
	 * Starts at 1. See ADR-0022.
	 */
	entityRevision: number;
	data: Record<string, unknown>;
	state: EntityState;
	createdAt: string;
	updatedAt: string;
}

export interface EntityInput {
	schemaId: string;
	data: Record<string, unknown>;
	state?: EntityState;
	/** Schema version to associate with the write; defaults to active schema version. */
	schemaVersion?: number;
}

export interface EntityUpdateInput {
	data: Record<string, unknown>;
	/** Required optimistic concurrency precondition. */
	expectedRevision: number;
	state?: EntityState;
	schemaVersion?: number;
}

export interface EntityPage {
	entities: Entity[];
	total: number;
	offset: number;
	limit: number | null;
}
