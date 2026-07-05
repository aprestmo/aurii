import { getDb } from "../db/client";
import type { SchemaDefinition, StoredSchema } from "./types";
import { validateSchemaDefinition } from "./validator";

interface RawSchemaRow {
  id: string;
  name: string;
  description: string | null;
  version: number;
  definition: string;
  created_at: string;
  updated_at: string;
}

function rowToSchema(row: RawSchemaRow): StoredSchema {
  const def = JSON.parse(row.definition) as SchemaDefinition;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    version: row.version,
    fields: def.fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerSchema(def: SchemaDefinition): StoredSchema {
  const validation = validateSchemaDefinition(def);
  if (!validation.valid) {
    throw new Error(`Invalid schema: ${validation.errors.join("; ")}`);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const version = def.version ?? 1;

  db.prepare(`
    INSERT INTO aurii_schemas (id, name, description, version, definition, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      version = excluded.version,
      definition = excluded.definition,
      updated_at = excluded.updated_at
  `).run(def.id, def.name, def.description ?? null, version, JSON.stringify(def), now, now);

  return getSchema(def.id)!;
}

export function getSchema(id: string): StoredSchema | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM aurii_schemas WHERE id = ?").get(id) as RawSchemaRow | null;
  return row ? rowToSchema(row) : null;
}

export function listSchemas(): StoredSchema[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM aurii_schemas ORDER BY created_at DESC").all() as RawSchemaRow[];
  return rows.map(rowToSchema);
}

export function deleteSchema(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM aurii_schemas WHERE id = ?").run(id);
  return result.changes > 0;
}
