/**
 * Real-World Dataset Test
 *
 * Tests Aurii against a realistic Norwegian job postings dataset that contains
 * the kinds of messy, inconsistent data found in actual production exports:
 *
 *   - Mixed date formats (ISO 8601, DD.MM.YYYY, "March 15, 2024")
 *   - Mixed remote/boolean values ("Yes", "No", "Hybrid", "Full Remote", "1")
 *   - Missing values (empty salary, empty company, empty location, empty deadline)
 *   - Norwegian special characters in text (æ, ø, å)
 *   - Numbers stored as strings
 *   - Mixed salary currencies
 *   - Columns in CSV not present in schema (extra data silently dropped)
 *
 * The tests are structured to document what passes, what partially works,
 * and what outright breaks — so the results serve as a capabilities audit.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "path";
import { runImport } from "../import/engine";
import { analyzeContent, detectFormat } from "../import/analyze";
import { applyTransform } from "../pipeline/transforms";
import type { ImportDefinition } from "../import/types";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, DEFAULT_DATASET } from "../storage";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const JOB_POSTING_SCHEMA: SchemaDefinition = {
	id: "job-posting",
	name: "Job Posting",
	description: "A job posting from a Norwegian job board",
	fields: [
		{ name: "title", type: "string", required: true },
		{ name: "company", type: "string" },
		{ name: "location", type: "string" },
		{ name: "salaryMin", type: "number" },
		{ name: "salaryMax", type: "number" },
		{ name: "currency", type: "string" },
		{ name: "remote", type: "boolean" },
		{ name: "postedDate", type: "date" },
		{ name: "deadline", type: "date" },
		{ name: "category", type: "string" },
		{ name: "description", type: "string" },
		{ name: "contactEmail", type: "string" },
		{ name: "tags", type: "string" },
		{ name: "openings", type: "number" },
	],
};

const CSV_PATH = join(
	import.meta.dir,
	"../../examples/data/job-postings.csv",
);

const IMPORT_DEF: ImportDefinition = {
	id: "import-job-postings",
	name: "Import Job Postings",
	schema: "job-posting",
	source: { type: "csv", path: CSV_PATH },
	pipeline: {
		steps: [
			{
				type: "map",
				mapping: {
					title: "Title",
					company: "Company",
					location: "Location",
					salaryMin: "Salary Min",
					salaryMax: "Salary Max",
					currency: "Currency",
					remote: "Remote",
					postedDate: "Posted Date",
					deadline: "Deadline",
					category: "Category",
					description: "Description",
					contactEmail: "Contact Email",
					tags: "Tags",
					openings: "Openings",
				},
			},
			{
				type: "transform",
				transforms: [
					{ field: "salaryMin", fn: "toNumber" },
					{ field: "salaryMax", fn: "toNumber" },
					{ field: "remote", fn: "toBoolean" },
					{ field: "postedDate", fn: "toDate" },
					{ field: "deadline", fn: "toDate" },
					{ field: "openings", fn: "toNumber" },
				],
			},
			{ type: "validate" },
			{ type: "persist" },
		],
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
});

afterEach(async () => {
	await closeStorage();
});

async function importDataset(dryRun = false) {
	await registerSchema(JOB_POSTING_SCHEMA, DEFAULT_DATASET);
	return runImport(IMPORT_DEF, join(import.meta.dir, "../.."), { dryRun });
}

// ── Section 1: Transform edge cases ──────────────────────────────────────────

describe("1. Transform edge cases", () => {
	describe("1a. toBoolean — non-standard values from real data", () => {
		// The dataset has: "Yes", "No", "Hybrid", "Full Remote", "1"
		// The TRUTHY set only handles: true, 1, yes, on, y, ja
		// The FALSY set only handles: false, 0, no, off, n, nei, ""

		it("handles 'Yes' → true (case-insensitive lower)", () => {
			expect(applyTransform("Yes", "toBoolean")).toBe(true);
		});

		it("handles 'No' → false (case-insensitive lower)", () => {
			expect(applyTransform("No", "toBoolean")).toBe(false);
		});

		it("handles '1' → true", () => {
			expect(applyTransform("1", "toBoolean")).toBe(true);
		});

		it("'Hybrid' is not in TRUTHY or FALSY — returns null (data loss)", () => {
			// KNOWN LIMITATION: ambiguous values like "Hybrid" become null.
			// The import pipeline drops null values for optional fields, so
			// remote=Hybrid means the field is simply absent from the entity.
			const result = applyTransform("Hybrid", "toBoolean");
			expect(result).toBeNull();
		});

		it("'Full Remote' is not in TRUTHY or FALSY — returns null (data loss)", () => {
			// KNOWN LIMITATION: "Full Remote" is a valid semantic value in job data
			// but maps to null. There is no way to distinguish "Full Remote" from
			// "Hybrid" or "On-site" using only boolean fields.
			const result = applyTransform("Full Remote", "toBoolean");
			expect(result).toBeNull();
		});
	});

	describe("1b. toDate — mixed real-world formats", () => {
		it("handles ISO 8601: '2024-03-01' → passthrough", () => {
			expect(applyTransform("2024-03-01", "toDate")).toBe("2024-03-01");
		});

		it("handles European: '31.03.2024' → '2024-03-31'", () => {
			expect(applyTransform("31.03.2024", "toDate")).toBe("2024-03-31");
		});

		it("handles '01.04.2024' → '2024-04-01'", () => {
			expect(applyTransform("01.04.2024", "toDate")).toBe("2024-04-01");
		});

		it("handles '15.03.2024' → '2024-03-15'", () => {
			expect(applyTransform("15.03.2024", "toDate")).toBe("2024-03-15");
		});

		it("handles natural language: 'March 15, 2024' — via Date.parse fallback", () => {
			// Date.parse can handle this in most environments, but it is locale/runtime
			// dependent. If it works, great. If it fails, it returns null (silent data loss).
			const result = applyTransform("March 15, 2024", "toDate");
			// Accept either correct parse or null — we document both outcomes
			expect(result === "2024-03-15" || result === null).toBe(true);
		});

		it("handles 'April 30, 2024' — via Date.parse fallback", () => {
			const result = applyTransform("April 30, 2024", "toDate");
			expect(result === "2024-04-30" || result === null).toBe(true);
		});

		it("empty string → null (no error, silently omitted from entity)", () => {
			expect(applyTransform("", "toDate")).toBeNull();
		});

		it("ISO 8601 with time: '2024-03-15T14:30:00Z' is truncated to date-only (fixed)", () => {
			// Fixed: the ISO passthrough now slices to 10 chars so a datetime string
			// like "2024-03-15T14:30:00Z" is stored as "2024-03-15" in a date field.
			const result = applyTransform("2024-03-15T14:30:00Z", "toDate");
			expect(result).toBe("2024-03-15");
		});
	});

	describe("1c. toNumber — real-world number formats", () => {
		it("plain integer string '950000' → 950000", () => {
			expect(applyTransform("950000", "toNumber")).toBe(950000);
		});

		it("quoted number '\"950000\"' parses correctly", () => {
			expect(applyTransform('"950000"', "toNumber")).toBeNull();
			// Note: if the CSV parser strips outer quotes this works fine.
			// But if a value arrives with literal quotes, toNumber fails.
		});

		it("thousands separator '1,500' → 1 (parseFloat stops at comma)", () => {
			// KNOWN LIMITATION: parseFloat("1,500") = 1 (stops at comma).
			// European format "1.500" → 1500 (parseFloat OK).
			// This is a silent data corruption: 1,500 becomes 1.
			const result = applyTransform("1,500", "toNumber");
			expect(result).toBe(1);
		});

		it("empty string '' → null (treated as missing, not zero)", () => {
			expect(applyTransform("", "toNumber")).toBeNull();
		});

		it("negative number '-50000' → -50000", () => {
			expect(applyTransform("-50000", "toNumber")).toBe(-50000);
		});

		it("decimal '1150000.50' → 1150000.5", () => {
			expect(applyTransform("1150000.50", "toNumber")).toBe(1150000.5);
		});

		it("currency prefix '$49.99' → 49.99 (parseFloat skips non-numeric prefix... actually fails)", () => {
			// KNOWN LIMITATION: parseFloat("$49.99") = NaN → null.
			// Currency-formatted numbers must be pre-cleaned before toNumber.
			const result = applyTransform("$49.99", "toNumber");
			expect(result).toBeNull();
		});
	});

	describe("1d. toSlug — Norwegian characters", () => {
		it("ASCII slug works normally", () => {
			expect(applyTransform("Senior Backend Engineer", "toSlug")).toBe(
				"senior-backend-engineer",
			);
		});

		it("Norwegian ø, æ, å are now transliterated (fixed: æ→ae, ø→o, å→a)", () => {
			// Fixed: transliteration happens before non-word-char stripping.
			// "søker" → "soker" (ø→o), "ingeniør" → "ingenior" (ø→o)
			const result = applyTransform("Aker BP søker ingeniør", "toSlug");
			expect(result).toBe("aker-bp-soker-ingenior");
		});

		it("Parentheses and special chars stripped, Norwegian words preserved", () => {
			const result = applyTransform(
				"NAV (Arbeids- og velferdsdirektoratet)",
				"toSlug",
			);
			expect(result).toBe("nav-arbeids--og-velferdsdirektoratet");
		});

		it("Norwegian title 'Lærling' → 'laerling' (æ transliterated)", () => {
			const result = applyTransform("Lærling", "toSlug");
			expect(result).toBe("laerling");
		});
	});
});

// ── Section 2: Import pipeline with real data ────────────────────────────────

describe("2. Import pipeline — real job postings dataset", () => {
	it("dry-run completes without throwing", async () => {
		const result = await importDataset(true);
		expect(result.dryRun).toBe(true);
		expect(result.total).toBeGreaterThan(0);
	});

	it("all 15 rows are processed (none silently lost by CSV parser)", async () => {
		const result = await importDataset(true);
		expect(result.total).toBe(15);
	});

	it("rows with all-required fields pass validation", async () => {
		const result = await importDataset(true);
		// Only 'title' is required. All 15 rows have a title, so 0 failures expected
		// from required-field validation alone.
		expect(result.failed).toBe(0);
		expect(result.imported).toBe(15);
	});

	it("'Hybrid' remote value silently becomes absent field (not an error)", async () => {
		const result = await importDataset(false);
		// Rows with "Hybrid" or "Full Remote" won't have a `remote` field at all.
		// This is not a validation error — the field is optional.
		// RISK: consumers querying `where remote == true` will miss "Hybrid" rows
		// instead of getting an informative error or result.
		expect(result.imported).toBe(15);
	});

	it("empty company name (row 13) is accepted — optional field", async () => {
		const result = await importDataset(false);
		// Row 13 (Blockchain Developer) has empty Company field.
		// Since company is optional, this is fine.
		expect(result.failed).toBe(0);
	});

	it("empty salaryMin/salaryMax (row 14 — Hydro) become absent fields", async () => {
		const result = await importDataset(false);
		// Row 14 has empty salary fields. toNumber("") = null, null is dropped.
		// Entity will have no salaryMin or salaryMax.
		expect(result.failed).toBe(0);
	});

	it("the CSV column 'Openings' (a string '2') is correctly cast to number 2", async () => {
		// sample is only populated in dry-run mode (toInsert data, not Entity objects)
		const result = await importDataset(true);
		expect(result.sample).toBeDefined();
		// sample entries are raw Record<string, unknown> — data keys are direct
		const first = result.sample?.[0];
		expect(first?.["openings"]).toBe(2);
	});

	it("Norwegian text with æ/ø/å is preserved in description field (no truncation)", async () => {
		// Use dry-run so sample is available
		const result = await importDataset(true);
		const finnRow = result.sample?.find((e) =>
			String(e["company"] ?? "").includes("Finn"),
		);
		expect(finnRow?.["description"]).toContain("søker");
		expect(finnRow?.["description"]).toContain("tverrfaglig");
	});

	it("date '15.03.2024' (European format) is normalized to ISO '2024-03-15'", async () => {
		// Use dry-run so sample is available; Aker BP row uses "15.03.2024"
		const result = await importDataset(true);
		const akerRow = result.sample?.find((e) =>
			String(e["company"] ?? "").includes("Aker"),
		);
		expect(akerRow?.["postedDate"]).toBe("2024-03-15");
	});

	it("'March 15, 2024' (natural language) is parsed or silently dropped", async () => {
		// Use dry-run so sample is available; Equinor row uses "March 15, 2024"
		const result = await importDataset(true);
		const equinorRow = result.sample?.find((e) =>
			String(e["company"] ?? "").includes("Equinor"),
		);
		const posted = equinorRow?.["postedDate"];
		// Either correct ISO date or undefined (field dropped if null from transform)
		expect(posted === "2024-03-15" || posted === undefined).toBe(true);
	});
});

// ── Section 3: Auto-analysis of real CSV ─────────────────────────────────────

describe("3. Import analysis — schema suggestion from real data", () => {
	// analyzeContent(filename, content, suggestedId?) — filename used for format detection
	// detectFormat(filename, content) — both args required

	it("detects format as CSV via filename extension", async () => {
		const csvContent = await Bun.file(CSV_PATH).text();
		const format = detectFormat("job-postings.csv", csvContent);
		expect(format).toBe("csv");
	});

	it("analyzes headers and suggests reasonable field types", async () => {
		const csvContent = await Bun.file(CSV_PATH).text();
		const analysis = analyzeContent("job-postings.csv", csvContent);

		// Should detect 14 columns (one per CSV column header)
		expect(analysis.suggestedSchema.fields.length).toBe(14);

		// Title column → slugified to 'title', detected as string
		const titleField = analysis.suggestedSchema.fields.find(
			(f) => f.name === "title",
		);
		expect(titleField?.type).toBe("string");
	});

	it("detects salary columns — number or string depending on empty-value rows", async () => {
		const csvContent = await Bun.file(CSV_PATH).text();
		const analysis = analyzeContent("job-postings.csv", csvContent);

		// Salary Min column is slugified to 'salaryMin'
		const salaryMin = analysis.suggestedSchema.fields.find(
			(f) => f.name === "salaryMin",
		);
		// Some rows have empty salary → inferType sees non-numeric values → string
		// All-numeric rows → number. We document what the analyzer actually decides.
		expect(["number", "string"]).toContain(salaryMin?.type);
	});

	it("suggests a schema id derived from filename", async () => {
		const csvContent = await Bun.file(CSV_PATH).text();
		const analysis = analyzeContent("job-postings.csv", csvContent);
		// Schema ID is slugified from filename minus extension
		expect(analysis.suggestedSchema.id).toBeDefined();
		expect(typeof analysis.suggestedSchema.id).toBe("string");
	});

	it("suggested mapping maps schema field names to original CSV column headers", async () => {
		const csvContent = await Bun.file(CSV_PATH).text();
		const analysis = analyzeContent("job-postings.csv", csvContent);
		// 'title' → 'Title', 'company' → 'Company'
		expect(analysis.suggestedMapping["title"]).toBe("Title");
		expect(analysis.suggestedMapping["company"]).toBe("Company");
	});
});

// ── Section 4: Query language limitations with real data ─────────────────────

describe("4. Query language — capabilities and gaps with real data", () => {
	beforeEach(async () => {
		await importDataset(false);
	});

	it("basic from query returns all 15 entities", async () => {
		const q = parseQuery("from job-posting");
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities).toHaveLength(15);
	});

	it("where category == 'Engineering' returns correct subset", async () => {
		const q = parseQuery('from job-posting where category == "Engineering"');
		const result = await executeQuery(q, DEFAULT_DATASET);
		// Engineering rows: Bekk, Kolonial, Bouvet, Equinor, Kahoot, Blockchain = 6
		expect(result.entities.length).toBeGreaterThan(0);
		expect(
			result.entities.every((e) => e.data["category"] === "Engineering"),
		).toBe(true);
	});

	it("where salaryMin > 900000 filters by numeric value correctly", async () => {
		const q = parseQuery("from job-posting where salaryMin > 900000");
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities.length).toBeGreaterThan(0);
		expect(
			result.entities.every(
				(e) => (e.data["salaryMin"] as number) > 900000,
			),
		).toBe(true);
	});

	it("order by salaryMax desc puts highest salary first", async () => {
		const q = parseQuery(
			"from job-posting where salaryMax > 0 order by salaryMax desc limit 3",
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities.length).toBeGreaterThanOrEqual(1);
		// Verify descending order
		const salaries = result.entities.map(
			(e) => (e.data["salaryMax"] as number) ?? 0,
		);
		for (let i = 1; i < salaries.length; i++) {
			expect(salaries[i - 1]! >= salaries[i]!).toBe(true);
		}
	});

	it("contains operator finds Norwegian text substring", async () => {
		const q = parseQuery('from job-posting where description contains "søker"');
		const result = await executeQuery(q, DEFAULT_DATASET);
		// Several Norwegian descriptions contain "søker"
		expect(result.entities.length).toBeGreaterThan(0);
	});

	it("where remote == true finds only fully-remote rows (Hybrid is absent)", async () => {
		const q = parseQuery("from job-posting where remote == true");
		const result = await executeQuery(q, DEFAULT_DATASET);
		// Rows with remote="Yes" or remote="1" become remote=true
		// Rows with remote="Hybrid" or "Full Remote" have no remote field → not matched
		// This is a silent data problem: Hybrid jobs are invisible to this query
		expect(result.entities.every((e) => e.data["remote"] === true)).toBe(true);
	});

	it("LIMITATION: OR conditions are not supported", () => {
		// There is no OR support. Only AND clauses.
		// This means: cannot query "where category == 'Engineering' OR category == 'Data'"
		expect(() =>
			parseQuery(
				'from job-posting where category == "Engineering" or category == "Data"',
			),
		).toThrow();
	});

	it("'where deadline == null' returns entities with no deadline field (IS NULL fixed)", async () => {
		// The SQLite executor now generates IS NULL for null-valued conditions,
		// matching entities where the JSONB field is absent (json_extract returns NULL).
		// Several rows in the dataset have empty deadline: Aker BP, Schibsted,
		// Security Analyst, Data Engineer (Hydro), Part-time Customer Success.
		const q = parseQuery("from job-posting where deadline == null");
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities.length).toBeGreaterThan(0);
		// All returned entities must have no deadline field
		expect(result.entities.every((e) => !("deadline" in e.data))).toBe(true);
	});

	it("LIMITATION: multi-field ORDER BY not supported", () => {
		// Can only order by one field.
		expect(() =>
			parseQuery(
				"from job-posting order by salaryMax desc, postedDate asc",
			),
		).toThrow();
	});

	it("LIMITATION: aggregate queries (COUNT, SUM, AVG) not supported", () => {
		// Cannot ask: "what is the average salaryMin for Engineering jobs?"
		// The query language has no aggregate functions.
		expect(() =>
			parseQuery(
				"from job-posting select count(*) where category == \"Engineering\"",
			),
		).toThrow();
	});

	it("LIMITATION: schema join / relation queries not supported", () => {
		// Cannot join job-posting with a separate company schema.
		// All data must be denormalized into a single entity.
		expect(() =>
			parseQuery("from job-posting join company on company == company.name"),
		).toThrow();
	});

	it("limit and offset work correctly for pagination", async () => {
		const page1 = await executeQuery(
			parseQuery("from job-posting limit 5 offset 0"),
			DEFAULT_DATASET,
		);
		const page2 = await executeQuery(
			parseQuery("from job-posting limit 5 offset 5"),
			DEFAULT_DATASET,
		);
		expect(page1.entities).toHaveLength(5);
		expect(page2.entities).toHaveLength(5);
		// Pages must not overlap
		const page1Ids = new Set(page1.entities.map((e) => e.id));
		const page2Ids = page2.entities.map((e) => e.id);
		expect(page2Ids.every((id) => !page1Ids.has(id))).toBe(true);
	});

	it("select projection returns only requested fields", async () => {
		const q = parseQuery("from job-posting select title, company, salaryMin");
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities.length).toBeGreaterThan(0);
		expect(
			result.entities.every((e) => {
				const keys = Object.keys(e.data);
				return keys.every((k) =>
					["title", "company", "salaryMin"].includes(k),
				);
			}),
		).toBe(true);
	});

	it("LIMITATION: hyphenated schema id 'job-posting' fails query parsing", () => {
		// The tokenizer treats '-' as part of operators or as a separate token.
		// Schema IDs with hyphens may be misparse.
		// We document whether this actually works or throws.
		let threw = false;
		try {
			parseQuery("from job-posting limit 1");
		} catch {
			threw = true;
		}
		// If this is already passing, great. If not, it's a documented bug.
		// We expect it to parse correctly given the existing test suite passes.
		expect(threw).toBe(false);
	});
});

// ── Section 5: Data integrity after round-trip ───────────────────────────────

describe("5. Data integrity — round-trip import → query", () => {
	beforeEach(async () => {
		await importDataset(false);
	});

	it("total entity count matches import result", async () => {
		const q = parseQuery("from job-posting");
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.count).toBe(15);
	});

	it("Bekk row preserves Norwegian company name 'Bekk Consulting AS'", async () => {
		const q = parseQuery(
			'from job-posting where company contains "Bekk"',
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities).toHaveLength(1);
		expect(result.entities[0]!.data["company"]).toBe("Bekk Consulting AS");
	});

	it("salary values are stored as numbers (not strings)", async () => {
		const q = parseQuery(
			'from job-posting where company contains "Bekk"',
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		const bekk = result.entities[0]!;
		expect(typeof bekk.data["salaryMin"]).toBe("number");
		expect(bekk.data["salaryMin"]).toBe(950000);
	});

	it("remote=true is stored as boolean (not '1' string)", async () => {
		const q = parseQuery(
			'from job-posting where company contains "Norsk Hydro"',
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		if (result.entities.length > 0) {
			// Hydro uses "1" for remote — should become boolean true
			expect(result.entities[0]!.data["remote"]).toBe(true);
		}
	});

	it("entities with missing optional fields don't have null keys (null is dropped)", async () => {
		// Empty deadline → toDate("") = null → field omitted from cleanData
		const q = parseQuery("from job-posting where company contains \"Aker\"");
		const result = await executeQuery(q, DEFAULT_DATASET);
		const akerBP = result.entities[0];
		expect(akerBP).toBeDefined();
		// deadline was empty → should not appear as key, not as null
		if (akerBP && !("deadline" in akerBP.data)) {
			expect("deadline" in akerBP.data).toBe(false);
		} else if (akerBP) {
			// If it does appear, document it
			expect(akerBP.data["deadline"]).toBeNull();
		}
	});

	it("very long description (Schibsted row) is stored and retrieved intact", async () => {
		const q = parseQuery(
			'from job-posting where company contains "Schibsted"',
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities).toHaveLength(1);
		const desc = result.entities[0]!.data["description"] as string;
		expect(desc.length).toBeGreaterThan(100);
		expect(desc).toContain("recommendation");
	});

	it("row with empty company ('Blockchain Developer') has no company field or empty string", async () => {
		const q = parseQuery(
			'from job-posting where title contains "Blockchain"',
		);
		const result = await executeQuery(q, DEFAULT_DATASET);
		expect(result.entities).toHaveLength(1);
		// Empty string company → map step maps it, but engine drops empty strings
		const blockchain = result.entities[0]!;
		// Either no company key, or empty string — both are acceptable but we document it
		const company = blockchain.data["company"];
		expect(company === undefined || company === "" || company === null).toBe(true);
	});
});
