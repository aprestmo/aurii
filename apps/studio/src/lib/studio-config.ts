/**
 * Project Studio navigation — uses @aurii/studio helpers.
 * Generic projects without config get defaultStudioConfig.
 */

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

export { navHref, navLabel, resolveStudioConfig };

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

export function navigationGroups(slug: string | null): StudioNavGroup[] {
	return resolveStudioConfig(studioConfigForProject(slug)).navigation ?? [];
}
