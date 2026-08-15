import type { PackageDataSource } from "./kartverket";

export default {
	id: "udir-nbr",
	name: "UDIR Nasjonalt barnehageregister",
	kind: "http",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["kindergarten"],
		path: "./modules/education/data",
		endpoint: "https://data-nbr.udir.no/v4/enheter",
		definitionIds: ["kindergartens"],
		options: {
			provenance: "UDIR Nasjonalt barnehageregister",
		},
	},
} satisfies PackageDataSource;
