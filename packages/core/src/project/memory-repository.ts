/**
 * In-memory project repository for unit tests.
 */

import type { Project, ProjectListFilters } from "@aurii/types";
import type {
	ProjectInsert,
	ProjectPatch,
	ProjectRepository,
} from "./repository";

function clone(project: Project): Project {
	return { ...project };
}

export class MemoryProjectRepository implements ProjectRepository {
	private readonly byId = new Map<string, Project>();

	async insert(data: ProjectInsert): Promise<Project> {
		const now = new Date().toISOString();
		const project: Project = {
			id: data.id ?? crypto.randomUUID(),
			name: data.name,
			slug: data.slug,
			description: data.description,
			status: data.status,
			createdAt: now,
			updatedAt: now,
			archivedAt: data.archivedAt,
		};
		this.byId.set(project.id, project);
		return clone(project);
	}

	async findById(id: string): Promise<Project | null> {
		const project = this.byId.get(id);
		return project ? clone(project) : null;
	}

	async findBySlug(slug: string): Promise<Project | null> {
		for (const project of this.byId.values()) {
			if (project.slug === slug) return clone(project);
		}
		return null;
	}

	async list(filters?: ProjectListFilters): Promise<Project[]> {
		let items = [...this.byId.values()];
		if (filters?.status) {
			items = items.filter((p) => p.status === filters.status);
		}
		items.sort((a, b) => a.name.localeCompare(b.name));
		return items.map(clone);
	}

	async update(id: string, patch: ProjectPatch): Promise<Project | null> {
		const existing = this.byId.get(id);
		if (!existing) return null;
		const next: Project = {
			...existing,
			updatedAt: patch.updatedAt,
		};
		if (patch.name !== undefined) next.name = patch.name;
		if (patch.slug !== undefined) next.slug = patch.slug;
		if (patch.description !== undefined) next.description = patch.description;
		if (patch.status !== undefined) next.status = patch.status;
		if (patch.archivedAt !== undefined) next.archivedAt = patch.archivedAt;
		this.byId.set(id, next);
		return clone(next);
	}
}
