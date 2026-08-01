/**
 * Saved import / sync definitions — operable product surfaces for data intake.
 *
 * Extends the file-based ImportDefinition concept with Project/Dataset/DataSource
 * linkage, activation, trigger mode, and optional schedule.
 */

import type { ScheduleState } from "./schedule";

export type ImportTriggerMode =
	| "manual"
	| "once"
	| "scheduled"
	| "webhook"
	| "api";

export const IMPORT_TRIGGER_MODES: readonly ImportTriggerMode[] = [
	"manual",
	"once",
	"scheduled",
	"webhook",
	"api",
] as const;

export type SavedImportStatus = "active" | "disabled";

/**
 * Declarative mapping/pipeline payload stored with a saved definition.
 * Aligns with Core ImportDefinition fields without requiring a file path.
 */
export interface SavedImportPipeline {
	/** Keys are schema field names, values are source column names. */
	mapping?: Record<string, string>;
	transforms?: Array<{ field: string; fn: string }>;
	deduplicateBy?: string;
	referenceValidation?: "strict" | "warning" | "skip";
}

export interface SavedImportDefinition {
	id: string;
	projectId: string;
	datasetId: string;
	/** Optional linked DataSource. */
	sourceId: string | null;
	name: string;
	/** Target schema id. */
	schemaId: string;
	status: SavedImportStatus;
	triggerMode: ImportTriggerMode;
	/**
	 * Relative path to a YAML import definition in the project package,
	 * or an absolute path for local runs. Optional when inline pipeline is set.
	 */
	definitionPath: string | null;
	/** Inline pipeline override / definition. */
	pipeline: SavedImportPipeline | null;
	/** File source path relative to project or absolute (non-secret). */
	filePath: string | null;
	fileFormat: "csv" | "json" | null;
	schedule: ScheduleState | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateSavedImportInput {
	id?: string;
	datasetId: string;
	sourceId?: string | null;
	name: string;
	schemaId: string;
	status?: SavedImportStatus;
	triggerMode?: ImportTriggerMode;
	definitionPath?: string | null;
	pipeline?: SavedImportPipeline | null;
	filePath?: string | null;
	fileFormat?: "csv" | "json" | null;
	schedule?: ScheduleState | null;
}

export interface UpdateSavedImportInput {
	name?: string;
	sourceId?: string | null;
	schemaId?: string;
	status?: SavedImportStatus;
	triggerMode?: ImportTriggerMode;
	definitionPath?: string | null;
	pipeline?: SavedImportPipeline | null;
	filePath?: string | null;
	fileFormat?: "csv" | "json" | null;
	schedule?: ScheduleState | null;
}

/** How a run was initiated. */
export type ImportRunTrigger = "user" | "schedule" | "system" | "webhook";

export function isImportTriggerMode(
	value: unknown,
): value is ImportTriggerMode {
	return (
		typeof value === "string" &&
		(IMPORT_TRIGGER_MODES as readonly string[]).includes(value)
	);
}
