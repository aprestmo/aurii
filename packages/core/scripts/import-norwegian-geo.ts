#!/usr/bin/env bun
/**
 * Import the Norwegian geographic reference dataset into Aurii Core.
 *
 * Usage (from repo root):
 *   bun run import:norwegian-geo
 *
 * With PostgreSQL:
 *   AURII_STORAGE=postgres DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
 *     bun run import:norwegian-geo
 */

import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { loadImportDefinition, runImport } from "../src/import/engine";
import { registerSchema } from "../src/schema/registry";
import type { SchemaDefinition } from "../src/schema/types";
import { closeStorage, getStorage } from "../src/storage";

const ROOT = resolve(import.meta.dir, "../../..");
const DEMO = resolve(ROOT, "demo/norwegian-geo");
const DATASET = "norwegian-geo";

async function applySchema(file: string): Promise<void> {
	const content = await Bun.file(file).text();
	const def = parseYaml(content) as SchemaDefinition;
	await registerSchema(def, DATASET);
	console.log(`  ✓ Schema "${def.id}" registered`);
}

async function runImportFile(file: string): Promise<void> {
	const def = await loadImportDefinition(file);
	const result = await runImport(def, resolve(file, ".."));
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

console.log("\nAurii — Norwegian Geographic Data Import\n");

const storage = await getStorage();
await storage.init();

try {
	await storage.createDataset({
		id: DATASET,
		name: "Norwegian Geography",
	});
	console.log(`Dataset "${DATASET}" ready\n`);
} catch {
	console.log(`Dataset "${DATASET}" already exists\n`);
}

console.log("Registering schemas...");
for (const schema of ["county", "municipality", "postal-code"]) {
	await applySchema(resolve(DEMO, "schemas", `${schema}.yaml`));
}

console.log("\nRunning imports...");
for (const imp of ["counties", "municipalities", "postal-codes"]) {
	await runImportFile(resolve(DEMO, "imports", `${imp}.yaml`));
}

const countyCount = await storage.countEntities("county", DATASET);
const municipalityCount = await storage.countEntities("municipality", DATASET);
const postalCount = await storage.countEntities("postal-code", DATASET);

console.log("\n── Summary ──────────────────────────────");
console.log(`  Counties:       ${countyCount}`);
console.log(`  Municipalities: ${municipalityCount}`);
console.log(`  Postal codes:   ${postalCount}`);
console.log("────────────────────────────────────────\n");

await closeStorage();
