/**
 * Phase 3 — Relational Core integration tests.
 *
 * Validates reference fields, import validation, query v1 features,
 * planner behaviour, joins, and aggregates against the Norwegian geo dataset.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join, resolve } from "path";
import { runImport } from "../import/engine";
import { loadImportDefinition } from "../import/engine";
import { executeQuery, explainQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { planQuery } from "../query/planner";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";

const ROOT = resolve(import.meta.dir, "../../../..");
const DATASET = "phase3-relational";
const DEMO = join(ROOT, "demo/norwegian-geo");
const CORE = join(DEMO, "core");

const COUNTY_SCHEMA: SchemaDefinition = {
	id: "county",
	name: "County",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
	],
};

const MUNICIPALITY_SCHEMA: SchemaDefinition = {
	id: "municipality",
	name: "Municipality",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "countyId", type: "reference", to: "county", required: true },
	],
};

const POSTAL_SCHEMA: SchemaDefinition = {
	id: "postal-code",
	name: "Postal Code",
	fields: [
		{ name: "code", type: "string", required: true },
		{ name: "city", type: "string", required: true },
		{
			name: "municipalityId",
			type: "reference",
			to: "municipality",
			required: true,
		},
	],
};

async function importDemo() {
	const importsDir = join(CORE, "imports");
	for (const name of ["counties", "municipalities", "postal-codes"]) {
		const file = join(importsDir, `${name}.yaml`);
		const def = await loadImportDefinition(file);
		await runImport(def, resolve(file, ".."), { datasetId: DATASET });
	}
}

describe("Phase 3 — Relational Core", () => {
	beforeEach(async () => {
		const storage = await getStorage();
		await storage.createDataset({
			id: DATASET,
			name: "Phase 3 Test",
		});
		await registerSchema(COUNTY_SCHEMA, DATASET);
		await registerSchema(MUNICIPALITY_SCHEMA, DATASET);
		await registerSchema(POSTAL_SCHEMA, DATASET);
		await importDemo();
	});

	afterEach(async () => {
		await closeStorage();
	});

	describe("reference fields", () => {
		it("stores reference values as stable string IDs", async () => {
			const result = await executeQuery(
				'from municipality where id == "0301"',
				DATASET,
			);
			expect(result.entities[0]!.data["countyId"]).toBe("03");
		});
	});

	describe("query language v1", () => {
		it("supports OR in where clause", async () => {
			const result = await executeQuery(
				'from municipality where countyId == "03" or countyId == "11" order by name asc',
				DATASET,
			);
			expect(result.count).toBeGreaterThan(0);
			expect(
				result.entities.every(
					(e) => e.data["countyId"] === "03" || e.data["countyId"] === "11",
				),
			).toBe(true);
		});

		it("supports IN operator", async () => {
			const result = await executeQuery(
				'from municipality where countyId in ("03", "11")',
				DATASET,
			);
			expect(result.count).toBeGreaterThan(0);
		});

		it("supports NOT operator", async () => {
			const all = await executeQuery("count municipality", DATASET);
			const filtered = await executeQuery(
				'from municipality where not countyId == "03"',
				DATASET,
			);
			expect(filtered.count).toBeLessThan(all.count);
		});

		it("supports COUNT aggregate", async () => {
			const result = await executeQuery("count municipality", DATASET);
			expect(result.aggregate?.fn).toBe("count");
			expect(result.aggregate?.value).toBe(357);
			expect(result.count).toBe(357);
		});

		it("supports COUNT with filter", async () => {
			const result = await executeQuery(
				'count municipality where countyId == "03"',
				DATASET,
			);
			expect(result.aggregate?.value).toBeGreaterThan(0);
			expect(result.aggregate?.value).toBeLessThan(357);
		});

		it("supports JOIN queries", async () => {
			const result = await executeQuery(
				"from municipality join county on municipality.countyId = county.id where municipality.id == \"0301\"",
				DATASET,
			);
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0]!.data["county.name"]).toBeDefined();
		});
	});

	describe("query planner", () => {
		it("produces a join plan for join queries", () => {
			const ast = parseQuery(
				"from municipality join county on municipality.countyId = county.id",
			);
			const plan = planQuery(ast);
			expect(plan.kind).toBe("join");
		});

		it("produces an aggregate plan for count queries", () => {
			const plan = planQuery(parseQuery("count municipality"));
			expect(plan.kind).toBe("aggregate");
		});

		it("explain returns human-readable steps", async () => {
			const explanation = await explainQuery(
				"from municipality join county on municipality.countyId = county.id",
			);
			expect(explanation.steps.length).toBeGreaterThan(0);
			expect(explanation.estimatedSchemas).toContain("municipality");
			expect(explanation.estimatedSchemas).toContain("county");
		});
	});

	describe("import reference validation", () => {
		it("rejects rows with missing references in strict mode", async () => {
			const storage = await getStorage();
			const badRow = {
				id: "9999",
				name: "Ghost Town",
				countyId: "99",
			};

			const def = {
				id: "test-bad-ref",
				name: "Bad Ref",
				schema: "municipality",
				dataset: DATASET,
				referenceValidation: "strict" as const,
				source: {
					type: "json" as const,
					path: "inline",
				},
				pipeline: {
					steps: [
						{
							type: "map" as const,
							mapping: { id: "id", name: "name", countyId: "countyId" },
						},
						{ type: "validate" as const },
						{ type: "persist" as const },
					],
				},
			};

			// Write temp JSON for import
			const tmpPath = join(ROOT, "tmp-bad-ref.json");
			await Bun.write(tmpPath, JSON.stringify([badRow]));
			def.source.path = tmpPath;

			const result = await runImport(def, ROOT, { datasetId: DATASET });
			expect(result.failed).toBeGreaterThan(0);
			expect(result.errors[0]!.message).toContain("missing county");
		});
	});

	describe("circular references", () => {
		it("does not infinite-loop on self-referential schema definitions", async () => {
			const circular: SchemaDefinition = {
				id: "node",
				name: "Node",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "parentId", type: "reference", to: "node" },
				],
			};
			await registerSchema(circular, DATASET);
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
});
