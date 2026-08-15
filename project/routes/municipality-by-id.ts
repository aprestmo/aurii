import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "municipality-by-id",
	path: "/municipalities/:id",
	method: "GET",
	description: "Get a municipality by id",
	version: "1",
	query: {
		schema: "municipality",
		select: [
			"id",
			"name",
			"countyId",
			"population",
			"populationYear",
			"source",
		],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 3600,
	},
});
