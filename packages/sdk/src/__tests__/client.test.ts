/**
 * SDK client tests.
 *
 * Tests exercise the SDK against a live in-process Aurii Core instance,
 * identical to how the API server tests work in @aurii/core.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { buildApp } from "../../../core/src/api/server";
import { closeStorage, getStorage } from "../../../core/src/storage";
import { AuriiError, createClient } from "../index";

// ── Helpers ───────────────────────────────────────────────────────────────────

const app = buildApp({ apiToken: "test-token" });

function appFetch(input: Request): Promise<Response> {
	return app.handle(input);
}

// Patch global fetch to route to the in-process app
const MOCK_BASE = "http://localhost:3000";

const originalFetch = globalThis.fetch;

beforeAll(async () => {
	const storage = await getStorage();
	await storage.init();

	// Override fetch to route to in-process app
	const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: (input as Request).url;
		if (url.startsWith(MOCK_BASE)) {
			const req = new Request(url, init as RequestInit);
			return appFetch(req);
		}
		return originalFetch(input as RequestInfo, init);
	};
	// @ts-expect-error — replacing with a compatible subset for testing
	globalThis.fetch = mockFetch;
});

afterAll(async () => {
	globalThis.fetch = originalFetch;
	await closeStorage();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createClient", () => {
	test("returns an AuriiClient instance", () => {
		const client = createClient({ baseUrl: MOCK_BASE });
		expect(client).toBeDefined();
		expect(typeof client.datasets.list).toBe("function");
		expect(typeof client.schemas.list).toBe("function");
		expect(typeof client.entities.list).toBe("function");
		expect(typeof client.query.run).toBe("function");
		expect(typeof client.import.analyze).toBe("function");
		expect(typeof client.import.run).toBe("function");
		expect(typeof client.stats.get).toBe("function");
		expect(typeof client.health.check).toBe("function");
	});
});

describe("client.health", () => {
	test("check() returns ok status", async () => {
		const client = createClient({ baseUrl: MOCK_BASE });
		const health = await client.health.check();
		expect(health.status).toBe("ok");
		expect(health.version).toBeDefined();
	});
});

describe("client.datasets", () => {
	const client = createClient({ baseUrl: MOCK_BASE, token: "test-token" });

	test("list() returns an array", async () => {
		const datasets = await client.datasets.list();
		expect(Array.isArray(datasets)).toBe(true);
	});

	test("create() creates a dataset", async () => {
		const dataset = await client.datasets.create({
			id: "sdk-test-ds",
			name: "SDK Test Dataset",
		});
		expect(dataset.id).toBe("sdk-test-ds");
		expect(dataset.name).toBe("SDK Test Dataset");
		expect(dataset.projectId).toBeTruthy();
	});
});

describe("client.projects", () => {
	test("byId().datasets is available", () => {
		const client = createClient({ baseUrl: MOCK_BASE, token: "test-token" });
		expect(typeof client.projects.byId).toBe("function");
		expect(typeof client.projects.byId("proj").datasets.list).toBe("function");
		expect(typeof client.projects.byId("proj").datasets.get).toBe("function");
		expect(typeof client.projects.byId("proj").datasets.create).toBe(
			"function",
		);
	});
});

describe("client.schemas", () => {
	const client = createClient({
		baseUrl: MOCK_BASE,
		token: "test-token",
		defaultDataset: "default",
	});

	test("create() registers a schema", async () => {
		const schema = await client.schemas.create({
			id: "sdk-article",
			name: "SDK Article",
			fields: [
				{ name: "title", type: "string", required: true },
				{ name: "content", type: "string" },
			],
		});
		expect(schema.id).toBe("sdk-article");
		expect(schema.fields).toHaveLength(2);
	});

	test("list() includes registered schema", async () => {
		const schemas = await client.schemas.list();
		expect(schemas.some((s) => s.id === "sdk-article")).toBe(true);
	});

	test("get() retrieves a schema by id", async () => {
		const schema = await client.schemas.get("sdk-article");
		expect(schema.id).toBe("sdk-article");
	});
});

describe("AuriiError", () => {
	test("is thrown on 4xx responses", async () => {
		const client = createClient({ baseUrl: MOCK_BASE, token: "test-token" });
		await expect(client.schemas.get("nonexistent-schema")).rejects.toBeInstanceOf(AuriiError);
	});

	test("is thrown on auth failure", async () => {
		const client = createClient({ baseUrl: MOCK_BASE, token: "wrong-token" });
		try {
			await client.datasets.list();
			expect(true).toBe(false); // should not reach here
		} catch (e) {
			expect(e).toBeInstanceOf(AuriiError);
			expect((e as AuriiError).status).toBe(401);
		}
	});
});
