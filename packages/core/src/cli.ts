#!/usr/bin/env bun
/**
 * Aurii CLI — Phase 2
 *
 * Usage:
 *   bun run cli schema apply <file> [--dataset <id>]
 *   bun run cli schema list [--dataset <id>]
 *   bun run cli schema get <id> [--dataset <id>]
 *   bun run cli dataset create <id> <name>
 *   bun run cli dataset list
 *   bun run cli import run <file> [--dataset <id>] [--dry-run]
 *   bun run cli query "<query string>" [--dataset <id>]
 *   bun run cli entity get <id>
 *   bun run cli entity list <schema> [--dataset <id>] [--limit <n>]
 *   bun run cli serve [--port <n>]
 */

import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { getEntity, listEntities } from "./entity/store";
import { loadImportDefinition, runImport } from "./import/engine";
import { executeQuery } from "./query/executor";
import { parseQuery } from "./query/parser";
import { getSchema, listSchemas, registerSchema } from "./schema/registry";
import type { SchemaDefinition } from "./schema/types";
import { closeStorage, DEFAULT_DATASET, getStorage } from "./storage";

const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
};

const ok = (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`);
const err = (msg: string) => console.error(`${c.red}✗${c.reset} ${msg}`);
const hdr = (msg: string) =>
	console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}`);
const dim = (msg: string) => console.log(`${c.gray}${msg}${c.reset}`);

const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

function hasFlag(name: string): boolean {
	return args.includes(name);
}

const datasetId = flagValue("--dataset") ?? DEFAULT_DATASET;

// ── Schema commands ───────────────────────────────────────────────────────────

async function cmdSchemaApply(filePath: string) {
	const absPath = resolve(process.cwd(), filePath);
	const file = Bun.file(absPath);
	if (!(await file.exists())) {
		err(`File not found: ${absPath}`);
		process.exit(1);
	}
	const def = parseYaml(await file.text()) as SchemaDefinition;
	const schema = await registerSchema(def, datasetId);
	ok(
		`Schema "${schema.id}" registered in dataset "${datasetId}" (${schema.fields.length} fields)`,
	);
	dim(
		`  Fields: ${schema.fields.map((f) => `${f.name}:${f.type}${f.required ? "*" : ""}`).join(", ")}`,
	);
}

async function cmdSchemaList() {
	const schemas = await listSchemas(
		hasFlag("--dataset") ? datasetId : undefined,
	);
	if (schemas.length === 0) {
		dim("No schemas registered.");
		return;
	}
	hdr(`Schemas (${schemas.length})`);
	for (const s of schemas) {
		console.log(
			`  ${c.bold}${s.id}${c.reset} ${c.gray}[${s.datasetId}] — ${s.name} (${s.fields.length} fields)${c.reset}`,
		);
	}
}

async function cmdSchemaGet(id: string) {
	const schema = await getSchema(id, datasetId);
	if (!schema) {
		err(`Schema "${id}" not found in dataset "${datasetId}"`);
		process.exit(1);
	}
	console.log(JSON.stringify(schema, null, 2));
}

// ── Dataset commands ──────────────────────────────────────────────────────────

async function cmdDatasetCreate(id: string, name: string) {
	const storage = await getStorage();
	const ds = await storage.createDataset({ id, name });
	ok(`Dataset "${ds.id}" created (${ds.name})`);
}

async function cmdDatasetList() {
	const storage = await getStorage();
	const datasets = await storage.listDatasets();
	hdr(`Datasets (${datasets.length})`);
	for (const d of datasets) {
		console.log(`  ${c.bold}${d.id}${c.reset} ${c.gray}— ${d.name}${c.reset}`);
	}
}

// ── Import commands ───────────────────────────────────────────────────────────

async function cmdImportRun(filePath: string) {
	const absPath = resolve(process.cwd(), filePath);
	const def = await loadImportDefinition(absPath);
	const dryRun = hasFlag("--dry-run");

	console.log(
		`\nRunning import: ${c.bold}${def.name}${c.reset}${dryRun ? ` ${c.yellow}(dry run)${c.reset}` : ""}`,
	);
	dim(`  Schema:  ${def.schema}`);
	dim(`  Dataset: ${datasetId}`);
	dim(`  Source:  ${def.source.type} — ${def.source.path}`);
	console.log("");

	const result = await runImport(def, process.cwd(), { datasetId, dryRun });

	const statusColor =
		result.failed === 0 ? c.green : result.imported === 0 ? c.red : c.yellow;
	const status =
		result.failed === 0
			? "complete"
			: result.imported === 0
				? "failed"
				: "partial";

	console.log(
		`${statusColor}${c.bold}Import ${status}${c.reset} in ${result.durationMs}ms${dryRun ? " (nothing written)" : ""}`,
	);
	console.log(
		`  ${c.green}${dryRun ? "Would import" : "Imported"}: ${result.imported}${c.reset}`,
	);
	if (result.failed > 0) {
		console.log(`  ${c.red}Failed:   ${result.failed}${c.reset}`);
		for (const e of result.errors.slice(0, 10)) {
			console.log(`    ${c.gray}Row ${e.row}: ${e.message}${c.reset}`);
		}
	}
	console.log(`  Total:    ${result.total}`);
}

// ── Query / entity commands ───────────────────────────────────────────────────

async function cmdQuery(queryStr: string) {
	const parsed = parseQuery(queryStr);
	const result = await executeQuery(parsed, datasetId);
	if (result.entities.length === 0) {
		dim("No entities matched.");
		return;
	}
	console.log(JSON.stringify(result.entities, null, 2));
	dim(`\n${result.count} result${result.count !== 1 ? "s" : ""}`);
}

async function cmdEntityGet(id: string) {
	const entity = await getEntity(id);
	if (!entity) {
		err(`Entity "${id}" not found`);
		process.exit(1);
	}
	console.log(JSON.stringify(entity, null, 2));
}

async function cmdEntityList(schemaId: string) {
	const limit = flagValue("--limit") ? parseInt(flagValue("--limit")!, 10) : 20;
	const entities = await listEntities(schemaId, datasetId, limit);
	if (entities.length === 0) {
		dim(`No entities for schema "${schemaId}" in dataset "${datasetId}"`);
		return;
	}
	console.log(JSON.stringify(entities, null, 2));
	dim(`\n${entities.length} result${entities.length !== 1 ? "s" : ""}`);
}

// ── Serve ─────────────────────────────────────────────────────────────────────

async function cmdServe() {
	const port = flagValue("--port");
	if (port) process.env["PORT"] = port;
	await import("./api/server");
}

// ── Help ──────────────────────────────────────────────────────────────────────

function printHelp() {
	console.log(`
${c.bold}${c.cyan}Aurii CLI${c.reset} — Phase 2

${c.bold}Datasets:${c.reset}
  dataset create <id> <name>       Create a dataset
  dataset list                     List datasets

${c.bold}Schemas:${c.reset}
  schema apply <file> [--dataset]  Register a schema from YAML
  schema list [--dataset]          List schemas
  schema get <id> [--dataset]      Show schema details

${c.bold}Imports:${c.reset}
  import run <file> [--dataset] [--dry-run]

${c.bold}Queries:${c.reset}
  query "<query>" [--dataset]      Execute a query

${c.bold}Entities:${c.reset}
  entity get <id>
  entity list <schema> [--dataset] [--limit <n>]

${c.bold}Server:${c.reset}
  serve [--port <n>]               Start the HTTP API

${c.bold}Environment:${c.reset}
  AURII_STORAGE=sqlite|postgres    Storage engine (default: sqlite)
  DATABASE_URL=postgres://…        PostgreSQL connection
  AURII_DB_PATH=./aurii.db         SQLite file path
  AURII_API_TOKEN=…                Protect the HTTP API
`);
}

// ── Router ────────────────────────────────────────────────────────────────────

async function main() {
	const [cmd, sub, ...rest] = args;

	if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
		printHelp();
		return;
	}

	if (cmd === "schema") {
		if (sub === "apply" && rest[0]) return cmdSchemaApply(rest[0]);
		if (sub === "list") return cmdSchemaList();
		if (sub === "get" && rest[0]) return cmdSchemaGet(rest[0]);
		err("Usage: schema apply|list|get");
		process.exit(1);
	}

	if (cmd === "dataset") {
		if (sub === "create" && rest[0] && rest[1])
			return cmdDatasetCreate(rest[0], rest[1]);
		if (sub === "list") return cmdDatasetList();
		err("Usage: dataset create <id> <name> | dataset list");
		process.exit(1);
	}

	if (cmd === "import") {
		if (sub === "run" && rest[0]) return cmdImportRun(rest[0]);
		err("Usage: import run <file>");
		process.exit(1);
	}

	if (cmd === "query") {
		const queryStr = sub;
		if (!queryStr) {
			err("Provide a query string");
			process.exit(1);
		}
		return cmdQuery(queryStr);
	}

	if (cmd === "entity") {
		if (sub === "get" && rest[0]) return cmdEntityGet(rest[0]);
		if (sub === "list" && rest[0]) return cmdEntityList(rest[0]);
		err("Usage: entity get|list");
		process.exit(1);
	}

	if (cmd === "serve") return cmdServe();

	err(`Unknown command: "${cmd}". Run with --help for usage.`);
	process.exit(1);
}

main()
	.then(async () => {
		// Keep server alive; close storage for one-shot commands
		if (args[0] !== "serve") await closeStorage();
	})
	.catch(async (e) => {
		err(String(e));
		await closeStorage();
		process.exit(1);
	});
