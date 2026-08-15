import { defineRoute } from "@aurii/core";

export default defineRoute({
	id: "postal-codes",
	path: "/postal-codes",
	method: "GET",
	description: "List postal codes",
	version: "1",
	query: {
		schema: "postal-code",
		select: [
			"code",
			"city",
			"municipalityId",
			"municipalityName",
			"postalCodeType",
		],
		orderBy: [{ field: "code", direction: "asc" }],
		// Single-request limit: Norwegian Geo has ~5,122 postal codes.
		// Cursor pagination is not yet part of the published-route contract (N4).
		limit: 10000,
	},
	defaults: {
		enabled: false,
		access: "public",
		cacheTtl: 3600,
	},
});
