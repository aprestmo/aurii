import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "regions",
	path: "/regions",
	method: "GET",
	description: "List regions",
	version: "1",
	query: {
		schema: "region",
		select: ["id", "name"],
		orderBy: [{ field: "name", direction: "asc" }],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 60,
	},
});
