/**
 * Aurii HTTP API application.
 *
 * Composes the existing Core runtime routes with the Project administration
 * surface under /api/projects, platform resources, and public published routes.
 */

import {
	buildApp as buildCoreApp,
	configurePlatformStore,
	configureProjectService,
	createDurablePlatformStore,
	type AppOptions,
	createProjectService,
	DrizzleProjectRepository,
	getImportScheduler,
	getPlatformStore,
	getStorage,
	hashToken,
	MemoryProjectRepository,
	parseBearer,
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
	/** Skip durable platform store init (tests that inject MemoryPlatformStore). */
	skipPlatformStoreInit?: boolean;
}

/**
 * Build the full API app (Core runtime + projects + platform + public routes).
 */
export function buildApiApp(options: ApiAppOptions = {}) {
	if (!options.skipPlatformStoreInit) {
		const durable = createDurablePlatformStore();
		if (durable) configurePlatformStore(durable);
	}

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

	// Accept global bearer OR a valid project-bound token. Platform routes
	// enforce finer AuthScope checks. Open mode when no global token is set.
	const projectRoutes = new Elysia({ name: "api-projects-auth" })
		.onBeforeHandle(async ({ headers, set, path }) => {
			if (!apiToken) return;
			const raw = parseBearer(
				(headers as Record<string, string | undefined>)["authorization"],
			);
			if (!raw) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
			if (raw === apiToken) return;
			// Allow project tokens through; platform handlers check scopes.
			const store = getPlatformStore();
			const token = await store.findTokenByHash(hashToken(raw));
			if (!token) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
			// Token must match the project in the path when present.
			const match = /\/api\/projects\/([^/]+)/.exec(path ?? "");
			if (match?.[1] && match[1] !== token.projectId) {
				set.status = 403;
				return { error: "Forbidden" };
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
		.use(
			createProjectPlatformPlugin({
				projectService,
				legacyApiToken: apiToken,
			}),
		);

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
