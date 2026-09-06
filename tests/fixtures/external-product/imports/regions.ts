export default {
	id: "regions",
	name: "Import regions",
	schemaId: "region",
	datasetId: "catalog",
	sourceId: "catalog-file",
	definitionPath: "./imports/regions.yaml",
	triggerMode: "manual" as const,
	status: "active" as const,
};
