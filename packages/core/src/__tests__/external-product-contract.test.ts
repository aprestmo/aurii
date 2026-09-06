/**
 * Generic external-product contract.
 *
 * Replaces Norwegian Geo as Aurii's in-repo proof that a product can:
 *   define/register schema → import entities → enable a published route
 *   → query the expected records.
 *
 * Domain is a tiny City / Region catalog. No Norwegian geography.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
	executeQuery,
	getStorage,
	loadImportDefinition,
	loadProjectPackage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	runImport,
} from "../index";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const DATASET = "catalog";

async function registerFixtureSchemas() {
	const pkg = await loadProjectPackage(FIXTURE);
	for (const schemaPath of pkg.schemaPaths) {
		const def = parse(await readFile(schemaPath, "utf-8"));
		await registerSchema(def, DATASET);
	}
	return pkg;
}

async function importFixtureData() {
	for (const name of ["regions", "cities"]) {
		const file = resolve(FIXTURE, "imports", `${name}.yaml`);
		const def = await loadImportDefinition(file);
		const result = await runImport(def, resolve(file, ".."), {
			datasetId: DATASET,
		});
		expect(result.failed).toBe(0);
	}
}

describe("external-product contract", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("loads the synthetic project package", async () => {
		const pkg = await loadProjectPackage(FIXTURE);
		expect(pkg.config.id).toBe("external-catalog");
		expect(pkg.config.core.projectSlug).toBe("catalog");
		expect(pkg.config.core.defaultDataset).toBe(DATASET);
		expect(pkg.schemaPaths).toHaveLength(2);
		expect(pkg.routes.map((r) => r.id)).toEqual([
			"regions",
			"cities",
			"city-by-id",
		]);
		expect(pkg.studio?.title).toBe("External Catalog");
	});

	test("schema → import → query returns the fixture catalog", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		delete process.env["DATABASE_URL"];
		resetProjectService();
		await closeStorage().catch(() => undefined);

		const storage = await getStorage();
		await storage.createDataset({ id: DATASET, name: "Catalog" });
		await registerFixtureSchemas();
		await importFixtureData();

		const regions = await executeQuery(
			"from region order by name asc",
			DATASET,
		);
		expect(regions.entities).toHaveLength(2);
		expect(regions.entities.map((e) => e.data["name"])).toEqual([
			"North",
			"South",
		]);

		const cities = await executeQuery(
			'from city where regionId == "north" order by name asc',
			DATASET,
		);
		expect(cities.entities.map((e) => e.data["id"])).toEqual(["alpha", "gamma"]);
	});

	test("applyProjectPackage is idempotent for the fixture", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		delete process.env["DATABASE_URL"];
		await closeStorage().catch(() => undefined);

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
			id: DATASET,
			name: "Catalog",
			projectId: project.id,
		});
		const pkg = await registerFixtureSchemas();

		const sources = createDataSourceService();
		const imports = createSavedImportService();
		const routes = createPublishedRouteService();

		const first = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources,
			imports,
			routes,
		});
		expect(
			first.events.filter((e) => e.kind === "source" && e.outcome === "created")
				.length,
		).toBe(1);
		expect(
			first.events.filter((e) => e.kind === "import" && e.outcome === "created")
				.length,
		).toBe(2);
		expect(
			first.events.filter((e) => e.kind === "route" && e.outcome === "upserted")
				.length,
		).toBe(3);

		const second = await applyProjectPackage({
			pkg,
			projectId: project.id,
			sources,
			imports,
			routes,
		});
		expect(
			second.events.filter((e) => e.kind === "source").every((e) => e.outcome === "exists"),
		).toBe(true);
		expect(
			second.events.filter((e) => e.kind === "import").every((e) => e.outcome === "exists"),
		).toBe(true);
	});
});
