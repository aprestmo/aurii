/**
 * Domain errors for project administration.
 *
 * API adapters map these to HTTP status codes — Core stays transport-agnostic.
 */

import type { ValidationIssue } from "@aurii/validation";

export type ProjectErrorCode =
	| "PROJECT_NOT_FOUND"
	| "PROJECT_SLUG_CONFLICT"
	| "INVALID_PROJECT_STATUS_TRANSITION"
	| "PROJECT_VALIDATION_ERROR"
	| "PROJECT_NOT_WRITABLE";

export abstract class ProjectError extends Error {
	abstract readonly code: ProjectErrorCode;
	abstract readonly httpStatus: number;

	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class ProjectNotFoundError extends ProjectError {
	readonly code = "PROJECT_NOT_FOUND" as const;
	readonly httpStatus = 404;

	constructor(identifier: string) {
		super(`Project "${identifier}" was not found.`);
	}
}

export class ProjectSlugConflictError extends ProjectError {
	readonly code = "PROJECT_SLUG_CONFLICT" as const;
	readonly httpStatus = 409;

	constructor(slug: string) {
		super(`A project with slug "${slug}" already exists.`);
	}
}

export class InvalidProjectStatusTransitionError extends ProjectError {
	readonly code = "INVALID_PROJECT_STATUS_TRANSITION" as const;
	readonly httpStatus = 409;

	constructor(from: string, to: string) {
		super(`Cannot transition project status from "${from}" to "${to}".`);
	}
}

export class ProjectValidationError extends ProjectError {
	readonly code = "PROJECT_VALIDATION_ERROR" as const;
	readonly httpStatus = 400;
	readonly issues: ValidationIssue[];

	constructor(issues: ValidationIssue[]) {
		const summary = issues.map((i) => `${i.path || "input"}: ${i.message}`).join("; ");
		super(summary || "Project validation failed.");
		this.issues = issues;
	}
}

export class ProjectNotWritableError extends ProjectError {
	readonly code = "PROJECT_NOT_WRITABLE" as const;
	readonly httpStatus = 409;
	readonly projectId: string;
	readonly projectStatus: string;
	readonly operation: string | undefined;

	constructor(projectId: string, status: string, operation?: string) {
		const op = operation ? ` (${operation})` : "";
		super(
			`Project "${projectId}" has status "${status}" and does not allow write operations${op}.`,
		);
		this.projectId = projectId;
		this.projectStatus = status;
		this.operation = operation;
	}
}

export function isProjectError(error: unknown): error is ProjectError {
	return error instanceof ProjectError;
}
