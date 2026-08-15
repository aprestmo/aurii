import {
	apiRoutes,
	collection,
	customView,
	defineStudio,
	imports,
	sources,
	systemStatus,
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
			title: "Utdanning",
			items: [
				collection("school", {
					columns: ["id", "name", "municipalityId"],
				}),
				collection("kindergarten", {
					columns: ["id", "name", "municipalityId"],
				}),
			],
		},
		{
			title: "Helse",
			items: [
				collection("hospital", {
					columns: ["id", "name", "municipalityId"],
				}),
			],
		},
		{
			title: "Kalender",
			items: [
				collection("public-holiday", {
					columns: ["id", "localName", "date", "year"],
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
		{
			title: "Drift",
			items: [systemStatus()],
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
			title: "Utdanning",
			definitionIds: ["schools", "kindergartens"],
		},
		{
			title: "Helse",
			definitionIds: ["hospitals"],
		},
		{
			title: "Kalender",
			definitionIds: ["public-holidays"],
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
