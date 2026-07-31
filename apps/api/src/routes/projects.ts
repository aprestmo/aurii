/**
 * Project HTTP routes — thin adapter over ProjectService.
 *
 * Base path: /api/projects
 *
 * List default: returns all projects (active, inactive, archived).
 * Filter with ?status=active|inactive|archived.
 */

import {
	createProjectService,
	type ProjectRepository,
	type ProjectService,
} from "@aurii/core";
import type { CreateProjectInput, ProjectStatus, UpdateProjectInput } from "@aurii/types";
import { Elysia } from "elysia";
import { toApiError } from "../errors";

export interface ProjectsPluginOptions {
	/** Injected for tests; when omitted, callers must provide a service. */
	service?: ProjectService;
	repository?: ProjectRepository;
}

function resolveService(options: ProjectsPluginOptions): ProjectService {
	if (options.service) return options.service;
	if (options.repository) return createProjectService(options.repository);
	throw new Error("projectsPlugin requires service or repository");
}

export function createProjectsPlugin(options: ProjectsPluginOptions = {}) {
	const service = resolveService(options);

	return new Elysia({ name: "projects", prefix: "/api/projects" })
		.post("/", async ({ body, set }) => {
			try {
				const data = await service.createProject(
					(body ?? {}) as CreateProjectInput,
				);
				set.status = 201;
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get("/", async ({ query, set }) => {
			try {
				const status = (query as Record<string, string | undefined>)["status"] as
					| ProjectStatus
					| undefined;
				const data = await service.listProjects(
					status ? { status } : undefined,
				);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get("/by-slug/:slug", async ({ params, set }) => {
			try {
				const data = await service.getProjectBySlug(params.slug);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.get("/:id", async ({ params, set }) => {
			try {
				const data = await service.getProjectById(params.id);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.patch("/:id", async ({ params, body, set }) => {
			try {
				const data = await service.updateProject(
					params.id,
					(body ?? {}) as UpdateProjectInput,
				);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.patch("/:id/status", async ({ params, body, set }) => {
			try {
				const status = (body as { status?: ProjectStatus } | null)?.status;
				const data = await service.setProjectStatus(
					params.id,
					status as ProjectStatus,
				);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		})
		.post("/:id/archive", async ({ params, set }) => {
			try {
				const data = await service.archiveProject(params.id);
				return { data };
			} catch (error) {
				const mapped = toApiError(error);
				set.status = mapped.status;
				return mapped.body;
			}
		});
}
