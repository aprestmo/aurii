import {
	PROJECT_CONFIG_VERSION,
	type AuriiProjectConfig,
	type AuriiProjectConfigInput,
} from "@aurii/types";
import { validateProjectConfigShape } from "@aurii/validation";

/**
 * Define a versioned Aurii project package configuration.
 * Pure data helper — no UI framework dependency.
 */
export function defineProject(
	config: AuriiProjectConfigInput,
): AuriiProjectConfig {
	const withVersion = {
		...config,
		version: config.version ?? PROJECT_CONFIG_VERSION,
	};
	const result = validateProjectConfigShape(withVersion);
	if (!result.success) {
		throw new ProjectConfigError(result.issues);
	}
	return result.data;
}

export class ProjectConfigError extends Error {
	readonly issues: Array<{ path: string; message: string }>;
	constructor(issues: Array<{ path: string; message: string }>) {
		super(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
		this.name = "ProjectConfigError";
		this.issues = issues;
	}
}
