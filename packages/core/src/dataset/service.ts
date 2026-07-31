/**
 * Project-scoped dataset administration service.
 *
 * Owns project membership checks, write-rule enforcement, and dataset
 * identity validation. Storage adapters remain the persistence layer for
 * `aurii_datasets`; this service is the application boundary.
 */

import type { Project } from "@aurii/types";
import { ProjectNotWritableError } from "../project/errors";
import type { ProjectService } from "../project/service";
import type {
	Dataset,
	DatasetUpdateInput,
	StorageAdapter,
} from "../storage/types";
import {
	DatasetIdConflictError,
	DatasetNotFoundError,
	DatasetValidationError,
} from "./errors";

const DATASET_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface CreateDatasetInput {
	id: string;
	name: string;
	description?: string;
}

export interface UpdateDatasetInput {
	name?: string;
	description?: string | null;
}

export class DatasetService {
	constructor(
		private readonly storage: StorageAdapter,
		private readonly projects: ProjectService,
	) {}

	async createDataset(
		projectId: string,
		input: CreateDatasetInput,
	): Promise<Dataset> {
		await this.requireWritableProject(projectId);
		this.validateCreateInput(input);

		const existing = await this.storage.getDataset(input.id);
		if (existing) {
			throw new DatasetIdConflictError(input.id);
		}

		return this.storage.createDataset({
			id: input.id,
			name: input.name,
			description: input.description,
			projectId,
		});
	}

	async getDataset(projectId: string, datasetId: string): Promise<Dataset> {
		await this.requireReadableProject(projectId);
		const dataset = await this.storage.getDataset(datasetId);
		if (!dataset || dataset.projectId !== projectId) {
			throw new DatasetNotFoundError(datasetId, projectId);
		}
		return dataset;
	}

	async listDatasets(projectId: string): Promise<Dataset[]> {
		await this.requireReadableProject(projectId);
		return this.storage.listDatasets(projectId);
	}

	async updateDataset(
		projectId: string,
		datasetId: string,
		input: UpdateDatasetInput,
	): Promise<Dataset> {
		await this.requireWritableProject(projectId);

		if (
			input.name === undefined &&
			input.description === undefined
		) {
			throw new DatasetValidationError(
				"Update requires at least one of `name` or `description`.",
			);
		}
		if (input.name !== undefined && input.name.trim().length === 0) {
			throw new DatasetValidationError("Dataset name must not be empty.");
		}

		// Refuse project moves via ordinary update (ignore any sneaky fields).
		const scoped = input as UpdateDatasetInput & { projectId?: unknown };
		if (scoped.projectId !== undefined) {
			throw new DatasetValidationError(
				"Datasets cannot be moved between projects through update.",
			);
		}

		const existing = await this.storage.getDataset(datasetId);
		if (!existing || existing.projectId !== projectId) {
			throw new DatasetNotFoundError(datasetId, projectId);
		}

		const patch: DatasetUpdateInput = {};
		if (input.name !== undefined) patch.name = input.name.trim();
		if (input.description !== undefined) patch.description = input.description;

		const updated = await this.storage.updateDataset(datasetId, patch);
		if (!updated) {
			throw new DatasetNotFoundError(datasetId, projectId);
		}
		return updated;
	}

	/**
	 * Administrative reassignment — not for the public API.
	 * Target project must exist and be writable (active).
	 */
	async reassignDatasetProject(
		datasetId: string,
		toProjectId: string,
	): Promise<Dataset> {
		await this.requireWritableProject(toProjectId);
		const existing = await this.storage.getDataset(datasetId);
		if (!existing) {
			throw new DatasetNotFoundError(datasetId);
		}
		const updated = await this.storage.reassignDatasetProject(
			datasetId,
			toProjectId,
		);
		if (!updated) {
			throw new DatasetNotFoundError(datasetId);
		}
		return updated;
	}

	private validateCreateInput(input: CreateDatasetInput): void {
		if (!input.id || !input.name) {
			throw new DatasetValidationError("Dataset requires `id` and `name`.");
		}
		if (!DATASET_ID_RE.test(input.id)) {
			throw new DatasetValidationError(
				"Dataset id must be lowercase alphanumeric with dashes.",
			);
		}
		if (input.name.trim().length === 0) {
			throw new DatasetValidationError("Dataset name must not be empty.");
		}
	}

	private async requireReadableProject(projectId: string): Promise<Project> {
		return this.projects.getProjectById(projectId);
	}

	private async requireWritableProject(projectId: string): Promise<Project> {
		const project = await this.projects.getProjectById(projectId);
		if (project.status !== "active") {
			throw new ProjectNotWritableError(projectId, project.status);
		}
		return project;
	}
}

export function createDatasetService(
	storage: StorageAdapter,
	projects: ProjectService,
): DatasetService {
	return new DatasetService(storage, projects);
}
