import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "city-by-id",
	path: "/cities/:id",
	method: "GET",
	description: "Get a city by id",
	version: "1",
	query: {
		schema: "city",
		select: ["id", "name", "regionId"],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 60,
	},
});
