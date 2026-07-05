/**
 * Aurii HTTP API — Phase 1
 *
 * Routes:
 *   GET  /health
 *   GET  /schemas
 *   POST /schemas
 *   GET  /schemas/:id
 *   GET  /entities/:id
 *   GET  /query?q=<query language string>
 *   POST /import
 */

import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { listSchemas, getSchema, registerSchema } from "../schema/registry";
import { getEntity } from "../entity/store";
import { parseQuery } from "../query/parser";
import { executeQuery } from "../query/executor";
import { runImport, loadImportDefinition } from "../import/engine";
import type { SchemaDefinition } from "../schema/types";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function parseBody<T>(req: Request): Promise<T> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return req.json() as Promise<T>;
  }
  if (ct.includes("application/yaml") || ct.includes("text/yaml")) {
    const text = await req.text();
    return parseYaml(text) as T;
  }
  return req.json() as Promise<T>;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const method = req.method.toUpperCase();

    // ── GET /health ──────────────────────────────────────────────────────────
    if (method === "GET" && path === "/health") {
      return json({ status: "ok", phase: "1", version: "0.1.0" });
    }

    // ── GET /schemas ─────────────────────────────────────────────────────────
    if (method === "GET" && path === "/schemas") {
      return json(listSchemas());
    }

    // ── POST /schemas ─────────────────────────────────────────────────────────
    if (method === "POST" && path === "/schemas") {
      try {
        const def = await parseBody<SchemaDefinition>(req);
        const schema = registerSchema(def);
        return json(schema, 201);
      } catch (e) {
        return error(String(e));
      }
    }

    // ── GET /schemas/:id ─────────────────────────────────────────────────────
    const schemaMatch = path.match(/^\/schemas\/([^/]+)$/);
    if (method === "GET" && schemaMatch) {
      const schema = getSchema(schemaMatch[1]!);
      if (!schema) return error(`Schema "${schemaMatch[1]}" not found`, 404);
      return json(schema);
    }

    // ── GET /entities/:id ────────────────────────────────────────────────────
    const entityMatch = path.match(/^\/entities\/([^/]+)$/);
    if (method === "GET" && entityMatch) {
      const entity = getEntity(entityMatch[1]!);
      if (!entity) return error(`Entity "${entityMatch[1]}" not found`, 404);
      return json(entity);
    }

    // ── GET /query?q=... ─────────────────────────────────────────────────────
    if (method === "GET" && path === "/query") {
      const q = url.searchParams.get("q");
      if (!q) return error('Missing query parameter "q"');
      try {
        const parsed = parseQuery(q);
        const result = executeQuery(parsed);
        return json(result);
      } catch (e) {
        return error(String(e));
      }
    }

    // ── POST /import ──────────────────────────────────────────────────────────
    if (method === "POST" && path === "/import") {
      try {
        const body = await parseBody<{ path?: string; definition?: unknown }>(req);

        let def;
        if (body.path) {
          def = await loadImportDefinition(resolve(process.cwd(), body.path));
        } else if (body.definition) {
          def = body.definition;
        } else {
          return error('Provide either "path" to an import YAML file or an inline "definition"');
        }

        const result = await runImport(def as Parameters<typeof runImport>[0], process.cwd());
        return json(result, result.failed === result.total && result.total > 0 ? 422 : 200);
      } catch (e) {
        return error(String(e));
      }
    }

    return error(`Not found: ${method} ${path}`, 404);
  },
});

console.log(`Aurii API running on http://localhost:${server.port}`);
