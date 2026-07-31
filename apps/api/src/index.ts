/**
 * Aurii API entrypoint.
 *
 * Prefer this app over packages/core `serve` when project administration
 * routes are required. Core runtime routes remain available at the root.
 */

import { buildApiApp } from "./server";

export { buildApiApp } from "./server";
export type { ApiAppOptions } from "./server";
export { createProjectsPlugin } from "./routes/projects";
export { toApiError } from "./errors";

if (import.meta.main) {
	const PORT = Number.parseInt(process.env["PORT"] ?? "3000", 10);
	const API_TOKEN = process.env["AURII_API_TOKEN"];

	const app = buildApiApp().listen({
		port: PORT,
		maxRequestBodySize: 100 * 1024 * 1024,
	});

	console.log(`Aurii API running on http://localhost:${app.server?.port}`);
	console.log(`Storage: ${process.env["AURII_STORAGE"] ?? "sqlite"}`);
	console.log(
		`Projects: ${process.env["DATABASE_URL"] ? "postgres" : "memory"}`,
	);
	console.log(
		`Auth: ${API_TOKEN ? "token required" : "open (set AURII_API_TOKEN to protect)"}`,
	);
}
