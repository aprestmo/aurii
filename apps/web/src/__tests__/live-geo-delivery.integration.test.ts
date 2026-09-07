/**
 * Live delivery proof for the standalone product:
 * published HTTP routes → @aurii/sdk → web loaders.
 *
 * Does not import @aurii/core or @aurii/db. A running Aurii Runtime is
 * simulated with a mock HTTP published-route contract.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
	loadCountiesLoaded,
	loadMunicipalitiesLoaded,
	loadPostalCodesLoaded,
} from "../lib/data";
import { LiveDeliveryError } from "../lib/live";

const MOCK_BASE = "http://localhost:3000";
const originalFetch = globalThis.fetch;
const envKeys = [
	"AURII_CORE_URL",
	"PUBLIC_AURII_CORE_URL",
	"AURII_PROJECT_SLUG",
	"AURII_DELIVERY_MODE",
	"PUBLIC_AURII_DELIVERY_MODE",
] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of envKeys) originalEnv[key] = process.env[key];

function restoreEnv() {
	for (const key of envKeys) {
		const previous = originalEnv[key];
		if (previous === undefined) delete process.env[key];
		else process.env[key] = previous;
	}
}

function publishedEnvelope<T>(data: T[]) {
	return {
		data,
		meta: { total: data.length, limit: data.length, offset: 0 },
	};
}

describe("live geo delivery (SDK / HTTP)", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		restoreEnv();
	});

	test("web loaders read counties, municipalities, and postal codes via SDK", async () => {
		process.env["AURII_CORE_URL"] = MOCK_BASE;
		process.env["AURII_PROJECT_SLUG"] = "norge-data";
		process.env["AURII_DELIVERY_MODE"] = "live";
		delete process.env["PUBLIC_AURII_CORE_URL"];

		const mockFetch = async (input: RequestInfo | URL) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const pathname = new URL(url).pathname;
			if (pathname === "/public/norge-data/v1/counties") {
				return Response.json(
					publishedEnvelope([
						{ id: "03", name: "Oslo" },
						{ id: "11", name: "Rogaland" },
					]),
				);
			}
			if (pathname === "/public/norge-data/v1/municipalities") {
				return Response.json(
					publishedEnvelope([
						{ id: "0301", name: "Oslo", countyId: "03" },
						{ id: "1103", name: "Stavanger", countyId: "11" },
					]),
				);
			}
			if (pathname === "/public/norge-data/v1/postal-codes") {
				return Response.json(
					publishedEnvelope([
						{
							code: "0010",
							city: "OSLO",
							municipalityId: "0301",
						},
					]),
				);
			}
			return new Response("not found", { status: 404 });
		};
		// @ts-expect-error — replacing with a compatible subset for testing
		globalThis.fetch = mockFetch;

		const counties = await loadCountiesLoaded();
		const municipalities = await loadMunicipalitiesLoaded();
		const postalCodes = await loadPostalCodesLoaded();

		expect(counties.source).toBe("live");
		expect(municipalities.source).toBe("live");
		expect(postalCodes.source).toBe("live");
		expect(counties.data.some((c) => c.id === "03" && c.name === "Oslo")).toBe(
			true,
		);
		expect(
			municipalities.data.some((m) => m.id === "0301" && m.countyId === "03"),
		).toBe(true);
		expect(postalCodes.data.some((p) => p.municipalityId === "0301")).toBe(
			true,
		);
		expect(postalCodes.data.every((p) => p.code && p.city)).toBe(true);
	});

	test("live mode fails closed instead of reading snapshots", async () => {
		process.env["AURII_CORE_URL"] = MOCK_BASE;
		process.env["AURII_PROJECT_SLUG"] = "norge-data";
		process.env["AURII_DELIVERY_MODE"] = "live";
		// @ts-expect-error — replacing with a compatible subset for testing
		globalThis.fetch = async () => new Response("down", { status: 503 });

		await expect(loadCountiesLoaded()).rejects.toBeInstanceOf(LiveDeliveryError);
	});
});
