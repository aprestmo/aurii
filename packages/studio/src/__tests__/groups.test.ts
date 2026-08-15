import { describe, expect, test } from "bun:test";
import { defineStudio, collection } from "../index";
import {
	collectionColumns,
	collectionColumnsBySchema,
	groupItemsByIds,
	importGroupsFromConfig,
	routeGroupsFromConfig,
} from "../groups";

describe("groupItemsByIds", () => {
	const items = [
		{ id: "counties", name: "Counties" },
		{ id: "municipalities", name: "Municipalities" },
		{ id: "schools", name: "Schools" },
	];

	test("returns a single untitled section when no groups", () => {
		const grouped = groupItemsByIds(items, undefined, (i) => i.id);
		expect(grouped).toEqual([{ title: "", items }]);
	});

	test("returns empty when there are no items", () => {
		expect(groupItemsByIds([], [{ title: "A", ids: ["x"] }], (i) => i.id)).toEqual(
			[],
		);
	});

	test("partitions by declared groups and leftover Other", () => {
		const grouped = groupItemsByIds(
			items,
			[
				{ title: "Kjerne", ids: ["counties", "municipalities"] },
				{ title: "Tom", ids: ["missing"] },
			],
			(i) => i.id,
		);
		expect(grouped.map((g) => g.title)).toEqual(["Kjerne", "Other"]);
		expect(grouped[0]!.items.map((i) => i.id)).toEqual([
			"counties",
			"municipalities",
		]);
		expect(grouped[1]!.items.map((i) => i.id)).toEqual(["schools"]);
	});
});

describe("import / route groups from defineStudio", () => {
	const cfg = defineStudio({
		title: "NG",
		importGroups: [
			{ title: "Kjerne", definitionIds: ["counties", "municipalities"] },
		],
		routeGroups: [{ title: "Offentlig v1", routeIds: ["counties"] }],
		navigation: [
			{
				title: "Geo",
				items: [
					collection("county", { columns: ["id", "name"] }),
					collection("municipality", { columns: ["id", "name", "countyId"] }),
				],
			},
		],
	});

	test("maps importGroups definitionIds", () => {
		expect(importGroupsFromConfig(cfg)).toEqual([
			{ title: "Kjerne", ids: ["counties", "municipalities"] },
		]);
	});

	test("maps routeGroups routeIds", () => {
		expect(routeGroupsFromConfig(cfg)).toEqual([
			{ title: "Offentlig v1", ids: ["counties"] },
		]);
	});

	test("collectionColumns reads featured columns from nav", () => {
		expect(collectionColumns(cfg, "municipality")).toEqual([
			"id",
			"name",
			"countyId",
		]);
		expect(collectionColumns(cfg, "postal-code")).toBeUndefined();
		expect(collectionColumnsBySchema(cfg)["county"]).toEqual(["id", "name"]);
	});
});
