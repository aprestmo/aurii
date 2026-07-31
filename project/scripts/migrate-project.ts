#!/usr/bin/env bun
/**
 * Classify Norwegian Geo datasets under the Norge Data project.
 *
 * Idempotent administrative migration for existing installations:
 * - Ensures project Norge Data (slug: norge-data) exists and is active
 * - Moves expected datasets from Legacy (or any other project) via DatasetService
 * - Preserves dataset ids, entities, schemas, imports, and history
 *
 * Usage (from repo root):
 *   bun run migrate:norwegian-geo-project
 *
 * With PostgreSQL:
 *   AURII_STORAGE=postgres DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
 *     bun run migrate:norwegian-geo-project
 */

import {
	closeStorage,
	configureProjectService,
	createDatasetService,
	createProjectService,
	DrizzleProjectRepository,
	ensureLegacyProject,
	getStorage,
	MemoryProjectRepository,
	ProjectNotFoundError,
	resetProjectService,
} from "../../../packages/core/src/index";
import { createDb } from "../../../packages/db/src/index";
import { getDatasetId, loadManifest } from "../lib/manifest";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";

interface MigrateSummary {
	projectId: string;
	projectSlug: string;
	moved: string[];
	alreadyClassified: string[];
	missing: string[];
	conflicts: string[];
}

async function ensureNorgeDataProject(
	projects: ReturnType<typeof createProjectService>,
) {
	try {
		const existing = await projects.getProjectBySlug(NORGE_DATA_PROJECT_SLUG);
		if (existing.status !== "active") {
			await projects.setProjectStatus(existing.id, "active");
			return projects.getProjectBySlug(NORGE_DATA_PROJECT_SLUG);
		}
		return existing;
	} catch (error) {
		if (!(error instanceof ProjectNotFoundError)) throw error;
		return projects.createProject({
			name: NORGE_DATA_PROJECT_NAME,
			slug: NORGE_DATA_PROJECT_SLUG,
			description: NORGE_DATA_PROJECT_DESCRIPTION,
		});
	}
}

async function main(): Promise<MigrateSummary> {
	resetProjectService();
	const storage = await getStorage();
	await storage.init();

	const repo = process.env["DATABASE_URL"]
		? new DrizzleProjectRepository(createDb())
		: new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	const projects = createProjectService(repo);
	configureProjectService(projects);
	const datasets = createDatasetService(storage, projects);

	const norgeData = await ensureNorgeDataProject(projects);
	const manifest = loadManifest();
	const expected = [getDatasetId(manifest)];

	const summary: MigrateSummary = {
		projectId: norgeData.id,
		projectSlug: norgeData.slug,
		moved: [],
		alreadyClassified: [],
		missing: [],
		conflicts: [],
	};

	for (const datasetId of expected) {
		const existing = await storage.getDataset(datasetId);
		if (!existing) {
			summary.missing.push(datasetId);
			continue;
		}
		if (existing.projectId === norgeData.id) {
			summary.alreadyClassified.push(datasetId);
			continue;
		}
		try {
			await datasets.reassignDatasetProject(datasetId, norgeData.id);
			summary.moved.push(datasetId);
		} catch (error) {
			summary.conflicts.push(
				`${datasetId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return summary;
}

console.log("\nAurii — Migrate Norwegian Geo → Norge Data\n");

try {
	const summary = await main();
	console.log(`Project: ${NORGE_DATA_PROJECT_NAME} (${summary.projectSlug})`);
	console.log(`Project ID: ${summary.projectId}`);
	console.log(`Moved: ${summary.moved.length} datasets`);
	if (summary.moved.length > 0) {
		for (const id of summary.moved) console.log(`  → ${id}`);
	}
	console.log(`Already classified: ${summary.alreadyClassified.length}`);
	if (summary.alreadyClassified.length > 0) {
		for (const id of summary.alreadyClassified) console.log(`  · ${id}`);
	}
	console.log(`Missing: ${summary.missing.length}`);
	if (summary.missing.length > 0) {
		for (const id of summary.missing) console.log(`  ! ${id}`);
	}
	console.log(`Conflicts: ${summary.conflicts.length}`);
	if (summary.conflicts.length > 0) {
		for (const c of summary.conflicts) console.log(`  ✗ ${c}`);
	}
	console.log("");

	if (summary.conflicts.length > 0) {
		process.exitCode = 1;
	}
} finally {
	await closeStorage();
	resetProjectService();
}
