import { resolve, dirname } from "path";
import { parse as parseYaml } from "yaml";
import { getSchema } from "../schema/registry";
import { createEntities } from "../entity/store";
import { runPipeline } from "../pipeline/runner";
import { readCsvFile } from "./sources/csv";
import { readJsonFile } from "./sources/json";
import { getDb } from "../db/client";
import type { ImportDefinition, ImportResult, RowError } from "./types";
import type { EntityInput } from "../entity/types";

export async function loadImportDefinition(filePath: string): Promise<ImportDefinition> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Import definition file not found: ${filePath}`);
  }
  const content = await file.text();
  return parseYaml(content) as ImportDefinition;
}

async function loadRows(
  def: ImportDefinition,
  basePath: string
): Promise<Record<string, unknown>[]> {
  const sourcePath = resolve(basePath, def.source.path);

  if (def.source.type === "csv") {
    const delimiter = def.source.options?.delimiter ?? ",";
    return await readCsvFile(sourcePath, delimiter);
  }

  if (def.source.type === "json") {
    return await readJsonFile(sourcePath);
  }

  throw new Error(`Unsupported source type: "${def.source.type}"`);
}

export async function runImport(
  def: ImportDefinition,
  basePath: string = process.cwd()
): Promise<ImportResult> {
  const startedAt = Date.now();
  const db = getDb();
  const runId = crypto.randomUUID();

  // Resolve schema
  const schema = getSchema(def.schema);
  if (!schema) {
    throw new Error(`Schema "${def.schema}" not found. Register it first with: aurii schema apply`);
  }

  // Record import run
  db.prepare(`
    INSERT INTO aurii_import_runs (id, definition_id, schema_id, status, started_at)
    VALUES (?, ?, ?, 'running', ?)
  `).run(runId, def.id, def.schema, new Date().toISOString());

  // Load source rows
  const rows = await loadRows(def, basePath);
  const total = rows.length;
  const errors: RowError[] = [];
  const toInsert: EntityInput[] = [];

  // Run pipeline over each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    const result = runPipeline(
      def.pipeline.steps,
      row as Record<string, unknown>,
      schema,
      i + 1
    );

    if (!result.ok) {
      errors.push({
        row: i + 1,
        message: result.errors.join("; "),
        data: row as Record<string, unknown>,
      });
    } else {
      // Only include fields defined in the schema
      const cleanData: Record<string, unknown> = {};
      for (const field of schema.fields) {
        if (field.name in result.row) {
          const v = result.row[field.name];
          if (v !== null && v !== undefined && v !== "") {
            cleanData[field.name] = v;
          } else if (field.default !== undefined) {
            cleanData[field.name] = field.default;
          }
        } else if (field.default !== undefined) {
          cleanData[field.name] = field.default;
        }
      }
      toInsert.push({ schemaId: def.schema, data: cleanData });
    }
  }

  // Batch persist
  if (toInsert.length > 0) {
    createEntities(toInsert);
  }

  const imported = toInsert.length;
  const failed = errors.length;
  const durationMs = Date.now() - startedAt;

  // Update import run record
  db.prepare(`
    UPDATE aurii_import_runs
    SET status = ?, total = ?, imported = ?, failed = ?, errors = ?, completed_at = ?
    WHERE id = ?
  `).run(
    failed > 0 && imported === 0 ? "failed" : failed > 0 ? "partial" : "completed",
    total,
    imported,
    failed,
    JSON.stringify(errors),
    new Date().toISOString(),
    runId
  );

  return {
    definitionId: def.id,
    schemaId: def.schema,
    total,
    imported,
    failed,
    errors,
    durationMs,
  };
}
