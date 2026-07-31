/**
 * Project administration service.
 *
 * Owns normalization, slug generation/collision checks, status transitions,
 * and archivedAt bookkeeping. Independent of HTTP and Elysia.
 */

import type {
	CreateProjectInput,
	Project,
	ProjectListFilters,
	ProjectStatus,
	UpdateProjectInput,
} from "@aurii/types";
import {
	validateCreateProject,
	validateProjectStatus,
	validateUpdateProject,
} from "@aurii/validation";
import {
	InvalidProjectStatusTransitionError,
	ProjectNotFoundError,
	ProjectSlugConflictError,
	ProjectValidationError,
} from "./errors";
import type { ProjectRepository } from "./repository";

/** Allowed status transitions (same-status is treated as a no-op). */
const ALLOWED_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
	active: ["active", "inactive", "archived"],
	inactive: ["inactive", "active", "archived"],
	archived: ["archived", "active"],
};

export class ProjectService {
	constructor(private readonly repo: ProjectRepository) {}

	async createProject(input: CreateProjectInput): Promise<Project> {
		const validated = validateCreateProject(input);
		if (!validated.success) {
			throw new ProjectValidationError(validated.issues);
		}

		const existing = await this.repo.findBySlug(validated.data.slug);
		if (existing) {
			throw new ProjectSlugConflictError(validated.data.slug);
		}

		return this.repo.insert({
			name: validated.data.name,
			slug: validated.data.slug,
			description: validated.data.description,
			status: "active",
			archivedAt: null,
		});
	}

	async getProjectById(id: string): Promise<Project> {
		const project = await this.repo.findById(id);
		if (!project) {
			throw new ProjectNotFoundError(id);
		}
		return project;
	}

	async getProjectBySlug(slug: string): Promise<Project> {
		const project = await this.repo.findBySlug(slug);
		if (!project) {
			throw new ProjectNotFoundError(slug);
		}
		return project;
	}

	/**
	 * List projects.
	 *
	 * Default: returns all projects (active, inactive, and archived).
	 * Pass `filters.status` to narrow the list.
	 */
	async listProjects(filters?: ProjectListFilters): Promise<Project[]> {
		if (filters?.status !== undefined) {
			const status = validateProjectStatus(filters.status);
			if (!status.success) {
				throw new ProjectValidationError(status.issues);
			}
		}
		return this.repo.list(filters);
	}

	async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
		const validated = validateUpdateProject(input);
		if (!validated.success) {
			throw new ProjectValidationError(validated.issues);
		}

		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new ProjectNotFoundError(id);
		}

		if (
			validated.data.slug !== undefined &&
			validated.data.slug !== existing.slug
		) {
			const conflict = await this.repo.findBySlug(validated.data.slug);
			if (conflict) {
				throw new ProjectSlugConflictError(validated.data.slug);
			}
		}

		const updated = await this.repo.update(id, {
			...validated.data,
			updatedAt: new Date().toISOString(),
		});
		if (!updated) {
			throw new ProjectNotFoundError(id);
		}
		return updated;
	}

	async setProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
		const validated = validateProjectStatus(status);
		if (!validated.success) {
			throw new ProjectValidationError(validated.issues);
		}

		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new ProjectNotFoundError(id);
		}

		const next = validated.data;
		if (!ALLOWED_TRANSITIONS[existing.status].includes(next)) {
			throw new InvalidProjectStatusTransitionError(existing.status, next);
		}

		if (existing.status === next) {
			return existing;
		}

		const now = new Date().toISOString();
		let archivedAt: string | null = existing.archivedAt;

		if (next === "archived") {
			archivedAt = now;
		} else if (existing.status === "archived" && next === "active") {
			archivedAt = null;
		}

		const updated = await this.repo.update(id, {
			status: next,
			archivedAt,
			updatedAt: now,
		});
		if (!updated) {
			throw new ProjectNotFoundError(id);
		}
		return updated;
	}

	/** Explicit archive operation (equivalent to setProjectStatus(..., "archived")). */
	async archiveProject(id: string): Promise<Project> {
		return this.setProjectStatus(id, "archived");
	}
}

export function createProjectService(repo: ProjectRepository): ProjectService {
	return new ProjectService(repo);
}
