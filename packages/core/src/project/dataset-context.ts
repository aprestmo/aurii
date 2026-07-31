/**
 * Resolve project context for dataset-bound resources (imports, schemas).
 *
 * Ownership chain: Resource → Dataset → Project
 * Project id is not duplicated on import/schema tables.
 */

import { DatasetNotFoundError } from "../dataset/errors";
import { getStorage } from "../storage";
import type { Dataset, StorageAdapter } from "../storage/types";
import { ProjectNotFoundError } from "./errors";
import { assertProjectWritable } from "./policy";
import { getProjectService } from "./runtime";
import type { ProjectService } from "./service";
import type { Project } from "@aurii/types";

export interface DatasetProjectContext {
	dataset: Dataset;
	project: Project;
}

async function resolveServices(options?: {
	storage?: StorageAdapter;
	projects?: ProjectService;
}): Promise<{ storage: StorageAdapter; projects: ProjectService }> {
	const storage = options?.storage ?? (await getStorage());
	const projects = options?.projects ?? (await getProjectService());
	return { storage, projects };
}

/**
 * Load dataset and its owning project. Throws DatasetNotFoundError if missing.
 */
export async function resolveDatasetProject(
	datasetId: string,
	options?: { storage?: StorageAdapter; projects?: ProjectService },
): Promise<DatasetProjectContext> {
	const { storage, projects } = await resolveServices(options);
	const dataset = await storage.getDataset(datasetId);
	if (!dataset) {
		throw new DatasetNotFoundError(datasetId);
	}
	let project: Project;
	try {
		project = await projects.getProjectById(dataset.projectId);
	} catch (error) {
		if (error instanceof ProjectNotFoundError) {
			throw new ProjectNotFoundError(dataset.projectId);
		}
		throw error;
	}
	return { dataset, project };
}

/**
 * Ensure the dataset exists under the given project (wrong project → not found).
 */
export async function requireDatasetInProject(
	projectId: string,
	datasetId: string,
	options?: { storage?: StorageAdapter; projects?: ProjectService },
): Promise<DatasetProjectContext> {
	const { projects } = await resolveServices(options);
	// Project must exist (404 for unknown project)
	await projects.getProjectById(projectId);
	const ctx = await resolveDatasetProject(datasetId, options);
	if (ctx.dataset.projectId !== projectId) {
		throw new DatasetNotFoundError(datasetId, projectId);
	}
	return ctx;
}

/**
 * Resolve dataset → project and assert the project is writable.
 * Used by import and schema mutations in Core.
 */
export async function requireWritableDatasetProject(
	datasetId: string,
	operation: string,
	options?: { storage?: StorageAdapter; projects?: ProjectService },
): Promise<DatasetProjectContext> {
	const ctx = await resolveDatasetProject(datasetId, options);
	assertProjectWritable(ctx.project, operation);
	return ctx;
}
