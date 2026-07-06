import { describe, expect, it } from "bun:test";
import { applyTransform } from "../pipeline/transforms";

describe("applyTransform", () => {
	describe("toBoolean", () => {
		it("converts truthy strings to true", () => {
			for (const v of ["true", "1", "yes", "on", "y", "ja"]) {
				expect(applyTransform(v, "toBoolean")).toBe(true);
			}
		});

		it("converts falsy strings to false", () => {
			for (const v of ["false", "0", "no", "off", "n", "nei", ""]) {
				expect(applyTransform(v, "toBoolean")).toBe(false);
			}
		});

		it("is case-insensitive", () => {
			expect(applyTransform("YES", "toBoolean")).toBe(true);
			expect(applyTransform("NO", "toBoolean")).toBe(false);
			expect(applyTransform("JA", "toBoolean")).toBe(true);
			expect(applyTransform("NEI", "toBoolean")).toBe(false);
		});

		it("returns null for unrecognised values", () => {
			expect(applyTransform("maybe", "toBoolean")).toBeNull();
		});

		it("handles null/undefined input", () => {
			expect(applyTransform(null, "toBoolean")).toBe(false);
			expect(applyTransform(undefined, "toBoolean")).toBe(false);
		});
	});

	describe("toNumber", () => {
		it("converts numeric strings", () => {
			expect(applyTransform("42", "toNumber")).toBe(42);
			expect(applyTransform("3.14", "toNumber")).toBe(3.14);
			expect(applyTransform("-7", "toNumber")).toBe(-7);
		});

		it("returns null for non-numeric strings", () => {
			expect(applyTransform("abc", "toNumber")).toBeNull();
			expect(applyTransform("", "toNumber")).toBeNull();
		});

		it("passes through numbers", () => {
			expect(applyTransform(99, "toNumber")).toBe(99);
		});
	});

	describe("toDate", () => {
		it("passes ISO dates through", () => {
			expect(applyTransform("2024-01-15", "toDate")).toBe("2024-01-15");
		});

		it("converts DD.MM.YYYY to ISO", () => {
			expect(applyTransform("15.01.2024", "toDate")).toBe("2024-01-15");
		});

		it("converts MM/DD/YYYY to ISO", () => {
			expect(applyTransform("01/15/2024", "toDate")).toBe("2024-01-15");
		});

		it("returns null for invalid dates", () => {
			expect(applyTransform("not-a-date", "toDate")).toBeNull();
			expect(applyTransform("", "toDate")).toBeNull();
		});
	});

	describe("toSlug", () => {
		it("slugifies normal text", () => {
			expect(applyTransform("Hello World", "toSlug")).toBe("hello-world");
		});

		it("removes special characters", () => {
			expect(applyTransform("Café & Bar!", "toSlug")).toBe("caf-bar");
		});

		it("collapses multiple dashes", () => {
			expect(applyTransform("foo  bar", "toSlug")).toBe("foo-bar");
		});

		it("trims leading/trailing dashes", () => {
			expect(applyTransform("  hello  ", "toSlug")).toBe("hello");
		});
	});

	describe("trim", () => {
		it("trims whitespace", () => {
			expect(applyTransform("  hello  ", "trim")).toBe("hello");
		});

		it("handles already-trimmed strings", () => {
			expect(applyTransform("hello", "trim")).toBe("hello");
		});
	});

	describe("toLowerCase / toUpperCase", () => {
		it("lowercases", () => {
			expect(applyTransform("Hello WORLD", "toLowerCase")).toBe("hello world");
		});

		it("uppercases", () => {
			expect(applyTransform("Hello World", "toUpperCase")).toBe("HELLO WORLD");
		});
	});

	describe("unknown transform", () => {
		it("returns the value unchanged for unknown transforms", () => {
			// @ts-expect-error testing unknown transform
			expect(applyTransform("value", "unknownFn")).toBe("value");
		});
	});
});
