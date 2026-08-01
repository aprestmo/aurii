import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "postal-codes",
	path: "/postal-codes",
	method: "GET",
	description: "List postal codes",
	version: "1",
	query: {
		schema: "postal-code",
		select: ["id", "name", "municipalityId"],
		orderBy: [{ field: "id", direction: "asc" }],
		limit: 500,
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 3600,
	},
});
