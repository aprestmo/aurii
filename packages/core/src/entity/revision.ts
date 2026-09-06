import type { EntityState } from "./types";

/**
 * Durable snapshot of entity state at a specific entityRevision.
 *
 * This is revision history — not provenance, not audit, not publication.
 * See docs/HISTORY_MODEL.md.
 */
export interface EntityRevisionSnapshot {
	entityId: string;
	datasetId: string;
	schemaId: string;
	/** Schema version associated with this snapshot. */
	schemaVersion: number;
	/** Monotonic entity revision (concurrency + pinned addressing). */
	entityRevision: number;
	data: Record<string, unknown>;
	state: EntityState;
	/** When Aurii recorded this snapshot (system time). */
	recordedAt: string;
}

/**
 * Optimistic concurrency conflict — expectedRevision does not match current.
 * Not a generic "history" or validation error.
 */
export class ConcurrencyConflictError extends Error {
	readonly code = "concurrency_conflict" as const;
	readonly status = 409;

	constructor(
		readonly entityId: string,
		readonly expectedRevision: number,
		readonly currentRevision: number,
	) {
		super(
			`Concurrency conflict for entity "${entityId}": expected revision ${expectedRevision}, current is ${currentRevision}`,
		);
		this.name = "ConcurrencyConflictError";
	}
}

export function isConcurrencyConflictError(
	error: unknown,
): error is ConcurrencyConflictError {
	return error instanceof ConcurrencyConflictError;
}
