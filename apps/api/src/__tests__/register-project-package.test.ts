/**
 * registerProjectPackage is the shared HTTP path external products use.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
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
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const MOCK_BASE = "http://localhost:3000";

describe("registerProjectPackage HTTP helper", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("registers fixture sources, imports, and routes against Core", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		await closeStorage().catch(() => undefined);

		const pkg = await loadProjectPackage(FIXTURE);
		const repo = new MemoryProjectRepository();
		const projects = createProjectService(repo);
		configureProjectService(projects);
		configurePlatformStore(new MemoryPlatformStore());

		const storage = await getStorage();
		const project = await projects.createProject({
			name: "Catalog",
			slug: "catalog",
		});
		await storage.createDataset({
			id: "catalog",
			name: "Catalog",
			projectId: project.id,
		});

		for (const schemaPath of pkg.schemaPaths) {
			const def = parse(await readFile(schemaPath, "utf-8"));
			await registerSchema(def, "catalog");
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
			project: { name: "Catalog", slug: "catalog" },
		});

		expect(first.project.slug).toBe("catalog");
		expect(
			first.events.some(
				(e) => e.kind === "source" && e.id === "catalog-file" && e.outcome === "created",
			),
		).toBe(true);
		expect(
			first.events.some(
				(e) => e.kind === "import" && e.id === "cities" && e.outcome === "created",
			),
		).toBe(true);
		expect(
			first.events.filter((e) => e.kind === "route" && e.outcome === "upserted")
				.length,
		).toBe(pkg.routes.length);

		const second = await registerProjectPackage({
			pkg,
			coreUrl: MOCK_BASE,
			fetch: fetchImpl,
			project: { name: "Catalog", slug: "catalog" },
		});
		expect(
			second.events.filter((e) => e.kind === "source").every((e) => e.outcome === "exists"),
		).toBe(true);
		expect(
			second.events.filter((e) => e.kind === "import").every((e) => e.outcome === "exists"),
		).toBe(true);

		const listed = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/sources`),
		);
		expect(listed.status).toBe(200);
		const body = (await listed.json()) as { data: Array<{ id: string }> };
		expect(body.data.map((s) => s.id)).toContain("catalog-file");
	});
});
