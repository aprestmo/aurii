/**
 * HTTP path for the generic external-product fixture:
 * package → project → import → enable published route → public GET.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createProjectService,
	getStorage,
	loadImportDefinition,
	loadProjectPackage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerProjectPackage,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	runImport,
	type SchemaDefinition,
} from "@aurii/core";
import {
	createCatalogClient,
	loadCities,
	loadRegions,
} from "../../../../tests/fixtures/external-product/consumer";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";
import { buildApiApp } from "../server";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const DATASET = "catalog";
const MOCK_BASE = "http://localhost:3000";

describe("external-product HTTP contract", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("register package, import, enable route, public delivery", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		delete process.env["DATABASE_URL"];
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
			id: DATASET,
			name: "Catalog",
			projectId: project.id,
		});

		for (const schemaPath of pkg.schemaPaths) {
			const def = Bun.YAML.parse(
				await readFile(schemaPath, "utf-8"),
			) as SchemaDefinition;
			await registerSchema(def, DATASET);
		}

		for (const name of ["regions", "cities"]) {
			const file = resolve(FIXTURE, "imports", `${name}.yaml`);
			const def = await loadImportDefinition(file);
			const imported = await runImport(def, resolve(file, ".."), {
				datasetId: DATASET,
			});
			expect(imported.failed).toBe(0);
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

		const registered = await registerProjectPackage({
			pkg,
			coreUrl: MOCK_BASE,
			fetch: fetchImpl,
			project: { name: "Catalog", slug: "catalog" },
		});
		expect(registered.project.slug).toBe("catalog");
		expect(
			registered.events.some(
				(e) => e.kind === "source" && e.id === "catalog-file" && e.outcome === "created",
			),
		).toBe(true);
		expect(
			registered.events.filter((e) => e.kind === "route" && e.outcome === "upserted")
				.length,
		).toBe(pkg.routes.length);

		for (const route of pkg.routes) {
			const enable = await app.handle(
				new Request(
					`http://localhost/api/projects/${project.id}/routes/${route.id}`,
					{
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ enabled: true }),
					},
				),
			);
			expect(enable.status).toBeLessThan(300);
		}

		const regions = await app.handle(
			new Request("http://localhost/public/catalog/v1/regions"),
		);
		expect(regions.status).toBe(200);
		const regionBody = (await regions.json()) as {
			data: Array<{ id: string; name: string }>;
		};
		expect(regionBody.data.map((r) => r.id).sort()).toEqual(["north", "south"]);

		const cities = await app.handle(
			new Request("http://localhost/public/catalog/v1/cities"),
		);
		expect(cities.status).toBe(200);
		const cityBody = (await cities.json()) as {
			data: Array<{ id: string; regionId: string }>;
		};
		expect(cityBody.data).toHaveLength(3);
		expect(cityBody.data.every((c) => c.regionId === "north" || c.regionId === "south")).toBe(
			true,
		);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchImpl;
		try {
			const client = createCatalogClient(MOCK_BASE);
			const viaSdk = await loadRegions(client);
			expect(viaSdk.map((r) => r.id).sort()).toEqual(["north", "south"]);
			const citiesViaSdk = await loadCities(client);
			expect(citiesViaSdk).toHaveLength(3);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
