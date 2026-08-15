import { defineProject } from "@aurii/core";

/**
 * Norwegian Geo — Aurii project package entry.
 *
 * Complements product.yaml (module composition + CLI import order).
 * This file is the installable ops surface for Studio, sources, saved imports,
 * sync, and published routes. Schema YAML for dataset modules stays in
 * product.yaml / module.yaml / lib/manifest.ts — list those modules here only
 * as sources, imports, and Studio collections.
 *
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
		"./sources/udir-nsr.ts",
		"./sources/udir-nbr.ts",
		"./sources/brreg.ts",
		"./sources/nager-date.ts",
	],
	imports: [
		"./imports/counties.ts",
		"./imports/municipalities.ts",
		"./imports/postal-codes.ts",
		"./imports/schools.ts",
		"./imports/kindergartens.ts",
		"./imports/hospitals.ts",
		"./imports/public-holidays.ts",
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
