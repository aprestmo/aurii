import {
	isRouteAccess,
	type DeclarativeRouteQuery,
	type PublishedRouteDefaults,
	type PublishedRouteDefinition,
} from "@aurii/types";
import { fail, ok, type ValidationIssue, type ValidationResult } from "./result";

function issue(path: string, message: string): ValidationIssue {
	return { path, message };
}

export function validateDeclarativeQuery(
	query: unknown,
): ValidationResult<DeclarativeRouteQuery> {
	const issues: ValidationIssue[] = [];
	if (!query || typeof query !== "object") {
		return fail([issue("query", "query is required")]);
	}
	const q = query as Record<string, unknown>;
	if (typeof q["schema"] !== "string" || !(q["schema"] as string).trim()) {
		issues.push(issue("query.schema", "schema is required"));
	}
	if (q["select"] !== undefined) {
		if (
			!Array.isArray(q["select"]) ||
			!q["select"].every((s) => typeof s === "string")
		) {
			issues.push(issue("query.select", "select must be a string array"));
		}
	}
	if (q["orderBy"] !== undefined) {
		if (!Array.isArray(q["orderBy"])) {
			issues.push(issue("query.orderBy", "orderBy must be an array"));
		}
	}
	if (q["limit"] !== undefined && typeof q["limit"] !== "number") {
		issues.push(issue("query.limit", "limit must be a number"));
	}
	if (issues.length) return fail(issues);

	const normalized: DeclarativeRouteQuery = {
		schema: (q["schema"] as string).trim(),
	};
	if (q["filter"] !== undefined && typeof q["filter"] === "object" && q["filter"]) {
		normalized.filter = q["filter"] as Record<string, unknown>;
	}
	if (Array.isArray(q["select"])) {
		normalized.select = q["select"] as string[];
	}
	if (Array.isArray(q["orderBy"])) {
		normalized.orderBy = q["orderBy"] as Array<{
			field: string;
			direction: "asc" | "desc";
		}>;
	}
	if (typeof q["limit"] === "number") {
		normalized.limit = q["limit"];
	}
	return ok(normalized);
}

export function validatePublishedRouteDefinition(
	input: unknown,
): ValidationResult<PublishedRouteDefinition> {
	const issues: ValidationIssue[] = [];
	if (!input || typeof input !== "object") {
		return fail([issue("", "Expected a route definition object")]);
	}
	const raw = input as Record<string, unknown>;
	if (typeof raw["id"] !== "string" || !raw["id"].trim()) {
		issues.push(issue("id", "id is required"));
	}
	if (typeof raw["path"] !== "string" || !raw["path"].trim()) {
		issues.push(issue("path", "path is required"));
	} else if (!(raw["path"] as string).startsWith("/")) {
		issues.push(issue("path", "path must start with /"));
	}
	if (raw["method"] !== undefined && raw["method"] !== "GET") {
		issues.push(issue("method", 'Only method "GET" is supported'));
	}
	const query = validateDeclarativeQuery(raw["query"]);
	if (!query.success) issues.push(...query.issues);

	if (raw["defaults"] && typeof raw["defaults"] === "object") {
		const d = raw["defaults"] as Record<string, unknown>;
		if (d["access"] !== undefined && !isRouteAccess(d["access"])) {
			issues.push(issue("defaults.access", "Invalid access value"));
		}
	}

	if (issues.length) return fail(issues);

	const normalized: PublishedRouteDefinition = {
		id: (raw["id"] as string).trim(),
		path: (raw["path"] as string).trim(),
		method: "GET",
		query: (query as { success: true; data: DeclarativeRouteQuery }).data,
	};
	if (raw["defaults"] && typeof raw["defaults"] === "object") {
		normalized.defaults = raw["defaults"] as PublishedRouteDefaults;
	}
	if (typeof raw["description"] === "string") {
		normalized.description = raw["description"];
	}
	if (typeof raw["version"] === "string") {
		normalized.version = raw["version"];
	}
	return ok(normalized);
}
