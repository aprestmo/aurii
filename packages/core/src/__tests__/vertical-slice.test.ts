/**
 * Phase 2.2 — Vertical Slice Integration Test
 *
 * Validates the complete Aurii workflow against real Norwegian geographic data:
 *
 *   Real dataset → Schema → Import Analysis → Mapping → Pipeline →
 *   Validation → Persist → Query → REST API
 *
 * Uses bundled snapshots in demo/norwegian-geo/data/ so CI runs offline.
 * The norwegian-geo-import.test.ts covers live API fetching separately.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { buildApp } from "../api/server";
import { countEntities } from "../entity/store";
import { analyzeContent } from "../import/analyze";
import { loadImportDefinition, runImport } from "../import/engine";
import type { ImportDefinition } from "../import/types";
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

let uploadDir: string;

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	uploadDir = await mkdtemp(join(tmpdir(), "aurii-vertical-"));
});

afterEach(async () => {
	await closeStorage();
	await rm(uploadDir, { recursive: true, force: true });
});

async function setupDataset(): Promise<void> {
	const storage = await getStorage();
	await storage.createDataset({ id: DATASET, name: "Norwegian Geography" });
	await Promise.all([
		registerSchema(COUNTY_SCHEMA, DATASET),
		registerSchema(MUNICIPALITY_SCHEMA, DATASET),
		registerSchema(POSTAL_CODE_SCHEMA, DATASET),
	]);
}

async function importAll(): Promise<{
	counties: number;
	municipalities: number;
	postalCodes: number;
}> {
	const importsDir = resolve(DEMO, "imports");
	const results = await Promise.all(
		["counties", "municipalities", "postal-codes"].map(async (name) => {
			const file = resolve(importsDir, `${name}.yaml`);
			const def = await loadImportDefinition(file);
			return runImport(def, resolve(file, ".."));
		}),
	);

	return {
		counties: results[0]!.imported,
		municipalities: results[1]!.imported,
		postalCodes: results[2]!.imported,
	};
}

// ── 1. Schema ─────────────────────────────────────────────────────────────────

describe("1. Schema — complete definitions with validation and relationships", () => {
	it("registers county, municipality and postal-code schemas", async () => {
		await setupDataset();
		const storage = await getStorage();
		const schemas = await storage.listSchemas(DATASET);
		const ids = schemas.map((s) => s.id);
		expect(ids).toContain("county");
		expect(ids).toContain("municipality");
		expect(ids).toContain("postal-code");
	});

	it("municipality schema declares countyId as a relationship field", async () => {
		await setupDataset();
		const storage = await getStorage();
		const schema = await storage.getSchema("municipality", DATASET);
		const countyField = schema!.fields.find((f) => f.name === "countyId");
		expect(countyField?.required).toBe(true);
		expect(countyField?.type).toBe("string");
	});
});

// ── 2. Import Analysis ────────────────────────────────────────────────────────

describe("2. Import Analysis — detects format, columns, types and record count", () => {
	it("analyzes municipalities JSON: format, columns, row count", async () => {
		const content = await Bun.file(
			resolve(DEMO, "data/municipalities.json"),
		).text();
		const analysis = analyzeContent("municipalities.json", content);

		expect(analysis.format).toBe("json");
		expect(analysis.columns).toContain("id");
		expect(analysis.columns).toContain("name");
		expect(analysis.columns).toContain("countyId");
		expect(analysis.rowCount).toBeGreaterThanOrEqual(300);
		expect(["string", "number"]).toContain(analysis.inferredTypes["id"]);
		// Identifier columns should infer as string after Phase 2.2 fix
		expect(analysis.inferredTypes["id"]).toBe("string");
		expect(analysis.inferredTypes["countyId"]).toBe("string");
		expect(analysis.suggestedMapping["name"]).toBe("name");
	});

	it("analyzes postal codes JSON with correct record count", async () => {
		const content = await Bun.file(
			resolve(DEMO, "data/postal-codes.json"),
		).text();
		const analysis = analyzeContent("postal-codes.json", content);

		expect(analysis.format).toBe("json");
		expect(analysis.rowCount).toBeGreaterThanOrEqual(4000);
		expect(analysis.columns).toContain("code");
		expect(analysis.columns).toContain("municipalityId");
	});
});

// ── 3. Mapping & Pipeline ─────────────────────────────────────────────────────

describe("3. Mapping & Pipeline — map, transform, validate, persist", () => {
	it("imports all three entity types from bundled real data", async () => {
		await setupDataset();
		const counts = await importAll();

		expect(counts.counties).toBeGreaterThanOrEqual(10);
		expect(counts.municipalities).toBeGreaterThanOrEqual(300);
		expect(counts.postalCodes).toBeGreaterThanOrEqual(4000);
	});
});

describe("4. Persistence — inserts, updates, duplicate handling", () => {
	it("persists entities and supports idempotent re-import", async () => {
		await setupDataset();
		await importAll();

		const storage = await getStorage();
		const before = await storage.countEntities("municipality", DATASET);

		const def = await loadImportDefinition(
			resolve(DEMO, "imports/municipalities.yaml"),
		);
		const secondRun = await runImport(def, resolve(DEMO, "imports"));

		expect(secondRun.updated).toBe(before);
		expect(secondRun.inserted).toBe(0);
		expect(await storage.countEntities("municipality", DATASET)).toBe(before);
	});
});

describe("5. Query — filtering, sorting, limits, relationships", () => {
	it("filters municipalities by countyId", async () => {
		await setupDataset();
		await importAll();

		const q = parseQuery(`from municipality where countyId == "03"`);
		const result = await executeQuery(q, DATASET);
		expect(result.entities.length).toBeGreaterThanOrEqual(1);
		expect(result.entities.every((e) => e.data["countyId"] === "03")).toBe(
			true,
		);
	});

	it("sorts postal codes and applies limit", async () => {
		await setupDataset();
		await importAll();

		const q = parseQuery(
			`from postal-code where municipalityId == "0301" order by code asc limit 5`,
		);
		const result = await executeQuery(q, DATASET);
		expect(result.entities.length).toBe(5);
		const codes = result.entities.map((e) => e.data["code"] as string);
		expect(codes).toEqual([...codes].sort());
	});

	it("navigates county → municipality → postal-code via code fields", async () => {
		await setupDataset();
		await importAll();

		const postalQ = parseQuery(`from postal-code where code == "0001"`);
		const postal = (await executeQuery(postalQ, DATASET)).entities[0]!;
		const municipalityId = postal.data["municipalityId"] as string;

		const munQ = parseQuery(
			`from municipality where id == "${municipalityId}"`,
		);
		const municipality = (await executeQuery(munQ, DATASET)).entities[0]!;
		const countyId = municipality.data["countyId"] as string;

		const countyQ = parseQuery(`from county where id == "${countyId}"`);
		const county = (await executeQuery(countyQ, DATASET)).entities[0]!;

		expect(municipality.data["name"]).toBe("Oslo");
		expect(county.data["name"]).toBe("Oslo");
	});
});

// ── 6. REST API ───────────────────────────────────────────────────────────────

describe("6. REST API — health, schemas, entities, query, stats", () => {
	const BASE = "http://localhost";

	function apiReq(
		method: string,
		path: string,
		body?: unknown,
	): Request {
		return new Request(`${BASE}${path}`, {
			method,
			headers: body ? { "content-type": "application/json" } : {},
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	async function setupViaApi(app: ReturnType<typeof buildApp>) {
		await setupDataset();
		const counts = await importAll();
		return counts;
	}

	it("GET /health returns ok", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(apiReq("GET", "/health"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("ok");
	});

	it("GET /schemas lists registered schemas", async () => {
		const app = buildApp({ uploadDir });
		await setupViaApi(app);

		const res = await app.handle(
			apiReq("GET", `/schemas?dataset=${DATASET}`),
		);
		expect(res.status).toBe(200);
		const schemas = (await res.json()) as { id: string }[];
		expect(schemas.some((s) => s.id === "municipality")).toBe(true);
	});

	it("GET /entities returns imported municipalities", async () => {
		const app = buildApp({ uploadDir });
		await setupViaApi(app);

		const res = await app.handle(
			apiReq(
				"GET",
				`/entities?schema=municipality&dataset=${DATASET}&limit=10`,
			),
		);
		expect(res.status).toBe(200);
		const page = (await res.json()) as { entities: unknown[]; total: number };
		expect(page.entities.length).toBe(10);
		expect(page.total).toBeGreaterThanOrEqual(300);
	});

	it("GET /query executes Aurii Query Language", async () => {
		const app = buildApp({ uploadDir });
		await setupViaApi(app);

		const q = encodeURIComponent('from county where name == "Oslo"');
		const res = await app.handle(
			apiReq("GET", `/query?q=${q}&dataset=${DATASET}`),
		);
		expect(res.status).toBe(200);
		const result = (await res.json()) as {
			entities: { data: Record<string, unknown> }[];
		};
		expect(result.entities.length).toBe(1);
		expect(result.entities[0]!.data["id"]).toBe("03");
	});

	it("GET /stats returns dataset aggregates", async () => {
		const app = buildApp({ uploadDir });
		await setupViaApi(app);

		const res = await app.handle(
			apiReq("GET", `/stats?dataset=${DATASET}`),
		);
		expect(res.status).toBe(200);
		const stats = (await res.json()) as { totalEntities: number };
		expect(stats.totalEntities).toBeGreaterThanOrEqual(4000);
	});

	it("GET /imports returns import history", async () => {
		const app = buildApp({ uploadDir });
		await setupViaApi(app);

		const res = await app.handle(
			apiReq("GET", `/imports?dataset=${DATASET}`),
		);
		expect(res.status).toBe(200);
		const runs = (await res.json()) as unknown[];
		expect(runs.length).toBeGreaterThanOrEqual(3);
	});
});

// ── 7. Error handling ─────────────────────────────────────────────────────────

describe("7. Error handling — graceful failures", () => {
	it("rejects import when schema is not registered", async () => {
		const def = await loadImportDefinition(
			resolve(DEMO, "imports/counties.yaml"),
		);
		await expect(runImport(def, resolve(DEMO, "imports"))).rejects.toThrow(
			/not found/,
		);
	});

	it("fails validation on malformed rows with missing required fields", async () => {
		await setupDataset();
		const badPath = join(uploadDir, "bad-municipalities.json");
		await Bun.write(
			badPath,
			JSON.stringify([{ id: "9999" }]), // missing name and countyId
		);

		const def: ImportDefinition = {
			id: "bad-import",
			name: "Bad Import",
			schema: "municipality",
			dataset: DATASET,
			source: { type: "json", path: badPath },
			pipeline: {
				steps: [
					{
						type: "map",
						mapping: { id: "id", name: "name", countyId: "countyId" },
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

	it("malformed CSV is handled without crashing the analyzer", () => {
		const analysis = analyzeContent(
			"broken.csv",
			'"unclosed quote\nrow2,a,b',
		);
		expect(analysis.format).toBe("csv");
		expect(analysis.rowCount).toBeGreaterThanOrEqual(0);
	});
});
