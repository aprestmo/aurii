#!/usr/bin/env bun
/**
 * Import the Norwegian Geo product into Aurii Core.
 *
 * Ensures the Norge Data project exists, creates/classifies the
 * `norwegian-geo` dataset under that project, then registers schemas
 * and runs imports.
 *
 * Usage (from repo root):
 *   bun run import:norwegian-geo
 *
 * With PostgreSQL:
 *   AURII_STORAGE=postgres DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
 *     bun run import:norwegian-geo
 */

import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
	closeStorage,
	configureProjectService,
	createDatasetService,
	createProjectService,
	DrizzleProjectRepository,
	ensureLegacyProject,
	getStorage,
	loadImportDefinition,
	MemoryProjectRepository,
	ProjectNotFoundError,
	registerSchema,
	resetProjectService,
	runImport,
} from "../../../packages/core/src/index";
import type { SchemaDefinition } from "../../../packages/core/src/schema/types";
import { createDb } from "../../../packages/db/src/index";
import {
	getDatasetId,
	listAllImports,
	listAllSchemas,
	loadManifest,
} from "../lib/manifest";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";

async function ensureNorgeDataProject(
	projects: ReturnType<typeof createProjectService>,
) {
	try {
		return await projects.getProjectBySlug(NORGE_DATA_PROJECT_SLUG);
	} catch (error) {
		if (!(error instanceof ProjectNotFoundError)) throw error;
		return projects.createProject({
			name: NORGE_DATA_PROJECT_NAME,
			slug: NORGE_DATA_PROJECT_SLUG,
			description: NORGE_DATA_PROJECT_DESCRIPTION,
		});
	}
}

async function applySchema(file: string, datasetId: string): Promise<void> {
	const content = await Bun.file(file).text();
	const def = parseYaml(content) as SchemaDefinition;
	await registerSchema(def, datasetId);
	console.log(`  ✓ Schema "${def.id}" registered`);
}

async function runImportFile(file: string, datasetId: string): Promise<void> {
	const def = await loadImportDefinition(file);
	const result = await runImport(def, resolve(file, ".."), {
		datasetId,
	});
	console.log(
		`  ✓ ${def.name}: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed (${result.durationMs}ms)`,
	);
	if (result.failed > 0) {
		for (const e of result.errors.slice(0, 5)) {
			console.error(`    Row ${e.row}: ${e.message}`);
		}
		process.exit(1);
	}
}

console.log("\nAurii — Norwegian Geo Import\n");

resetProjectService();
const storage = await getStorage();
await storage.init();

const repo = process.env["DATABASE_URL"]
	? new DrizzleProjectRepository(createDb())
	: new MemoryProjectRepository();
await ensureLegacyProject(repo);
const projects = createProjectService(repo);
configureProjectService(projects);
const datasetService = createDatasetService(storage, projects);

const norgeData = await ensureNorgeDataProject(projects);
console.log(
	`Project "${norgeData.name}" (${norgeData.slug}) — ${norgeData.id}\n`,
);

const manifest = loadManifest();
const datasetId = getDatasetId(manifest);

const existing = await storage.getDataset(datasetId);
if (!existing) {
	await datasetService.createDataset(norgeData.id, {
		id: datasetId,
		name: manifest.dataset.name,
	});
	console.log(`Dataset "${datasetId}" created in ${norgeData.slug}\n`);
} else if (existing.projectId !== norgeData.id) {
	await datasetService.reassignDatasetProject(datasetId, norgeData.id);
	console.log(`Dataset "${datasetId}" reassigned to ${norgeData.slug}\n`);
} else {
	console.log(`Dataset "${datasetId}" already in ${norgeData.slug}\n`);
}

try {
	console.log("Registering schemas (core → modules)...");
	for (const schema of listAllSchemas(manifest)) {
		const label = schema.moduleId ? `[${schema.moduleId}]` : "[core]";
		console.log(`  ${label} ${schema.schemaId}`);
		await applySchema(schema.file, datasetId);
	}

	console.log("\nRunning imports (core → modules)...");
	for (const imp of listAllImports(manifest)) {
		const label = imp.moduleId ? `[${imp.moduleId}]` : "[core]";
		console.log(`  ${label} ${imp.importId}`);
		await runImportFile(imp.file, datasetId);
	}

	console.log("\n── Summary ──────────────────────────────");
	console.log(`  project         ${norgeData.slug}`);
	console.log(`  dataset         ${datasetId}`);
	for (const schema of listAllSchemas(manifest)) {
		const count = await storage.countEntities(schema.schemaId, datasetId);
		const label = schema.schemaId.padEnd(16);
		const layer = schema.moduleId ? schema.moduleId.padEnd(10) : "core      ";
		console.log(`  ${label} ${layer} ${count}`);
	}
	console.log("────────────────────────────────────────\n");
} finally {
	await closeStorage();
	resetProjectService();
}
