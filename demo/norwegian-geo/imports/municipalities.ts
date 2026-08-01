import type { PackageImportDefinition } from "./counties";

export default {
	id: "municipalities",
	name: "Import municipalities",
	schemaId: "municipality",
	datasetId: "norwegian-geo",
	sourceId: "kartverket",
	definitionPath: "./core/imports/municipalities.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
