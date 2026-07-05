import type { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aurii_schemas (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      version     INTEGER NOT NULL DEFAULT 1,
      definition  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS aurii_entities (
      id         TEXT PRIMARY KEY,
      schema_id  TEXT NOT NULL REFERENCES aurii_schemas(id),
      data       TEXT NOT NULL,
      state      TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entities_schema_id
      ON aurii_entities(schema_id);

    CREATE TABLE IF NOT EXISTS aurii_import_runs (
      id            TEXT PRIMARY KEY,
      definition_id TEXT,
      schema_id     TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      total         INTEGER NOT NULL DEFAULT 0,
      imported      INTEGER NOT NULL DEFAULT 0,
      failed        INTEGER NOT NULL DEFAULT 0,
      errors        TEXT NOT NULL DEFAULT '[]',
      started_at    TEXT,
      completed_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
