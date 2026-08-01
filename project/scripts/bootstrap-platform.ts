/**
 * Register Norwegian Geo project-package resources into a running Core:
 * data sources, saved imports (incl. disabled nightly sync), published routes.
 *
 * Usage (after import:norwegian-geo):
 *   bun run demo/norwegian-geo/scripts/bootstrap-platform.ts
 */

import { resolve } from "node:path";
import {
	createDataSourceService,
	createPublishedRouteService,
	createSavedImportService,
	loadProjectPackage,
	MemoryProjectRepository,
	configureProjectService,
	createProjectService,
	resetPlatformStore,
	getStorage,
	SqliteAdapter,
} from "@aurii/core";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";
import { PRODUCT_ROOT } from "../lib/paths";

async function main() {
	const root = PRODUCT_ROOT;
	const pkg = await loadProjectPackage(root);

	const repo = new MemoryProjectRepository();
	const projects = createProjectService(repo);
	configureProjectService(projects);

	// Prefer existing storage if already initialized by import script context;
	// for standalone bootstrap we still need a project + dataset.
	const storage = new SqliteAdapter(":memory:");
	await storage.init();
	// Note: this script is mainly for validation of package loading in CI.
	// Production registration uses HTTP against a running API — see register-via-api.ts

	resetPlatformStore();
	let project = await projects.listProjects({ status: "active" }).then((list) =>
		list.find((p) => p.slug === NORGE_DATA_PROJECT_SLUG),
	);
	if (!project) {
		project = await projects.createProject({
			name: NORGE_DATA_PROJECT_NAME,
			slug: NORGE_DATA_PROJECT_SLUG,
			description: NORGE_DATA_PROJECT_DESCRIPTION,
		});
	}

	const datasetId = pkg.config.core.defaultDataset;
	const existing = await storage.getDataset(datasetId);
	if (!existing) {
		await storage.createDataset({
			id: datasetId,
			name: "Norwegian Public Reference Data",
			projectId: project.id,
		});
	}

	const sources = createDataSourceService();
	const imports = createSavedImportService();
	const routes = createPublishedRouteService();

	for (const sp of pkg.sourcePaths) {
		const mod = await import(sp);
		const def = mod.default;
		try {
			await sources.create(project.id, {
				id: def.id,
				datasetId: def.datasetId,
				name: def.name,
				kind: def.kind,
				config: def.config,
			});
			console.log(`source ${def.id}`);
		} catch (e) {
			console.log(`source ${def.id}:`, e instanceof Error ? e.message : e);
		}
	}

	const importMods = [...pkg.importPaths, ...pkg.syncPaths];
	for (const ip of importMods) {
		const mod = await import(ip);
		const def = mod.default;
		const definitionPath = resolve(root, def.definitionPath);
		try {
			await imports.create(project.id, {
				id: def.id,
				datasetId: def.datasetId,
				sourceId: def.sourceId,
				name: def.name,
				schemaId: def.schemaId,
				status: def.status ?? "active",
				triggerMode: def.triggerMode,
				definitionPath,
				schedule: def.schedule
					? {
							enabled: def.schedule.enabled,
							spec: def.schedule.spec,
							nextRunAt: null,
							lastRunAt: null,
						}
					: null,
			});
			console.log(`import ${def.id}`);
		} catch (e) {
			console.log(`import ${def.id}:`, e instanceof Error ? e.message : e);
		}
	}

	for (const route of pkg.routes) {
		try {
			await routes.upsert(project.id, {
				routeId: route.id,
				datasetId,
				definition: route,
				enabled: route.defaults?.enabled ?? false,
				access: route.defaults?.access ?? "public",
				cacheTtl: route.defaults?.cacheTtl ?? 3600,
				version: route.version ?? "1",
			});
			console.log(`route ${route.id}`);
		} catch (e) {
			console.log(`route ${route.id}:`, e instanceof Error ? e.message : e);
		}
	}

	console.log("Norwegian Geo project package loaded:", pkg.config.id);
	console.log("Studio:", pkg.studio?.title ?? "(default)");
	await storage.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
