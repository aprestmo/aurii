import { Database } from "bun:sqlite";
import { join } from "path";
import { runMigrations } from "./migrations";

const DB_PATH = process.env["AURII_DB_PATH"] ?? join(process.cwd(), "aurii.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.exec("PRAGMA journal_mode=WAL;");
    _db.exec("PRAGMA foreign_keys=ON;");
    runMigrations(_db);
  }
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
