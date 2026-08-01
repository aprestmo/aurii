/**
 * Studio runtime configuration from environment (build + local).
 *
 * Secrets/tokens are never embedded in public builds — only URLs and slugs.
 */

export interface StudioRuntimeEnv {
	coreUrl: string;
	projectSlug: string | null;
	defaultDataset: string | null;
	/** Optional path to project package for server-side config loading. */
	projectRoot: string | null;
	/** Optional explicit path to defineStudio module (overrides package convention). */
	studioConfigPath: string | null;
}

export function getStudioRuntimeEnv(
	env: Record<string, string | undefined> = typeof process !== "undefined"
		? process.env
		: {},
): StudioRuntimeEnv {
	return {
		coreUrl: env["AURII_CORE_URL"] ?? env["PUBLIC_AURII_CORE_URL"] ?? "http://localhost:3000",
		projectSlug: env["AURII_PROJECT_SLUG"] ?? env["PUBLIC_AURII_PROJECT_SLUG"] ?? null,
		defaultDataset:
			env["AURII_DEFAULT_DATASET"] ?? env["PUBLIC_AURII_DEFAULT_DATASET"] ?? null,
		projectRoot: env["AURII_PROJECT_ROOT"] ?? null,
		studioConfigPath: env["AURII_STUDIO_CONFIG"] ?? null,
	};
}
