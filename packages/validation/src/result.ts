/**
 * Minimal validation result types shared across Aurii packages.
 */

export interface ValidationIssue {
	path: string;
	message: string;
}

export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; issues: ValidationIssue[] };

export function ok<T>(data: T): ValidationResult<T> {
	return { success: true, data };
}

export function fail<T = never>(
	issues: ValidationIssue[],
): ValidationResult<T> {
	return { success: false, issues };
}
