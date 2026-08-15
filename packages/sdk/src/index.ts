/**
 * @aurii/sdk — Aurii SDK public API
 *
 * The SDK is the preferred interface for:
 * - Studio (admin client)
 * - CLI tools
 * - External applications
 * - AI agents
 *
 * @example
 * ```ts
 * import { createClient } from "@aurii/sdk";
 *
 * const client = createClient({
 *   baseUrl: "http://localhost:3000",
 *   token: process.env.AURII_API_TOKEN,
 *   defaultDataset: "my-dataset",
 * });
 *
 * // List datasets in a project
 * const datasets = await client.projects.byId(projectId).datasets.list();
 *
 * // Query entities
 * const result = await client.query.run("FROM article LIMIT 10");
 *
 * // Import data
 * const analysis = await client.import.analyze(file);
 * const importResult = await client.import.run({ uploadId: analysis.uploadId, ... });
 * ```
 */

export { AuriiClient, createClient } from "./client";
export type {
	AnalyzeResponse,
	ApiEnvelope,
	AuriiClientConfig,
	Dataset,
	DatasetInput,
	Entity,
	EntityPage,
	EntityState,
	FieldDefinition,
	FieldTransform,
	FieldType,
	HealthResponse,
	ImportResult,
	ImportRunRecord,
	ImportRunRequest,
	Project,
	PublishedRoutePage,
	QueryResult,
	SchemaDefinition,
	SchemaStats,
	StorageStats,
	StoredSchema,
	UpdateDatasetInput,
} from "./types";
export { AuriiError } from "./types";
