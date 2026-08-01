import { describe, expect, test } from "bun:test";
import { getLiveGeoConfig } from "../lib/live";

describe("live delivery config", () => {
	test("null when no Core URL", () => {
		expect(getLiveGeoConfig({})).toBeNull();
	});

	test("reads Core URL and project slug", () => {
		const cfg = getLiveGeoConfig({
			AURII_CORE_URL: "http://localhost:3000/",
			AURII_PROJECT_SLUG: "norge-data",
		});
		expect(cfg).toEqual({
			coreUrl: "http://localhost:3000",
			projectSlug: "norge-data",
		});
	});

	test("does not import studio", async () => {
		// apps/geo must never depend on Studio
		const pkg = await import("../../package.json");
		const deps = {
			...pkg.dependencies,
			...pkg.devDependencies,
		};
		expect(Object.keys(deps).some((k) => k.includes("studio-app"))).toBe(
			false,
		);
	});
});
