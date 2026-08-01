/**
 * Project Studio navigation — loads defineStudio from the project package
 * when AURII_PROJECT_ROOT is set; otherwise falls back to generic defaults
 * (or a built-in Norwegian Geo layout when only the slug is known).
 */

import { loadProjectPackage } from "@aurii/core";
import {
	apiRoutes,
	collection,
	customView,
	defaultStudioConfig,
	defineStudio,
	imports,
	navHref,
	navLabel,
	resolveStudioConfig,
	sources,
} from "@aurii/studio";
import type { AuriiStudioConfig, StudioNavGroup } from "@aurii/types";
import { resolve } from "node:path";
import { getStudioRuntimeEnv } from "./env";

export { navHref, navLabel, resolveStudioConfig };

let cachedPackageConfig: {
	root: string;
	config: AuriiStudioConfig;
	title: string;
} | null = null;

/**
 * Load Studio config from the project package on disk (server-side only).
 * Safe to call during Astro SSR / build; never embeds secrets.
 */
export async function loadStudioConfigFromPackage(
	projectRoot?: string | null,
): Promise<{ config: AuriiStudioConfig; title: string } | null> {
	const rootEnv = projectRoot ?? getStudioRuntimeEnv().projectRoot;
	if (!rootEnv) return null;
	const root = resolve(rootEnv);
	if (cachedPackageConfig?.root === root) {
		return {
			config: cachedPackageConfig.config,
			title: cachedPackageConfig.title,
		};
	}
	const pkg = await loadProjectPackage(root);
	const config =
		pkg.studio ?? defaultStudioConfig(pkg.config.title ?? "Aurii Studio");
	cachedPackageConfig = {
		root,
		config,
		title: pkg.config.title ?? config.title ?? "Aurii Studio",
	};
	return { config, title: cachedPackageConfig.title };
}

/** @internal test helper */
export function clearStudioConfigCache(): void {
	cachedPackageConfig = null;
}

/**
 * Sync fallback when AURII_PROJECT_ROOT is not set (static host without package).
 */
export function studioConfigForProject(
	slug: string | null,
): AuriiStudioConfig {
	if (slug === "norge-data" || slug === "norwegian-geo") {
		return defineStudio({
			title: "Norwegian Geo",
			featuredSchemas: ["county", "municipality", "postal-code"],
			navigation: [
				{
					title: "Geografi",
					items: [
						collection("county", { columns: ["id", "name"] }),
						collection("municipality", {
							columns: ["id", "name", "countyId"],
						}),
						collection("postal-code", {
							columns: ["id", "name", "municipalityId"],
						}),
					],
				},
				{
					title: "Datatilførsel",
					items: [sources(), imports()],
				},
				{
					title: "Levering",
					items: [apiRoutes()],
				},
				{
					title: "Innsikt",
					items: [
						customView("coverage", {
							title: "Datadekning",
							href: "/views/coverage",
						}),
					],
				},
			],
		});
	}
	return defaultStudioConfig(slug ? `Project ${slug}` : "Aurii Studio");
}

export async function resolveActiveStudioConfig(): Promise<{
	config: AuriiStudioConfig;
	title: string;
}> {
	const env = getStudioRuntimeEnv();
	const fromPackage = await loadStudioConfigFromPackage(env.projectRoot);
	if (fromPackage) {
		return {
			config: resolveStudioConfig(fromPackage.config),
			title: fromPackage.title,
		};
	}
	const config = resolveStudioConfig(studioConfigForProject(env.projectSlug));
	return {
		config,
		title: config.title ?? (env.projectSlug ? `Project ${env.projectSlug}` : "Aurii Studio"),
	};
}

export function navigationGroups(slug: string | null): StudioNavGroup[] {
	return resolveStudioConfig(studioConfigForProject(slug)).navigation ?? [];
}
