import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";
import {
	applyProjectPackage,
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createDataSourceService,
	createProjectService,
	createPublishedRouteService,
	createSavedImportService,
	getStorage,
	loadProjectPackage,
	materializeProjectPackage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
} from "../index";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;

describe("materializeProjectPackage / applyProjectPackage", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("external-product fixture materializes sources, imports, and routes", async () => {
		const pkg = await loadProjectPackage(FIXTURE);
		const plan = await materializeProjectPackage(pkg);

		expect(pkg.config.id).toBe("external-catalog");
		expect(plan.projectSlug).toBe("catalog");
		expect(plan.datasetId).toBe("catalog");
		expect(plan.sources.map((s) => s.id)).toEqual(["catalog-file"]);
		expect(plan.imports.map((i) => i.id)).toEqual(["regions", "cities"]);
		expect(plan.routes.map((r) => r.id)).toEqual([
			"regions",
			"cities",
			"city-by-id",
		]);
	});

	test("applyProjectPackage is idempotent for sources and saved imports", async () => {
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

		const sources = createDataSourceService();
		const imports = createSavedImportService();
		const routes = createPublishedRouteService();

		const first = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources,
			imports,
			routes,
			strictRoutes: false,
		});
		expect(
			first.events.filter((e) => e.kind === "source" && e.outcome === "created")
				.length,
		).toBe(1);
		expect(
			first.events.filter((e) => e.kind === "import" && e.outcome === "created")
				.length,
		).toBe(2);

		const second = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources,
			imports,
			routes,
			strictRoutes: false,
		});
		expect(
			second.events.filter((e) => e.kind === "source").every((e) => e.outcome === "exists"),
		).toBe(true);
		expect(
			second.events.filter((e) => e.kind === "import").every((e) => e.outcome === "exists"),
		).toBe(true);
	});

	test("applyProjectPackage upserts routes after schemas are registered", async () => {
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

		const result = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources: createDataSourceService(),
			imports: createSavedImportService(),
			routes: createPublishedRouteService(),
		});
		expect(
			result.events.filter((e) => e.kind === "route" && e.outcome === "upserted")
				.length,
		).toBe(pkg.routes.length);
	});
});
