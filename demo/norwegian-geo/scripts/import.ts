#!/usr/bin/env bun
/**
 * Import the Norwegian Geo product into Aurii Core.
 *
 * Registers Norwegian Geo Core schemas first, then dataset module schemas.
 * Import order respects cross-dataset reference dependencies.
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
	getDatasetId,
	listAllImports,
	listAllSchemas,
	loadManifest,
} from "../lib/manifest";
import { loadImportDefinition, runImport } from "../../../packages/core/src/import/engine";
import { registerSchema } from "../../../packages/core/src/schema/registry";
import type { SchemaDefinition } from "../../../packages/core/src/schema/types";
import { closeStorage, getStorage } from "../../../packages/core/src/storage";

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

const manifest = loadManifest();
const datasetId = getDatasetId(manifest);

const storage = await getStorage();
await storage.init();

try {
	await storage.createDataset({
		id: datasetId,
		name: manifest.dataset.name,
	});
	console.log(`Dataset "${datasetId}" ready\n`);
} catch {
	console.log(`Dataset "${datasetId}" already exists\n`);
}

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
for (const schema of listAllSchemas(manifest)) {
	const count = await storage.countEntities(schema.schemaId, datasetId);
	const label = schema.schemaId.padEnd(16);
	const layer = schema.moduleId ? schema.moduleId.padEnd(10) : "core      ";
	console.log(`  ${label} ${layer} ${count}`);
}
console.log("────────────────────────────────────────\n");

await closeStorage();
