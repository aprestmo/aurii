import { getDb } from "../db/client";
import type { Entity, EntityInput, EntityState } from "./types";

interface RawEntityRow {
  id: string;
  schema_id: string;
  data: string;
  state: string;
  created_at: string;
  updated_at: string;
}

function rowToEntity(row: RawEntityRow): Entity {
  return {
    id: row.id,
    schemaId: row.schema_id,
    data: JSON.parse(row.data) as Record<string, unknown>,
    state: row.state as EntityState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createEntity(input: EntityInput): Entity {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const state = input.state ?? "active";

  db.prepare(`
    INSERT INTO aurii_entities (id, schema_id, data, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.schemaId, JSON.stringify(input.data), state, now, now);

  return getEntity(id)!;
}

export function createEntities(inputs: EntityInput[]): Entity[] {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO aurii_entities (id, schema_id, data, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows: EntityInput[]) => {
    const ids: string[] = [];
    for (const input of rows) {
      const id = crypto.randomUUID();
      insert.run(id, input.schemaId, JSON.stringify(input.data), input.state ?? "active", now, now);
      ids.push(id);
    }
    return ids;
  });

  const ids = insertMany(inputs);

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM aurii_entities WHERE id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...ids) as RawEntityRow[];

  return rows.map(rowToEntity);
}

export function getEntity(id: string): Entity | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM aurii_entities WHERE id = ?")
    .get(id) as RawEntityRow | null;
  return row ? rowToEntity(row) : null;
}

export function listEntities(schemaId: string, limit?: number, offset?: number): Entity[] {
  const db = getDb();
  const params: unknown[] = [schemaId];
  let sql = "SELECT * FROM aurii_entities WHERE schema_id = ? ORDER BY created_at DESC";

  if (limit !== undefined) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  if (offset !== undefined) {
    sql += " OFFSET ?";
    params.push(offset);
  }

  const rows = db.prepare(sql).all(...params) as RawEntityRow[];
  return rows.map(rowToEntity);
}

export function countEntities(schemaId: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM aurii_entities WHERE schema_id = ?")
    .get(schemaId) as { count: number };
  return row.count;
}
