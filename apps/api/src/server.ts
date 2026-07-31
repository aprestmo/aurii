/**
 * Aurii HTTP API application.
 *
 * Composes the existing Core runtime routes with the Project administration
 * surface under /api/projects.
 */

import {
	buildApp as buildCoreApp,
	type AppOptions,
	createProjectService,
	DrizzleProjectRepository,
	MemoryProjectRepository,
	type ProjectRepository,
	type ProjectService,
} from "@aurii/core";
import { createDb } from "@aurii/db";
import { createProjectsPlugin } from "./routes/projects";

export interface ApiAppOptions extends AppOptions {
	/** Override project persistence (defaults: memory unless DATABASE_URL is set). */
	projectRepository?: ProjectRepository;
	projectService?: ProjectService;
}

/**
 * Build the full API app (Core runtime + projects) without listening.
 */
export function buildApiApp(options: ApiAppOptions = {}) {
	const projectService =
		options.projectService ??
		createProjectService(
			options.projectRepository ?? createDefaultProjectRepository(),
		);

	return buildCoreApp(options).use(
		createProjectsPlugin({ service: projectService }),
	);
}

function createDefaultProjectRepository(): ProjectRepository {
	if (process.env["DATABASE_URL"]) {
		const db = createDb();
		return new DrizzleProjectRepository(db);
	}
	return new MemoryProjectRepository();
}
