import { describe, expect, test } from "bun:test";
import { canPushdownWhere } from "../storage/plan-executor";

describe("canPushdownWhere", () => {
	test("empty and simple comparisons are safe", () => {
		expect(canPushdownWhere()).toBe(true);
		expect(
			canPushdownWhere({
				type: "condition",
				condition: { field: "countyId", op: "==", value: "03" },
			}),
		).toBe(true);
		expect(
			canPushdownWhere({
				type: "and",
				exprs: [
					{
						type: "condition",
						condition: { field: "countyId", op: "==", value: "03" },
					},
					{
						type: "condition",
						condition: { field: "name", op: "contains", value: "Oslo" },
					},
				],
			}),
		).toBe(true);
	});

	test("NOT and EXISTS are not pushdown-safe", () => {
		expect(
			canPushdownWhere({
				type: "not",
				expr: {
					type: "condition",
					condition: { field: "countyId", op: "==", value: "03" },
				},
			}),
		).toBe(false);
		expect(
			canPushdownWhere({
				type: "condition",
				condition: { field: "countyId", op: "exists" },
			}),
		).toBe(false);
	});
});
