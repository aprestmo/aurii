/**
 * Process-wide ProjectService accessor for Core runtime paths
 * (import engine, schema registry) that resolve project through dataset.
 *
 * Prefer injecting ProjectService at composition roots (apps/api). Tests may
 * call `configureProjectService` / `resetProjectService` explicitly.
 *
 * When unset, a default service is created: Drizzle when DATABASE_URL is set,
 * otherwise an in-memory repository with Legacy ensured.
 */

import { createDb } from "@aurii/db";
import { DrizzleProjectRepository } from "./drizzle-repository";
import { ensureLegacyProject } from "./ensure-legacy";
import { MemoryProjectRepository } from "./memory-repository";
import { createProjectService, type ProjectService } from "./service";

let _projects: ProjectService | null = null;
let _autoConfigured = false;

/**
 * Bind the ProjectService used by Core import/schema write checks.
 * Call from the API composition root so HTTP and Core share one instance.
 */
export function configureProjectService(service: ProjectService): void {
	_projects = service;
	_autoConfigured = false;
}

/** Clear the process-wide ProjectService (tests). */
export function resetProjectService(): void {
	_projects = null;
	_autoConfigured = false;
}

/**
 * Resolve the ProjectService for Core runtime paths.
 * Auto-configures a default when none was injected.
 */
export async function getProjectService(): Promise<ProjectService> {
	if (_projects) return _projects;

	if (process.env["DATABASE_URL"]) {
		const db = createDb();
		const repo = new DrizzleProjectRepository(db);
		await ensureLegacyProject(repo);
		_projects = createProjectService(repo);
	} else {
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		_projects = createProjectService(repo);
	}
	_autoConfigured = true;
	return _projects;
}

/** True when the current service was created by getProjectService defaults. */
export function isProjectServiceAutoConfigured(): boolean {
	return _autoConfigured;
}
