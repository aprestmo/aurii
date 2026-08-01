/**
 * Published API routes — stable, declarative delivery endpoints.
 *
 * Project code declares what *can* be published (PublishedRouteDefinition).
 * Core stores the active runtime state (PublishedRouteState).
 * See ADR-0016.
 */

export type RouteAccess = "public" | "authenticated" | "private";

export const ROUTE_ACCESS_VALUES: readonly RouteAccess[] = [
	"public",
	"authenticated",
	"private",
] as const;

export type RouteMethod = "GET";

/**
 * Safe declarative query model for published routes.
 * No arbitrary JavaScript — only schema, filter, select, orderBy, limit.
 */
export interface DeclarativeRouteQuery {
	schema: string;
	filter?: Record<string, unknown>;
	select?: string[];
	orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
	limit?: number;
}

export interface PublishedRouteDefaults {
	enabled?: boolean;
	access?: RouteAccess;
	cacheTtl?: number;
}

/**
 * Declarative definition from project code (`defineRoute`).
 * Not itself the runtime enablement state.
 */
export interface PublishedRouteDefinition {
	id: string;
	path: string;
	method: RouteMethod;
	query: DeclarativeRouteQuery;
	defaults?: PublishedRouteDefaults;
	description?: string;
	version?: string;
}

/**
 * Active configuration stored in Core for a declared route.
 */
export interface PublishedRouteState {
	routeId: string;
	projectId: string;
	datasetId: string;
	enabled: boolean;
	access: RouteAccess;
	cacheTtl: number;
	version: string;
	/** Snapshot of the definition used at last enable/update. */
	definition: PublishedRouteDefinition;
	lastError: string | null;
	/** Simple hit counter when instrumentation is available. */
	hitCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface UpsertPublishedRouteInput {
	routeId: string;
	datasetId: string;
	enabled?: boolean;
	access?: RouteAccess;
	cacheTtl?: number;
	version?: string;
	definition: PublishedRouteDefinition;
}

export interface UpdatePublishedRouteStateInput {
	enabled?: boolean;
	access?: RouteAccess;
	cacheTtl?: number;
	datasetId?: string;
	version?: string;
	definition?: PublishedRouteDefinition;
	lastError?: string | null;
}

export function isRouteAccess(value: unknown): value is RouteAccess {
	return (
		typeof value === "string" &&
		(ROUTE_ACCESS_VALUES as readonly string[]).includes(value)
	);
}
