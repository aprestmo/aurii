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

const FIXTURE = resolve(
	import.meta.dir,
	"../../../../tests/fixtures/external-product",
);

describe("studio config from project package", () => {
	afterEach(() => {
		clearStudioConfigCache();
		delete process.env["AURII_PROJECT_ROOT"];
		delete process.env["AURII_PROJECT_SLUG"];
	});

	test("loads fixture defineStudio from disk", async () => {
		const loaded = await loadStudioConfigFromPackage(FIXTURE);
		expect(loaded).not.toBeNull();
		expect(loaded!.title).toBe("External Catalog");
		expect(loaded!.config.featuredSchemas).toContain("region");
		expect(loaded!.config.featuredSchemas).toContain("city");
		expect(
			loaded!.config.navigation?.some((g) => g.title === "Catalog"),
		).toBe(true);
	});

	test("resolveActiveStudioConfig prefers AURII_PROJECT_ROOT", async () => {
		process.env["AURII_PROJECT_ROOT"] = FIXTURE;
		process.env["AURII_PROJECT_SLUG"] = "other-slug";
		const { config, title } = await resolveActiveStudioConfig();
		expect(title).toBe("External Catalog");
		expect(config.navigation?.some((g) => g.title === "Catalog")).toBe(true);
	});

	test("fallback without package is generic, not product-specific", () => {
		const cfg = studioConfigForProject("norge-data");
		expect(cfg.title).toBe("Project norge-data");
		expect(cfg.importGroups ?? []).toHaveLength(0);
	});

	test("default studio without slug", () => {
		const cfg = studioConfigForProject(null);
		expect(cfg.title).toContain("Aurii Studio");
	});
});
