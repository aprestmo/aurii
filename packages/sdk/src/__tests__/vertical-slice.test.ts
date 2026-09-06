/**
 * SDK vertical slice against the generic external-product fixture.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "path";
import { buildApp } from "../../../core/src/api/server";
import { loadImportDefinition, runImport } from "../../../core/src/import/engine";
import { resetProjectService } from "../../../core/src/project/runtime";
import { registerSchema } from "../../../core/src/schema/registry";
import type { SchemaDefinition } from "../../../core/src/schema/types";
import { closeStorage, getStorage } from "../../../core/src/storage";
import { createClient } from "../index";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const DATASET = "catalog-sdk";
const MOCK_BASE = "http://localhost:3000";

const app = buildApp();
const originalFetch = globalThis.fetch;

beforeAll(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	resetProjectService();
	await closeStorage();

	const storage = await getStorage();
	await storage.init();
	await storage.createDataset({ id: DATASET, name: "SDK Catalog" });

	const schemas: SchemaDefinition[] = [
		{
			id: "region",
			name: "Region",
			fields: [
				{ name: "id", type: "string", required: true },
				{ name: "name", type: "string", required: true },
			],
		},
		{
			id: "city",
			name: "City",
			fields: [
				{ name: "id", type: "string", required: true },
				{ name: "name", type: "string", required: true },
				{ name: "regionId", type: "string", required: true },
			],
		},
	];
	for (const schema of schemas) {
		await registerSchema(schema, DATASET);
	}

	for (const name of ["regions", "cities"]) {
		const file = resolve(FIXTURE, "imports", `${name}.yaml`);
		const def = await loadImportDefinition(file);
		def.dataset = DATASET;
		await runImport(def, resolve(file, ".."), { datasetId: DATASET });
	}

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
	// @ts-expect-error — test fetch shim
	globalThis.fetch = mockFetch;
});

afterAll(async () => {
	globalThis.fetch = originalFetch;
	await closeStorage();
	resetProjectService();
});

describe("SDK vertical slice — external catalog", () => {
	const client = createClient({
		baseUrl: MOCK_BASE,
		defaultDataset: DATASET,
	});

	test("health.check() returns ok", async () => {
		const health = await client.health.check();
		expect(health.status).toBe("ok");
	});

	test("schemas.list() includes region and city", async () => {
		const ids = (await client.schemas.list()).map((s) => s.id);
		expect(ids).toContain("region");
		expect(ids).toContain("city");
	});

	test("entities.list() returns cities", async () => {
		const page = await client.entities.list("city", { limit: 5 });
		expect(page.entities.length).toBe(3);
		expect(page.total).toBe(3);
	});

	test("query.run() filters by regionId", async () => {
		const result = await client.query.run('FROM city WHERE regionId == "north"');
		expect(result.entities.length).toBe(2);
		expect(result.entities.every((e) => e.data["regionId"] === "north")).toBe(
			true,
		);
	});

	test("query.run() with sorting and limit", async () => {
		const result = await client.query.run("FROM region ORDER BY name ASC LIMIT 2");
		expect(result.entities.length).toBe(2);
		const names = result.entities.map((e) => e.data["name"] as string);
		expect(names).toEqual([...names].sort());
	});

	test("stats.get() returns entity counts", async () => {
		const stats = await client.stats.get();
		expect(stats.totalEntities).toBe(5);
	});

	test("import.history() records completed imports", async () => {
		const runs = await client.import.history();
		expect(runs.length).toBeGreaterThanOrEqual(2);
		expect(runs.some((r) => r.status === "completed")).toBe(true);
	});
});
