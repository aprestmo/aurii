import type { PackageDataSource } from "./kartverket";

export default {
	id: "udir-nsr",
	name: "UDIR Nasjonalt skoleregister",
	kind: "http",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["school"],
		path: "./modules/education/data",
		endpoint: "https://data-nsr.udir.no/v4/enheter",
		definitionIds: ["schools"],
		options: {
			provenance: "UDIR Nasjonalt skoleregister",
		},
	},
} satisfies PackageDataSource;
