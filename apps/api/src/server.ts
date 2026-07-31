/**
 * Aurii HTTP API application.
 *
 * Composes the existing Core runtime routes with the Project administration
 * surface under /api/projects and project-scoped datasets.
 */

import {
	buildApp as buildCoreApp,
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
import { createProjectDatasetsPlugin } from "./routes/project-datasets";
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

	return buildCoreApp(options)
		.use(createProjectsPlugin({ service: projectService }))
		.use(createProjectDatasetsPlugin(datasetPluginOptions));
}

function createDefaultProjectRepository(): ProjectRepository {
	if (process.env["DATABASE_URL"]) {
		const db = createDb();
		return new DrizzleProjectRepository(db);
	}
	return new MemoryProjectRepository();
}
