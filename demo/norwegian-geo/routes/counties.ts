import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "counties",
	path: "/counties",
	method: "GET",
	description: "List Norwegian counties",
	version: "1",
	query: {
		schema: "county",
		select: ["id", "name", "population", "populationYear", "source"],
		orderBy: [{ field: "name", direction: "asc" }],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 3600,
	},
});
