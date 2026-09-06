/**
 * Optimistic concurrency + entityRevision tests (Pre–Phase 5).
 * See ADR-0022.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	ConcurrencyConflictError,
	createEntity,
	getEntity,
	isConcurrencyConflictError,
	registerSchema,
	resetProjectService,
	updateEntity,
} from "../index";

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = `:memory:`;
	delete process.env["DATABASE_URL"];
	resetProjectService();
	await closeStorage().catch(() => undefined);
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
});

async function seed() {
	await registerSchema({
		id: "doc",
		name: "Doc",
		fields: [{ name: "title", type: "string", required: true }],
	});
	return createEntity({ schemaId: "doc", data: { title: "one" } });
}

describe("optimistic concurrency", () => {
	it("create → revision 1; update expected=1 → 2; stale → conflict; expected=2 → 3", async () => {
		const created = await seed();
		expect(created.entityRevision).toBe(1);

		const updated = await updateEntity(created.id, {
			data: { title: "two" },
			expectedRevision: 1,
		});
		expect(updated.entityRevision).toBe(2);
		expect(updated.data["title"]).toBe("two");

		await expect(
			updateEntity(created.id, {
				data: { title: "stale" },
				expectedRevision: 1,
			}),
		).rejects.toBeInstanceOf(ConcurrencyConflictError);

		const again = await updateEntity(created.id, {
			data: { title: "three" },
			expectedRevision: 2,
		});
		expect(again.entityRevision).toBe(3);
	});

	it("concurrent writes: exactly one succeeds", async () => {
		const created = await seed();
		const results = await Promise.allSettled([
			updateEntity(created.id, {
				data: { title: "A" },
				expectedRevision: 1,
			}),
			updateEntity(created.id, {
				data: { title: "B" },
				expectedRevision: 1,
			}),
		]);

		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter((r) => r.status === "rejected");
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(
			isConcurrencyConflictError(
				(rejected[0] as PromiseRejectedResult).reason,
			),
		).toBe(true);

		const live = await getEntity(created.id);
		expect(live!.entityRevision).toBe(2);
	});

	it("persists entityRevision across adapter restart (file sqlite)", async () => {
		const path = `/tmp/aurii-revision-${crypto.randomUUID()}.db`;
		process.env["AURII_DB_PATH"] = path;
		await registerSchema({
			id: "doc",
			name: "Doc",
			fields: [{ name: "title", type: "string", required: true }],
		});
		const created = await createEntity({
			schemaId: "doc",
			data: { title: "persist" },
		});
		await updateEntity(created.id, {
			data: { title: "persist-2" },
			expectedRevision: 1,
		});
		await closeStorage();

		process.env["AURII_DB_PATH"] = path;
		const reloaded = await getEntity(created.id);
		expect(reloaded?.entityRevision).toBe(2);
		expect(reloaded?.data["title"]).toBe("persist-2");
	});
});
