import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "cities",
	path: "/cities",
	method: "GET",
	description: "List cities",
	version: "1",
	query: {
		schema: "city",
		select: ["id", "name", "regionId"],
		orderBy: [{ field: "name", direction: "asc" }],
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 60,
	},
});
