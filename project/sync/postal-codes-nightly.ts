import type { PackageImportDefinition } from "../imports/counties";

/**
 * Nightly postal-code sync — disabled by default for beta.
 * Enable in Studio when the operator wants scheduled refreshes.
 */
export default {
	id: "postal-codes-nightly",
	name: "Postal codes nightly sync",
	schemaId: "postal-code",
	datasetId: "norwegian-geo",
	sourceId: "bring",
	definitionPath: "./core/imports/postal-codes.yaml",
	triggerMode: "scheduled",
	status: "active",
	schedule: {
		enabled: false,
		spec: {
			type: "cron",
			expression: "0 4 * * *",
			timezone: "Europe/Oslo",
		},
	},
} satisfies PackageImportDefinition;
