/**
 * Declarative Studio configuration for a project package.
 *
 * Three layers:
 * 1. Generic Studio runtime (apps/studio)
 * 2. Declarative project config (this module)
 * 3. Optional custom views registered by the project
 *
 * See ADR-0017.
 */

export type StudioNavItemKind =
	| "collection"
	| "sources"
	| "imports"
	| "apiRoutes"
	| "query"
	| "schemas"
	| "dashboard"
	| "system"
	| "custom";

export interface StudioCollectionOptions {
	columns?: string[];
	filters?: Record<string, unknown>;
	orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
	hidden?: boolean;
	featured?: boolean;
}

export interface StudioNavItem {
	kind: StudioNavItemKind;
	/** Schema id for collection items. */
	schemaId?: string;
	title?: string;
	href?: string;
	options?: StudioCollectionOptions;
	/** Custom view id when kind === "custom". */
	viewId?: string;
}

export interface StudioNavGroup {
	title: string;
	items: StudioNavItem[];
}

export interface StudioCustomView {
	id: string;
	title: string;
	description?: string;
	/**
	 * Client module path relative to the project package (loaded by Studio
	 * extension point — no Core / database access).
	 */
	module: string;
}

export interface StudioDashboardWidget {
	id: string;
	title: string;
	kind: "stats" | "importHistory" | "custom";
	viewId?: string;
}

export interface AuriiStudioConfig {
	title: string;
	navigation?: StudioNavGroup[];
	/** Schemas to hide from default browser. */
	hiddenSchemas?: string[];
	/** Schemas to highlight. */
	featuredSchemas?: string[];
	dashboards?: StudioDashboardWidget[];
	views?: StudioCustomView[];
	/** Import groups for Studio sidebar organization. */
	importGroups?: Array<{ title: string; definitionIds: string[] }>;
	/** API route groups. */
	routeGroups?: Array<{ title: string; routeIds: string[] }>;
}
