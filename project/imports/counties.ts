/**
 * Saved import definition descriptors for the project package.
 * `definitionPath` points at existing YAML consumed by the Core import engine.
 */
export interface PackageImportDefinition {
	id: string;
	name: string;
	schemaId: string;
	datasetId: string;
	sourceId: string;
	definitionPath: string;
	triggerMode: "manual" | "once" | "scheduled" | "webhook" | "api";
	status?: "active" | "disabled";
	schedule?: {
		enabled: boolean;
		spec: { type: "cron"; expression: string; timezone: string };
	} | null;
}

export default {
	id: "counties",
	name: "Import counties",
	schemaId: "county",
	datasetId: "norwegian-geo",
	sourceId: "kartverket",
	definitionPath: "./core/imports/counties.yaml",
	triggerMode: "manual",
	status: "active",
} satisfies PackageImportDefinition;
