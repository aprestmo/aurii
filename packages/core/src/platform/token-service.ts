import { createHash, randomBytes } from "node:crypto";
import type {
	AuthScope,
	CreateProjectTokenInput,
	CreateProjectTokenResult,
	ProjectToken,
} from "@aurii/types";
import { isAuthScope, scopeAllows } from "@aurii/types";
import { getPlatformStore, type PlatformStore } from "./store";
import { appendAudit } from "./audit";

export class TokenError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "TokenError";
	}
}

export function hashToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export class ProjectTokenService {
	constructor(private readonly store: PlatformStore = getPlatformStore()) {}

	async create(
		projectId: string,
		input: CreateProjectTokenInput,
		actor = "system",
	): Promise<CreateProjectTokenResult> {
		if (!input.name?.trim()) {
			throw new TokenError("name is required", "validation_error");
		}
		if (!input.scopes?.length) {
			throw new TokenError("scopes are required", "validation_error");
		}
		for (const s of input.scopes) {
			if (!isAuthScope(s)) {
				throw new TokenError(`Invalid scope: ${s}`, "validation_error");
			}
		}

		const rawToken = `aur_${randomBytes(24).toString("hex")}`;
		const now = new Date().toISOString();
		const token: ProjectToken = {
			id: crypto.randomUUID(),
			projectId,
			name: input.name.trim(),
			tokenHash: hashToken(rawToken),
			scopes: input.scopes,
			tokenPrefix: rawToken.slice(0, 12),
			createdAt: now,
			revokedAt: null,
		};
		await this.store.insertToken(token);
		await appendAudit(this.store, {
			projectId,
			action: "token.created",
			actor,
			resourceType: "project_token",
			resourceId: token.id,
			detail: { name: token.name, scopes: token.scopes },
		});
		return { token, rawToken };
	}

	async list(projectId: string): Promise<ProjectToken[]> {
		return this.store.listTokens(projectId);
	}

	async revoke(projectId: string, id: string, actor = "system"): Promise<ProjectToken> {
		const row = await this.store.revokeToken(projectId, id);
		if (!row) throw new TokenError("Token not found", "not_found", 404);
		await appendAudit(this.store, {
			projectId,
			action: "token.revoked",
			actor,
			resourceType: "project_token",
			resourceId: id,
			detail: null,
		});
		return row;
	}

	async resolve(rawToken: string): Promise<ProjectToken | null> {
		return this.store.findTokenByHash(hashToken(rawToken));
	}

	async requireScope(
		rawToken: string | undefined,
		projectId: string,
		required: AuthScope,
		/** Legacy global bearer — treated as project:admin when it matches. */
		legacyGlobalToken?: string,
	): Promise<ProjectToken | { legacy: true; scopes: AuthScope[] }> {
		if (legacyGlobalToken && rawToken === legacyGlobalToken) {
			return { legacy: true, scopes: ["project:admin"] };
		}
		if (!rawToken) {
			// Open mode when no tokens configured at all — allow (caller checks env)
			throw new TokenError("Authentication required", "unauthorized", 401);
		}
		const token = await this.resolve(rawToken);
		if (!token || token.projectId !== projectId) {
			throw new TokenError("Invalid token", "unauthorized", 401);
		}
		if (!scopeAllows(token.scopes, required)) {
			throw new TokenError(
				`Missing scope: ${required}`,
				"forbidden",
				403,
			);
		}
		return token;
	}
}

export function createProjectTokenService(store?: PlatformStore): ProjectTokenService {
	return new ProjectTokenService(store ?? getPlatformStore());
}

/** Extract bearer token from Authorization header value. */
export function parseBearer(authorization: string | undefined): string | undefined {
	if (!authorization) return undefined;
	const m = /^Bearer\s+(.+)$/i.exec(authorization);
	return m?.[1];
}
