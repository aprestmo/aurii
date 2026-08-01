/**
 * Project platform routes: data sources, saved imports, published routes, tokens, audit.
 */

import {
	createDataSourceService,
	createProjectTokenService,
	createPublishedRouteService,
	createSavedImportService,
	DataSourceError,
	listAuditEvents,
	PublishedRouteError,
	SavedImportError,
	TokenError,
	type ProjectService,
} from "@aurii/core";
import { Elysia } from "elysia";
import { toApiError } from "../errors";

function mapPlatformError(error: unknown): { status: number; body: unknown } {
	if (
		error instanceof DataSourceError ||
		error instanceof SavedImportError ||
		error instanceof PublishedRouteError ||
		error instanceof TokenError
	) {
		return {
			status: error.status,
			body: { error: { code: error.code, message: error.message } },
		};
	}
	return toApiError(error);
}

export function createProjectPlatformPlugin(options: {
	projectService: ProjectService;
}) {
	const { projectService } = options;
	const sources = createDataSourceService();
	const imports = createSavedImportService();
	const routes = createPublishedRouteService();
	const tokens = createProjectTokenService();

	return new Elysia({ name: "project-platform", prefix: "/api/projects" })
		.group("/:id", (app) =>
			app
				.get("/sources", async ({ params, query, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const datasetId = (query as Record<string, string>)["dataset"];
						const data = await sources.list(params.id, datasetId);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/sources", async ({ params, body, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await sources.create(params.id, body as never);
						set.status = 201;
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/sources/:sourceId", async ({ params, set }) => {
					try {
						const data = await sources.get(params.id, params.sourceId);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.patch("/sources/:sourceId", async ({ params, body, set }) => {
					try {
						const data = await sources.update(
							params.id,
							params.sourceId,
							body as never,
						);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/saved-imports", async ({ params, query, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const datasetId = (query as Record<string, string>)["dataset"];
						const data = await imports.list(params.id, datasetId);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/saved-imports", async ({ params, body, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await imports.create(params.id, body as never);
						set.status = 201;
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/saved-imports/:importId", async ({ params, set }) => {
					try {
						const data = await imports.get(params.id, params.importId);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.patch("/saved-imports/:importId", async ({ params, body, set }) => {
					try {
						const data = await imports.update(
							params.id,
							params.importId,
							body as never,
						);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/saved-imports/:importId/run", async ({ params, body, set }) => {
					try {
						const dryRun = Boolean(
							(body as { dryRun?: boolean } | null)?.dryRun,
						);
						const data = await imports.run(params.id, params.importId, {
							dryRun,
							trigger: "user",
						});
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/routes", async ({ params, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await routes.list(params.id);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/routes", async ({ params, body, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await routes.upsert(params.id, body as never, "api");
						set.status = 201;
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.patch("/routes/:routeId", async ({ params, body, set }) => {
					try {
						const data = await routes.updateState(
							params.id,
							params.routeId,
							body as never,
							"api",
						);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/routes/:routeId/test", async ({ params, set }) => {
					try {
						const state = await routes.get(params.id, params.routeId);
						const result = await routes.execute(params.id, state.definition.path, {
							authenticated: true,
						});
						if (!result) {
							set.status = 404;
							return {
								error: { code: "not_found", message: "Route not enabled or missing" },
							};
						}
						return { data: result };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/tokens", async ({ params, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await tokens.list(params.id);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/tokens", async ({ params, body, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const result = await tokens.create(params.id, body as never, "api");
						set.status = 201;
						return {
							data: {
								token: result.token,
								rawToken: result.rawToken,
							},
						};
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.post("/tokens/:tokenId/revoke", async ({ params, set }) => {
					try {
						const data = await tokens.revoke(params.id, params.tokenId, "api");
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				})
				.get("/audit", async ({ params, set }) => {
					try {
						await projectService.getProjectById(params.id);
						const data = await listAuditEvents(params.id);
						return { data };
					} catch (error) {
						const mapped = mapPlatformError(error);
						set.status = mapped.status;
						return mapped.body;
					}
				}),
		);
}
