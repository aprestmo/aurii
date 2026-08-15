import type { PackageImportDefinition } from "./counties";

export default {
	id: "schools",
	name: "Import schools",
	schemaId: "school",
	datasetId: "norwegian-geo",
	sourceId: "udir-nsr",
	definitionPath: "./modules/education/imports/schools.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
