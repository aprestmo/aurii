import type { PackageDataSource } from "./kartverket";

export default {
	id: "brreg",
	name: "Brønnøysundregistrene Enhetsregisteret",
	kind: "http",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["hospital"],
		path: "./modules/health/data",
		endpoint: "https://data.brreg.no/enhetsregisteret/api/enheter",
		definitionIds: ["hospitals"],
		options: {
			provenance: "Brønnøysundregistrene Enhetsregisteret",
			filter: "naeringskode=86.10",
		},
	},
} satisfies PackageDataSource;
