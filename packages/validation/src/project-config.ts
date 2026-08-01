import {
	PROJECT_CONFIG_VERSION,
	type AuriiProjectConfig,
	type AuriiProjectConfigInput,
} from "@aurii/types";
import { fail, ok, type ValidationIssue, type ValidationResult } from "./result";

function issue(path: string, message: string): ValidationIssue {
	return { path, message };
}

export function validateProjectConfigShape(
	input: unknown,
): ValidationResult<AuriiProjectConfig> {
	const issues: ValidationIssue[] = [];
	if (!input || typeof input !== "object") {
		return fail([issue("", "Expected a project config object")]);
	}
	const raw = input as AuriiProjectConfigInput & Record<string, unknown>;

	const version = raw.version ?? PROJECT_CONFIG_VERSION;
	if (version !== PROJECT_CONFIG_VERSION) {
		issues.push(
			issue(
				"version",
				`Unsupported project config version ${String(version)}; expected ${PROJECT_CONFIG_VERSION}`,
			),
		);
	}

	if (typeof raw.id !== "string" || !raw.id.trim()) {
		issues.push(issue("id", "id is required"));
	}
	if (typeof raw.title !== "string" || !raw.title.trim()) {
		issues.push(issue("title", "title is required"));
	}
	if (!raw.core || typeof raw.core !== "object") {
		issues.push(issue("core", "core link is required"));
	} else {
		if (
			typeof raw.core.projectSlug !== "string" ||
			!raw.core.projectSlug.trim()
		) {
			issues.push(issue("core.projectSlug", "projectSlug is required"));
		}
		if (
			typeof raw.core.defaultDataset !== "string" ||
			!raw.core.defaultDataset.trim()
		) {
			issues.push(issue("core.defaultDataset", "defaultDataset is required"));
		}
	}

	for (const key of ["schemas", "sources", "imports", "sync", "routes"] as const) {
		const val = raw[key];
		if (val !== undefined) {
			if (!Array.isArray(val) || !val.every((p) => typeof p === "string")) {
				issues.push(issue(key, `${key} must be an array of path strings`));
			}
		}
	}

	if (raw.studio !== undefined && typeof raw.studio !== "string") {
		issues.push(issue("studio", "studio must be a path string"));
	}

	if (issues.length) return fail(issues);

	const normalized: AuriiProjectConfig = {
		version: PROJECT_CONFIG_VERSION,
		id: raw.id.trim(),
		title: raw.title.trim(),
		core: {
			projectSlug: raw.core!.projectSlug.trim(),
			defaultDataset: raw.core!.defaultDataset.trim(),
		},
	};
	if (raw.description !== undefined) normalized.description = raw.description;
	if (raw.schemas !== undefined) normalized.schemas = raw.schemas;
	if (raw.sources !== undefined) normalized.sources = raw.sources;
	if (raw.imports !== undefined) normalized.imports = raw.imports;
	if (raw.sync !== undefined) normalized.sync = raw.sync;
	if (raw.routes !== undefined) normalized.routes = raw.routes;
	if (raw.studio !== undefined) normalized.studio = raw.studio;
	return ok(normalized);
}
