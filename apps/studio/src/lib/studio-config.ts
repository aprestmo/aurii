/**
 * Project Studio navigation — loads defineStudio from the project package
 * when AURII_PROJECT_ROOT / AURII_STUDIO_CONFIG is set; otherwise falls back
 * to generic defaults (or a built-in Norwegian Geo layout when only the slug
 * is known).
 *
 * Intentionally does **not** import `@aurii/core` — Studio talks to Core via
 * HTTP/SDK only. Pulling Core into the Astro/Vite graph breaks the static
 * build (bun-native modules).
 */

import {
	apiRoutes,
	collection,
	collectionColumnsBySchema,
	customView,
	defaultStudioConfig,
	defineStudio,
	importGroupsFromConfig,
	imports,
	navHref,
	navLabel,
	resolveStudioConfig,
	routeGroupsFromConfig,
	sources,
	systemStatus,
} from "@aurii/studio";
import type { AuriiStudioConfig, StudioNavGroup } from "@aurii/types";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getStudioRuntimeEnv } from "./env";

export {
	collectionColumnsBySchema,
	importGroupsFromConfig,
	navHref,
	navLabel,
	resolveStudioConfig,
	routeGroupsFromConfig,
};

let cachedPackageConfig: {
	key: string;
	config: AuriiStudioConfig;
	title: string;
} | null = null;

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve the on-disk `defineStudio` module path without loading Core.
 *
 * Order:
 * 1. `AURII_STUDIO_CONFIG` (explicit file)
 * 2. `{AURII_PROJECT_ROOT}/studio/studio.config.ts` (convention)
 * 3. `{AURII_PROJECT_ROOT}/studio/studio.config.js`
 */
export async function resolveStudioConfigModulePath(
	projectRoot?: string | null,
	studioConfigPath?: string | null,
): Promise<string | null> {
	const env = getStudioRuntimeEnv();
	const explicit = studioConfigPath ?? env.studioConfigPath;
	if (explicit) {
		const abs = resolve(explicit);
		return (await fileExists(abs)) ? abs : null;
	}
	const rootEnv = projectRoot ?? env.projectRoot;
	if (!rootEnv) return null;
	const root = resolve(rootEnv);
	for (const rel of ["studio/studio.config.ts", "studio/studio.config.js"]) {
		const abs = join(root, rel);
		if (await fileExists(abs)) return abs;
	}
	return null;
}

/**
 * Load Studio config from the project package on disk (server-side only).
 * Safe to call during Astro SSR / build; never embeds secrets; never imports Core.
 */
export async function loadStudioConfigFromPackage(
	projectRoot?: string | null,
): Promise<{ config: AuriiStudioConfig; title: string } | null> {
	const configPath = await resolveStudioConfigModulePath(projectRoot);
	if (!configPath) return null;
	if (cachedPackageConfig?.key === configPath) {
		return {
			config: cachedPackageConfig.config,
			title: cachedPackageConfig.title,
		};
	}
	const mod = await import(pathToFileURL(configPath).href);
	const raw = (mod.default ?? mod.config) as AuriiStudioConfig | undefined;
	if (!raw || typeof raw !== "object") return null;
	const config = resolveStudioConfig(raw);
	const title = config.title ?? "Aurii Studio";
	cachedPackageConfig = { key: configPath, config, title };
	return { config, title };
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
					title: "Utdanning",
					items: [
						collection("school", {
							columns: ["id", "name", "municipalityId"],
						}),
						collection("kindergarten", {
							columns: ["id", "name", "municipalityId"],
						}),
					],
				},
				{
					title: "Helse",
					items: [
						collection("hospital", {
							columns: ["id", "name", "municipalityId"],
						}),
					],
				},
				{
					title: "Kalender",
					items: [
						collection("public-holiday", {
							columns: ["id", "localName", "date", "year"],
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
				{
					title: "Drift",
					items: [systemStatus()],
				},
			],
			importGroups: [
				{
					title: "Kjerne",
					definitionIds: ["counties", "municipalities", "postal-codes"],
				},
				{
					title: "Utdanning",
					definitionIds: ["schools", "kindergartens"],
				},
				{
					title: "Helse",
					definitionIds: ["hospitals"],
				},
				{
					title: "Kalender",
					definitionIds: ["public-holidays"],
				},
				{
					title: "Planlagt synk",
					definitionIds: ["postal-codes-nightly"],
				},
			],
			routeGroups: [
				{
					title: "Offentlig v1",
					routeIds: [
						"counties",
						"municipalities",
						"municipality-by-id",
						"postal-codes",
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
		title:
			config.title ??
			(env.projectSlug ? `Project ${env.projectSlug}` : "Aurii Studio"),
	};
}

export function navigationGroups(slug: string | null): StudioNavGroup[] {
	return resolveStudioConfig(studioConfigForProject(slug)).navigation ?? [];
}
