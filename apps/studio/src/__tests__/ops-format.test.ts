import { describe, expect, test } from "bun:test";
import {
	formatErrorItem,
	formatErrorList,
	formatErrorPreview,
	linkedDefinitionIds,
	pickEntityColumns,
} from "../lib/ops-format";

describe("formatErrorItem", () => {
	test("string and message objects", () => {
		expect(formatErrorItem("boom")).toBe("boom");
		expect(formatErrorItem({ row: 3, message: "bad ref" })).toBe(
			"row 3: bad ref",
		);
	});
});

describe("formatErrorList / preview", () => {
	test("empty", () => {
		expect(formatErrorList(undefined)).toEqual([]);
		expect(formatErrorPreview([])).toBe("");
	});

	test("truncates preview", () => {
		const errors = ["a", "b", "c", "d"];
		expect(formatErrorPreview(errors, 2)).toBe("a; b (+2 more)");
		expect(formatErrorList(errors)).toHaveLength(4);
	});
});

describe("linkedDefinitionIds", () => {
	test("unions config ids and saved imports by sourceId", () => {
		const ids = linkedDefinitionIds(
			{ id: "kartverket", config: { definitionIds: ["counties"] } },
			[
				{ id: "counties", sourceId: "kartverket" },
				{ id: "postal-codes", sourceId: "kartverket" },
				{ id: "other", sourceId: "ssb" },
			],
		);
		expect(ids).toEqual(["counties", "postal-codes"]);
	});
});

describe("pickEntityColumns", () => {
	test("uses featured columns when present", () => {
		expect(
			pickEntityColumns({ name: "Oslo", countyId: "03", extra: 1 }, [
				"id",
				"name",
				"countyId",
			]),
		).toEqual(["id", "name", "countyId"]);
	});

	test("falls back to first keys", () => {
		expect(pickEntityColumns({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
		]);
	});
});
