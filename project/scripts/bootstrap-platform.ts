/**
 * Bootstrap Norwegian Geo platform resources in-process (CI / validation).
 * For a running Core API, use registerProjectPackage / register-via-api.ts.
 *
 * Usage:
 *   bun run demo/norwegian-geo/scripts/bootstrap-platform.ts
 */

import {
	applyProjectPackage,
	createDataSourceService,
	createPublishedRouteService,
	createSavedImportService,
	loadProjectPackage,
	MemoryProjectRepository,
	configureProjectService,
	createProjectService,
	resetPlatformStore,
	SqliteAdapter,
} from "@aurii/core";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";
import { PRODUCT_ROOT } from "../lib/paths";

const root = PRODUCT_ROOT;
const pkg = await loadProjectPackage(root);

const repo = new MemoryProjectRepository();
const projects = createProjectService(repo);
configureProjectService(projects);

const storage = new SqliteAdapter(":memory:");
await storage.init();

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

const result = await applyProjectPackage({
	pkg,
	projectId: project.id,
	sources: createDataSourceService(),
	imports: createSavedImportService(),
	routes: createPublishedRouteService(),
	strictRoutes: false,
	onEvent: (event) => {
		const extra = event.error ? ` (${event.error})` : "";
		console.log(`${event.kind} ${event.id}: ${event.outcome}${extra}`);
	},
});

console.log("Norwegian Geo project package loaded:", result.packageId);
console.log("Studio:", pkg.studio?.title ?? "(default)");
await storage.close();
