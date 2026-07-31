/**
 * Project domain types.
 *
 * A Project is the administrative, security, and functional boundary for
 * datasets, imports, relations, and APIs. These types are shared across
 * Core, API, and clients — never expose Drizzle row types through the API.
 */

export type ProjectStatus = "active" | "inactive" | "archived";

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
	"active",
	"inactive",
	"archived",
] as const;

/**
 * Stable UUID for the migration fallback project ("Legacy").
 *
 * Existing `aurii_datasets` rows are backfilled to this project.
 * Do not hardcode this value elsewhere — import this constant.
 */
export const LEGACY_PROJECT_ID = "a0000000-0000-4000-8000-000000000001";

/** Slug of the migration fallback project. */
export const LEGACY_PROJECT_SLUG = "legacy";

export interface Project {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	status: ProjectStatus;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
}

export interface CreateProjectInput {
	name: string;
	/** When omitted, a slug is generated from `name`. */
	slug?: string;
	description?: string | null;
}

export interface UpdateProjectInput {
	name?: string;
	slug?: string;
	description?: string | null;
}

export interface ProjectListFilters {
	/** When set, only projects with this status are returned. */
	status?: ProjectStatus;
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
	return (
		typeof value === "string" &&
		(PROJECT_STATUSES as readonly string[]).includes(value)
	);
}
