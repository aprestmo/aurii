/**
 * History vocabulary separation (Pre–Phase 5).
 * See docs/HISTORY_MODEL.md.
 */

import { describe, expect, it } from "bun:test";
import { HISTORY_KINDS } from "../history/types";
import type {
	AuditHistoryRecord,
	ProvenanceRecord,
	PublicationHistoryRecord,
	RevisionHistoryRecord,
} from "../history/types";

describe("history model separation", () => {
	it("keeps four distinct history kinds", () => {
		expect(HISTORY_KINDS).toEqual([
			"provenance",
			"audit",
			"revision",
			"publication",
		]);
		expect(new Set(HISTORY_KINDS).size).toBe(4);
	});

	it("entityRevision is not an import run id", () => {
		const revision: RevisionHistoryRecord = {
			kind: "revision",
			entityId: "e1",
			entityRevision: 17,
			schemaVersion: 2,
			recordedAt: new Date().toISOString(),
		};
		const provenance: ProvenanceRecord = {
			kind: "provenance",
			importRunId: "import-run-abc",
			sourceId: "ssb",
		};
		expect(revision.entityRevision).not.toBe(provenance.importRunId as never);
		expect(revision.kind).not.toBe(provenance.kind);
		expect(typeof revision.entityRevision).toBe("number");
		expect(typeof provenance.importRunId).toBe("string");
	});

	it("provenance can change without implying a published version", () => {
		const provenance: ProvenanceRecord = {
			kind: "provenance",
			sourceId: "kartverket",
			importRunId: "run-1",
		};
		const publication: PublicationHistoryRecord = {
			kind: "publication",
			publicationId: "pub-1",
			publishedRevision: 5,
			entityId: "e1",
			publishedAt: new Date().toISOString(),
		};
		// Changing provenance metadata does not require touching publication.
		const updatedProvenance: ProvenanceRecord = {
			...provenance,
			importRunId: "run-2",
		};
		expect(updatedProvenance.importRunId).toBe("run-2");
		expect(publication.publishedRevision).toBe(5);
		expect(publication.kind).toBe("publication");
		expect(updatedProvenance.kind).toBe("provenance");
	});

	it("revision metadata exists independently of provenance", () => {
		const revision: RevisionHistoryRecord = {
			kind: "revision",
			entityId: "e1",
			entityRevision: 3,
			schemaVersion: 1,
			recordedAt: "2026-01-01T00:00:00Z",
		};
		const audit: AuditHistoryRecord = {
			kind: "audit",
			action: "entity.updated",
			actor: "studio",
			resourceType: "entity",
			resourceId: "e1",
			timestamp: "2026-01-01T00:00:00Z",
		};
		expect(revision.kind).toBe("revision");
		expect(audit.kind).toBe("audit");
		expect("importRunId" in revision).toBe(false);
		expect("entityRevision" in audit).toBe(false);
	});
});
