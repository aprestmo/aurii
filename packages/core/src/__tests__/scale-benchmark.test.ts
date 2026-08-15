/**
 * N4 scale honesty: measure Norwegian Geo query sizes on the real API surface
 * (`executeQuery` → planner → storage). Timings are logged; assertions use
 * generous bounds so CI does not flake. Recorded numbers live in docs/SCALE.md.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { loadImportDefinition, runImport } from "../import/engine";
import { executeQuery } from "../query/executor";
import { resetProjectService } from "../project/runtime";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";

const ROOT = resolve(import.meta.dir, "../../../..");
const DATASET = "n4-scale";
const CORE = join(ROOT, "demo/norwegian-geo/core");

const COUNTY: SchemaDefinition = {
	id: "county",
	name: "County",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
	],
};

const MUNICIPALITY: SchemaDefinition = {
	id: "municipality",
	name: "Municipality",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "countyId", type: "reference", to: "county", required: true },
	],
};

const POSTAL: SchemaDefinition = {
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

async function timeMs(label: string, fn: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await fn();
	const ms = performance.now() - start;
	console.log(`N4 ${label}: ${ms.toFixed(2)}ms`);
	return ms;
}

describe("N4 Norwegian Geo scale benchmark (SQLite)", () => {
	beforeEach(async () => {
		delete process.env["DATABASE_URL"];
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		resetProjectService();
		await closeStorage();
		const storage = await getStorage();
		await storage.createDataset({ id: DATASET, name: "N4 Scale" });
		await registerSchema(COUNTY, DATASET);
		await registerSchema(MUNICIPALITY, DATASET);
		await registerSchema(POSTAL, DATASET);
		const importsDir = join(CORE, "imports");
		for (const name of ["counties", "municipalities", "postal-codes"]) {
			const file = join(importsDir, `${name}.yaml`);
			const def = await loadImportDefinition(file);
			await runImport(def, resolve(file, ".."), { datasetId: DATASET });
		}
	});

	afterEach(async () => {
		await closeStorage();
		resetProjectService();
	});

	test("measured query sizes stay correct and within demo-scale bounds", async () => {
		const storage = await getStorage();

		const counties = await executeQuery("count county", DATASET);
		const municipalities = await executeQuery("count municipality", DATASET);
		const postal = await executeQuery("count postal-code", DATASET);
		expect(counties.count).toBe(15);
		expect(municipalities.count).toBe(357);
		expect(postal.count).toBeGreaterThan(5000);

		const countAllMs = await timeMs("count municipality", () =>
			executeQuery("count municipality", DATASET),
		);
		const countFilterMs = await timeMs(
			'count municipality where countyId == "03"',
			() => executeQuery('count municipality where countyId == "03"', DATASET),
		);
		const countPostalMs = await timeMs("count postal-code", () =>
			executeQuery("count postal-code", DATASET),
		);
		const joinMs = await timeMs("municipality join county (full)", () =>
			executeQuery(
				"from municipality join county on municipality.countyId = county.id",
				DATASET,
			),
		);
		const joinFilterMs = await timeMs("municipality join county where Oslo", () =>
			executeQuery(
				'from municipality join county on municipality.countyId = county.id where municipality.id == "0301"',
				DATASET,
			),
		);
		const pageMs = await timeMs("postal-code limit 100 offset 5000", () =>
			executeQuery("from postal-code order by code asc limit 100 offset 5000", DATASET),
		);
		const lookupMs = await timeMs("findEntityByField municipality 0301", () =>
			storage.findEntityByField("municipality", DATASET, "id", "0301"),
		);

		const oslo = await executeQuery(
			'count municipality where countyId == "03"',
			DATASET,
		);
		expect(oslo.count).toBeGreaterThan(0);
		expect(oslo.count).toBeLessThan(357);

		const joined = await executeQuery(
			"from municipality join county on municipality.countyId = county.id",
			DATASET,
		);
		expect(joined.count).toBe(357);
		expect(joined.entities[0]?.data["county.name"]).toBeDefined();

		const page = await executeQuery(
			"from postal-code order by code asc limit 100 offset 5000",
			DATASET,
		);
		expect(page.entities.length).toBeGreaterThan(0);
		expect(page.entities.length).toBeLessThanOrEqual(100);

		const found = await storage.findEntityByField(
			"municipality",
			DATASET,
			"id",
			"0301",
		);
		expect(found?.data["name"]).toBeTruthy();

		// Generous CI bounds — Norwegian Geo is the proven size, not tax-list.
		expect(countAllMs).toBeLessThan(200);
		expect(countFilterMs).toBeLessThan(200);
		expect(countPostalMs).toBeLessThan(200);
		expect(joinMs).toBeLessThan(500);
		expect(joinFilterMs).toBeLessThan(500);
		expect(pageMs).toBeLessThan(500);
		expect(lookupMs).toBeLessThan(50);
	});
});
