import { describe, expect, it } from "bun:test";
import {
	analyzeContent,
	detectDelimiter,
	detectFormat,
	slugifyFieldName,
} from "../import/analyze";

describe("slugifyFieldName", () => {
	it("lowercases and camelCases multi-word names", () => {
		expect(slugifyFieldName("First Name")).toBe("firstName");
		expect(slugifyFieldName("product title")).toBe("productTitle");
	});

	it("handles single-word names", () => {
		expect(slugifyFieldName("Title")).toBe("title");
	});

	it("strips special characters and camelCases remaining words", () => {
		// "price (USD)" → removes parens → "price USD" → camelCase → "priceUsd"
		expect(slugifyFieldName("price (USD)")).toBe("priceUsd");
	});

	it("returns 'field' for empty/unusable input", () => {
		expect(slugifyFieldName("---")).toBe("field");
		expect(slugifyFieldName("   ")).toBe("field");
	});
});

describe("detectFormat", () => {
	it("detects json by filename extension", () => {
		expect(detectFormat("data.json", "")).toBe("json");
	});

	it("detects csv by filename extension", () => {
		expect(detectFormat("data.csv", "")).toBe("csv");
	});

	it("detects json by content starting with [", () => {
		expect(detectFormat("file.txt", '[{"id":1}]')).toBe("json");
	});

	it("detects json by content starting with {", () => {
		expect(detectFormat("file.txt", '{"id":1}')).toBe("json");
	});

	it("falls back to csv for plain text", () => {
		expect(detectFormat("file.txt", "name,age\nAlice,30")).toBe("csv");
	});
});

describe("detectDelimiter", () => {
	it("detects comma as default", () => {
		expect(detectDelimiter("name,age,city\nAlice,30,Oslo")).toBe(",");
	});

	it("detects semicolon delimiter", () => {
		expect(detectDelimiter("name;age;city\nAlice;30;Oslo")).toBe(";");
	});

	it("detects tab delimiter", () => {
		expect(detectDelimiter("name\tage\tcity\nAlice\t30\tOslo")).toBe("\t");
	});

	it("detects pipe delimiter", () => {
		expect(detectDelimiter("name|age|city\nAlice|30|Oslo")).toBe("|");
	});

	it("returns comma for empty content", () => {
		expect(detectDelimiter("")).toBe(",");
	});
});

describe("analyzeContent", () => {
	const csvContent = `title,price,available,created_at
Widget A,29.99,yes,15.01.2024
Widget B,49.50,no,20.02.2024
Widget C,9.99,ja,01.03.2024`;

	const jsonContent = JSON.stringify([
		{ title: "Widget A", price: 29.99, available: true },
		{ title: "Widget B", price: 49.5, available: false },
	]);

	it("returns correct format for CSV", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.format).toBe("csv");
	});

	it("returns correct format for JSON", () => {
		const r = analyzeContent("products.json", jsonContent);
		expect(r.format).toBe("json");
	});

	it("extracts correct column names from CSV", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.columns).toEqual(["title", "price", "available", "created_at"]);
	});

	it("returns correct row count", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.rowCount).toBe(3);
	});

	it("infers number type for price column", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.inferredTypes["price"]).toBe("number");
	});

	it("infers boolean type for available column (ja/nei)", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.inferredTypes["available"]).toBe("boolean");
	});

	it("infers date type for created_at column (DD.MM.YYYY)", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.inferredTypes["created_at"]).toBe("date");
	});

	it("infers string type for title column", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.inferredTypes["title"]).toBe("string");
	});

	it("generates a suggested schema", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.suggestedSchema.fields).toHaveLength(4);
		expect(r.suggestedSchema.fields.some((f) => f.name === "title")).toBe(true);
	});

	it("generates suggested mapping (slugified field → original column)", () => {
		const r = analyzeContent("products.csv", csvContent);
		// "created_at" slugifies to "created_at" (underscore is a word char, not a separator)
		expect(r.suggestedMapping["created_at"]).toBe("created_at");
		expect(r.suggestedMapping["title"]).toBe("title");
	});

	it("includes transforms for non-string types", () => {
		const r = analyzeContent("products.csv", csvContent);
		const fns = r.suggestedTransforms.map((t) => t.fn);
		expect(fns).toContain("toNumber");
		expect(fns).toContain("toBoolean");
		expect(fns).toContain("toDate");
	});

	it("includes a preview of up to 10 rows", () => {
		const r = analyzeContent("products.csv", csvContent);
		expect(r.preview.length).toBeLessThanOrEqual(10);
		expect(r.preview.length).toBeGreaterThan(0);
	});

	it("throws for JSON that is not an array", () => {
		expect(() => analyzeContent("data.json", '{"key":"value"}')).toThrow();
	});

	it("uses suggestedId when provided", () => {
		const r = analyzeContent("products.csv", csvContent, "my-custom-id");
		expect(r.suggestedSchema.id).toBe("my-custom-id");
	});
});
