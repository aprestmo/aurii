import { defineProject } from "@aurii/core";

/**
 * Synthetic external product used by Aurii CI.
 *
 * Neutral City / Region domain — not Norwegian geography.
 * Proves the generic path: project package → import → published route → SDK.
 */
export default defineProject({
	id: "external-catalog",
	title: "External Catalog",
	description:
		"Tiny synthetic product that consumes Aurii only through public packages.",
	core: {
		projectSlug: "catalog",
		defaultDataset: "catalog",
	},
	schemas: ["./schemas/region.yaml", "./schemas/city.yaml"],
	sources: ["./sources/catalog.ts"],
	imports: ["./imports/regions.ts", "./imports/cities.ts"],
	routes: [
		"./routes/regions.ts",
		"./routes/cities.ts",
		"./routes/city-by-id.ts",
	],
	studio: "./studio/studio.config.ts",
});
