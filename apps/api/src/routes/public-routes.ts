/**
 * Public published-route delivery — no Studio dependency.
 *
 * GET /public/:projectSlug/v1/*
 */

import {
	createPublishedRouteService,
	extractPathParams,
	PublishedRouteError,
	type ProjectService,
} from "@aurii/core";
import { Elysia } from "elysia";

export function createPublicRoutesPlugin(options: {
	projectService: ProjectService;
}) {
	const { projectService } = options;
	const routes = createPublishedRouteService();

	return new Elysia({ name: "public-routes" }).get(
		"/public/:projectSlug/v1/*",
		async ({ params, request, set }) => {
			try {
				const project = await projectService.getProjectBySlug(params.projectSlug);
				const wildcard =
					(params as Record<string, string>)["*"] ??
					extractWildcard(request.url, params.projectSlug);
				const path = `/${wildcard}`.replace(/\/+/g, "/");
				if (path === "/") {
					set.status = 404;
					return { error: { code: "not_found", message: "Route not found" } };
				}

				const auth = request.headers.get("authorization") ?? "";
				const authenticated = auth.startsWith("Bearer ");

				// Find matching definition for path params
				const listed = await routes.list(project.id);
				const match = listed.find((r) => {
					if (!r.enabled) return false;
					return pathMatches(r.definition.path, path);
				});
				if (!match) {
					set.status = 404;
					return { error: { code: "not_found", message: "Route not found" } };
				}

				const pathParams = extractPathParams(match.definition.path, path);
				const result = await routes.execute(project.id, path, {
					authenticated,
					pathParams,
				});
				if (!result) {
					set.status = 404;
					return { error: { code: "not_found", message: "Route not found" } };
				}

				set.headers["Cache-Control"] = `public, max-age=${result.cacheTtl}`;
				return { data: result.data, meta: { routeId: result.routeId } };
			} catch (error) {
				if (error instanceof PublishedRouteError) {
					set.status = error.status;
					return { error: { code: error.code, message: error.message } };
				}
				const message = error instanceof Error ? error.message : "Error";
				if (message.includes("not found") || message.includes("Not found")) {
					set.status = 404;
					return { error: { code: "not_found", message } };
				}
				set.status = 500;
				return { error: { code: "INTERNAL_ERROR", message } };
			}
		},
	);
}

function extractWildcard(url: string, slug: string): string {
	const u = new URL(url);
	const prefix = `/public/${slug}/v1/`;
	if (!u.pathname.startsWith(prefix)) return "";
	return u.pathname.slice(prefix.length);
}

function pathMatches(pattern: string, path: string): boolean {
	const patternParts = pattern.split("/");
	const pathParts = path.split("/");
	if (patternParts.length !== pathParts.length) return false;
	for (let i = 0; i < patternParts.length; i++) {
		const pp = patternParts[i]!;
		if (pp.startsWith(":")) continue;
		if (pp !== pathParts[i]) return false;
	}
	return true;
}
