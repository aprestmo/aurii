/**
 * Register Norwegian Geo project-package resources into a running Core API.
 *
 * Thin wrapper around `registerProjectPackage` from `@aurii/core`.
 *
 * Prerequisites:
 *   bun run import:norwegian-geo   # schemas + entities
 *   bun run serve                  # Core API on :3000
 *
 * Usage:
 *   AURII_CORE_URL=http://localhost:3000 \
 *   AURII_API_TOKEN=... \
 *   bun run register:norwegian-geo-platform
 */

import { registerProjectPackage } from "@aurii/core";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";
import { PRODUCT_ROOT } from "../lib/paths";

const CORE_URL = (process.env["AURII_CORE_URL"] ?? "http://localhost:3000").replace(
	/\/$/,
	"",
);

const result = await registerProjectPackage({
	root: PRODUCT_ROOT,
	coreUrl: CORE_URL,
	token: process.env["AURII_API_TOKEN"],
	project: {
		name: NORGE_DATA_PROJECT_NAME,
		slug: NORGE_DATA_PROJECT_SLUG,
		description: NORGE_DATA_PROJECT_DESCRIPTION,
	},
	onEvent: (event) => {
		const status = event.status ? ` ${event.status}` : "";
		console.log(`${event.kind} ${event.id}: ${event.outcome}${status}`);
	},
});

console.log(`Core: ${CORE_URL}`);
console.log(`Project: ${result.project.slug} (${result.project.id})`);
console.log(`Dataset: ${result.datasetId}`);
console.log(`Package: ${result.packageId}`);
console.log("Done. Enable routes in Studio or via PATCH /api/projects/:id/routes/:routeId");
console.log(
	`Studio: AURII_PROJECT_ROOT=${PRODUCT_ROOT} AURII_PROJECT_SLUG=${NORGE_DATA_PROJECT_SLUG} bun run studio`,
);
