import { getDb } from "../db/client";
import type { Entity } from "../entity/types";
import type { Condition, ParsedQuery } from "./parser";

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
    state: row.state as Entity["state"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function conditionToSql(condition: Condition, params: unknown[]): string {
  const path = `json_extract(data, '$.${condition.field}')`;

  if (condition.op === "contains") {
    params.push(`%${condition.value}%`);
    return `${path} LIKE ?`;
  }

  // SQLite stores JSON booleans as integers
  const value =
    typeof condition.value === "boolean"
      ? condition.value ? 1 : 0
      : condition.value;

  params.push(value);

  const ops: Record<string, string> = {
    "==": "=",
    "!=": "!=",
    ">":  ">",
    "<":  "<",
    ">=": ">=",
    "<=": "<=",
  };

  return `${path} ${ops[condition.op]} ?`;
}

export interface QueryResult {
  entities: Entity[];
  count: number;
  query: ParsedQuery;
}

export function executeQuery(query: ParsedQuery): QueryResult {
  const db = getDb();
  const params: unknown[] = [query.from];

  let sql =
    "SELECT id, schema_id, data, state, created_at, updated_at " +
    "FROM aurii_entities WHERE schema_id = ?";

  if (query.where && query.where.length > 0) {
    const clauses = query.where.map((c) => conditionToSql(c, params));
    sql += " AND " + clauses.join(" AND ");
  }

  if (query.orderBy) {
    const dir = query.orderBy.direction.toUpperCase();
    sql += ` ORDER BY json_extract(data, '$.${query.orderBy.field}') ${dir}`;
  }

  if (query.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(query.limit);
  }

  if (query.offset !== undefined) {
    sql += " OFFSET ?";
    params.push(query.offset);
  }

  const rows = db.prepare(sql).all(...params) as RawEntityRow[];
  let entities = rows.map(rowToEntity);

  if (query.select && query.select.length > 0) {
    const fields = query.select;
    entities = entities.map((e) => ({
      ...e,
      data: Object.fromEntries(
        Object.entries(e.data).filter(([k]) => fields.includes(k))
      ),
    }));
  }

  return { entities, count: entities.length, query };
}
