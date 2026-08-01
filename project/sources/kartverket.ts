/**
 * Declarative data source descriptors for the Norwegian Geo project package.
 * Registered into Core via Studio/API; secrets never live here.
 */
export interface PackageDataSource {
	id: string;
	name: string;
	kind: "file" | "http" | "database" | "manual" | "product" | "automation" | "other";
	datasetId: string;
	config: {
		targetSchemas?: string[];
		endpoint?: string;
		path?: string;
		definitionIds?: string[];
		options?: Record<string, unknown>;
	};
}

export default {
	id: "kartverket",
	name: "Kartverket / GeoNorge",
	kind: "file",
	datasetId: "norwegian-geo",
	config: {
		targetSchemas: ["county", "municipality"],
		path: "./core/data",
		endpoint: "https://kartkatalog.geonorge.no/",
		definitionIds: ["counties", "municipalities"],
		options: {
			provenance: "Kartverket administrative boundaries",
		},
	},
} satisfies PackageDataSource;
