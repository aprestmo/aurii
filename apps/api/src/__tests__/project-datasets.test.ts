/**
 * HTTP integration tests for /api/projects/:projectId/datasets.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	ensureLegacyProject,
	getStorage,
	MemoryProjectRepository,
} from "@aurii/core";
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

function app() {
	return buildApiApp({
		projectRepository: repo,
		uploadDir: "/tmp/aurii-api-project-datasets-test",
	});
}

beforeEach(async () => {
	await closeStorage();
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = `:memory:`;
	// Force fresh in-memory storage for each test via getStorage after close
	repo = new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	await getStorage();
});

afterEach(async () => {
	await closeStorage();
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

describe("project-scoped datasets API", () => {
	it("lists datasets for a project", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "municipalities", name: "Municipalities" },
			}),
		);
		const res = await instance.handle(
			req("GET", `/api/projects/${projectId}/datasets`),
		);
		expect(res.status).toBe(200);
		const body = (await json(res)) as {
			data: { id: string; projectId: string }[];
		};
		expect(body.data).toHaveLength(1);
		expect(body.data[0]?.id).toBe("municipalities");
		expect(body.data[0]?.projectId).toBe(projectId);
	});

	it("gets a dataset by id within a project", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "counties", name: "Counties" },
			}),
		);
		const res = await instance.handle(
			req("GET", `/api/projects/${projectId}/datasets/counties`),
		);
		expect(res.status).toBe(200);
		const body = (await json(res)) as {
			data: { id: string; projectId: string };
		};
		expect(body.data.id).toBe("counties");
		expect(body.data.projectId).toBe(projectId);
	});

	it("returns 404 for the wrong project", async () => {
		const instance = app();
		const a = await createProject(instance, "norge-data");
		const b = await createProject(instance, "valgdata");
		await instance.handle(
			req("POST", `/api/projects/${a}/datasets`, {
				body: { id: "counties", name: "Counties" },
			}),
		);
		const res = await instance.handle(
			req("GET", `/api/projects/${b}/datasets/counties`),
		);
		expect(res.status).toBe(404);
		const body = (await json(res)) as { error: { code: string } };
		expect(body.error.code).toBe("DATASET_NOT_FOUND");
	});

	it("ignores projectId from the request body", async () => {
		const instance = app();
		const a = await createProject(instance, "norge-data");
		const b = await createProject(instance, "valgdata");
		const res = await instance.handle(
			req("POST", `/api/projects/${a}/datasets`, {
				body: {
					id: "postal-codes",
					name: "Postal codes",
					projectId: b,
				},
			}),
		);
		expect(res.status).toBe(201);
		const body = (await json(res)) as {
			data: { projectId: string };
		};
		expect(body.data.projectId).toBe(a);
	});

	it("includes projectId in the response", async () => {
		const instance = app();
		const projectId = await createProject(instance, "news-cms");
		const res = await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "articles", name: "Articles" },
			}),
		);
		const body = (await json(res)) as {
			data: { id: string; projectId: string; name: string };
		};
		expect(body.data.projectId).toBe(projectId);
		expect(body.data.id).toBe("articles");
	});

	it("rejects create on inactive project", async () => {
		const instance = app();
		const projectId = await createProject(instance, "paused");
		await instance.handle(
			req("PATCH", `/api/projects/${projectId}/status`, {
				body: { status: "inactive" },
			}),
		);
		const res = await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "x", name: "X" },
			}),
		);
		expect(res.status).toBe(409);
		const body = (await json(res)) as { error: { code: string } };
		expect(body.error.code).toBe("PROJECT_NOT_WRITABLE");
	});

	it("deprecated global /datasets is Legacy-scoped", async () => {
		const instance = app();
		const projectId = await createProject(instance, "norge-data");
		await instance.handle(
			req("POST", `/api/projects/${projectId}/datasets`, {
				body: { id: "only-in-project", name: "Only" },
			}),
		);
		await instance.handle(
			req("POST", "/datasets", {
				body: { id: "legacy-only", name: "Legacy Only" },
			}),
		);
		const globalList = (await json(
			await instance.handle(req("GET", "/datasets")),
		)) as { id: string; projectId: string }[];
		expect(globalList.some((d) => d.id === "legacy-only")).toBe(true);
		expect(globalList.some((d) => d.id === "only-in-project")).toBe(false);
	});
});
