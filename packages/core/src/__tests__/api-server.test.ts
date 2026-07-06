/**
 * HTTP integration tests for the Elysia app (`src/api/server.ts`).
 *
 * Uses Elysia's in-process `app.handle(request)` — no real socket is
 * opened, so these tests are as fast and isolated as the unit tests while
 * still exercising the real routing, auth, parsing and status-code layer
 * that unit tests around the underlying modules never touch.
 *
 * Storage is an in-memory SQLite database, reset between tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { buildApp } from "../api/server";
import { closeStorage } from "../storage";

const BASE = "http://localhost";

function req(
	method: string,
	path: string,
	options: {
		body?: unknown;
		headers?: Record<string, string>;
		raw?: FormData;
	} = {},
): Request {
	const headers: Record<string, string> = { ...options.headers };
	let body: FormData | string | undefined;
	if (options.raw !== undefined) {
		body = options.raw;
	} else if (options.body !== undefined) {
		headers["content-type"] = "application/json";
		body = JSON.stringify(options.body);
	}
	return new Request(`${BASE}${path}`, { method, headers, body });
}

async function json(res: Response): Promise<any> {
	const text = await res.text();
	return text ? JSON.parse(text) : undefined;
}

let uploadDir: string;

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	uploadDir = await mkdtemp(join(tmpdir(), "aurii-api-test-"));
});

afterEach(async () => {
	await closeStorage();
	await rm(uploadDir, { recursive: true, force: true });
});

const articleSchema = {
	id: "article",
	name: "Article",
	fields: [
		{ name: "title", type: "string", required: true },
		{ name: "author", type: "string", required: true },
		{ name: "views", type: "number" },
	],
};

describe("GET /health", () => {
	it("returns 200 without requiring auth, even when a token is configured", async () => {
		const app = buildApp({ apiToken: "secret", uploadDir });
		const res = await app.handle(req("GET", "/health"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toMatchObject({ status: "ok", storage: "sqlite" });
	});
});

describe("auth", () => {
	it("rejects protected routes with 401 when no token is provided", async () => {
		const app = buildApp({ apiToken: "secret", uploadDir });
		const res = await app.handle(req("GET", "/datasets"));
		expect(res.status).toBe(401);
		expect(await json(res)).toEqual({ error: "Unauthorized" });
	});

	it("rejects protected routes with 401 when the token is wrong", async () => {
		const app = buildApp({ apiToken: "secret", uploadDir });
		const res = await app.handle(
			req("GET", "/datasets", {
				headers: { authorization: "Bearer wrong-token" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("allows protected routes with the correct bearer token", async () => {
		const app = buildApp({ apiToken: "secret", uploadDir });
		const res = await app.handle(
			req("GET", "/datasets", {
				headers: { authorization: "Bearer secret" },
			}),
		);
		expect(res.status).toBe(200);
	});

	it("allows every route when no token is configured", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/datasets"));
		expect(res.status).toBe(200);
	});
});

describe("GET/POST /datasets", () => {
	it("always includes the default dataset", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/datasets"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.some((d: { id: string }) => d.id === "default")).toBe(true);
	});

	it("rejects a dataset missing id or name with 400", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("POST", "/datasets", { body: { name: "No id" } }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects an invalid dataset id with 400", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("POST", "/datasets", { body: { id: "Not Valid!", name: "Bad" } }),
		);
		expect(res.status).toBe(400);
	});

	it("creates a dataset and returns 201", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("POST", "/datasets", { body: { id: "blog", name: "Blog" } }),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.id).toBe("blog");

		const list = await json(await app.handle(req("GET", "/datasets")));
		expect(list.some((d: { id: string }) => d.id === "blog")).toBe(true);
	});
});

describe("GET/POST /schemas", () => {
	it("registers a schema and returns 201", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("POST", "/schemas", { body: articleSchema }),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.id).toBe("article");
		expect(body.datasetId).toBe("default");
	});

	it("lists registered schemas", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));
		const res = await app.handle(req("GET", "/schemas?dataset=default"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.some((s: { id: string }) => s.id === "article")).toBe(true);
	});

	it("returns 404 for an unknown schema id", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/schemas/does-not-exist"));
		expect(res.status).toBe(404);
	});

	it("returns a schema by id", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));
		const res = await app.handle(req("GET", "/schemas/article"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.fields).toHaveLength(3);
	});
});

describe("GET /entities", () => {
	it("requires a schema query parameter", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/entities"));
		expect(res.status).toBe(400);
	});

	it("returns an empty list for a schema with no entities", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));
		const res = await app.handle(req("GET", "/entities?schema=article"));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toEqual({ entities: [], total: 0, limit: 50, offset: 0 });
	});

	it("returns 404 for an unknown entity id", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("GET", `/entities/${crypto.randomUUID()}`),
		);
		expect(res.status).toBe(404);
	});
});

describe("GET /query", () => {
	it("requires a q query parameter", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/query"));
		expect(res.status).toBe(400);
	});

	it("returns 500 for a malformed query string", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("GET", `/query?q=${encodeURIComponent("not a valid query")}`),
		);
		expect(res.status).toBe(500);
	});
});

describe("POST /import/analyze", () => {
	it("rejects non-multipart bodies with 400", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("POST", "/import/analyze", { body: {} }));
		expect(res.status).toBe(400);
	});

	it("rejects multipart requests missing the file field with 400", async () => {
		const app = buildApp({ uploadDir });
		const form = new FormData();
		form.set("notFile", "oops");
		const res = await app.handle(req("POST", "/import/analyze", { raw: form }));
		expect(res.status).toBe(400);
	});

	it("analyzes an uploaded CSV file and returns an uploadId", async () => {
		const app = buildApp({ uploadDir });
		const form = new FormData();
		const csv = "Title,Author,Views\nHello Aurii,Alice,100\n";
		form.set("file", new File([csv], "articles.csv", { type: "text/csv" }));
		const res = await app.handle(req("POST", "/import/analyze", { raw: form }));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.uploadId).toBeTruthy();
		expect(body.filename).toBe("articles.csv");
		expect(body.format).toBe("csv");
		expect(body.columns).toEqual(["Title", "Author", "Views"]);
	});
});

describe("POST /import/run — full wizard loop", () => {
	async function uploadCsv(app: ReturnType<typeof buildApp>) {
		const form = new FormData();
		const csv = [
			"Title,Author,Views",
			"Hello Aurii,Alice,100",
			"Second Post,Bob,50",
		].join("\n");
		form.set("file", new File([csv], "articles.csv", { type: "text/csv" }));
		const res = await app.handle(req("POST", "/import/analyze", { raw: form }));
		return json(res);
	}

	it("requires uploadId, schemaId and mapping", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("POST", "/import/run", { body: {} }));
		expect(res.status).toBe(400);
	});

	it("returns 404 for an unknown uploadId", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(
			req("POST", "/import/run", {
				body: {
					uploadId: "does-not-exist",
					schemaId: "article",
					mapping: { title: "Title" },
				},
			}),
		);
		expect(res.status).toBe(404);
	});

	it("dry-run leaves storage untouched", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));
		const upload = await uploadCsv(app);

		const res = await app.handle(
			req("POST", "/import/run", {
				body: {
					uploadId: upload.uploadId,
					schemaId: "article",
					mapping: { title: "Title", author: "Author", views: "Views" },
					transforms: [{ field: "views", fn: "toNumber" }],
					dryRun: true,
				},
			}),
		);
		expect(res.status).toBe(200);
		const result = await json(res);
		expect(result.dryRun).toBe(true);
		expect(result.imported).toBe(2);

		const entities = await json(
			await app.handle(req("GET", "/entities?schema=article")),
		);
		expect(entities.total).toBe(0);
	});

	it("persists entities, then they are visible via /entities, /query and /stats", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));
		const upload = await uploadCsv(app);

		const runRes = await app.handle(
			req("POST", "/import/run", {
				body: {
					uploadId: upload.uploadId,
					schemaId: "article",
					mapping: { title: "Title", author: "Author", views: "Views" },
					transforms: [{ field: "views", fn: "toNumber" }],
				},
			}),
		);
		expect(runRes.status).toBe(200);
		const result = await json(runRes);
		expect(result.imported).toBe(2);

		const entities = await json(
			await app.handle(req("GET", "/entities?schema=article")),
		);
		expect(entities.total).toBe(2);

		const one = await json(
			await app.handle(req("GET", `/entities/${entities.entities[0].id}`)),
		);
		expect(one.data.title).toBeTruthy();

		const q = await json(
			await app.handle(
				req(
					"GET",
					`/query?q=${encodeURIComponent("from article where views > 60")}`,
				),
			),
		);
		expect(q.entities).toHaveLength(1);
		expect(q.entities[0].data.author).toBe("Alice");

		const imports = await json(await app.handle(req("GET", "/imports")));
		expect(imports.length).toBeGreaterThan(0);
		expect(imports[0].status).toBe("completed");

		const stats = await json(await app.handle(req("GET", "/stats")));
		expect(stats.totalEntities).toBe(2);
		expect(
			stats.schemas.some((s: { schemaId: string }) => s.schemaId === "article"),
		).toBe(true);
	});
});

describe("POST /import — Phase 1 compatibility", () => {
	it("requires a path", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("POST", "/import", { body: {} }));
		expect(res.status).toBe(400);
	});

	it("runs an import definition file end-to-end", async () => {
		const app = buildApp({ uploadDir });
		await app.handle(req("POST", "/schemas", { body: articleSchema }));

		const csvPath = join(uploadDir, "articles.csv");
		await Bun.write(
			csvPath,
			["Title,Author,Views", "Hello Aurii,Alice,100"].join("\n"),
		);
		const defPath = join(uploadDir, "import.yaml");
		await Bun.write(
			defPath,
			[
				"id: test-import",
				"name: Test Import",
				"schema: article",
				"source:",
				"  type: csv",
				`  path: ${csvPath}`,
				"pipeline:",
				"  steps:",
				"    - type: map",
				"      mapping:",
				"        title: Title",
				"        author: Author",
				"        views: Views",
				"    - type: transform",
				"      transforms:",
				"        - field: views",
				"          fn: toNumber",
				"    - type: validate",
				"    - type: persist",
			].join("\n"),
		);

		const res = await app.handle(
			req("POST", "/import", { body: { path: defPath } }),
		);
		expect(res.status).toBe(200);
		const result = await json(res);
		expect(result.imported).toBe(1);
	});
});

describe("CORS", () => {
	it("adds Access-Control-Allow-Origin to responses", async () => {
		const app = buildApp({ uploadDir });
		const res = await app.handle(req("GET", "/health"));
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
	});
});
