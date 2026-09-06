/**
 * Studio loads defineStudio from the generic external-product fixture
 * without importing Core into the Studio bundle.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";
import {
	clearStudioConfigCache,
	loadStudioConfigFromPackage,
	resolveActiveStudioConfig,
} from "../lib/studio-config";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;

describe("studio config from external-product fixture", () => {
	afterEach(() => {
		clearStudioConfigCache();
		delete process.env["AURII_PROJECT_ROOT"];
		delete process.env["AURII_PROJECT_SLUG"];
	});

	test("loads defineStudio from the fixture package", async () => {
		const loaded = await loadStudioConfigFromPackage(FIXTURE);
		expect(loaded).not.toBeNull();
		expect(loaded!.title).toBe("External Catalog");
		expect(loaded!.config.featuredSchemas).toEqual(["region", "city"]);
		expect(
			loaded!.config.navigation?.some((g) => g.title === "Catalog"),
		).toBe(true);
	});

	test("resolveActiveStudioConfig prefers AURII_PROJECT_ROOT", async () => {
		process.env["AURII_PROJECT_ROOT"] = FIXTURE;
		const { config, title } = await resolveActiveStudioConfig();
		expect(title).toBe("External Catalog");
		expect(config.featuredSchemas).toContain("city");
	});
});
