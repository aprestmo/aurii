import { afterEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
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

const DEMO = resolve(import.meta.dir, "../../../../demo/norwegian-geo");

describe("materializeProjectPackage / applyProjectPackage (N3)", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("Norwegian Geo package materializes core and module ops resources", async () => {
		const pkg = await loadProjectPackage(DEMO);
		const plan = await materializeProjectPackage(pkg);

		expect(pkg.config.id).toBe("norwegian-geo");
		expect(plan.projectSlug).toBe("norge-data");
		expect(plan.datasetId).toBe("norwegian-geo");

		const sourceIds = plan.sources.map((s) => s.id);
		expect(sourceIds).toEqual(
			expect.arrayContaining([
				"kartverket",
				"bring",
				"udir-nsr",
				"udir-nbr",
				"brreg",
				"nager-date",
			]),
		);

		const importIds = plan.imports.map((i) => i.id);
		expect(importIds).toEqual(
			expect.arrayContaining([
				"counties",
				"municipalities",
				"postal-codes",
				"postal-codes-nightly",
				"schools",
				"kindergartens",
				"hospitals",
				"public-holidays",
			]),
		);

		expect(plan.imports.find((i) => i.id === "schools")?.payload.definitionPath).toContain(
			"modules/education/imports/schools.yaml",
		);
		expect(plan.routes.map((r) => r.id)).toEqual(
			expect.arrayContaining([
				"counties",
				"municipalities",
				"municipality-by-id",
				"postal-codes",
			]),
		);
	});

	test("applyProjectPackage is idempotent for sources and saved imports", async () => {
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
			description: "n3 apply",
		});
		await storage.createDataset({
			id: "norwegian-geo",
			name: "Norwegian Public Reference Data",
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
		expect(first.events.filter((e) => e.kind === "source" && e.outcome === "created").length).toBe(
			6,
		);
		expect(first.events.filter((e) => e.kind === "import" && e.outcome === "created").length).toBe(
			8,
		);

		const second = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources,
			imports,
			routes,
			strictRoutes: false,
		});
		expect(second.events.filter((e) => e.kind === "source").every((e) => e.outcome === "exists")).toBe(
			true,
		);
		expect(second.events.filter((e) => e.kind === "import").every((e) => e.outcome === "exists")).toBe(
			true,
		);

		const listed = await sources.list(project.id, "norwegian-geo");
		expect(listed.map((s) => s.id)).toEqual(
			expect.arrayContaining(["kartverket", "udir-nsr", "brreg", "nager-date"]),
		);
	});

	test("applyProjectPackage upserts routes after core schemas are registered", async () => {
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
			description: "n3 routes",
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

		const result = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources: createDataSourceService(),
			imports: createSavedImportService(),
			routes: createPublishedRouteService(),
		});
		expect(result.events.filter((e) => e.kind === "route" && e.outcome === "upserted").length).toBe(
			pkg.routes.length,
		);
	});
});
