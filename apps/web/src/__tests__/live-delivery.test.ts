import { afterEach, describe, expect, test } from "bun:test";
import {
	getLiveGeoConfig,
	LIVE_GEO_ROUTES,
	LiveDeliveryError,
	resolveGeoDelivery,
} from "../lib/live";
import { loadCountiesLoaded } from "../lib/data";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	for (const key of [
		"AURII_CORE_URL",
		"PUBLIC_AURII_CORE_URL",
		"AURII_PROJECT_SLUG",
		"PUBLIC_AURII_PROJECT_SLUG",
		"AURII_DELIVERY_MODE",
		"PUBLIC_AURII_DELIVERY_MODE",
	]) {
		const previous = originalEnv[key];
		if (previous === undefined) delete process.env[key];
		else process.env[key] = previous;
	}
});

describe("live delivery config", () => {
	test("snapshot when no Core URL", () => {
		expect(resolveGeoDelivery({})).toEqual({ mode: "snapshot", config: null });
		expect(getLiveGeoConfig({})).toBeNull();
	});

	test("live when Core URL is set", () => {
		const resolved = resolveGeoDelivery({
			AURII_CORE_URL: "http://localhost:3000/",
			AURII_PROJECT_SLUG: "norge-data",
		});
		expect(resolved).toEqual({
			mode: "live",
			config: {
				coreUrl: "http://localhost:3000",
				projectSlug: "norge-data",
			},
		});
	});

	test("explicit snapshot wins over Core URL", () => {
		const resolved = resolveGeoDelivery({
			AURII_CORE_URL: "http://localhost:3000",
			AURII_DELIVERY_MODE: "snapshot",
		});
		expect(resolved.mode).toBe("snapshot");
		expect(resolved.config).toBeNull();
	});

	test("explicit live requires Core URL", () => {
		expect(() => resolveGeoDelivery({ AURII_DELIVERY_MODE: "live" })).toThrow(
			LiveDeliveryError,
		);
	});

	test("does not import studio", async () => {
		const pkg = await import("../../package.json");
		const deps = {
			...pkg.dependencies,
			...pkg.devDependencies,
		};
		expect(Object.keys(deps).some((k) => k.includes("studio-app"))).toBe(false);
		expect(Object.keys(deps).some((k) => k === "@aurii/studio")).toBe(false);
		expect(Object.keys(deps).some((k) => k === "@aurii/sdk")).toBe(true);
	});

	test("published route paths for core geo schemas", () => {
		expect(LIVE_GEO_ROUTES).toEqual({
			counties: "/counties",
			municipalities: "/municipalities",
			postalCodes: "/postal-codes",
		});
	});
});

describe("live mode does not fall back to snapshots", () => {
	test("loader throws when Core is unreachable", async () => {
		process.env["AURII_CORE_URL"] = "http://localhost:3999";
		process.env["AURII_PROJECT_SLUG"] = "norge-data";
		process.env["AURII_DELIVERY_MODE"] = "live";
		globalThis.fetch = async () => new Response("unavailable", { status: 503 });

		await expect(loadCountiesLoaded()).rejects.toBeInstanceOf(LiveDeliveryError);
	});
});
