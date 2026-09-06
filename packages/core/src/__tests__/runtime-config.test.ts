import { describe, expect, it } from "bun:test";
import {
	corsOriginOption,
	resolveCorsPolicy,
	resolveRuntimeIdentity,
	RuntimeConfigError,
	validateRuntimeConfig,
} from "../runtime/config";

function env(values: Record<string, string | undefined>): Record<
	string,
	string | undefined
> {
	return values;
}

describe("validateRuntimeConfig", () => {
	it("allows open sqlite development", () => {
		const config = validateRuntimeConfig(
			env({ AURII_STORAGE: "sqlite", NODE_ENV: "test" }),
		);
		expect(config.production).toBe(false);
		expect(config.storage).toBe("sqlite");
		expect(config.apiTokenConfigured).toBe(false);
		expect(config.cors.mode).toBe("wildcard");
	});

	it("fails when postgres is selected without DATABASE_URL", () => {
		expect(() =>
			validateRuntimeConfig(
				env({ AURII_STORAGE: "postgres", NODE_ENV: "test" }),
			),
		).toThrow(RuntimeConfigError);
	});

	it("fails production without a token, postgres, or CORS allow-list", () => {
		expect(() =>
			validateRuntimeConfig(env({ AURII_ENV: "production" })),
		).toThrow(/AURII_STORAGE=postgres/);

		expect(() =>
			validateRuntimeConfig(
				env({
					AURII_ENV: "production",
					AURII_STORAGE: "postgres",
					DATABASE_URL: "postgres://aurii:secret@db:5432/aurii",
				}),
			),
		).toThrow(/AURII_API_TOKEN/);

		expect(() =>
			validateRuntimeConfig(
				env({
					AURII_ENV: "production",
					AURII_STORAGE: "postgres",
					DATABASE_URL: "postgres://aurii:secret@db:5432/aurii",
					AURII_API_TOKEN: "secret-token",
				}),
			),
		).toThrow(/AURII_CORS_ORIGINS/);
	});

	it("accepts a complete production configuration", () => {
		const config = validateRuntimeConfig(
			env({
				AURII_ENV: "production",
				AURII_STORAGE: "postgres",
				DATABASE_URL: "postgres://aurii:secret@db:5432/aurii",
				AURII_API_TOKEN: "secret-token",
				AURII_CORS_ORIGINS: "https://geo.example,https://studio.example",
				AURII_VERSION: "0.1.0",
				AURII_GIT_SHA: "abc123",
				AURII_BUILD_TIME: "2026-09-06T00:00:00Z",
			}),
		);
		expect(config.production).toBe(true);
		expect(config.apiTokenConfigured).toBe(true);
		expect(config.cors).toEqual({
			mode: "list",
			origins: ["https://geo.example", "https://studio.example"],
		});
		expect(config.identity).toEqual({
			version: "0.1.0",
			gitSha: "abc123",
			buildTime: "2026-09-06T00:00:00Z",
		});
	});
});

describe("CORS policy", () => {
	it("defaults to wildcard", () => {
		expect(resolveCorsPolicy(env({}))).toEqual({ mode: "wildcard" });
		expect(corsOriginOption(env({}))).toBe("*");
	});

	it("reflects an allowed origin and rejects an unknown one", () => {
		const option = corsOriginOption(
			env({ AURII_CORS_ORIGINS: "https://geo.example" }),
		);
		expect(typeof option).toBe("function");
		if (typeof option !== "function") return;
		expect(
			option(
				new Request("http://api.example/health", {
					headers: { origin: "https://geo.example" },
				}),
			),
		).toBe(true);
		expect(
			option(
				new Request("http://api.example/health", {
					headers: { origin: "https://evil.example" },
				}),
			),
		).toBe(false);
	});
});

describe("resolveRuntimeIdentity", () => {
	it("falls back to the package version when build metadata is absent", () => {
		expect(resolveRuntimeIdentity(env({}))).toEqual({
			version: "0.1.0",
			gitSha: null,
			buildTime: null,
		});
	});
});
