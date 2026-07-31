/**
 * Persistence port for projects.
 *
 * Core depends on this interface — not on Drizzle or HTTP.
 */

import type {
	Project,
	ProjectListFilters,
	ProjectStatus,
} from "@aurii/types";

export interface ProjectInsert {
	/** Optional stable id (used for the Legacy fallback project). */
	id?: string;
	name: string;
	slug: string;
	description: string | null;
	status: ProjectStatus;
	archivedAt: string | null;
}

export interface ProjectPatch {
	name?: string;
	slug?: string;
	description?: string | null;
	status?: ProjectStatus;
	archivedAt?: string | null;
	updatedAt: string;
}

export interface ProjectRepository {
	insert(data: ProjectInsert): Promise<Project>;
	findById(id: string): Promise<Project | null>;
	findBySlug(slug: string): Promise<Project | null>;
	list(filters?: ProjectListFilters): Promise<Project[]>;
	update(id: string, patch: ProjectPatch): Promise<Project | null>;
}
