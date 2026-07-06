import { describe, expect, it } from "bun:test";
import { parseCsv } from "../import/sources/csv";

describe("parseCsv", () => {
	describe("basic parsing", () => {
		it("parses a minimal CSV", () => {
			const result = parseCsv("name,age\nAlice,30\nBob,25");
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ name: "Alice", age: "30" });
			expect(result[1]).toEqual({ name: "Bob", age: "25" });
		});

		it("returns empty array for header-only CSV", () => {
			expect(parseCsv("name,age")).toHaveLength(0);
		});

		it("returns empty array for empty input", () => {
			expect(parseCsv("")).toHaveLength(0);
		});

		it("ignores empty lines", () => {
			const result = parseCsv("name,age\nAlice,30\n\nBob,25\n");
			expect(result).toHaveLength(2);
		});

		it("trims header names", () => {
			const result = parseCsv(" name , age \nAlice,30");
			expect(result[0]).toHaveProperty("name");
			expect(result[0]).toHaveProperty("age");
		});
	});

	describe("quoted fields", () => {
		it("handles quoted values with commas", () => {
			const result = parseCsv('name,address\nAlice,"123 Main St, Apt 4"');
			expect(result[0]!["address"]).toBe("123 Main St, Apt 4");
		});

		it("handles escaped quotes inside quoted fields", () => {
			const result = parseCsv('name,bio\nAlice,"She said ""hello"""');
			expect(result[0]!["bio"]).toBe('She said "hello"');
		});

		it("handles quoted fields with newlines", () => {
			const result = parseCsv('name,note\nAlice,"line one\nline two"');
			expect(result[0]!["note"]).toBe("line one\nline two");
		});
	});

	describe("custom delimiters", () => {
		it("parses semicolon-separated CSV", () => {
			const result = parseCsv("name;age\nAlice;30", ";");
			expect(result[0]).toEqual({ name: "Alice", age: "30" });
		});

		it("parses tab-separated values", () => {
			const result = parseCsv("name\tage\nAlice\t30", "\t");
			expect(result[0]).toEqual({ name: "Alice", age: "30" });
		});

		it("parses pipe-separated values", () => {
			const result = parseCsv("name|age\nAlice|30", "|");
			expect(result[0]).toEqual({ name: "Alice", age: "30" });
		});
	});

	describe("missing values", () => {
		it("fills missing columns with empty string", () => {
			const result = parseCsv("a,b,c\n1,2");
			expect(result[0]!["c"]).toBe("");
		});
	});

	describe("CRLF line endings", () => {
		it("handles Windows CRLF", () => {
			const result = parseCsv("name,age\r\nAlice,30\r\nBob,25");
			expect(result).toHaveLength(2);
			expect(result[0]!["name"]).toBe("Alice");
		});
	});
});
