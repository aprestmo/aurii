/**
 * Live vs pinned reference resolution (Pre–Phase 5).
 * See docs/TEMPORAL_REFERENCES.md and ADR-0023.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	createEntity,
	getEntity,
	getEntityRevision,
	registerSchema,
	resetProjectService,
	updateEntity,
} from "../index";
import { isLiveEntityRef, isPinnedEntityRef, type EntityRef } from "../entity/refs";

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	delete process.env["DATABASE_URL"];
	resetProjectService();
	await closeStorage().catch(() => undefined);
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
});

describe("temporal / live vs pinned references", () => {
	it("live reference resolves current state; pinned resolves immutable historical state", async () => {
		await registerSchema({
			id: "municipality",
			name: "Municipality",
			fields: [
				{ name: "id", type: "string", required: true },
				{ name: "name", type: "string", required: true },
			],
		});
		const entity = await createEntity({
			schemaId: "municipality",
			data: { id: "5001", name: "Trondheim" },
		});

		const liveRef: EntityRef = {
			mode: "live",
			schema: "municipality",
			id: "5001",
		};
		const pinnedRef: EntityRef = {
			mode: "pinned",
			schema: "municipality",
			id: "5001",
			entityRevision: 1,
		};
		expect(isLiveEntityRef(liveRef)).toBe(true);
		expect(isPinnedEntityRef(pinnedRef)).toBe(true);

		await updateEntity(entity.id, {
			data: { id: "5001", name: "Trondheim kommune" },
			expectedRevision: 1,
		});

		const live = await getEntity(entity.id);
		expect(live!.data["name"]).toBe("Trondheim kommune");
		expect(live!.entityRevision).toBe(2);

		const pinned = await getEntityRevision(entity.id, 1);
		expect(pinned!.data["name"]).toBe("Trondheim");
		expect(pinned!.entityRevision).toBe(1);

		// Updating again must not mutate the pinned revision 1 result.
		await updateEntity(entity.id, {
			data: { id: "5001", name: "Something else" },
			expectedRevision: 2,
		});
		const pinnedAgain = await getEntityRevision(entity.id, 1);
		expect(pinnedAgain!.data["name"]).toBe("Trondheim");
		expect((await getEntity(entity.id))!.data["name"]).toBe("Something else");
	});
});
