export default {
	id: "cities",
	name: "Import cities",
	schemaId: "city",
	datasetId: "catalog",
	sourceId: "catalog-file",
	definitionPath: "./imports/cities.yaml",
	triggerMode: "manual" as const,
	status: "active" as const,
};
