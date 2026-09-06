/**
 * Scale honesty: measure query sizes on the real API surface with synthetic
 * catalog data. Does not keep Norwegian geography in Aurii.
 *
 * Recorded numbers for the extracted product live in that product's repo.
 * This file keeps a generic CI bound so Core does not silently regress.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { executeQuery } from "../query/executor";
import { resetProjectService } from "../project/runtime";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";

const DATASET = "n4-scale";
const REGION_COUNT = 20;
const CITY_COUNT = 400;
const PLACE_COUNT = 6000;

const REGION: SchemaDefinition = {
	id: "region",
	name: "Region",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
	],
};

const CITY: SchemaDefinition = {
	id: "city",
	name: "City",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "regionId", type: "reference", to: "region", required: true },
	],
};

const PLACE: SchemaDefinition = {
	id: "place",
	name: "Place",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "cityId", type: "reference", to: "city", required: true },
	],
};

async function timeMs(label: string, fn: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await fn();
	const ms = performance.now() - start;
	console.log(`N4 ${label}: ${ms.toFixed(2)}ms`);
	return ms;
}

describe("N4 synthetic catalog scale benchmark (SQLite)", () => {
	beforeEach(async () => {
		delete process.env["DATABASE_URL"];
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		resetProjectService();
		await closeStorage();
		const storage = await getStorage();
		await storage.createDataset({ id: DATASET, name: "N4 Scale" });
		await registerSchema(REGION, DATASET);
		await registerSchema(CITY, DATASET);
		await registerSchema(PLACE, DATASET);

		const regions = Array.from({ length: REGION_COUNT }, (_, i) => ({
			schemaId: "region",
			data: { id: `r${String(i).padStart(2, "0")}`, name: `Region ${i}` },
		}));
		const cities = Array.from({ length: CITY_COUNT }, (_, i) => ({
			schemaId: "city",
			data: {
				id: `c${String(i).padStart(4, "0")}`,
				name: `City ${i}`,
				regionId: `r${String(i % REGION_COUNT).padStart(2, "0")}`,
			},
		}));
		const places = Array.from({ length: PLACE_COUNT }, (_, i) => ({
			schemaId: "place",
			data: {
				id: `p${String(i).padStart(5, "0")}`,
				name: `Place ${i}`,
				cityId: `c${String(i % CITY_COUNT).padStart(4, "0")}`,
			},
		}));
		await storage.insertEntities(regions, DATASET);
		await storage.insertEntities(cities, DATASET);
		await storage.insertEntities(places, DATASET);
	});

	afterEach(async () => {
		await closeStorage();
		resetProjectService();
	});

	test("measured query sizes stay correct and within demo-scale bounds", async () => {
		const storage = await getStorage();

		expect((await executeQuery("count region", DATASET)).count).toBe(REGION_COUNT);
		expect((await executeQuery("count city", DATASET)).count).toBe(CITY_COUNT);
		expect((await executeQuery("count place", DATASET)).count).toBe(PLACE_COUNT);

		const countAllMs = await timeMs("count city", () =>
			executeQuery("count city", DATASET),
		);
		const countFilterMs = await timeMs('count city where regionId == "r00"', () =>
			executeQuery('count city where regionId == "r00"', DATASET),
		);
		const countPlaceMs = await timeMs("count place", () =>
			executeQuery("count place", DATASET),
		);
		const joinMs = await timeMs("city join region (full)", () =>
			executeQuery("from city join region on city.regionId = region.id", DATASET),
		);
		const joinFilterMs = await timeMs("city join region where c0000", () =>
			executeQuery(
				'from city join region on city.regionId = region.id where city.id == "c0000"',
				DATASET,
			),
		);
		const pageMs = await timeMs("place limit 100 offset 5000", () =>
			executeQuery("from place order by id asc limit 100 offset 5000", DATASET),
		);
		const lookupMs = await timeMs("findEntityByField city c0000", () =>
			storage.findEntityByField("city", DATASET, "id", "c0000"),
		);

		const filtered = await executeQuery(
			'count city where regionId == "r00"',
			DATASET,
		);
		expect(filtered.count).toBe(CITY_COUNT / REGION_COUNT);

		const joined = await executeQuery(
			"from city join region on city.regionId = region.id",
			DATASET,
		);
		expect(joined.count).toBe(CITY_COUNT);
		expect(joined.entities[0]?.data["region.name"]).toBeDefined();

		const page = await executeQuery(
			"from place order by id asc limit 100 offset 5000",
			DATASET,
		);
		expect(page.entities.length).toBe(100);

		const found = await storage.findEntityByField("city", DATASET, "id", "c0000");
		expect(found?.data["name"]).toBeTruthy();

		expect(countAllMs).toBeLessThan(200);
		expect(countFilterMs).toBeLessThan(200);
		expect(countPlaceMs).toBeLessThan(200);
		expect(joinMs).toBeLessThan(500);
		expect(joinFilterMs).toBeLessThan(500);
		expect(pageMs).toBeLessThan(500);
		expect(lookupMs).toBeLessThan(50);
	});
});
