/**
 * HTTP integration tests for /api/projects.
 *
 * Uses an in-memory project repository — no PostgreSQL required.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { MemoryProjectRepository } from "@aurii/core";
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

function app() {
	return buildApiApp({
		projectRepository: new MemoryProjectRepository(),
		uploadDir: "/tmp/aurii-api-projects-test",
	});
}

describe("POST /api/projects", () => {
	it("creates a project and returns 201", async () => {
		const res = await app().handle(
			req("POST", "/api/projects", {
				body: {
					name: "Valgdata",
					slug: "valgdata",
					description: "Offisielle valgdata.",
				},
			}),
		);
		expect(res.status).toBe(201);
		const body = (await json(res)) as {
			data: { slug: string; status: string };
		};
		expect(body.data.slug).toBe("valgdata");
		expect(body.data.status).toBe("active");
	});

	it("returns 409 on slug conflict", async () => {
		const instance = app();
		await instance.handle(
			req("POST", "/api/projects", {
				body: { name: "One", slug: "valgdata" },
			}),
		);
		const res = await instance.handle(
			req("POST", "/api/projects", {
				body: { name: "Two", slug: "valgdata" },
			}),
		);
		expect(res.status).toBe(409);
		const body = (await json(res)) as {
			error: { code: string };
		};
		expect(body.error.code).toBe("PROJECT_SLUG_CONFLICT");
	});

	it("returns 400 on invalid slug", async () => {
		const res = await app().handle(
			req("POST", "/api/projects", {
				body: { name: "Test", slug: "News CMS" },
			}),
		);
		expect(res.status).toBe(400);
		const body = (await json(res)) as { error: { code: string } };
		expect(body.error.code).toBe("PROJECT_VALIDATION_ERROR");
	});
});

describe("GET /api/projects", () => {
	it("lists all projects by default", async () => {
		const instance = app();
		await instance.handle(
			req("POST", "/api/projects", {
				body: { name: "Project A", slug: "a" },
			}),
		);
		const created = (await json(
			await instance.handle(
				req("POST", "/api/projects", {
					body: { name: "Project B", slug: "b" },
				}),
			),
		)) as { data: { id: string } };
		await instance.handle(
			req("PATCH", `/api/projects/${created.data.id}/status`, {
				body: { status: "inactive" },
			}),
		);
		const res = await instance.handle(req("GET", "/api/projects"));
		expect(res.status).toBe(200);
		const body = (await json(res)) as { data: unknown[] };
		expect(body.data.length).toBe(2);
	});

	it("filters by status", async () => {
		const instance = app();
		const created = (await json(
			await instance.handle(
				req("POST", "/api/projects", {
					body: { name: "Project A", slug: "a" },
				}),
			),
		)) as { data: { id: string } };
		await instance.handle(
			req("POST", "/api/projects", {
				body: { name: "Project B", slug: "b" },
			}),
		);
		await instance.handle(
			req("PATCH", `/api/projects/${created.data.id}/status`, {
				body: { status: "inactive" },
			}),
		);
		const res = await instance.handle(
			req("GET", "/api/projects?status=inactive"),
		);
		const body = (await json(res)) as { data: { slug: string }[] };
		expect(body.data.map((p) => p.slug)).toEqual(["a"]);
	});
});

describe("lookup and mutations", () => {
	let instance: ReturnType<typeof app>;
	let id: string;

	beforeEach(async () => {
		instance = app();
		const created = (await json(
			await instance.handle(
				req("POST", "/api/projects", {
					body: { name: "Valgdata", slug: "valgdata" },
				}),
			),
		)) as { data: { id: string } };
		id = created.data.id;
	});

	it("gets by id and by slug", async () => {
		const byId = await instance.handle(req("GET", `/api/projects/${id}`));
		expect(byId.status).toBe(200);
		const bySlug = await instance.handle(
			req("GET", "/api/projects/by-slug/valgdata"),
		);
		expect(bySlug.status).toBe(200);
		const missing = await instance.handle(
			req("GET", "/api/projects/by-slug/missing"),
		);
		expect(missing.status).toBe(404);
	});

	it("patches metadata", async () => {
		const res = await instance.handle(
			req("PATCH", `/api/projects/${id}`, {
				body: { name: "Valgdata 2026", description: "Updated" },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await json(res)) as {
			data: { name: string; description: string };
		};
		expect(body.data.name).toBe("Valgdata 2026");
		expect(body.data.description).toBe("Updated");
	});

	it("archives and reactivates", async () => {
		const archived = (await json(
			await instance.handle(req("POST", `/api/projects/${id}/archive`)),
		)) as { data: { status: string; archivedAt: string | null } };
		expect(archived.data.status).toBe("archived");
		expect(archived.data.archivedAt).toBeTruthy();

		const reactivated = (await json(
			await instance.handle(
				req("PATCH", `/api/projects/${id}/status`, {
					body: { status: "active" },
				}),
			),
		)) as { data: { status: string; archivedAt: string | null } };
		expect(reactivated.data.status).toBe("active");
		expect(reactivated.data.archivedAt).toBeNull();
	});

	it("rejects archived -> inactive", async () => {
		await instance.handle(req("POST", `/api/projects/${id}/archive`));
		const res = await instance.handle(
			req("PATCH", `/api/projects/${id}/status`, {
				body: { status: "inactive" },
			}),
		);
		expect(res.status).toBe(409);
		const body = (await json(res)) as { error: { code: string } };
		expect(body.error.code).toBe("INVALID_PROJECT_STATUS_TRANSITION");
	});
});
