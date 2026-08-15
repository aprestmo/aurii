import type { PackageImportDefinition } from "./counties";

export default {
	id: "kindergartens",
	name: "Import kindergartens",
	schemaId: "kindergarten",
	datasetId: "norwegian-geo",
	sourceId: "udir-nbr",
	definitionPath: "./modules/education/imports/kindergartens.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
