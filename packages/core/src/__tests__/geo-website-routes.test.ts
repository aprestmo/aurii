/**
 * Geo website route feasibility test.
 *
 * Validates that a public website can serve a page for every Norwegian county
 * and municipality using only Aurii Query Language + SDK — the same queries a
 * frontend would run against Core.
 *
 * Route map proven:
 *   /fylker           → from county order by name asc
 *   /fylker/:id       → from county where id == ":id"
 *   /fylker/:id/kommuner → from municipality where countyId == ":id"
 *   /kommuner/:id     → from municipality where id == ":id"
 *   /kommuner/:id/postnummer → from postal-code where municipalityId == ":id"
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { resolve } from "path";
import { loadImportDefinition, runImport } from "../import/engine";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";

const ROOT = resolve(import.meta.dir, "../../../..");
const DEMO = resolve(ROOT, "demo/norwegian-geo");
const DATASET = "norwegian-geo";

const COUNTY_SCHEMA: SchemaDefinition = {
	id: "county",
	name: "County",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "source", type: "string" },
	],
};

const MUNICIPALITY_SCHEMA: SchemaDefinition = {
	id: "municipality",
	name: "Municipality",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "countyId", type: "string", required: true },
		{ name: "source", type: "string" },
	],
};

const POSTAL_CODE_SCHEMA: SchemaDefinition = {
	id: "postal-code",
	name: "Postal Code",
	fields: [
		{ name: "code", type: "string", required: true },
		{ name: "city", type: "string", required: true },
		{ name: "municipalityId", type: "string", required: true },
		{ name: "municipalityName", type: "string" },
		{ name: "postalCodeType", type: "string" },
		{ name: "source", type: "string" },
	],
};

interface CountyRow {
	id: string;
	name: string;
}

interface MunicipalityRow {
	id: string;
	name: string;
	countyId: string;
}

let sourceCounties: CountyRow[] = [];
let sourceMunicipalities: MunicipalityRow[] = [];

beforeAll(async () => {
	sourceCounties = await Bun.file(resolve(DEMO, "data/counties.json")).json();
	sourceMunicipalities = await Bun.file(
		resolve(DEMO, "data/municipalities.json"),
	).json();
});

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";

	const storage = await getStorage();
	await storage.createDataset({ id: DATASET, name: "Norwegian Geography" });
	await Promise.all([
		registerSchema(COUNTY_SCHEMA, DATASET),
		registerSchema(MUNICIPALITY_SCHEMA, DATASET),
		registerSchema(POSTAL_CODE_SCHEMA, DATASET),
	]);

	for (const imp of ["counties", "municipalities", "postal-codes"]) {
		const file = resolve(DEMO, "imports", `${imp}.yaml`);
		const def = await loadImportDefinition(file);
		await runImport(def, resolve(file, ".."));
	}
});

afterEach(async () => {
	await closeStorage();
});

describe("Geo website — route feasibility", () => {
	it("source data has 15 counties and 357 municipalities with unique ids", () => {
		expect(sourceCounties).toHaveLength(15);
		expect(sourceMunicipalities).toHaveLength(357);
		expect(new Set(sourceCounties.map((c) => c.id)).size).toBe(15);
		expect(new Set(sourceMunicipalities.map((m) => m.id)).size).toBe(357);
	});

	it("every municipality belongs to a known county (required for /fylker/:id pages)", () => {
		const countyIds = new Set(sourceCounties.map((c) => c.id));
		for (const m of sourceMunicipalities) {
			expect(countyIds.has(m.countyId)).toBe(true);
		}
	});

	it("GET /fylker — lists all counties via query", async () => {
		const result = await executeQuery(
			parseQuery("from county order by name asc"),
			DATASET,
		);
		expect(result.entities).toHaveLength(15);
		expect(result.entities.map((e) => e.data["name"])).toEqual(
			[...result.entities.map((e) => e.data["name"] as string)].sort((a, b) =>
				a.localeCompare(b, "nb"),
			),
		);
	});

	it("every county has a routable /fylker/:id page", async () => {
		for (const county of sourceCounties) {
			const result = await executeQuery(
				parseQuery(`from county where id == "${county.id}"`),
				DATASET,
			);
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0]!.data["name"]).toBe(county.name);
		}
	});

	it("every county page can list its municipalities", async () => {
		for (const county of sourceCounties) {
			const expected = sourceMunicipalities.filter(
				(m) => m.countyId === county.id,
			);
			const result = await executeQuery(
				parseQuery(
					`from municipality where countyId == "${county.id}" order by name asc`,
				),
				DATASET,
			);
			expect(result.entities).toHaveLength(expected.length);
			expect(result.entities.length).toBeGreaterThan(0);
		}
	});

	it("every municipality has a routable /kommuner/:id page", async () => {
		for (const mun of sourceMunicipalities) {
			const result = await executeQuery(
				parseQuery(`from municipality where id == "${mun.id}"`),
				DATASET,
			);
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0]!.data["name"]).toBe(mun.name);
			expect(result.entities[0]!.data["countyId"]).toBe(mun.countyId);
		}
	});

	it("municipality pages can show postal codes from Bring data", async () => {
		// Oslo — known to have many postal codes
		const result = await executeQuery(
			parseQuery(
				'from postal-code where municipalityId == "0301" order by code asc limit 10',
			),
			DATASET,
		);
		expect(result.entities.length).toBe(10);
		expect(result.entities[0]!.data["code"]).toBeDefined();
	});

	it("county and municipality ids are URL-safe (no encoding needed)", () => {
		const idPattern = /^\d{2,4}$/;
		for (const c of sourceCounties) {
			expect(c.id).toMatch(idPattern);
		}
		for (const m of sourceMunicipalities) {
			expect(m.id).toMatch(idPattern);
		}
	});

	it("generates complete static path list: 15 counties + 357 municipalities", () => {
		const countyPaths = sourceCounties.map((c) => `/fylker/${c.id}`);
		const municipalityPaths = sourceMunicipalities.map(
			(m) => `/kommuner/${m.id}`,
		);
		expect(countyPaths).toHaveLength(15);
		expect(municipalityPaths).toHaveLength(357);
		expect(new Set(countyPaths).size).toBe(15);
		expect(new Set(municipalityPaths).size).toBe(357);
	});
});
