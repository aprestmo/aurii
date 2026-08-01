/**
 * End-to-end: Norwegian Geo project config → Project → Dataset → source →
 * import → enable published route → request route.
 */

import { afterEach, describe, expect, test } from "bun:test";
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
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	runImport,
} from "@aurii/core";
import { buildApiApp } from "../server";
import { PRODUCT_ROOT } from "../../../../demo/norwegian-geo/lib/paths";

const DEMO = PRODUCT_ROOT;

describe("Norwegian Geo project-oriented beta e2e", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("config → project → source → import → published route", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		await closeStorage().catch(() => undefined);

		const pkg = await loadProjectPackage(DEMO);
		expect(pkg.config.id).toBe("norwegian-geo");
		expect(pkg.config.core.projectSlug).toBe("norge-data");
		expect(pkg.studio?.title).toBe("Norwegian Geo");
		expect(pkg.routes.length).toBeGreaterThanOrEqual(4);

		const repo = new MemoryProjectRepository();
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const store = new MemoryPlatformStore();
		configurePlatformStore(store);

		const storage = await getStorage();
		const project = await projects.createProject({
			name: "Norge Data",
			slug: "norge-data",
			description: "test",
		});
		await storage.createDataset({
			id: "norwegian-geo",
			name: "Norwegian Public Reference Data",
			projectId: project.id,
		});

		for (const schemaPath of pkg.schemaPaths) {
			const { readFile } = await import("node:fs/promises");
			const { parse } = await import("yaml");
			const def = parse(await readFile(schemaPath, "utf-8"));
			await registerSchema(def, "norwegian-geo");
		}

		const app = buildApiApp({
			projectService: projects,
		});

		const sourceRes = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/sources`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: "kartverket",
					datasetId: "norwegian-geo",
					name: "Kartverket",
					kind: "file",
					config: { targetSchemas: ["county"], path: "./core/data" },
				}),
			}),
		);
		expect(sourceRes.status).toBe(201);

		const countiesYaml = resolve(DEMO, "core/imports/counties.yaml");
		const importDef = await loadImportDefinition(countiesYaml);
		const importResult = await runImport(importDef, resolve(DEMO, "core/imports"), {
			dryRun: false,
			datasetId: "norwegian-geo",
		});
		expect(importResult.imported).toBeGreaterThan(0);

		const routeDef = pkg.routes.find((r) => r.id === "counties")!;
		const upsert = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/routes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					routeId: routeDef.id,
					datasetId: "norwegian-geo",
					definition: routeDef,
					enabled: true,
					access: "public",
					cacheTtl: 60,
				}),
			}),
		);
		expect(upsert.status).toBe(201);

		const pub = await app.handle(
			new Request("http://localhost/public/norge-data/v1/counties"),
		);
		expect(pub.status).toBe(200);
		const body = (await pub.json()) as {
			data: Array<{ id: string; name: string }>;
		};
		expect(body.data.length).toBeGreaterThan(0);
		expect(body.data[0]).toHaveProperty("id");
		expect(body.data[0]).toHaveProperty("name");

		await app.handle(
			new Request(
				`http://localhost/api/projects/${project.id}/routes/counties`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled: false }),
				},
			),
		);
		const disabled = await app.handle(
			new Request("http://localhost/public/norge-data/v1/counties"),
		);
		expect(disabled.status).toBe(404);
	});
});
