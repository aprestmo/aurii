import {
	fail,
	ok,
	type ValidationIssue,
	type ValidationResult,
} from "./result";
import {
	isDataSourceKind,
	isDataSourceStatus,
	type CreateDataSourceInput,
	type DataSourceConfig,
} from "@aurii/types";

export interface NormalizedCreateDataSource {
	id?: string;
	datasetId: string;
	name: string;
	kind: CreateDataSourceInput["kind"];
	status: NonNullable<CreateDataSourceInput["status"]>;
	config: DataSourceConfig;
}

function issue(path: string, message: string): ValidationIssue {
	return { path, message };
}

export function validateCreateDataSource(
	input: unknown,
): ValidationResult<NormalizedCreateDataSource> {
	const issues: ValidationIssue[] = [];
	if (!input || typeof input !== "object") {
		return fail([{ path: "", message: "Expected an object" }]);
	}
	const raw = input as Record<string, unknown>;

	const datasetId =
		typeof raw["datasetId"] === "string" ? raw["datasetId"].trim() : "";
	if (!datasetId) {
		issues.push(issue("datasetId", "datasetId is required"));
	}

	const name = typeof raw["name"] === "string" ? raw["name"].trim() : "";
	if (!name) {
		issues.push(issue("name", "name is required"));
	}

	if (!isDataSourceKind(raw["kind"])) {
		issues.push(issue("kind", "Invalid data source kind"));
	}

	const status = raw["status"] ?? "active";
	if (!isDataSourceStatus(status)) {
		issues.push(issue("status", "Invalid data source status"));
	}

	const config =
		raw["config"] && typeof raw["config"] === "object"
			? (raw["config"] as DataSourceConfig)
			: {};

	if (issues.length) return fail(issues);

	return ok({
		id: typeof raw["id"] === "string" ? raw["id"] : undefined,
		datasetId,
		name,
		kind: raw["kind"] as NormalizedCreateDataSource["kind"],
		status: status as NormalizedCreateDataSource["status"],
		config,
	});
}

/** Strip secret values from config for API responses (keep SecretRef ids only). */
export function redactDataSourceConfig(config: DataSourceConfig): DataSourceConfig {
	const secrets = config.secrets?.map((s) => ({
		secretId: s.secretId,
		label: s.label,
	}));
	return {
		...config,
		secrets,
		options: config.options ? { ...config.options } : undefined,
	};
}
