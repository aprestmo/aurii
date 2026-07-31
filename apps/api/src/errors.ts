/**
 * Map Core project/dataset domain errors to the public API error envelope.
 */

import {
	isDatasetError,
	isProjectError,
	type DatasetError,
	type ProjectError,
	DatasetValidationError,
	ProjectValidationError,
} from "@aurii/core";

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		issues?: { path: string; message: string }[];
	};
}

export function projectErrorToResponse(error: ProjectError): {
	status: number;
	body: ApiErrorBody;
} {
	const body: ApiErrorBody = {
		error: {
			code: error.code,
			message: error.message,
		},
	};
	if (error instanceof ProjectValidationError) {
		body.error.issues = error.issues;
	}
	return { status: error.httpStatus, body };
}

export function datasetErrorToResponse(error: DatasetError): {
	status: number;
	body: ApiErrorBody;
} {
	const body: ApiErrorBody = {
		error: {
			code: error.code,
			message: error.message,
		},
	};
	if (error instanceof DatasetValidationError) {
		// Keep shape consistent with project validation errors
		body.error.issues = [{ path: "input", message: error.message }];
	}
	return { status: error.httpStatus, body };
}

export function toApiError(error: unknown): {
	status: number;
	body: ApiErrorBody;
} {
	if (isProjectError(error)) {
		return projectErrorToResponse(error);
	}
	if (isDatasetError(error)) {
		return datasetErrorToResponse(error);
	}
	return {
		status: 500,
		body: {
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred.",
			},
		},
	};
}
