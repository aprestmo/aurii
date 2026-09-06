/**
 * Explicit history vocabulary — prevent conflation of the four history kinds.
 * See docs/HISTORY_MODEL.md.
 *
 * These types are architectural boundaries. Do not introduce a generic
 * HistoryEntry that hides which semantic is intended.
 */

/** Provenance: where did this value/data originate? (ADR-0019) */
export interface ProvenanceRecord {
	kind: "provenance";
	/** Upstream / source system identifier when known. */
	sourceId?: string;
	/** Import run that produced or last refreshed the value. */
	importRunId?: string;
	upstreamId?: string;
	sourceTimestamp?: string;
	transform?: string;
	editorialOverride?: boolean;
}

/** Audit: who/what performed an operation? Not a snapshot store. */
export interface AuditHistoryRecord {
	kind: "audit";
	action: string;
	actor: string;
	resourceType: string;
	resourceId: string;
	timestamp: string;
	detail?: unknown;
}

/** Revision: durable entity state at entityRevision N. */
export interface RevisionHistoryRecord {
	kind: "revision";
	entityId: string;
	entityRevision: number;
	schemaVersion: number;
	recordedAt: string;
}

/**
 * Publication: exact state exposed to consumers.
 * Architecturally reserved — full publication workflow is Phase 5.
 */
export interface PublicationHistoryRecord {
	kind: "publication";
	publicationId: string;
	/** Immutable entity revision this publication pointed at. */
	publishedRevision: number;
	entityId: string;
	publishedAt: string;
}

export type HistoryKind =
	| ProvenanceRecord["kind"]
	| AuditHistoryRecord["kind"]
	| RevisionHistoryRecord["kind"]
	| PublicationHistoryRecord["kind"];

/** Compile-time guard: these kinds must remain distinct string literals. */
export const HISTORY_KINDS = [
	"provenance",
	"audit",
	"revision",
	"publication",
] as const satisfies readonly HistoryKind[];
