/**
 * Process-level runtime configuration.
 *
 * Core stays hosting-agnostic: no provider names, only environment contracts.
 * Production start fails closed on missing critical settings.
 */

export class RuntimeConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RuntimeConfigError";
	}
}

export type StorageKind = "sqlite" | "postgres";

export type CorsPolicy =
	| { mode: "wildcard" }
	| { mode: "list"; origins: string[] };

export interface RuntimeIdentity {
	version: string;
	gitSha: string | null;
	buildTime: string | null;
}

export interface RuntimeConfig {
	production: boolean;
	storage: StorageKind;
	databaseUrl: string | null;
	apiTokenConfigured: boolean;
	cors: CorsPolicy;
	uploadDir: string | null;
	identity: RuntimeIdentity;
}

export function isProductionEnv(
	env: Record<string, string | undefined> = process.env,
): boolean {
	return env["AURII_ENV"] === "production" || env["NODE_ENV"] === "production";
}

export function resolveRuntimeIdentity(
	env: Record<string, string | undefined> = process.env,
): RuntimeIdentity {
	const gitSha = emptyToNull(env["AURII_GIT_SHA"]);
	const buildTime = emptyToNull(env["AURII_BUILD_TIME"]);
	return {
		version: env["AURII_VERSION"]?.trim() || "0.1.0",
		gitSha,
		buildTime,
	};
}

export function resolveCorsPolicy(
	env: Record<string, string | undefined> = process.env,
): CorsPolicy {
	const raw = env["AURII_CORS_ORIGINS"]?.trim();
	if (!raw || raw === "*") {
		return { mode: "wildcard" };
	}
	const origins = raw
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	if (origins.length === 0 || origins.includes("*")) {
		return { mode: "wildcard" };
	}
	return { mode: "list", origins };
}

/**
 * Elysia CORS `origin` option: `*` in development, an allow-list in production.
 * A function must return boolean (`true` = allow); the plugin echoes Origin.
 */
export function corsOriginOption(
	env: Record<string, string | undefined> = process.env,
): "*" | ((request: Request) => boolean) {
	const policy = resolveCorsPolicy(env);
	if (policy.mode === "wildcard") {
		return "*";
	}
	const allowed = new Set(policy.origins);
	return (request: Request) => {
		const origin = request.headers.get("origin");
		if (!origin) {
			return true;
		}
		return allowed.has(origin);
	};
}

export function validateRuntimeConfig(
	env: Record<string, string | undefined> = process.env,
): RuntimeConfig {
	const production = isProductionEnv(env);
	const storageRaw = env["AURII_STORAGE"] ?? "sqlite";
	if (storageRaw !== "sqlite" && storageRaw !== "postgres") {
		throw new RuntimeConfigError(
			`AURII_STORAGE must be "sqlite" or "postgres" (got ${JSON.stringify(storageRaw)})`,
		);
	}
	const storage = storageRaw;
	const databaseUrl = emptyToNull(env["DATABASE_URL"]);
	const apiTokenConfigured = Boolean(env["AURII_API_TOKEN"]?.trim());
	const cors = resolveCorsPolicy(env);

	if (storage === "postgres" && !databaseUrl) {
		throw new RuntimeConfigError(
			"AURII_STORAGE=postgres requires DATABASE_URL",
		);
	}
	if (production && storage !== "postgres") {
		throw new RuntimeConfigError(
			"Production (AURII_ENV=production or NODE_ENV=production) requires AURII_STORAGE=postgres",
		);
	}
	if (production && !databaseUrl) {
		throw new RuntimeConfigError("Production requires DATABASE_URL");
	}
	if (production && !apiTokenConfigured) {
		throw new RuntimeConfigError(
			"Production requires AURII_API_TOKEN so management surfaces are not open to the internet",
		);
	}
	if (production && cors.mode === "wildcard") {
		throw new RuntimeConfigError(
			"Production requires AURII_CORS_ORIGINS with an explicit allow-list (wildcard CORS is not allowed)",
		);
	}

	return {
		production,
		storage,
		databaseUrl,
		apiTokenConfigured,
		cors,
		uploadDir: emptyToNull(env["AURII_UPLOAD_DIR"]),
		identity: resolveRuntimeIdentity(env),
	};
}

export function publicInternalErrorMessage(error: unknown): string {
	if (isProductionEnv()) {
		console.error(error);
		return "Internal Server Error";
	}
	return String(error);
}

function emptyToNull(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}
