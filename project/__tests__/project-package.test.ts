/**
 * Prove the project package loads through public @aurii/core exports.
 * Does not import Aurii from a sibling checkout.
 */

import { describe, expect, test } from "bun:test";
import { loadProjectPackage } from "@aurii/core";
import { PRODUCT_ROOT } from "../lib/paths";

describe("norwegian-geo project package", () => {
	test("loads via defineProject / loadProjectPackage", async () => {
		const pkg = await loadProjectPackage(PRODUCT_ROOT);
		expect(pkg.config.id).toBe("norwegian-geo");
		expect(pkg.config.core.projectSlug).toBe("norge-data");
		expect(pkg.config.core.defaultDataset).toBe("norwegian-geo");
		expect(pkg.schemaPaths.length).toBeGreaterThan(0);
		const routeIds = pkg.routes.map((route) => route.id);
		expect(routeIds).toContain("counties");
		expect(routeIds).toContain("municipalities");
		expect(routeIds).toContain("municipality-by-id");
		expect(routeIds).toContain("postal-codes");
		expect(pkg.studio?.title).toBe("Norwegian Geo");
	});
});
