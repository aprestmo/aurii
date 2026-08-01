import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "municipalities",
	path: "/municipalities",
	method: "GET",
	description: "List Norwegian municipalities",
	version: "1",
	query: {
		schema: "municipality",
		select: ["id", "name", "countyId"],
		orderBy: [{ field: "name", direction: "asc" }],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 3600,
	},
});
