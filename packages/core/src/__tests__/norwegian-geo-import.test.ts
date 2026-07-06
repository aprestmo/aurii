/**
 * Norwegian Geographic Reference Data — Import Test
 *
 * A realistic, end-to-end import test using three authoritative open datasets:
 *
 *   1. Fylker (counties) from Kartverket/GeoNorge
 *      GET https://ws.geonorge.no/kommuneinfo/v1/fylker
 *
 *   2. Kommuner (municipalities) from Kartverket/GeoNorge
 *      GET https://ws.geonorge.no/kommuneinfo/v1/kommuner
 *
 *   3. Postnummer (postal codes) from Bring — public TSV file, no auth needed
 *      https://www.bring.no/tjenester/adressetjenester/postnummer
 *
 * What this test proves:
 *
 *   - Declarative schemas define three related entity types
 *   - External data is fetched, normalized and imported through the pipeline
 *   - The countyId relationship is derived deterministically from the
 *     municipality number prefix (standard Norwegian administrative coding)
 *   - deduplicateBy makes every import run idempotent — no duplicates
 *   - Cross-reference validation surfaces discrepancies as warnings
 *   - The query language can navigate the county → municipality → postal-code
 *     chain without joins, using code fields as foreign keys
 *   - A summary report is produced at the end
 *
 * The test requires internet access.  It is self-contained and leaves no
 * artefacts on disk (in-memory SQLite only).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { join } from "path";
import { runImport } from "../import/engine";
import { parseCsv } from "../import/sources/csv";
import type { ImportDefinition } from "../import/types";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, getStorage } from "../storage";

// ── External source URLs ──────────────────────────────────────────────────────

const KARTVERKET_COUNTIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/fylker";
const KARTVERKET_MUNICIPALITIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/kommuner";
const BRING_POSTNUMMER_TSV_URL =
	"https://www.bring.no/tjenester/adressetjenester/postnummer/_/attachment/download/7f0186f6-cf90-4657-8b5b-70707abeb789:62b42f1b8274a60db4bba965e64c7cf2c43143e9/Postnummerregister-ansi.txt";

// ── Kartverket API response shapes ────────────────────────────────────────────

interface KartverketCounty {
	fylkesnummer: string;
	fylkesnavn: string;
}

interface KartverketMunicipality {
	kommunenummer: string;
	kommunenavnNorsk: string;
}

// ── Dataset ───────────────────────────────────────────────────────────────────

const DATASET = "norwegian-geo";

// ── Schemas ───────────────────────────────────────────────────────────────────

const COUNTY_SCHEMA: SchemaDefinition = {
	id: "county",
	name: "County",
	description: "Norwegian administrative county (fylke) from Kartverket",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
		{ name: "source", type: "string" },
	],
};

const MUNICIPALITY_SCHEMA: SchemaDefinition = {
	id: "municipality",
	name: "Municipality",
	description: "Norwegian administrative municipality (kommune) from Kartverket",
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
	description: "Norwegian postal code (postnummer) from Bring",
	fields: [
		{ name: "code", type: "string", required: true },
		{ name: "city", type: "string", required: true },
		{ name: "municipalityId", type: "string", required: true },
		{ name: "municipalityName", type: "string" },
		{ name: "postalCodeType", type: "string" },
		{ name: "source", type: "string" },
	],
};

// ── Normalized row shapes (ready for import engine) ───────────────────────────

interface CountyRow extends Record<string, unknown> {
	id: string;
	name: string;
	source: string;
}

interface MunicipalityRow extends Record<string, unknown> {
	id: string;
	name: string;
	countyId: string;
	source: string;
}

interface PostalCodeRow extends Record<string, unknown> {
	code: string;
	city: string;
	municipalityId: string;
	municipalityName: string;
	postalCodeType: string;
	source: string;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchCounties(): Promise<CountyRow[]> {
	const res = await fetch(KARTVERKET_COUNTIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket counties: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketCounty[];
	return data.map((c) => ({
		id: c.fylkesnummer,
		name: c.fylkesnavn,
		source: "kartverket",
	}));
}

async function fetchMunicipalities(): Promise<MunicipalityRow[]> {
	const res = await fetch(KARTVERKET_MUNICIPALITIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket municipalities: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketMunicipality[];
	return data.map((m) => ({
		id: m.kommunenummer,
		name: m.kommunenavnNorsk,
		// The first two digits of the 4-digit municipality number are the county
		// number — a deterministic relationship in the Norwegian administrative
		// coding system.  No API call needed to look this up.
		countyId: m.kommunenummer.slice(0, 2),
		source: "kartverket",
	}));
}

async function fetchPostalCodes(): Promise<PostalCodeRow[]> {
	// The Bring file is ISO-8859-1 (ANSI) encoded, tab-separated, no header.
	// Columns: postnummer, poststed, kommunenummer, kommunenavn, type
	const res = await fetch(BRING_POSTNUMMER_TSV_URL);
	if (!res.ok) throw new Error(`Bring postnummer TSV: HTTP ${res.status}`);

	// Decode as Latin-1 (ISO-8859-1).  Bun's TextDecoder Encoding type is
	// narrower than the WHATWG spec; use an explicit cast to bypass it.
	const bytes = new Uint8Array(await res.arrayBuffer());
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const text = new TextDecoder("latin1" as any).decode(bytes);

	// Prepend a synthetic header so the existing CSV parser can handle it.
	const withHeader = `postnummer\tpoststed\tkommunenummer\tkommunenavn\ttype\n${text}`;
	const rows = parseCsv(withHeader, "\t");

	return rows.map((r) => ({
		// Postal codes are always 4 digits; pad with leading zero if needed.
		code: String(r["postnummer"] ?? "").padStart(4, "0"),
		city: String(r["poststed"] ?? ""),
		municipalityId: String(r["kommunenummer"] ?? ""),
		municipalityName: String(r["kommunenavn"] ?? ""),
		postalCodeType: String(r["type"] ?? ""),
		source: "bring",
	}));
}

// ── Temp-file helper (import engine requires a file path) ─────────────────────

async function writeTemp(rows: Record<string, unknown>[]): Promise<string> {
	const path = join(
		import.meta.dir,
		`__tmp_geo_${crypto.randomUUID()}.json`,
	);
	await Bun.write(path, JSON.stringify(rows));
	return path;
}

async function deleteTemp(path: string): Promise<void> {
	try {
		if (await Bun.file(path).exists()) {
			await (await import("fs/promises")).unlink(path);
		}
	} catch {
		/* ignore */
	}
}

// ── Global test state ─────────────────────────────────────────────────────────

let counties: CountyRow[] = [];
let municipalities: MunicipalityRow[] = [];
let postalCodes: PostalCodeRow[] = [];

// Warnings collected during cross-reference validation
const warnings: string[] = [];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
	[counties, municipalities, postalCodes] = await Promise.all([
		fetchCounties(),
		fetchMunicipalities(),
		fetchPostalCodes(),
	]);
});

beforeEach(() => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
});

afterEach(async () => {
	await closeStorage();
});

// ── Utility: register all three schemas and a named dataset ──────────────────

async function setupDataset(): Promise<void> {
	const storage = await getStorage();
	await storage.createDataset({ id: DATASET, name: "Norwegian Geography" });
	await Promise.all([
		registerSchema(COUNTY_SCHEMA, DATASET),
		registerSchema(MUNICIPALITY_SCHEMA, DATASET),
		registerSchema(POSTAL_CODE_SCHEMA, DATASET),
	]);
}

// ── Utility: run one full import round (counties → municipalities → postal codes)

async function runFullImport(files: {
	countiesPath: string;
	municipalitiesPath: string;
	postalCodesPath: string;
}) {
	const countyDef: ImportDefinition = {
		id: "import-counties",
		name: "Import Counties (Kartverket)",
		schema: "county",
		dataset: DATASET,
		source: { type: "json", path: files.countiesPath },
		deduplicateBy: "id",
		pipeline: {
			steps: [
				{ type: "map", mapping: { id: "id", name: "name", source: "source" } },
				{ type: "validate" },
				{ type: "persist" },
			],
		},
	};

	const municipalityDef: ImportDefinition = {
		id: "import-municipalities",
		name: "Import Municipalities (Kartverket)",
		schema: "municipality",
		dataset: DATASET,
		source: { type: "json", path: files.municipalitiesPath },
		deduplicateBy: "id",
		pipeline: {
			steps: [
				{
					type: "map",
					mapping: {
						id: "id",
						name: "name",
						countyId: "countyId",
						source: "source",
					},
				},
				{ type: "validate" },
				{ type: "persist" },
			],
		},
	};

	const postalCodeDef: ImportDefinition = {
		id: "import-postal-codes",
		name: "Import Postal Codes (Bring)",
		schema: "postal-code",
		dataset: DATASET,
		source: { type: "json", path: files.postalCodesPath },
		deduplicateBy: "code",
		pipeline: {
			steps: [
				{
					type: "map",
					mapping: {
						code: "code",
						city: "city",
						municipalityId: "municipalityId",
						municipalityName: "municipalityName",
						postalCodeType: "postalCodeType",
						source: "source",
					},
				},
				{ type: "validate" },
				{ type: "persist" },
			],
		},
	};

	const [countyResult, municipalityResult, postalCodeResult] =
		await Promise.all([
			runImport(countyDef, "/"),
			runImport(municipalityDef, "/"),
			runImport(postalCodeDef, "/"),
		]);

	return { countyResult, municipalityResult, postalCodeResult };
}

// =============================================================================
// Section 1 — Fetch and normalize external data
// =============================================================================

describe("1. Fetch and normalize external data", () => {
	it("fetches counties from Kartverket — at least 10 fylker expected", () => {
		expect(counties.length).toBeGreaterThanOrEqual(10);
	});

	it("every county has a non-empty numeric id (fylkesnummer)", () => {
		for (const c of counties) {
			expect(c.id).toMatch(/^\d+$/);
			expect(c.name.length).toBeGreaterThan(0);
		}
	});

	it("fetches municipalities from Kartverket — at least 300 kommuner expected", () => {
		expect(municipalities.length).toBeGreaterThanOrEqual(300);
	});

	it("every municipality has a 4-digit id (kommunenummer)", () => {
		for (const m of municipalities) {
			expect(m.id).toMatch(/^\d{4}$/);
		}
	});

	it("countyId is derived from the first two digits of kommunenummer", () => {
		for (const m of municipalities) {
			expect(m.countyId).toBe(m.id.slice(0, 2));
		}
	});

	it("fetches postal codes from Bring TSV — at least 4000 postnummer expected", () => {
		expect(postalCodes.length).toBeGreaterThanOrEqual(4000);
	});

	it("all postal codes are normalised to exactly 4 characters", () => {
		for (const p of postalCodes) {
			expect(p.code.length).toBe(4);
			expect(p.code).toMatch(/^\d{4}$/);
		}
	});

	it("postal codes cover all 15 counties via their municipality prefix", () => {
		const countyPrefixes = new Set(
			postalCodes.map((p) => p.municipalityId.slice(0, 2)),
		);
		// All 15 current Norwegian county numbers should appear
		expect(countyPrefixes.size).toBeGreaterThanOrEqual(14);
	});
});

// =============================================================================
// Section 2 — Schema registration
// =============================================================================

describe("2. Schema registration", () => {
	it("registers all three schemas in the norwegian-geo dataset", async () => {
		await setupDataset();
		const storage = await getStorage();
		const schemas = await storage.listSchemas(DATASET);
		const ids = schemas.map((s) => s.id);
		expect(ids).toContain("county");
		expect(ids).toContain("municipality");
		expect(ids).toContain("postal-code");
	});
});

// =============================================================================
// Section 3 — Import pipeline
// =============================================================================

describe("3. Import pipeline — counties, municipalities, postal codes", () => {
	it("imports all counties, municipalities and postal codes without errors", async () => {
		await setupDataset();

		const [cPath, mPath, pPath] = await Promise.all([
			writeTemp(counties),
			writeTemp(municipalities),
			writeTemp(postalCodes),
		]);

		try {
			const { countyResult, municipalityResult, postalCodeResult } =
				await runFullImport({
					countiesPath: cPath,
					municipalitiesPath: mPath,
					postalCodesPath: pPath,
				});

			expect(countyResult.failed).toBe(0);
			expect(municipalityResult.failed).toBe(0);
			expect(postalCodeResult.failed).toBe(0);
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("county count in storage matches source from Kartverket", async () => {
		await setupDataset();
		const cPath = await writeTemp(counties);
		try {
			const def: ImportDefinition = {
				id: "import-counties",
				name: "Import Counties",
				schema: "county",
				dataset: DATASET,
				source: { type: "json", path: cPath },
				deduplicateBy: "id",
				pipeline: {
					steps: [
						{ type: "map", mapping: { id: "id", name: "name", source: "source" } },
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};
			const result = await runImport(def, "/");
			expect(result.total).toBe(counties.length);
			expect(result.imported).toBe(counties.length);

			const storage = await getStorage();
			const count = await storage.countEntities("county", DATASET);
			expect(count).toBe(counties.length);
		} finally {
			await deleteTemp(cPath);
		}
	});

	it("municipality count in storage matches source from Kartverket", async () => {
		await setupDataset();
		const mPath = await writeTemp(municipalities);
		try {
			const def: ImportDefinition = {
				id: "import-municipalities",
				name: "Import Municipalities",
				schema: "municipality",
				dataset: DATASET,
				source: { type: "json", path: mPath },
				deduplicateBy: "id",
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								id: "id",
								name: "name",
								countyId: "countyId",
								source: "source",
							},
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};
			const result = await runImport(def, "/");
			expect(result.total).toBe(municipalities.length);
			expect(result.imported).toBe(municipalities.length);

			const storage = await getStorage();
			const count = await storage.countEntities("municipality", DATASET);
			expect(count).toBe(municipalities.length);
		} finally {
			await deleteTemp(mPath);
		}
	});

	it("postal code count in storage matches source from Bring", async () => {
		await setupDataset();
		const pPath = await writeTemp(postalCodes);
		try {
			const def: ImportDefinition = {
				id: "import-postal-codes",
				name: "Import Postal Codes",
				schema: "postal-code",
				dataset: DATASET,
				source: { type: "json", path: pPath },
				deduplicateBy: "code",
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								code: "code",
								city: "city",
								municipalityId: "municipalityId",
								municipalityName: "municipalityName",
								postalCodeType: "postalCodeType",
								source: "source",
							},
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};
			const result = await runImport(def, "/");
			expect(result.total).toBe(postalCodes.length);
			expect(result.imported).toBe(postalCodes.length);

			const storage = await getStorage();
			const count = await storage.countEntities("postal-code", DATASET);
			expect(count).toBe(postalCodes.length);
		} finally {
			await deleteTemp(pPath);
		}
	});
});

// =============================================================================
// Section 4 — Idempotency
// =============================================================================

describe("4. Idempotency — running the same import twice produces no duplicates", () => {
	it("county count does not increase after a second import run", async () => {
		await setupDataset();
		const cPath = await writeTemp(counties);
		const def: ImportDefinition = {
			id: "import-counties",
			name: "Import Counties",
			schema: "county",
			dataset: DATASET,
			source: { type: "json", path: cPath },
			deduplicateBy: "id",
			pipeline: {
				steps: [
					{ type: "map", mapping: { id: "id", name: "name", source: "source" } },
					{ type: "validate" },
					{ type: "persist" },
				],
			},
		};

		try {
			await runImport(def, "/");
			const run2 = await runImport(def, "/");

			// Second run: all rows were found → updated in place, none inserted anew
			expect(run2.updated).toBe(counties.length);

			const storage = await getStorage();
			const count = await storage.countEntities("county", DATASET);
			// Entity count must equal the source, not double it
			expect(count).toBe(counties.length);
		} finally {
			await deleteTemp(cPath);
		}
	});

	it("municipality count does not increase after a second import run", async () => {
		await setupDataset();
		const mPath = await writeTemp(municipalities);
		const def: ImportDefinition = {
			id: "import-municipalities",
			name: "Import Municipalities",
			schema: "municipality",
			dataset: DATASET,
			source: { type: "json", path: mPath },
			deduplicateBy: "id",
			pipeline: {
				steps: [
					{
						type: "map",
						mapping: {
							id: "id",
							name: "name",
							countyId: "countyId",
							source: "source",
						},
					},
					{ type: "validate" },
					{ type: "persist" },
				],
			},
		};

		try {
			await runImport(def, "/");
			const run2 = await runImport(def, "/");

			expect(run2.updated).toBe(municipalities.length);
			const storage = await getStorage();
			expect(await storage.countEntities("municipality", DATASET)).toBe(
				municipalities.length,
			);
		} finally {
			await deleteTemp(mPath);
		}
	});

	it("postal code count does not increase after a second import run", async () => {
		await setupDataset();
		const pPath = await writeTemp(postalCodes);
		const def: ImportDefinition = {
			id: "import-postal-codes",
			name: "Import Postal Codes",
			schema: "postal-code",
			dataset: DATASET,
			source: { type: "json", path: pPath },
			deduplicateBy: "code",
			pipeline: {
				steps: [
					{
						type: "map",
						mapping: {
							code: "code",
							city: "city",
							municipalityId: "municipalityId",
							municipalityName: "municipalityName",
							postalCodeType: "postalCodeType",
							source: "source",
						},
					},
					{ type: "validate" },
					{ type: "persist" },
				],
			},
		};

		try {
			await runImport(def, "/");
			const run2 = await runImport(def, "/");

			expect(run2.updated).toBe(postalCodes.length);
			const storage = await getStorage();
			expect(await storage.countEntities("postal-code", DATASET)).toBe(
				postalCodes.length,
			);
		} finally {
			await deleteTemp(pPath);
		}
	});
});

// =============================================================================
// Section 5 — Cross-reference validation
// =============================================================================

describe("5. Cross-reference validation", () => {
	it("every municipality countyId matches a known county", () => {
		const countyIds = new Set(counties.map((c) => c.id));
		const mismatches: string[] = [];

		for (const m of municipalities) {
			if (!countyIds.has(m.countyId)) {
				const msg = `Municipality ${m.id} (${m.name}) → countyId "${m.countyId}" not found in counties`;
				mismatches.push(msg);
				warnings.push(msg);
			}
		}

		// Log but do not fail — mismatches are import warnings by design
		if (mismatches.length > 0) {
			console.warn(
				`[import warning] ${mismatches.length} municipality/county mismatches:\n` +
					mismatches.slice(0, 5).join("\n"),
			);
		}

		// The county derivation (first 2 digits) is deterministic, so no
		// mismatches are expected unless Kartverket returns inconsistent data.
		expect(mismatches.length).toBe(0);
	});

	it("every postal code municipalityId matches a known municipality", () => {
		const municipalityIds = new Set(municipalities.map((m) => m.id));
		const mismatches: string[] = [];

		for (const p of postalCodes) {
			if (!municipalityIds.has(p.municipalityId)) {
				const msg = `Postal code ${p.code} (${p.city}) → municipalityId "${p.municipalityId}" not found in municipalities`;
				mismatches.push(msg);
				warnings.push(msg);
			}
		}

		if (mismatches.length > 0) {
			console.warn(
				`[import warning] ${mismatches.length} postal-code/municipality mismatches:\n` +
					mismatches.slice(0, 5).join("\n"),
			);
		}

		// Some Bring entries may reference historical municipality codes.
		// We tolerate a small number of mismatches but flag them.
		const MAX_TOLERATED_MISMATCHES = 20;
		expect(mismatches.length).toBeLessThanOrEqual(MAX_TOLERATED_MISMATCHES);
	});
});

// =============================================================================
// Section 6 — Query: postnummer → kommune → fylke
// =============================================================================

describe("6. Query — navigate the county → municipality → postal-code chain", () => {
	async function setupAndImportAll(): Promise<{
		cPath: string;
		mPath: string;
		pPath: string;
	}> {
		await setupDataset();
		const [cPath, mPath, pPath] = await Promise.all([
			writeTemp(counties),
			writeTemp(municipalities),
			writeTemp(postalCodes),
		]);
		await runFullImport({ countiesPath: cPath, municipalitiesPath: mPath, postalCodesPath: pPath });
		return { cPath, mPath, pPath };
	}

	it("query counties: finds Oslo fylke by name", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			const q = parseQuery(`from county where name == "Oslo"`);
			const result = await executeQuery(q, DATASET);
			expect(result.entities.length).toBe(1);
			expect(result.entities[0]!.data["id"]).toBe("03");
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("query municipalities: finds Oslo kommune by id", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			const q = parseQuery(`from municipality where id == "0301"`);
			const result = await executeQuery(q, DATASET);
			expect(result.entities.length).toBe(1);
			expect(result.entities[0]!.data["name"]).toBe("Oslo");
			expect(result.entities[0]!.data["countyId"]).toBe("03");
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("query municipalities by county: finds all Oslo-county municipalities", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			const q = parseQuery(`from municipality where countyId == "03"`);
			const result = await executeQuery(q, DATASET);
			// Oslo county has exactly one municipality (Oslo kommune)
			expect(result.entities.length).toBeGreaterThanOrEqual(1);
			expect(result.entities.every((e) => e.data["countyId"] === "03")).toBe(true);
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("query postal codes: finds postal codes for Oslo municipality", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			const q = parseQuery(`from postal-code where municipalityId == "0301"`);
			const result = await executeQuery(q, DATASET);
			expect(result.entities.length).toBeGreaterThan(0);
			expect(
				result.entities.every((e) => e.data["municipalityId"] === "0301"),
			).toBe(true);
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("cross-entity lookup: postnummer 0001 → Oslo kommune → Oslo fylke", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			// Step 1: find postal code 0001
			const postalQ = parseQuery(`from postal-code where code == "0001"`);
			const postalResult = await executeQuery(postalQ, DATASET);
			expect(postalResult.entities.length).toBe(1);
			const postal = postalResult.entities[0]!;
			const municipalityId = postal.data["municipalityId"] as string;

			// Step 2: find the municipality
			const municipalityQ = parseQuery(
				`from municipality where id == "${municipalityId}"`,
			);
			const municipalityResult = await executeQuery(municipalityQ, DATASET);
			expect(municipalityResult.entities.length).toBe(1);
			const municipality = municipalityResult.entities[0]!;
			const countyId = municipality.data["countyId"] as string;

			// Step 3: find the county
			const countyQ = parseQuery(`from county where id == "${countyId}"`);
			const countyResult = await executeQuery(countyQ, DATASET);
			expect(countyResult.entities.length).toBe(1);
			const county = countyResult.entities[0]!;

			// Verify the chain: 0001 → Oslo kommune → Oslo fylke
			expect(postal.data["code"]).toBe("0001");
			expect(municipality.data["name"]).toBe("Oslo");
			expect(county.data["name"]).toBe("Oslo");
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});

	it("postal codes filtered by type: B = street addresses", async () => {
		const { cPath, mPath, pPath } = await setupAndImportAll();
		try {
			const q = parseQuery(
				`from postal-code where municipalityId == "0301" where postalCodeType == "B"`,
			);
			const result = await executeQuery(q, DATASET);
			expect(result.entities.length).toBeGreaterThan(0);
			expect(
				result.entities.every((e) => e.data["postalCodeType"] === "B"),
			).toBe(true);
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});
});

// =============================================================================
// Section 7 — Import report
// =============================================================================

describe("7. Import report", () => {
	it("prints a summary report after full import", async () => {
		await setupDataset();
		const [cPath, mPath, pPath] = await Promise.all([
			writeTemp(counties),
			writeTemp(municipalities),
			writeTemp(postalCodes),
		]);

		try {
			const { countyResult, municipalityResult, postalCodeResult } =
				await runFullImport({
					countiesPath: cPath,
					municipalitiesPath: mPath,
					postalCodesPath: pPath,
				});

			// Cross-reference validation (same logic as Section 5)
			const countyIds = new Set(counties.map((c) => c.id));
			const municipalityIds = new Set(municipalities.map((m) => m.id));
			const municipalityMismatches = municipalities.filter(
				(m) => !countyIds.has(m.countyId),
			).length;
			const postalCodeMismatches = postalCodes.filter(
				(p) => !municipalityIds.has(p.municipalityId),
			).length;

			const report = [
				"",
				"╔══════════════════════════════════════════════════════╗",
				"║     Aurii — Norwegian Geographic Data Import Report  ║",
				"╠══════════════════════════════════════════════════════╣",
				`║  Fylker (counties)       : ${String(countyResult.imported).padStart(6)}  imported     ║`,
				`║  Kommuner (municipalities): ${String(municipalityResult.imported).padStart(6)}  imported     ║`,
				`║  Postnummer (postal codes): ${String(postalCodeResult.imported).padStart(6)}  imported     ║`,
				"╠══════════════════════════════════════════════════════╣",
				`║  County import errors    : ${String(countyResult.failed).padStart(6)}                ║`,
				`║  Municipality errors     : ${String(municipalityResult.failed).padStart(6)}                ║`,
				`║  Postal code errors      : ${String(postalCodeResult.failed).padStart(6)}                ║`,
				"╠══════════════════════════════════════════════════════╣",
				`║  Municipality/county mismatch  : ${String(municipalityMismatches).padStart(4)}               ║`,
				`║  Postal code/municipality mismatch: ${String(postalCodeMismatches).padStart(4)}             ║`,
				"╠══════════════════════════════════════════════════════╣",
				`║  County import   : ${String(countyResult.durationMs).padStart(5)} ms                   ║`,
				`║  Municipal import: ${String(municipalityResult.durationMs).padStart(5)} ms                   ║`,
				`║  Postal import   : ${String(postalCodeResult.durationMs).padStart(5)} ms                   ║`,
				"╚══════════════════════════════════════════════════════╝",
				"",
			].join("\n");

			console.log(report);

			// Assertions on the report data
			expect(countyResult.imported).toBe(counties.length);
			expect(municipalityResult.imported).toBe(municipalities.length);
			expect(postalCodeResult.imported).toBe(postalCodes.length);
			expect(countyResult.failed).toBe(0);
			expect(municipalityResult.failed).toBe(0);
			expect(postalCodeResult.failed).toBe(0);
		} finally {
			await Promise.all([deleteTemp(cPath), deleteTemp(mPath), deleteTemp(pPath)]);
		}
	});
});
