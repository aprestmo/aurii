/**
 * Relational Core: references, query v1, planner, joins, aggregates.
 * Uses the generic external-product fixture (Region / City).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { loadImportDefinition, runImport } from "../import/engine";
import { executeQuery, explainQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { planQuery } from "../query/planner";
import { resetProjectService } from "../project/runtime";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";

const DATASET = "phase3-relational";
const FIXTURE = EXTERNAL_PRODUCT_ROOT;

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

async function importFixture() {
	for (const name of ["regions", "cities"]) {
		const file = join(FIXTURE, "imports", `${name}.yaml`);
		const def = await loadImportDefinition(file);
		await runImport(def, resolve(file, ".."), { datasetId: DATASET });
	}
}

describe("Phase 3 — Relational Core", () => {
	beforeEach(async () => {
		delete process.env["DATABASE_URL"];
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		resetProjectService();
		await closeStorage();
		const storage = await getStorage();
		await storage.createDataset({ id: DATASET, name: "Phase 3 Test" });
		await registerSchema(REGION_SCHEMA, DATASET);
		await registerSchema(CITY_SCHEMA, DATASET);
		await importFixture();
	});

	afterEach(async () => {
		await closeStorage();
		resetProjectService();
	});

	it("stores reference values as stable string IDs", async () => {
		const result = await executeQuery('from city where id == "alpha"', DATASET);
		expect(result.entities[0]!.data["regionId"]).toBe("north");
	});

	it("supports OR, IN, and NOT", async () => {
		const or = await executeQuery(
			'from city where regionId == "north" or regionId == "south" order by name asc',
			DATASET,
		);
		expect(or.count).toBe(3);

		const inn = await executeQuery(
			'from city where regionId in ("north", "south")',
			DATASET,
		);
		expect(inn.count).toBe(3);

		const all = await executeQuery("count city", DATASET);
		const filtered = await executeQuery(
			'from city where not regionId == "north"',
			DATASET,
		);
		expect(filtered.count).toBeLessThan(all.count);
	});

	it("supports COUNT aggregate and JOIN", async () => {
		const count = await executeQuery("count city", DATASET);
		expect(count.aggregate?.fn).toBe("count");
		expect(count.aggregate?.value).toBe(3);

		const joined = await executeQuery(
			'from city join region on city.regionId = region.id where city.id == "alpha"',
			DATASET,
		);
		expect(joined.entities).toHaveLength(1);
		expect(joined.entities[0]!.data["region.name"]).toBeDefined();
	});

	it("planner produces join and aggregate plans", () => {
		expect(
			planQuery(parseQuery("from city join region on city.regionId = region.id"))
				.kind,
		).toBe("join");
		expect(planQuery(parseQuery("count city")).kind).toBe("aggregate");
	});

	it("explain returns human-readable steps", async () => {
		const explanation = await explainQuery(
			"from city join region on city.regionId = region.id",
		);
		expect(explanation.steps.length).toBeGreaterThan(0);
		expect(explanation.estimatedSchemas).toContain("city");
		expect(explanation.estimatedSchemas).toContain("region");
	});

	it("rejects rows with missing references in strict mode", async () => {
		const tmpPath = join(ROOT, "tmp-bad-ref.json");
		await Bun.write(
			tmpPath,
			JSON.stringify([{ id: "ghost", name: "Ghost", regionId: "missing" }]),
		);
		const result = await runImport(
			{
				id: "test-bad-ref",
				name: "Bad Ref",
				schema: "city",
				dataset: DATASET,
				referenceValidation: "strict",
				source: { type: "json", path: tmpPath },
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
			},
			ROOT,
			{ datasetId: DATASET },
		);
		expect(result.failed).toBeGreaterThan(0);
		expect(result.errors[0]!.message).toContain("missing");
	});

	it("does not infinite-loop on self-referential schemas", async () => {
		await registerSchema(
			{
				id: "node",
				name: "Node",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "parentId", type: "reference", to: "node" },
				],
			},
			DATASET,
		);
		const storage = await getStorage();
		await storage.insertEntities(
			[
				{ schemaId: "node", data: { id: "a", parentId: "b" } },
				{ schemaId: "node", data: { id: "b", parentId: "a" } },
			],
			DATASET,
		);
		const result = await executeQuery('from node where id == "a"', DATASET);
		expect(result.entities).toHaveLength(1);
	});
});
