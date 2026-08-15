/**
 * Studio app loads defineStudio from AURII_PROJECT_ROOT package.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	clearStudioConfigCache,
	loadStudioConfigFromPackage,
	resolveActiveStudioConfig,
	studioConfigForProject,
} from "../lib/studio-config";

const DEMO = resolve(import.meta.dir, "../../../../demo/norwegian-geo");

describe("studio config from project package", () => {
	afterEach(() => {
		clearStudioConfigCache();
		delete process.env["AURII_PROJECT_ROOT"];
		delete process.env["AURII_PROJECT_SLUG"];
	});

	test("loads Norwegian Geo defineStudio from disk", async () => {
		const loaded = await loadStudioConfigFromPackage(DEMO);
		expect(loaded).not.toBeNull();
		expect(loaded!.title).toBe("Norwegian Geo");
		expect(loaded!.config.featuredSchemas).toContain("county");
		expect(loaded!.config.views?.some((v) => v.id === "coverage")).toBe(true);
		expect(loaded!.config.importGroups?.length).toBeGreaterThan(0);
		expect(loaded!.config.routeGroups?.length).toBeGreaterThan(0);
		expect(
			loaded!.config.navigation?.some((g) => g.title === "Drift"),
		).toBe(true);
	});

	test("resolveActiveStudioConfig prefers AURII_PROJECT_ROOT", async () => {
		process.env["AURII_PROJECT_ROOT"] = DEMO;
		process.env["AURII_PROJECT_SLUG"] = "other-slug";
		const { config, title } = await resolveActiveStudioConfig();
		expect(title).toBe("Norwegian Geo");
		expect(config.navigation?.some((g) => g.title === "Geografi")).toBe(true);
	});

	test("fallback without package still works for norge-data slug", () => {
		const cfg = studioConfigForProject("norge-data");
		expect(cfg.title).toBe("Norwegian Geo");
		expect(cfg.importGroups?.length).toBeGreaterThan(0);
		expect(cfg.routeGroups?.length).toBeGreaterThan(0);
	});

	test("default studio without slug", () => {
		const cfg = studioConfigForProject(null);
		expect(cfg.title).toContain("Aurii Studio");
	});
});
