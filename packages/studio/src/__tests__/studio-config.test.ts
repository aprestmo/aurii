import { describe, expect, test } from "bun:test";
import {
	collection,
	defaultStudioConfig,
	defineStudio,
	imports,
	resolveStudioConfig,
	sources,
	StudioConfigError,
} from "../index";

describe("defineStudio", () => {
	test("returns config as-is", () => {
		const cfg = defineStudio({
			title: "Norwegian Geo",
			navigation: [
				{
					title: "Geografi",
					items: [collection("county", { columns: ["id", "name"] })],
				},
				{ title: "Data", items: [sources(), imports()] },
			],
		});
		expect(cfg.title).toBe("Norwegian Geo");
		expect(cfg.navigation?.[0]?.items[0]?.schemaId).toBe("county");
	});

	test("default studio works without project config", () => {
		const cfg = resolveStudioConfig(null);
		expect(cfg.navigation?.length).toBeGreaterThan(0);
		expect(cfg.title).toContain("Aurii");
	});

	test("unknown schema fails when known list provided", () => {
		expect(() =>
			resolveStudioConfig(
				defineStudio({
					title: "T",
					navigation: [
						{ title: "G", items: [collection("missing-schema")] },
					],
				}),
				{ knownSchemaIds: ["county"] },
			),
		).toThrow(StudioConfigError);
	});

	test("custom view registers without Core dependency", () => {
		const cfg = resolveStudioConfig(
			defineStudio({
				title: "T",
				views: [
					{
						id: "coverage",
						title: "Coverage",
						module: "./views/coverage.ts",
					},
				],
			}),
		);
		expect(cfg.views?.[0]?.id).toBe("coverage");
	});

	test("defaultStudioConfig is valid", () => {
		const d = defaultStudioConfig("Demo");
		expect(resolveStudioConfig(d).title).toBe("Demo");
	});
});
