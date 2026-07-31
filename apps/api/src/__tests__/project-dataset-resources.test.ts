/**
 * Project-scoped import/schema HTTP routes.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	ensureLegacyProject,
	getStorage,
	MemoryProjectRepository,
	resetProjectService,
} from "@aurii/core";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { buildApiApp } from "../server";

const BASE = "http://localhost";

function req(
	method: string,
	path: string,
	options: { body?: unknown } = {},
): Request {
	const headers: Record<string, string> = {};
	let body: string | undefined;
	if (options.body !== undefined) {
		headers["content-type"] = "application/json";
		body = JSON.stringify(options.body);
	}
	return new Request(`${BASE}${path}`, { method, headers, body });
}

async function json(res: Response): Promise<unknown> {
	const text = await res.text();
	return text ? JSON.parse(text) : undefined;
}

let repo: MemoryProjectRepository;
let tmpDir: string;

function app() {
	return buildApiApp({
		projectRepository: repo,
		uploadDir: "/tmp/aurii-api-project-resources-test",
	});
}

beforeEach(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = `:memory:`;
	resetProjectService();
	await closeStorage();
	repo = new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	await getStorage();
	tmpDir = await mkdtemp(join(tmpdir(), "aurii-resources-"));
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
	delete process.env["AURII_DB_PATH"];
});

async function createProject(
	instance: ReturnType<typeof app>,
	slug: string,
): Promise<string> {
	const res = await instance.handle(
		req("POST", "/api/projects", {
			body: { name: slug, slug },
		}),
	);
	const body = (await json(res)) as { data: { id: string } };
	return body.data.id;
}

const itemSchema = {
	id: "item",
	name: "Item",
	fields: [
		{ name: "id", type: "string", required: true },
		{ name: "name", type: "string", required: true },
	],
};

describe("project-scoped schemas", () => {
	it("registers schema in the owning project", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		const res = await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);
		expect(res.status).toBe(201);
		const body = (await json(res)) as { data: { id: string; datasetId: string } };
		expect(body.data.id).toBe("item");
		expect(body.data.datasetId).toBe("geo");
	});

	it("returns 404 for schema ops through the wrong project", async () => {
		const instance = app();
		const a = await createProject(instance, "norge-data");
		const b = await createProject(instance, "valgdata");
		await instance.handle(
			req("POST", `/api/projects/${a}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		const res = await instance.handle(
			req("POST", `/api/projects/${b}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);
		expect(res.status).toBe(404);
	});

	it("rejects schema mutation when project is inactive", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		await instance.handle(
			req("PATCH", `/api/projects/${projectId}/status`, {
				body: { status: "inactive" },
			}),
		);
		const res = await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);
		expect(res.status).toBe(409);
		const body = (await json(res)) as { error: { code: string } };
		expect(body.error.code).toBe("PROJECT_NOT_WRITABLE");
	});

	it("allows reading schemas when project is archived", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);
		await instance.handle(req("POST", `/api/projects/${projectId}/archive`));
		const res = await instance.handle(
			req("GET", `/api/projects/${projectId}/datasets/geo/schemas`),
		);
		expect(res.status).toBe(200);
		const body = (await json(res)) as { data: { id: string }[] };
		expect(body.data.some((s) => s.id === "item")).toBe(true);
	});
});

describe("project-scoped imports", () => {
	it("lists import history for inactive projects", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);

		const dataPath = join(tmpDir, "items.json");
		await writeFile(dataPath, JSON.stringify([{ id: "1", name: "One" }]));
		const importPath = join(tmpDir, "items.yaml");
		await writeFile(
			importPath,
			`
id: items
name: Items
schema: item
source:
  type: json
  path: ${dataPath}
pipeline:
  steps:
    - type: map
      mapping:
        id: id
        name: name
    - type: validate
    - type: persist
`.trim(),
		);

		const runRes = await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets/geo/imports/run`, {
				body: { path: importPath },
			}),
		);
		expect(runRes.status).toBe(200);

		await instance.handle(
			req("PATCH", `/api/projects/${projectId}/status`, {
				body: { status: "inactive" },
			}),
		);
		const history = await instance.handle(
			req("GET", `/api/projects/${projectId}/datasets/geo/imports`),
		);
		expect(history.status).toBe(200);
		const body = (await json(history)) as { data: unknown[] };
		expect(body.data.length).toBeGreaterThan(0);
	});

	it("returns 404 for imports through the wrong project", async () => {
		const instance = app();
		const a = await createProject(instance, "norge-data");
		const b = await createProject(instance, "valgdata");
		await instance.handle(
			req("POST", `/api/projects/${a}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		const res = await instance.handle(
			req("GET", `/api/projects/${b}/datasets/geo/imports`),
		);
		expect(res.status).toBe(404);
	});

	it("ignores body projectId override attempts", async () => {
		const instance = app();
		const a = await createProject(instance, "norge-data");
		const b = await createProject(instance, "valgdata");
		await instance.handle(
			req("POST", `/api/projects/${a}/datasets`, {
				body: { id: "geo", name: "Geo" },
			}),
		);
		await instance.handle(
			req("POST", `/api/projects/${a}/datasets/geo/schemas`, {
				body: itemSchema,
			}),
		);
		const dataPath = join(tmpDir, "items2.json");
		await writeFile(dataPath, JSON.stringify([{ id: "1", name: "One" }]));
		const importPath = join(tmpDir, "items2.yaml");
		await writeFile(
			importPath,
			`
id: items
name: Items
schema: item
source:
  type: json
  path: ${dataPath}
pipeline:
  steps:
    - type: map
      mapping: { id: id, name: name }
    - type: validate
    - type: persist
`.trim(),
		);
		const res = await instance.handle(
			req("POST", `/api/projects/${a}/datasets/geo/imports/run`, {
				body: { path: importPath, projectId: b },
			}),
		);
		expect(res.status).toBe(200);
		const storage = await getStorage();
		const ds = await storage.getDataset("geo");
		expect(ds?.projectId).toBe(a);
	});
});
