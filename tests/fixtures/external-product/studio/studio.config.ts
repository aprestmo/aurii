import { collection, defineStudio, imports, sources } from "@aurii/studio";

/**
 * Operator Studio config for the fixture. Product clients must not import this.
 */
export default defineStudio({
	title: "External Catalog",
	featuredSchemas: ["region", "city"],
	navigation: [
		{
			title: "Catalog",
			items: [
				collection("region", { columns: ["id", "name"], featured: true }),
				collection("city", {
					columns: ["id", "name", "regionId"],
					featured: true,
				}),
			],
		},
		{
			title: "Operations",
			items: [sources(), imports()],
		},
	],
});
