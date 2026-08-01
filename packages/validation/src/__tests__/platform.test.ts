import { describe, expect, test } from "bun:test";
import {
	validateCronExpression,
	validateProjectConfigShape,
	validatePublishedRouteDefinition,
	validateScheduleSpec,
} from "../index";

describe("schedule validation", () => {
	test("valid cron", () => {
		const r = validateCronExpression("0 4 * * *");
		expect(r.success).toBe(true);
	});
	test("invalid cron rejected", () => {
		expect(validateCronExpression("bad").success).toBe(false);
	});
	test("schedule spec with timezone", () => {
		const r = validateScheduleSpec({
			type: "cron",
			expression: "0 4 * * *",
			timezone: "Europe/Oslo",
		});
		expect(r.success).toBe(true);
	});
});

describe("project config shape", () => {
	test("requires core link", () => {
		expect(validateProjectConfigShape({ id: "x", title: "X" }).success).toBe(
			false,
		);
	});
	test("accepts minimal valid config", () => {
		const r = validateProjectConfigShape({
			id: "x",
			title: "X",
			core: { projectSlug: "x", defaultDataset: "d" },
		});
		expect(r.success).toBe(true);
	});
});

describe("published route definition", () => {
	test("requires path starting with /", () => {
		expect(
			validatePublishedRouteDefinition({
				id: "a",
				path: "counties",
				method: "GET",
				query: { schema: "county" },
			}).success,
		).toBe(false);
	});
	test("valid route", () => {
		expect(
			validatePublishedRouteDefinition({
				id: "a",
				path: "/counties",
				method: "GET",
				query: { schema: "county", select: ["id"] },
			}).success,
		).toBe(true);
	});
});
