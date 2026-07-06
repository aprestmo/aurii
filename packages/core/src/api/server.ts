/**
 * Aurii HTTP API — Phase 2
 *
 * Routes:
 *   GET  /health
 *   GET  /datasets
 *   POST /datasets
 *   GET  /schemas?dataset=
 *   POST /schemas?dataset=
 *   GET  /schemas/:id?dataset=
 *   GET  /entities?schema=&dataset=&limit=&offset=
 *   GET  /entities/:id
 *   GET  /query?q=&dataset=
 *   POST /import/analyze          (multipart file upload)
 *   POST /import/run              { uploadId, schemaId, datasetId, mapping, transforms, dryRun }
 *   POST /import                  { path } — Phase 1 compatibility
 *   GET  /imports?dataset=
 *   GET  /stats?dataset=
 *
 * Auth: if AURII_API_TOKEN is set, all routes except /health require
 * `Authorization: Bearer <token>`.
 */

import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { mkdir } from "fs/promises";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import { countEntities, getEntity, listEntities } from "../entity/store";
import { analyzeContent } from "../import/analyze";
import { loadImportDefinition, runImport } from "../import/engine";
import type {
	FieldTransform,
	ImportDefinition,
	PipelineStep,
} from "../import/types";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { getSchema, listSchemas, registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { DEFAULT_DATASET, getStorage } from "../storage";

export interface AppOptions {
	/** Bearer token required on protected routes. Unset = open (no auth). */
	apiToken?: string;
	/** Directory where `/import/analyze` writes uploaded files. */
	uploadDir?: string;
}

interface ImportRunRequest {
	uploadId: string;
	filename?: string;
	schemaId: string;
	datasetId?: string;
	mapping: Record<string, string>;
	transforms?: FieldTransform[];
	dryRun?: boolean;
	delimiter?: string;
}

// ── Plugins ──────────────────────────────────────────────────────────────────

/**
 * Adds YAML body parsing alongside the default JSON parser.
 */
const yamlBodyParser = new Elysia({ name: "yaml-body-parser" }).onParse(
	async ({ request, contentType }) => {
		if (contentType?.includes("yaml")) {
			return parseYaml(await request.text());
		}
	},
);

// ── App ───────────────────────────────────────────────────────────────────────

/**
 * Builds the Aurii Elysia app without binding it to a port.
 *
 * Kept separate from `.listen()` so tests can exercise every route with
 * `app.handle(request)` — no real network socket required — and so a
 * single process can host multiple independently-configured instances.
 */
export function buildApp(options: AppOptions = {}) {
	const API_TOKEN = options.apiToken ?? process.env["AURII_API_TOKEN"];
	const UPLOAD_DIR =
		options.uploadDir ??
		process.env["AURII_UPLOAD_DIR"] ??
		join(process.cwd(), ".aurii-uploads");

	return (
		new Elysia()
			.use(
				cors({
					origin: "*",
					methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
					allowedHeaders: ["Content-Type", "Authorization"],
				}),
			)
			.use(yamlBodyParser)
			.onError(({ error, set }) => {
				set.status = 500;
				return { error: String(error) };
			})

			// ── Public ──────────────────────────────────────────────────────────────────
			.get("/health", async () => {
				const storage = await getStorage();
				return {
					status: "ok",
					phase: "2",
					version: "0.2.0",
					storage: storage.kind,
				};
			})

			// ── Protected ─────────────────────────────────────────────────────────────
			// derive and onBeforeHandle are inlined here so TypeScript resolves `dataset`
			// correctly in all handler signatures below.
			.use(
				new Elysia()
					.derive(({ query }) => ({
						dataset:
							(query as Record<string, string | undefined>)["dataset"] ??
							DEFAULT_DATASET,
					}))
					.onBeforeHandle(({ headers, set }) => {
						if (!API_TOKEN) return;
						const auth =
							(headers as Record<string, string | undefined>)[
								"authorization"
							] ?? "";
						if (auth !== `Bearer ${API_TOKEN}`) {
							set.status = 401;
							return { error: "Unauthorized" };
						}
					})

					// Datasets
					.get("/datasets", async () => {
						const storage = await getStorage();
						return storage.listDatasets();
					})
					.post("/datasets", async ({ body, set }) => {
						const b = body as {
							id?: string;
							name?: string;
							description?: string;
						} | null;
						if (!b?.id || !b?.name) {
							set.status = 400;
							return { error: "Dataset requires `id` and `name`" };
						}
						if (!/^[a-z0-9][a-z0-9-]*$/.test(b.id)) {
							set.status = 400;
							return {
								error: "Dataset id must be lowercase alphanumeric with dashes",
							};
						}
						const storage = await getStorage();
						set.status = 201;
						return storage.createDataset(
							b as { id: string; name: string; description?: string },
						);
					})

					// Schemas
					.get("/schemas", async ({ query, dataset }) => {
						const scoped =
							(query as Record<string, string | undefined>)["dataset"] !==
							undefined;
						return listSchemas(scoped ? dataset : undefined);
					})
					.post("/schemas", async ({ body, dataset, set }) => {
						set.status = 201;
						return registerSchema(body as SchemaDefinition, dataset);
					})
					.get("/schemas/:id", async ({ params, dataset, set }) => {
						const schema = await getSchema(params.id, dataset);
						if (!schema) {
							set.status = 404;
							return { error: `Schema "${params.id}" not found` };
						}
						return schema;
					})

					// Entities
					.get("/entities", async ({ query, dataset, set }) => {
						const q = query as Record<string, string | undefined>;
						const schemaId = q["schema"];
						if (!schemaId) {
							set.status = 400;
							return { error: 'Missing "schema" parameter' };
						}
						const limit = parseInt(q["limit"] ?? "50", 10);
						const offset = parseInt(q["offset"] ?? "0", 10);
						const [entities, total] = await Promise.all([
							listEntities(schemaId, dataset, limit, offset),
							countEntities(schemaId, dataset),
						]);
						return { entities, total, limit, offset };
					})
					.get("/entities/:id", async ({ params, set }) => {
						const entity = await getEntity(params.id);
						if (!entity) {
							set.status = 404;
							return { error: `Entity "${params.id}" not found` };
						}
						return entity;
					})

					// Query
					.get("/query", async ({ query, dataset, set }) => {
						const q = (query as Record<string, string | undefined>)["q"];
						if (!q) {
							set.status = 400;
							return { error: 'Missing query parameter "q"' };
						}
						const parsed = parseQuery(q);
						return executeQuery(parsed, dataset);
					})

					// Import: analyze (multipart file upload)
					.post("/import/analyze", async ({ request, set }) => {
						let rawForm: Awaited<ReturnType<Request["formData"]>>;
						try {
							rawForm = await request.formData();
						} catch {
							set.status = 400;
							return { error: "Expected multipart/form-data" };
						}
						const fileEntry = rawForm.get("file");
						if (!(fileEntry instanceof File)) {
							set.status = 400;
							return { error: 'Multipart field "file" is required' };
						}

						const content = await fileEntry.text();
						const analysis = analyzeContent(fileEntry.name, content);

						await mkdir(UPLOAD_DIR, { recursive: true });
						const uploadId = crypto.randomUUID();
						const ext = analysis.format === "json" ? "json" : "csv";
						await Bun.write(join(UPLOAD_DIR, `${uploadId}.${ext}`), content);

						return { uploadId, filename: fileEntry.name, ...analysis };
					})

					// Import: run (wizard)
					.post("/import/run", async ({ body, dataset, set }) => {
						const b = body as ImportRunRequest | null;
						if (!b?.uploadId || !b?.schemaId || !b?.mapping) {
							set.status = 400;
							return { error: "Required: uploadId, schemaId, mapping" };
						}

						const csvPath = join(UPLOAD_DIR, `${b.uploadId}.csv`);
						const jsonPath = join(UPLOAD_DIR, `${b.uploadId}.json`);
						const isCsv = await Bun.file(csvPath).exists();
						const isJson = !isCsv && (await Bun.file(jsonPath).exists());
						if (!isCsv && !isJson) {
							set.status = 404;
							return { error: `Upload "${b.uploadId}" not found` };
						}

						const steps: PipelineStep[] = [{ type: "map", mapping: b.mapping }];
						if (b.transforms && b.transforms.length > 0) {
							steps.push({ type: "transform", transforms: b.transforms });
						}
						steps.push({ type: "validate" }, { type: "persist" });

						const sourceOptions = b.delimiter
							? { delimiter: b.delimiter }
							: undefined;
						const def: ImportDefinition = {
							id: `wizard-${b.uploadId}`,
							name: b.filename ?? `Wizard import ${b.uploadId}`,
							schema: b.schemaId,
							source: {
								type: isCsv ? "csv" : "json",
								path: isCsv ? csvPath : jsonPath,
								...(sourceOptions ? { options: sourceOptions } : {}),
							},
							pipeline: { steps },
						};

						return runImport(def, "/", {
							datasetId: b.datasetId ?? dataset,
							dryRun: b.dryRun ?? false,
						});
					})

					// Import: Phase 1 compatibility
					.post("/import", async ({ body, dataset, set }) => {
						const b = body as { path?: string } | null;
						if (!b?.path) {
							set.status = 400;
							return { error: 'Provide "path" to an import YAML file' };
						}
						const def = await loadImportDefinition(
							resolve(process.cwd(), b.path),
						);
						return runImport(def, process.cwd(), { datasetId: dataset });
					})

					// Import history
					.get("/imports", async ({ query, dataset }) => {
						const storage = await getStorage();
						const limit = parseInt(
							(query as Record<string, string | undefined>)["limit"] ?? "20",
							10,
						);
						return storage.listImportRuns(dataset, limit);
					})

					// Stats
					.get("/stats", async ({ dataset }) => {
						const storage = await getStorage();
						return storage.getStats(dataset);
					}),
			)
	);
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
// Only bind a real port when this file is executed directly (`bun run serve`),
// never on import — this is what lets tests call `buildApp().handle(request)`
// in-process without a network socket.

if (import.meta.main) {
	const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
	const API_TOKEN = process.env["AURII_API_TOKEN"];

	const app = buildApp().listen({
		port: PORT,
		maxRequestBodySize: 100 * 1024 * 1024, // 100 MB uploads
	});

	console.log(`Aurii API running on http://localhost:${app.server?.port}`);
	console.log(`Storage: ${process.env["AURII_STORAGE"] ?? "sqlite"}`);
	console.log(
		`Auth: ${API_TOKEN ? "token required" : "open (set AURII_API_TOKEN to protect)"}`,
	);
}
