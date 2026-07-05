#!/usr/bin/env bun
/**
 * Aurii CLI — Phase 1
 *
 * Usage:
 *   bun run cli schema apply <file>
 *   bun run cli schema list
 *   bun run cli schema get <id>
 *   bun run cli import run <file>
 *   bun run cli query "<query string>"
 *   bun run cli entity get <id>
 *   bun run cli serve [--port <n>]
 */

import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { registerSchema, listSchemas, getSchema } from "./schema/registry";
import { getEntity, listEntities } from "./entity/store";
import { parseQuery } from "./query/parser";
import { executeQuery } from "./query/executor";
import { runImport, loadImportDefinition } from "./import/engine";
import type { SchemaDefinition } from "./schema/types";

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  gray:   "\x1b[90m",
};

const ok  = (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`);
const err = (msg: string) => console.error(`${c.red}✗${c.reset} ${msg}`);
const hdr = (msg: string) => console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}`);
const dim = (msg: string) => console.log(`${c.gray}${msg}${c.reset}`);

// ── Schema commands ───────────────────────────────────────────────────────────

async function cmdSchemaApply(filePath: string) {
  const absPath = resolve(process.cwd(), filePath);
  const file = Bun.file(absPath);

  if (!(await file.exists())) {
    err(`File not found: ${absPath}`);
    process.exit(1);
  }

  const content = await file.text();
  const def = parseYaml(content) as SchemaDefinition;

  try {
    const schema = registerSchema(def);
    ok(`Schema "${schema.id}" registered (${schema.fields.length} field${schema.fields.length !== 1 ? "s" : ""})`);
    dim(`  Name:    ${schema.name}`);
    if (schema.description) dim(`  Desc:    ${schema.description}`);
    dim(`  Version: ${schema.version}`);
    dim(`  Fields:  ${schema.fields.map((f) => `${f.name}:${f.type}${f.required ? "*" : ""}`).join(", ")}`);
  } catch (e) {
    err(String(e));
    process.exit(1);
  }
}

function cmdSchemaList() {
  const schemas = listSchemas();
  if (schemas.length === 0) {
    dim("No schemas registered. Use: aurii schema apply <file>");
    return;
  }
  hdr(`Schemas (${schemas.length})`);
  for (const s of schemas) {
    console.log(`  ${c.bold}${s.id}${c.reset} ${c.gray}— ${s.name} (${s.fields.length} fields)${c.reset}`);
  }
}

function cmdSchemaGet(id: string) {
  const schema = getSchema(id);
  if (!schema) {
    err(`Schema "${id}" not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(schema, null, 2));
}

// ── Import commands ───────────────────────────────────────────────────────────

async function cmdImportRun(filePath: string) {
  const absPath = resolve(process.cwd(), filePath);

  let def;
  try {
    def = await loadImportDefinition(absPath);
  } catch (e) {
    err(String(e));
    process.exit(1);
  }

  console.log(`\nRunning import: ${c.bold}${def.name}${c.reset}`);
  dim(`  Schema: ${def.schema}`);
  dim(`  Source: ${def.source.type} — ${def.source.path}`);
  console.log("");

  try {
    const result = await runImport(def, process.cwd());

    const statusColor = result.failed === 0 ? c.green : result.imported === 0 ? c.red : c.yellow;
    const status = result.failed === 0 ? "complete" : result.imported === 0 ? "failed" : "partial";

    console.log(`${statusColor}${c.bold}Import ${status}${c.reset} in ${result.durationMs}ms`);
    console.log(`  ${c.green}Imported: ${result.imported}${c.reset}`);
    if (result.failed > 0) {
      console.log(`  ${c.red}Failed:   ${result.failed}${c.reset}`);
      for (const e of result.errors) {
        console.log(`    ${c.gray}Row ${e.row}: ${e.message}${c.reset}`);
      }
    }
    console.log(`  Total:    ${result.total}`);
  } catch (e) {
    err(String(e));
    process.exit(1);
  }
}

// ── Query commands ────────────────────────────────────────────────────────────

function cmdQuery(queryStr: string) {
  try {
    const parsed = parseQuery(queryStr);
    const result = executeQuery(parsed);

    if (result.entities.length === 0) {
      dim("No entities matched.");
      return;
    }

    console.log(JSON.stringify(result.entities, null, 2));
    dim(`\n${result.count} result${result.count !== 1 ? "s" : ""}`);
  } catch (e) {
    err(String(e));
    process.exit(1);
  }
}

// ── Entity commands ───────────────────────────────────────────────────────────

function cmdEntityGet(id: string) {
  const entity = getEntity(id);
  if (!entity) {
    err(`Entity "${id}" not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(entity, null, 2));
}

function cmdEntityList(schemaId: string, limit?: number) {
  const entities = listEntities(schemaId, limit);
  if (entities.length === 0) {
    dim(`No entities for schema "${schemaId}"`);
    return;
  }
  console.log(JSON.stringify(entities, null, 2));
  dim(`\n${entities.length} result${entities.length !== 1 ? "s" : ""}`);
}

// ── Serve command ─────────────────────────────────────────────────────────────

async function cmdServe(port?: number) {
  process.env["PORT"] = String(port ?? 3000);
  await import("./api/server");
}

// ── Help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${c.bold}${c.cyan}Aurii CLI${c.reset} — Phase 1

${c.bold}Schema commands:${c.reset}
  schema apply <file>      Register a schema from a YAML file
  schema list              List all registered schemas
  schema get <id>          Show schema details

${c.bold}Import commands:${c.reset}
  import run <file>        Run an import from a YAML definition

${c.bold}Query commands:${c.reset}
  query "<query>"          Execute a query (Quote the query string)

${c.bold}Entity commands:${c.reset}
  entity get <id>          Get an entity by ID
  entity list <schema>     List entities for a schema

${c.bold}Server:${c.reset}
  serve [--port <n>]       Start the HTTP API server (default: 3000)

${c.bold}Examples:${c.reset}
  bun run cli schema apply examples/schemas/article.yaml
  bun run cli import run examples/imports/articles.yaml
  bun run cli query "from article where published == true limit 10"
  bun run cli query "from article select title, author order by publishedAt desc"
  bun run cli serve --port 4000
`);
}

// ── Router ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

async function main() {
  const [cmd, sub, ...rest] = args;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "schema") {
    if (sub === "apply" && rest[0]) return cmdSchemaApply(rest[0]);
    if (sub === "list")            return cmdSchemaList();
    if (sub === "get" && rest[0])  return cmdSchemaGet(rest[0]);
    err(`Unknown schema command. Use: schema apply|list|get`);
    process.exit(1);
  }

  if (cmd === "import") {
    if (sub === "run" && rest[0]) return cmdImportRun(rest[0]);
    err(`Unknown import command. Use: import run <file>`);
    process.exit(1);
  }

  if (cmd === "query") {
    const queryStr = sub ?? rest.join(" ");
    if (!queryStr) { err("Provide a query string"); process.exit(1); }
    return cmdQuery(queryStr);
  }

  if (cmd === "entity") {
    if (sub === "get" && rest[0]) return cmdEntityGet(rest[0]);
    if (sub === "list" && rest[0]) {
      const limitFlag = rest.indexOf("--limit");
      const limit = limitFlag >= 0 ? parseInt(rest[limitFlag + 1] ?? "20", 10) : undefined;
      return cmdEntityList(rest[0], limit);
    }
    err(`Unknown entity command. Use: entity get|list`);
    process.exit(1);
  }

  if (cmd === "serve") {
    const portFlag = args.indexOf("--port");
    const port = portFlag >= 0 ? parseInt(args[portFlag + 1] ?? "3000", 10) : 3000;
    return cmdServe(port);
  }

  err(`Unknown command: "${cmd}". Run with --help for usage.`);
  process.exit(1);
}

main().catch((e) => {
  err(String(e));
  process.exit(1);
});
