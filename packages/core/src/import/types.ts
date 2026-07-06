export type SourceType = "csv" | "json";

export interface CsvSourceOptions {
	delimiter?: string;
	skipEmptyLines?: boolean;
}

export interface Source {
	type: SourceType;
	path: string;
	options?: CsvSourceOptions;
}

export type TransformFn =
	| "toBoolean"
	| "toNumber"
	| "toDate"
	| "toSlug"
	| "trim"
	| "toLowerCase"
	| "toUpperCase";

export interface FieldTransform {
	field: string;
	fn: TransformFn;
}

export interface MapStep {
	type: "map";
	/** Keys are schema field names, values are source column names */
	mapping: Record<string, string>;
}

export interface TransformStep {
	type: "transform";
	transforms: FieldTransform[];
}

export interface ValidateStep {
	type: "validate";
}

export interface PersistStep {
	type: "persist";
}

export type PipelineStep = MapStep | TransformStep | ValidateStep | PersistStep;

export interface ImportPipeline {
	steps: PipelineStep[];
}

export interface ImportDefinition {
	id: string;
	name: string;
	schema: string;
	/** Target dataset; defaults to "default" */
	dataset?: string;
	source: Source;
	pipeline: ImportPipeline;
}

export interface RowError {
	row: number;
	message: string;
	data?: Record<string, unknown>;
}

export interface ImportResult {
	definitionId: string;
	schemaId: string;
	datasetId: string;
	dryRun: boolean;
	total: number;
	imported: number;
	failed: number;
	errors: RowError[];
	durationMs: number;
	/** Present in dry-run mode: sample of the rows that would be written */
	sample?: Record<string, unknown>[];
}
