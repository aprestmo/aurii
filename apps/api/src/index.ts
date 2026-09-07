/**
 * Aurii API entrypoint.
 *
 * Prefer this app over packages/core `serve` when project administration
 * routes are required. Core runtime routes remain available at the root.
 */

import {
	assertRuntimeConfigOrExit,
	attachShutdownHandlers,
} from "@aurii/core";
import { buildApiApp } from "./server";

export { buildApiApp } from "./server";
export type { ApiAppOptions } from "./server";
export { createProjectsPlugin } from "./routes/projects";
export { toApiError } from "./errors";

if (import.meta.main) {
	assertRuntimeConfigOrExit();
	const PORT = Number.parseInt(process.env["PORT"] ?? "3000", 10);

	const app = buildApiApp().listen({
		port: PORT,
		maxRequestBodySize: 100 * 1024 * 1024,
	});
	attachShutdownHandlers(async () => {
		await app.stop();
	});

	console.log(`Aurii API listening on :${app.server?.port}`);
}
