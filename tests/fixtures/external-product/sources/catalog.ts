/**
 * Declarative data source for the external-product fixture.
 * Registered into Core via the project-package path; no secrets.
 */
export default {
	id: "catalog-file",
	name: "Catalog file source",
	kind: "file" as const,
	datasetId: "catalog",
	config: {
		targetSchemas: ["region", "city"],
		path: "./data",
		definitionIds: ["regions", "cities"],
	},
};
