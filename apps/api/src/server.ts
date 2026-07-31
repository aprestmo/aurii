/**
 * Aurii HTTP API application.
 *
 * Composes the existing Core runtime routes with the Project administration
 * surface under /api/projects and project-scoped datasets.
 */

import {
	buildApp as buildCoreApp,
	configureProjectService,
	type AppOptions,
	createProjectService,
	DrizzleProjectRepository,
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
import { createProjectsPlugin } from "./routes/projects";

export interface ApiAppOptions extends AppOptions {
	/** Override project persistence (defaults: memory unless DATABASE_URL is set). */
	projectRepository?: ProjectRepository;
	projectService?: ProjectService;
	datasetService?: DatasetService;
	storage?: StorageAdapter;
}

/**
 * Build the full API app (Core runtime + projects + project datasets).
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
		);

	return buildCoreApp(options).use(projectRoutes);
}

function createDefaultProjectRepository(): ProjectRepository {
	if (process.env["DATABASE_URL"]) {
		const db = createDb();
		return new DrizzleProjectRepository(db);
	}
	return new MemoryProjectRepository();
}
