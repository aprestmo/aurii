/**
 * Phase 2.2 — SDK vertical slice tests.
 *
 * Exercises @aurii/sdk against the Norwegian geographic dataset workflow:
 * dataset creation, schema registration, import, query, stats.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "path";
import { buildApp } from "../../../core/src/api/server";
import { loadImportDefinition, runImport } from "../../../core/src/import/engine";
import { registerSchema } from "../../../core/src/schema/registry";
import type { SchemaDefinition } from "../../../core/src/schema/types";
import { closeStorage, getStorage } from "../../../core/src/storage";
import { createClient } from "../index";

const ROOT = resolve(import.meta.dir, "../../../..");
const DEMO = resolve(ROOT, "demo/norwegian-geo");
const DATASET = "norwegian-geo-sdk";
const MOCK_BASE = "http://localhost:3000";

const app = buildApp();
const originalFetch = globalThis.fetch;

beforeAll(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";

	const storage = await getStorage();
	await storage.init();
	await storage.createDataset({ id: DATASET, name: "SDK Norwegian Geo" });

	const schemas: SchemaDefinition[] = [
		{
			id: "county",
			name: "County",
			fields: [
				{ name: "id", type: "string", required: true },
				{ name: "name", type: "string", required: true },
			],
		},
		{
			id: "municipality",
			name: "Municipality",
			fields: [
				{ name: "id", type: "string", required: true },
				{ name: "name", type: "string", required: true },
				{ name: "countyId", type: "string", required: true },
			],
		},
	];

	for (const schema of schemas) {
		await registerSchema(schema, DATASET);
	}

	const countyDef = await loadImportDefinition(
		resolve(DEMO, "imports/counties.yaml"),
	);
	const munDef = await loadImportDefinition(
		resolve(DEMO, "imports/municipalities.yaml"),
	);
	// Override dataset for SDK test isolation
	countyDef.dataset = DATASET;
	munDef.dataset = DATASET;
	await runImport(countyDef, resolve(DEMO, "imports"));
	await runImport(munDef, resolve(DEMO, "imports"));

	const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: (input as Request).url;
		if (url.startsWith(MOCK_BASE)) {
			return app.handle(new Request(url, init as RequestInit));
		}
		return originalFetch(input as RequestInfo, init);
	};
	// @ts-expect-error — replacing with a compatible subset for testing
	globalThis.fetch = mockFetch;
});

afterAll(async () => {
	globalThis.fetch = originalFetch;
	await closeStorage();
});

describe("SDK vertical slice — Norwegian geo workflow", () => {
	const client = createClient({
		baseUrl: MOCK_BASE,
		defaultDataset: DATASET,
	});

	test("health.check() returns ok", async () => {
		const health = await client.health.check();
		expect(health.status).toBe("ok");
	});

	test("schemas.list() includes county and municipality", async () => {
		const schemas = await client.schemas.list();
		const ids = schemas.map((s) => s.id);
		expect(ids).toContain("county");
		expect(ids).toContain("municipality");
	});

	test("entities.list() returns municipalities", async () => {
		const page = await client.entities.list("municipality", { limit: 5 });
		expect(page.entities.length).toBe(5);
		expect(page.total).toBeGreaterThanOrEqual(300);
	});

	test("query.run() filters by countyId", async () => {
		const result = await client.query.run(
			'FROM municipality WHERE countyId == "03"',
		);
		expect(result.entities.length).toBeGreaterThanOrEqual(1);
		expect(
			result.entities.every((e) => e.data["countyId"] === "03"),
		).toBe(true);
	});

	test("query.run() with sorting and limit", async () => {
		const result = await client.query.run(
			"FROM county ORDER BY name ASC LIMIT 3",
		);
		expect(result.entities.length).toBe(3);
		const names = result.entities.map((e) => e.data["name"] as string);
		expect(names).toEqual([...names].sort());
	});

	test("stats.get() returns entity counts", async () => {
		const stats = await client.stats.get();
		expect(stats.totalEntities).toBeGreaterThanOrEqual(300);
	});

	test("import.history() records completed imports", async () => {
		const runs = await client.import.history();
		expect(runs.length).toBeGreaterThanOrEqual(2);
		expect(runs.some((r) => r.status === "completed")).toBe(true);
	});
});
