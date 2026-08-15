import type { PackageImportDefinition } from "./counties";

export default {
	id: "hospitals",
	name: "Import hospitals",
	schemaId: "hospital",
	datasetId: "norwegian-geo",
	sourceId: "brreg",
	definitionPath: "./modules/health/imports/hospitals.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
