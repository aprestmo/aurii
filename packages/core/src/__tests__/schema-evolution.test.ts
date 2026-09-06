/**
 * Schema evolution contract tests (Pre–Phase 5).
 * See docs/SCHEMA_EVOLUTION.md and ADR-0021.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	createEntity,
	getEntity,
	getEntityRevision,
	registerSchema,
	registerSchemaDetailed,
	resetProjectService,
} from "../index";
import { classifySchemaChange } from "../schema/evolution";

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

const v1 = {
	id: "note",
	name: "Note",
	version: 1,
	fields: [
		{ name: "title", type: "string" as const, required: true },
		{ name: "body", type: "string" as const },
	],
};

describe("schema evolution", () => {
	it("keeps an entity readable after a newer schema version is registered", async () => {
		await registerSchema(v1);
		const entity = await createEntity({
			schemaId: "note",
			data: { title: "Hello", body: "World" },
		});
		expect(entity.schemaVersion).toBe(1);

		const v2 = {
			...v1,
			fields: [
				...v1.fields,
				{ name: "subtitle", type: "string" as const },
			],
		};
		const detailed = await registerSchemaDetailed(v2);
		expect(detailed.schema.version).toBeGreaterThanOrEqual(2);
		expect(detailed.change?.kind).toBe("compatible");

		const reloaded = await getEntity(entity.id);
		expect(reloaded).not.toBeNull();
		expect(reloaded!.data["title"]).toBe("Hello");
		expect(reloaded!.schemaVersion).toBe(1);
	});

	it("does not invalidate entities when an optional field is added", async () => {
		await registerSchema(v1);
		const entity = await createEntity({
			schemaId: "note",
			data: { title: "A", body: "B" },
		});
		await registerSchema({
			...v1,
			fields: [...v1.fields, { name: "tag", type: "string" }],
		});
		const reloaded = await getEntity(entity.id);
		expect(reloaded!.data).toEqual({ title: "A", body: "B" });
	});

	it("detects breaking schema changes rather than treating them as compatible", () => {
		const next = {
			...v1,
			fields: [{ name: "title", type: "number" as const, required: true }],
		};
		const classification = classifySchemaChange(v1, next);
		expect(classification.kind).toBe("breaking");
		expect(classification.reasons.length).toBeGreaterThan(0);
	});

	it("detects field removal as breaking", () => {
		const next = {
			...v1,
			fields: [{ name: "title", type: "string" as const, required: true }],
		};
		expect(classifySchemaChange(v1, next).kind).toBe("breaking");
	});

	it("retains original schemaVersion on historical revisions", async () => {
		await registerSchema(v1);
		const entity = await createEntity({
			schemaId: "note",
			data: { title: "v1", body: "x" },
		});
		const snap = await getEntityRevision(entity.id, 1);
		expect(snap?.schemaVersion).toBe(1);

		await registerSchema({
			...v1,
			fields: [...v1.fields, { name: "extra", type: "string" }],
		});
		const after = await getEntityRevision(entity.id, 1);
		expect(after?.schemaVersion).toBe(1);
		expect(after?.data["title"]).toBe("v1");
	});

	it("persists schemaVersion across storage reload", async () => {
		await registerSchema(v1);
		const entity = await createEntity({
			schemaId: "note",
			data: { title: "Persist", body: "me" },
		});
		await closeStorage();
		// Re-open same in-memory DB is impossible; use file DB for this case.
		const path = `/tmp/aurii-schema-version-${crypto.randomUUID()}.db`;
		process.env["AURII_DB_PATH"] = path;
		await registerSchema(v1);
		const created = await createEntity({
			schemaId: "note",
			data: { title: "Persist", body: "me" },
		});
		expect(created.schemaVersion).toBe(1);
		await closeStorage();
		process.env["AURII_DB_PATH"] = path;
		const reloaded = await getEntity(created.id);
		expect(reloaded?.schemaVersion).toBe(1);
		expect(entity.id).toBeTruthy();
	});
});
