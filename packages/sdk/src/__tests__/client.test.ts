/**
 * SDK client tests.
 *
 * Tests exercise the SDK against a live in-process Aurii API instance
 * (Core + project routes).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	closeStorage,
	ensureLegacyProject,
	getStorage,
	MemoryProjectRepository,
	resetProjectService,
} from "../../../core/src/index";
import { buildApiApp } from "../../../../apps/api/src/server";
import { AuriiError, createClient } from "../index";

const MOCK_BASE = "http://localhost:3000";
const originalFetch = globalThis.fetch;

let repo: MemoryProjectRepository;
let app: ReturnType<typeof buildApiApp>;

beforeAll(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	resetProjectService();
	await closeStorage();
	repo = new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	await getStorage();
	app = buildApiApp({
		apiToken: "test-token",
		projectRepository: repo,
		uploadDir: "/tmp/aurii-sdk-client-test",
	});

	const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: (input as Request).url;
		if (url.startsWith(MOCK_BASE)) {
			return app.handle(new Request(url, init as RequestInit));
		}
		return originalFetch(input as RequestInfo, init);
	};
	// @ts-expect-error — replacing with a compatible subset for testing
	globalThis.fetch = mockFetch;
});

afterAll(async () => {
	globalThis.fetch = originalFetch;
	await closeStorage();
	resetProjectService();
});

describe("createClient", () => {
	test("returns an AuriiClient without global datasets API", () => {
		const client = createClient({ baseUrl: MOCK_BASE });
		expect(client).toBeDefined();
		expect("datasets" in client).toBe(false);
		expect(typeof client.projects.list).toBe("function");
		expect(typeof client.projects.getBySlug).toBe("function");
		expect(typeof client.projects.byId("x").datasets.list).toBe("function");
		expect(typeof client.schemas.list).toBe("function");
		expect(typeof client.entities.list).toBe("function");
		expect(typeof client.query.run).toBe("function");
		expect(typeof client.import.analyze).toBe("function");
		expect(typeof client.import.run).toBe("function");
		expect(typeof client.stats.get).toBe("function");
		expect(typeof client.health.check).toBe("function");
		expect(typeof client.published.get).toBe("function");
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

describe("client.projects.datasets", () => {
	const client = createClient({ baseUrl: MOCK_BASE, token: "test-token" });

	test("list/create via project scope", async () => {
		const project = await client.projects.list().then(async (all) => {
			const created = await (
				await fetch(`${MOCK_BASE}/api/projects`, {
					method: "POST",
					headers: {
						Authorization: "Bearer test-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ name: "SDK Proj", slug: "sdk-proj" }),
				})
			).json() as { data: { id: string } };
			return created.data.id;
		});

		const dataset = await client.projects.byId(project).datasets.create({
			id: "sdk-test-ds",
			name: "SDK Test Dataset",
		});
		expect(dataset.id).toBe("sdk-test-ds");
		expect(dataset.projectId).toBe(project);

		const datasets = await client.projects.byId(project).datasets.list();
		expect(datasets.some((d) => d.id === "sdk-test-ds")).toBe(true);
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
		await expect(client.schemas.get("nonexistent-schema")).rejects.toBeInstanceOf(
			AuriiError,
		);
	});

	test("is thrown on auth failure", async () => {
		const client = createClient({ baseUrl: MOCK_BASE, token: "wrong-token" });
		try {
			await client.projects.list();
			expect(true).toBe(false);
		} catch (e) {
			expect(e).toBeInstanceOf(AuriiError);
			expect((e as AuriiError).status).toBe(401);
		}
	});
});
