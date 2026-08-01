/**
 * Aurii HTTP API application.
 *
 * Composes the existing Core runtime routes with the Project administration
 * surface under /api/projects, platform resources, and public published routes.
 */

import {
	buildApp as buildCoreApp,
	configureProjectService,
	type AppOptions,
	createProjectService,
	DrizzleProjectRepository,
	getImportScheduler,
	getStorage,
	MemoryProjectRepository,
	type DatasetService,
	type ProjectRepository,
	type ProjectService,
	type StorageAdapter,
} from "@aurii/core";
import { createDb } from "@aurii/db";
import { Elysia } from "elysia";
import { createProjectDatasetsPlugin } from "./routes/project-datasets";
import { createProjectDatasetResourcesPlugin } from "./routes/project-dataset-resources";
import { createProjectPlatformPlugin } from "./routes/project-platform";
import { createProjectsPlugin } from "./routes/projects";
import { createPublicRoutesPlugin } from "./routes/public-routes";

export interface ApiAppOptions extends AppOptions {
	/** Override project persistence (defaults: memory unless DATABASE_URL is set). */
	projectRepository?: ProjectRepository;
	projectService?: ProjectService;
	datasetService?: DatasetService;
	storage?: StorageAdapter;
	/** Start the in-process import scheduler (default: false in tests). */
	enableScheduler?: boolean;
}

/**
 * Build the full API app (Core runtime + projects + platform + public routes).
 */
export function buildApiApp(options: ApiAppOptions = {}) {
	const projectService =
		options.projectService ??
		createProjectService(
			options.projectRepository ?? createDefaultProjectRepository(),
		);

	// Share the same ProjectService with Core import/schema write checks.
	configureProjectService(projectService);

	const datasetPluginOptions: Parameters<
		typeof createProjectDatasetsPlugin
	>[0] = {
		projectService,
		getStorage,
	};
	if (options.datasetService) {
		datasetPluginOptions.datasetService = options.datasetService;
	}
	if (options.storage) {
		datasetPluginOptions.storage = options.storage;
	}

	const apiToken = options.apiToken ?? process.env["AURII_API_TOKEN"];

	// Apply the same bearer-token gate as Core to /api/projects* routes.
	const projectRoutes = new Elysia({ name: "api-projects-auth" })
		.onBeforeHandle(({ headers, set }) => {
			if (!apiToken) return;
			const auth =
				(headers as Record<string, string | undefined>)["authorization"] ?? "";
			if (auth !== `Bearer ${apiToken}`) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
		})
		.use(createProjectsPlugin({ service: projectService }))
		.use(createProjectDatasetsPlugin(datasetPluginOptions))
		.use(
			createProjectDatasetResourcesPlugin({
				projectService,
				getStorage,
			}),
		)
		.use(createProjectPlatformPlugin({ projectService }));

	const app = buildCoreApp(options)
		.use(projectRoutes)
		.use(createPublicRoutesPlugin({ projectService }));

	if (options.enableScheduler ?? process.env["AURII_ENABLE_SCHEDULER"] === "1") {
		const scheduler = getImportScheduler();
		void projectService.listProjects().then((projects) => {
			scheduler.setWatchedProjects(projects.map((p) => p.id));
			scheduler.start();
		});
	}

	return app;
}

function createDefaultProjectRepository(): ProjectRepository {
	if (process.env["DATABASE_URL"]) {
		const db = createDb();
		return new DrizzleProjectRepository(db);
	}
	return new MemoryProjectRepository();
}
