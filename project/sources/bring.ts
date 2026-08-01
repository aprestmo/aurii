import type { PackageDataSource } from "./kartverket";

export default {
	id: "bring",
	name: "Bring postal codes",
	kind: "file",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["postal-code"],
		path: "./core/data/postal-codes.json",
		endpoint: "https://www.bring.no/tjenester/adressetjenester",
		definitionIds: ["postal-codes", "postal-codes-nightly"],
		options: {
			provenance: "Bring postnummerregister",
		},
	},
} satisfies PackageDataSource;
