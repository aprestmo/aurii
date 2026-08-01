import type { PackageImportDefinition } from "./counties";

export default {
	id: "postal-codes",
	name: "Import postal codes",
	schemaId: "postal-code",
	datasetId: "norwegian-geo",
	sourceId: "bring",
	definitionPath: "./core/imports/postal-codes.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
