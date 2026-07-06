import { describe, expect, it } from "bun:test";
import type { SchemaDefinition } from "../schema/types";
import { validateEntity, validateSchemaDefinition } from "../schema/validator";

const articleSchema: SchemaDefinition = {
	id: "article",
	name: "Article",
	fields: [
		{ name: "title", type: "string", required: true },
		{ name: "published", type: "boolean", required: true },
		{ name: "views", type: "number" },
		{ name: "createdAt", type: "date" },
		{ name: "tags", type: "string[]" },
	],
};

describe("validateEntity", () => {
	it("accepts a fully valid entity", () => {
		const result = validateEntity(
			{
				title: "Hello",
				published: true,
				views: 42,
				createdAt: "2024-01-01",
				tags: ["a", "b"],
			},
			articleSchema,
		);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("accepts an entity missing optional fields", () => {
		const result = validateEntity(
			{ title: "Minimal", published: false },
			articleSchema,
		);
		expect(result.valid).toBe(true);
	});

	it("rejects a missing required field", () => {
		const result = validateEntity({ title: "No published" }, articleSchema);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("published"))).toBe(true);
	});

	it("rejects wrong type for string field", () => {
		const result = validateEntity(
			{ title: 42, published: true },
			articleSchema,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("title"))).toBe(true);
	});

	it("rejects wrong type for number field", () => {
		const result = validateEntity(
			{ title: "ok", published: true, views: "many" },
			articleSchema,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("views"))).toBe(true);
	});

	it("rejects wrong type for boolean field", () => {
		const result = validateEntity(
			{ title: "ok", published: "yes" },
			articleSchema,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("published"))).toBe(true);
	});

	it("rejects invalid ISO date", () => {
		const result = validateEntity(
			{ title: "ok", published: true, createdAt: "01.01.2024" },
			articleSchema,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("createdAt"))).toBe(true);
	});

	it("accepts valid ISO date with time", () => {
		const result = validateEntity(
			{ title: "ok", published: true, createdAt: "2024-01-15T12:00:00Z" },
			articleSchema,
		);
		expect(result.valid).toBe(true);
	});

	it("rejects non-string-array for string[] field", () => {
		const result = validateEntity(
			{ title: "ok", published: true, tags: [1, 2] },
			articleSchema,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("tags"))).toBe(true);
	});

	it("accumulates multiple errors", () => {
		const result = validateEntity({}, articleSchema);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});
});

describe("validateSchemaDefinition", () => {
	it("accepts a valid schema definition", () => {
		const result = validateSchemaDefinition({
			id: "product",
			name: "Product",
			fields: [
				{ name: "title", type: "string" },
				{ name: "price", type: "number" },
			],
		});
		expect(result.valid).toBe(true);
	});

	it("rejects non-object input", () => {
		expect(validateSchemaDefinition(null).valid).toBe(false);
		expect(validateSchemaDefinition("string").valid).toBe(false);
		expect(validateSchemaDefinition(42).valid).toBe(false);
	});

	it("requires id field", () => {
		const result = validateSchemaDefinition({ name: "X", fields: [] });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("id"))).toBe(true);
	});

	it("requires name field", () => {
		const result = validateSchemaDefinition({ id: "x", fields: [] });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("name"))).toBe(true);
	});

	it("requires fields array", () => {
		const result = validateSchemaDefinition({ id: "x", name: "X" });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("fields"))).toBe(true);
	});

	it("rejects fields with invalid type", () => {
		const result = validateSchemaDefinition({
			id: "x",
			name: "X",
			fields: [{ name: "foo", type: "uuid" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("uuid"))).toBe(true);
	});

	it("rejects fields missing name", () => {
		const result = validateSchemaDefinition({
			id: "x",
			name: "X",
			fields: [{ type: "string" }],
		});
		expect(result.valid).toBe(false);
	});

	it("accepts all valid field types", () => {
		const types = [
			"string",
			"number",
			"boolean",
			"date",
			"reference",
			"string[]",
			"number[]",
		];
		for (const type of types) {
			const r = validateSchemaDefinition({
				id: "x",
				name: "X",
				fields: [{ name: "f", type }],
			});
			expect(r.valid).toBe(true);
		}
	});
});
