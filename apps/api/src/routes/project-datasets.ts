/**
 * Project-scoped dataset HTTP routes.
 *
 * Base path: /api/projects/:projectId/datasets
 *
 * projectId always comes from the URL — never from the request body.
 */

import {
	createDatasetService,
	type CreateDatasetInput,
	type DatasetService,
	type ProjectService,
	type StorageAdapter,
	type UpdateDatasetInput,
} from "@aurii/core";
import { Elysia } from "elysia";
import { toApiError } from "../errors";

export interface ProjectDatasetsPluginOptions {
	projectService: ProjectService;
	/** Injected storage; resolved lazily when omitted (production). */
	storage?: StorageAdapter;
	/** Injected for tests. */
	datasetService?: DatasetService;
	getStorage?: () => Promise<StorageAdapter>;
}

export function createProjectDatasetsPlugin(
	options: ProjectDatasetsPluginOptions,
) {
	const resolveService = async (): Promise<DatasetService> => {
		if (options.datasetService) return options.datasetService;
		const storage =
			options.storage ??
			(options.getStorage ? await options.getStorage() : null);
		if (!storage) {
			throw new Error(
				"projectDatasetsPlugin requires datasetService, storage, or getStorage",
			);
		}
		return createDatasetService(storage, options.projectService);
	};

	return new Elysia({ name: "project-datasets" })
		.get("/api/projects/:projectId/datasets", async ({ params, set }) => {
			try {
				const service = await resolveService();
				const data = await service.listDatasets(params.projectId);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.post("/api/projects/:projectId/datasets", async ({ params, body, set }) => {
			try {
				const service = await resolveService();
				const raw = (body ?? {}) as CreateDatasetInput & {
					projectId?: string;
				};
				// URL is the source of truth — ignore body.projectId
				const { projectId: _ignored, ...input } = raw;
				const data = await service.createDataset(
					params.projectId,
					input as CreateDatasetInput,
				);
				set.status = 201;
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get(
			"/api/projects/:projectId/datasets/:datasetId",
			async ({ params, set }) => {
				try {
					const service = await resolveService();
					const data = await service.getDataset(
						params.projectId,
						params.datasetId,
					);
					return { data };
				} catch (error) {
					const mapped = toApiError(error);
					set.status = mapped.status;
					return mapped.body;
				}
			},
		)
		.patch(
			"/api/projects/:projectId/datasets/:datasetId",
			async ({ params, body, set }) => {
				try {
					const service = await resolveService();
					const raw = (body ?? {}) as UpdateDatasetInput & {
						projectId?: string;
					};
					const { projectId: _ignored, ...input } = raw;
					const data = await service.updateDataset(
						params.projectId,
						params.datasetId,
						input as UpdateDatasetInput,
					);
					return { data };
				} catch (error) {
					const mapped = toApiError(error);
					set.status = mapped.status;
					return mapped.body;
				}
			},
		);
}
