import type { PackageImportDefinition } from "./counties";

export default {
	id: "public-holidays",
	name: "Import public holidays",
	schemaId: "public-holiday",
	datasetId: "norwegian-geo",
	sourceId: "nager-date",
	definitionPath: "./modules/calendar/imports/public-holidays.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
