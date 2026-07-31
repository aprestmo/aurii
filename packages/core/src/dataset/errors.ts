/**
 * Domain errors for project-scoped dataset operations.
 *
 * API adapters map these to HTTP status codes — Core stays transport-agnostic.
 */

export type DatasetErrorCode =
	| "DATASET_NOT_FOUND"
	| "DATASET_ID_CONFLICT"
	| "DATASET_VALIDATION_ERROR";

export abstract class DatasetError extends Error {
	abstract readonly code: DatasetErrorCode;
	abstract readonly httpStatus: number;

	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class DatasetNotFoundError extends DatasetError {
	readonly code = "DATASET_NOT_FOUND" as const;
	readonly httpStatus = 404;

	constructor(datasetId: string, projectId?: string) {
		super(
			projectId
				? `Dataset "${datasetId}" was not found in project "${projectId}".`
				: `Dataset "${datasetId}" was not found.`,
		);
	}
}

export class DatasetIdConflictError extends DatasetError {
	readonly code = "DATASET_ID_CONFLICT" as const;
	readonly httpStatus = 409;

	constructor(datasetId: string) {
		super(`A dataset with id "${datasetId}" already exists.`);
	}
}

export class DatasetValidationError extends DatasetError {
	readonly code = "DATASET_VALIDATION_ERROR" as const;
	readonly httpStatus = 400;

	constructor(message: string) {
		super(message);
	}
}

export function isDatasetError(error: unknown): error is DatasetError {
	return error instanceof DatasetError;
}
