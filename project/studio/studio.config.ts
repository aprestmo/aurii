import {
	apiRoutes,
	collection,
	customView,
	defineStudio,
	imports,
	sources,
} from "@aurii/studio";

/**
 * Project-specific Studio configuration for Norwegian Geo.
 * Custom views use SDK/public APIs only — no Core database access.
 */
export default defineStudio({
	title: "Norwegian Geo",
	featuredSchemas: ["county", "municipality", "postal-code"],
	navigation: [
		{
			title: "Geografi",
			items: [
				collection("county", { columns: ["id", "name"], featured: true }),
				collection("municipality", {
					columns: ["id", "name", "countyId"],
					featured: true,
				}),
				collection("postal-code", {
					columns: ["id", "name", "municipalityId"],
				}),
			],
		},
		{
			title: "Datatilførsel",
			items: [sources(), imports()],
		},
		{
			title: "Levering",
			items: [apiRoutes()],
		},
		{
			title: "Innsikt",
			items: [
				customView("coverage", {
					title: "Datadekning",
					href: "/views/coverage",
				}),
			],
		},
	],
	views: [
		{
			id: "coverage",
			title: "Datadekning",
			description: "Field coverage overview for core schemas",
			module: "./views/coverage.ts",
		},
	],
	importGroups: [
		{
			title: "Kjerne",
			definitionIds: ["counties", "municipalities", "postal-codes"],
		},
		{
			title: "Planlagt synk",
			definitionIds: ["postal-codes-nightly"],
		},
	],
	routeGroups: [
		{
			title: "Offentlig v1",
			routeIds: [
				"counties",
				"municipalities",
				"municipality-by-id",
				"postal-codes",
			],
		},
	],
});
