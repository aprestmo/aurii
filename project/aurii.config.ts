import { defineProject } from "@aurii/core";

/**
 * Norwegian Geo — Aurii project package entry.
 *
 * Complements product.yaml (module composition). This file is the installable
 * project config for Studio, sources, imports, sync, and published routes.
 * Links to Core Project slug `norge-data` and dataset `norwegian-geo`.
 */
export default defineProject({
	id: "norwegian-geo",
	title: "Norwegian Geo",
	description:
		"Norwegian reference geodata — counties, municipalities, postal codes, and related modules.",
	core: {
		projectSlug: "norge-data",
		defaultDataset: "norwegian-geo",
	},
	schemas: [
		"./core/schemas/county.yaml",
		"./core/schemas/municipality.yaml",
		"./core/schemas/postal-code.yaml",
	],
	sources: [
		"./sources/kartverket.ts",
		"./sources/bring.ts",
	],
	imports: [
		"./imports/counties.ts",
		"./imports/municipalities.ts",
		"./imports/postal-codes.ts",
	],
	sync: ["./sync/postal-codes-nightly.ts"],
	routes: [
		"./routes/counties.ts",
		"./routes/municipalities.ts",
		"./routes/municipality-by-id.ts",
		"./routes/postal-codes.ts",
	],
	studio: "./studio/studio.config.ts",
});
