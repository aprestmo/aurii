/**
 * Vertical-slice integration: schema → analyze → import → persist → query → REST.
 *
 * Uses the generic external-product fixture (Region / City), not Norwegian geography.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { buildApp } from "../api/server";
import { analyzeContent } from "../import/analyze";
import { loadImportDefinition, runImport } from "../import/engine";
import type { ImportDefinition } from "../import/types";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { resetProjectService } from "../project/runtime";
import { closeStorage, getStorage } from "../storage";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const DATASET = "catalog-slice";

const REGION_SCHEMA: SchemaDefinition = {
	id: "region",
	name: "Region",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
	],
};

const CITY_SCHEMA: SchemaDefinition = {
	id: "city",
	name: "City",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "regionId", type: "reference", to: "region", required: true },
	],
};

let uploadDir: string;

beforeEach(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	resetProjectService();
	uploadDir = await mkdtemp(join(tmpdir(), "aurii-vertical-"));
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
	await rm(uploadDir, { recursive: true, force: true });
});

async function setupDataset(): Promise<void> {
	const storage = await getStorage();
	await storage.createDataset({ id: DATASET, name: "Catalog" });
	await Promise.all([
		registerSchema(REGION_SCHEMA, DATASET),
		registerSchema(CITY_SCHEMA, DATASET),
	]);
}

async function importAll(): Promise<{ regions: number; cities: number }> {
	const importsDir = resolve(FIXTURE, "imports");
	const results = [];
	for (const name of ["regions", "cities"]) {
		const file = resolve(importsDir, `${name}.yaml`);
		const def = await loadImportDefinition(file);
		results.push(
			await runImport(def, resolve(file, ".."), { datasetId: DATASET }),
		);
	}
	return { regions: results[0]!.imported, cities: results[1]!.imported };
}

describe("1. Schema", () => {
	it("registers region and city schemas with a reference field", async () => {
		await setupDataset();
		const storage = await getStorage();
		const ids = (await storage.listSchemas(DATASET)).map((s) => s.id);
		expect(ids).toContain("region");
		expect(ids).toContain("city");
		const city = await storage.getSchema("city", DATASET);
		const regionField = city!.fields.find((f) => f.name === "regionId");
		expect(regionField?.type).toBe("reference");
		expect(regionField?.required).toBe(true);
	});
});

describe("2. Import analysis", () => {
	it("analyzes cities JSON", async () => {
		const content = await Bun.file(resolve(FIXTURE, "data/cities.json")).text();
		const analysis = analyzeContent("cities.json", content);
		expect(analysis.format).toBe("json");
		expect(analysis.columns).toContain("id");
		expect(analysis.columns).toContain("regionId");
		expect(analysis.rowCount).toBe(3);
	});
});

describe("3. Mapping & persist", () => {
	it("imports fixture rows and is idempotent on re-import", async () => {
		await setupDataset();
		const counts = await importAll();
		expect(counts.regions).toBe(2);
		expect(counts.cities).toBe(3);

		const storage = await getStorage();
		const before = await storage.countEntities("city", DATASET);
		const def = await loadImportDefinition(resolve(FIXTURE, "imports/cities.yaml"));
		const second = await runImport(def, resolve(FIXTURE, "imports"), {
			datasetId: DATASET,
		});
		expect(second.updated).toBe(before);
		expect(second.inserted).toBe(0);
		expect(await storage.countEntities("city", DATASET)).toBe(before);
	});
});

describe("4. Query", () => {
	it("filters cities by region and navigates city → region", async () => {
		await setupDataset();
		await importAll();

		const north = await executeQuery(
			parseQuery('from city where regionId == "north"'),
			DATASET,
		);
		expect(north.entities.every((e) => e.data["regionId"] === "north")).toBe(
			true,
		);
		expect(north.entities.length).toBe(2);

		const city = (
			await executeQuery(parseQuery('from city where id == "alpha"'), DATASET)
		).entities[0]!;
		const region = (
			await executeQuery(
				parseQuery(`from region where id == "${city.data["regionId"]}"`),
				DATASET,
			)
		).entities[0]!;
		expect(region.data["name"]).toBe("North");
	});
});

describe("5. REST API", () => {
	const BASE = "http://localhost";

	function apiReq(method: string, path: string): Request {
		return new Request(`${BASE}${path}`, { method });
	}

	it("lists schemas, entities, query, stats, and import history", async () => {
		await setupDataset();
		await importAll();
		const app = buildApp({ uploadDir });

		const health = await app.handle(apiReq("GET", "/health"));
		expect(health.status).toBe(200);

		const schemas = (await (
			await app.handle(apiReq("GET", `/schemas?dataset=${DATASET}`))
		).json()) as { id: string }[];
		expect(schemas.some((s) => s.id === "city")).toBe(true);

		const page = (await (
			await app.handle(
				apiReq("GET", `/entities?schema=city&dataset=${DATASET}&limit=10`),
			)
		).json()) as { entities: unknown[]; total: number };
		expect(page.total).toBe(3);

		const q = encodeURIComponent('from region where name == "North"');
		const query = (await (
			await app.handle(apiReq("GET", `/query?q=${q}&dataset=${DATASET}`))
		).json()) as { entities: { data: Record<string, unknown> }[] };
		expect(query.entities[0]!.data["id"]).toBe("north");

		const stats = (await (
			await app.handle(apiReq("GET", `/stats?dataset=${DATASET}`))
		).json()) as { totalEntities: number };
		expect(stats.totalEntities).toBe(5);

		const runs = (await (
			await app.handle(apiReq("GET", `/imports?dataset=${DATASET}`))
		).json()) as unknown[];
		expect(runs.length).toBeGreaterThanOrEqual(2);
	});
});

describe("6. Error handling", () => {
	it("rejects import when schema is not registered", async () => {
		const def = await loadImportDefinition(
			resolve(FIXTURE, "imports/regions.yaml"),
		);
		await expect(
			runImport(def, resolve(FIXTURE, "imports"), { datasetId: DATASET }),
		).rejects.toThrow(/not found/);
	});

	it("fails validation on malformed rows", async () => {
		await setupDataset();
		const badPath = join(uploadDir, "bad-cities.json");
		await Bun.write(badPath, JSON.stringify([{ id: "zzz" }]));
		const def: ImportDefinition = {
			id: "bad-import",
			name: "Bad Import",
			schema: "city",
			dataset: DATASET,
			source: { type: "json", path: badPath },
			pipeline: {
				steps: [
					{
						type: "map",
						mapping: { id: "id", name: "name", regionId: "regionId" },
					},
					{ type: "validate" },
					{ type: "persist" },
				],
			},
		};
		const result = await runImport(def, uploadDir);
		expect(result.failed).toBe(1);
		expect(result.imported).toBe(0);
	});

	it("malformed CSV does not crash the analyzer", () => {
		const analysis = analyzeContent("broken.csv", '"unclosed quote\nrow2,a,b');
		expect(analysis.format).toBe("csv");
		expect(analysis.rowCount).toBeGreaterThanOrEqual(0);
	});
});
