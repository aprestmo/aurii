/**
 * Live vs pinned entity reference contract.
 * See docs/TEMPORAL_REFERENCES.md and ADR-0023.
 */

export interface LiveEntityRef {
	mode: "live";
	schema: string;
	/** Natural key or entity UUID depending on product convention. */
	id: string;
}

export interface PinnedEntityRef {
	mode: "pinned";
	schema: string;
	id: string;
	entityRevision: number;
}

export type EntityRef = LiveEntityRef | PinnedEntityRef;

export function isPinnedEntityRef(ref: EntityRef): ref is PinnedEntityRef {
	return ref.mode === "pinned";
}

export function isLiveEntityRef(ref: EntityRef): ref is LiveEntityRef {
	return ref.mode === "live";
}
