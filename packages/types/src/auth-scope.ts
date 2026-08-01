/**
 * Minimal project-bound token scopes for beta.
 *
 * Not full RBAC. Foundation for finer-grained authorization later.
 * See docs and ADR notes in Phase 4 security polish.
 */

export type AuthScope =
	| "project:read"
	| "dataset:read"
	| "entity:write"
	| "import:run"
	| "source:manage"
	| "route:manage"
	| "project:admin";

export const AUTH_SCOPES: readonly AuthScope[] = [
	"project:read",
	"dataset:read",
	"entity:write",
	"import:run",
	"source:manage",
	"route:manage",
	"project:admin",
] as const;

/** Convenience bundles. */
export const READ_SCOPES: readonly AuthScope[] = [
	"project:read",
	"dataset:read",
] as const;

export const ADMIN_SCOPES: readonly AuthScope[] = [...AUTH_SCOPES] as const;

export interface ProjectToken {
	id: string;
	projectId: string;
	name: string;
	/** SHA-256 hex of the raw token. Never store or return the raw value. */
	tokenHash: string;
	scopes: AuthScope[];
	/** Prefix of the raw token for identification in Studio (e.g. "aur_ab12…"). */
	tokenPrefix: string;
	createdAt: string;
	revokedAt: string | null;
}

export interface CreateProjectTokenInput {
	name: string;
	scopes: AuthScope[];
}

export interface CreateProjectTokenResult {
	token: ProjectToken;
	/** Raw bearer token — returned once at creation only. */
	rawToken: string;
}

export interface AuditEvent {
	id: string;
	projectId: string;
	action: string;
	actor: string;
	resourceType: string;
	resourceId: string;
	detail: Record<string, unknown> | null;
	createdAt: string;
}

export function isAuthScope(value: unknown): value is AuthScope {
	return (
		typeof value === "string" &&
		(AUTH_SCOPES as readonly string[]).includes(value)
	);
}

/** project:admin implies all scopes. */
export function scopeAllows(
	granted: readonly AuthScope[],
	required: AuthScope,
): boolean {
	if (granted.includes("project:admin")) return true;
	return granted.includes(required);
}
