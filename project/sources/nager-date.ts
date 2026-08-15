import type { PackageDataSource } from "./kartverket";

export default {
	id: "nager-date",
	name: "Nager.Date Public Holidays API",
	kind: "http",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["public-holiday"],
		path: "./modules/calendar/data",
		endpoint: "https://date.nager.at/api/v3/PublicHolidays",
		definitionIds: ["public-holidays"],
		options: {
			provenance: "Nager.Date public holidays",
		},
	},
} satisfies PackageDataSource;
