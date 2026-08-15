/**
 * N3: registerProjectPackage is the shared HTTP path used by
 * `bun run register:norwegian-geo-platform`.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createProjectService,
	getStorage,
	loadProjectPackage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerProjectPackage,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
} from "@aurii/core";
import { buildApiApp } from "../server";
import { PRODUCT_ROOT } from "../../../../demo/norwegian-geo/lib/paths";

const DEMO = PRODUCT_ROOT;
const MOCK_BASE = "http://localhost:3000";

describe("registerProjectPackage HTTP helper (N3)", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("registers NG sources, module imports, and routes against Core", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		await closeStorage().catch(() => undefined);

		const pkg = await loadProjectPackage(DEMO);
		const repo = new MemoryProjectRepository();
		const projects = createProjectService(repo);
		configureProjectService(projects);
		configurePlatformStore(new MemoryPlatformStore());

		const storage = await getStorage();
		const project = await projects.createProject({
			name: "Norge Data",
			slug: "norge-data",
			description: "n3 register",
		});
		await storage.createDataset({
			id: "norwegian-geo",
			name: "Norwegian Public Reference Data",
			projectId: project.id,
		});

		const { readFile } = await import("node:fs/promises");
		const { parse } = await import("yaml");
		for (const schemaPath of pkg.schemaPaths) {
			const def = parse(await readFile(schemaPath, "utf-8"));
			await registerSchema(def, "norwegian-geo");
		}

		const app = buildApiApp({
			projectService: projects,
			skipPlatformStoreInit: true,
		});

		const fetchImpl: typeof fetch = async (input, init) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: (input as Request).url;
			const path = url.replace(MOCK_BASE, "http://localhost");
			return app.handle(new Request(path, init as RequestInit));
		};

		const first = await registerProjectPackage({
			pkg,
			coreUrl: MOCK_BASE,
			fetch: fetchImpl,
			project: { name: "Norge Data", slug: "norge-data" },
		});

		expect(first.project.slug).toBe("norge-data");
		expect(first.events.some((e) => e.kind === "source" && e.id === "udir-nsr" && e.outcome === "created")).toBe(
			true,
		);
		expect(first.events.some((e) => e.kind === "import" && e.id === "schools" && e.outcome === "created")).toBe(
			true,
		);
		expect(first.events.some((e) => e.kind === "import" && e.id === "hospitals" && e.outcome === "created")).toBe(
			true,
		);
		expect(first.events.filter((e) => e.kind === "route" && e.outcome === "upserted").length).toBe(
			pkg.routes.length,
		);

		const second = await registerProjectPackage({
			pkg,
			coreUrl: MOCK_BASE,
			fetch: fetchImpl,
			project: { name: "Norge Data", slug: "norge-data" },
		});
		expect(second.events.filter((e) => e.kind === "source").every((e) => e.outcome === "exists")).toBe(
			true,
		);
		expect(second.events.filter((e) => e.kind === "import").every((e) => e.outcome === "exists")).toBe(
			true,
		);

		const listed = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/sources`),
		);
		expect(listed.status).toBe(200);
		const body = (await listed.json()) as { data: Array<{ id: string }> };
		expect(body.data.map((s) => s.id)).toEqual(
			expect.arrayContaining(["kartverket", "udir-nsr", "brreg", "nager-date"]),
		);
	});
});
