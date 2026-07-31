/**
 * Project-scoped import and schema routes.
 *
 * Prefixed under /api/projects/:id/datasets/:datasetId
 *
 * Wrong project → 404 (dataset not found in project).
 * Mutations enforce Core project write policy.
 * Reads remain available for inactive/archived projects.
 */

import {
	getSchema,
	listSchemas,
	loadImportDefinition,
	registerSchema,
	requireDatasetInProject,
	runImport,
	type ProjectService,
	type SchemaDefinition,
	type StorageAdapter,
} from "@aurii/core";
import { Elysia } from "elysia";
import { resolve } from "path";
import { toApiError } from "../errors";

export interface ProjectDatasetResourcesOptions {
	projectService: ProjectService;
	getStorage: () => Promise<StorageAdapter>;
	storage?: StorageAdapter;
}

export function createProjectDatasetResourcesPlugin(
	options: ProjectDatasetResourcesOptions,
) {
	const projects = options.projectService;

	async function storage(): Promise<StorageAdapter> {
		return options.storage ?? (await options.getStorage());
	}

	return new Elysia({
		name: "project-dataset-resources",
		prefix: "/api/projects",
	})
		.get("/:id/datasets/:datasetId/schemas", async ({ params, set }) => {
			try {
				await requireDatasetInProject(params.id, params.datasetId, {
					projects,
					storage: await storage(),
				});
				const data = await listSchemas(params.datasetId);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get(
			"/:id/datasets/:datasetId/schemas/:schemaId",
			async ({ params, set }) => {
				try {
					await requireDatasetInProject(params.id, params.datasetId, {
						projects,
						storage: await storage(),
					});
					const data = await getSchema(params.schemaId, params.datasetId);
					if (!data) {
						set.status = 404;
						return {
							error: {
								code: "SCHEMA_NOT_FOUND",
								message: `Schema "${params.schemaId}" was not found.`,
							},
						};
					}
					return { data };
				} catch (error) {
					const mapped = toApiError(error);
					set.status = mapped.status;
					return mapped.body;
				}
			},
		)
		.post("/:id/datasets/:datasetId/schemas", async ({ params, body, set }) => {
			try {
				await requireDatasetInProject(params.id, params.datasetId, {
					projects,
					storage: await storage(),
				});
				const data = await registerSchema(
					body as SchemaDefinition,
					params.datasetId,
				);
				set.status = 201;
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get("/:id/datasets/:datasetId/imports", async ({ params, query, set }) => {
			try {
				await requireDatasetInProject(params.id, params.datasetId, {
					projects,
					storage: await storage(),
				});
				const limit = parseInt(
					(query as Record<string, string | undefined>)["limit"] ?? "20",
					10,
				);
				const store = await storage();
				const data = await store.listImportRuns(params.datasetId, limit);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.post(
			"/:id/datasets/:datasetId/imports/run",
			async ({ params, body, set }) => {
				try {
					await requireDatasetInProject(params.id, params.datasetId, {
						projects,
						storage: await storage(),
					});
					const b = body as {
						path?: string;
						dryRun?: boolean;
						projectId?: string;
					} | null;
					if (!b?.path) {
						set.status = 400;
						return {
							error: {
								code: "VALIDATION_ERROR",
								message: 'Provide "path" to an import YAML file',
							},
						};
					}
					// Body projectId cannot override URL/dataset ownership.
					const def = await loadImportDefinition(
						resolve(process.cwd(), b.path),
					);
					const data = await runImport(def, process.cwd(), {
						datasetId: params.datasetId,
						dryRun: b.dryRun ?? false,
					});
					return { data };
				} catch (error) {
					const mapped = toApiError(error);
					set.status = mapped.status;
					return mapped.body;
				}
			},
		);
}
