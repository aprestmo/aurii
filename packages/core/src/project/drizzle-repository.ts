/**
 * Drizzle-backed project repository (PostgreSQL).
 */

import type { Project, ProjectListFilters, ProjectStatus } from "@aurii/types";
import { type AuriiDb, projects } from "@aurii/db";
import { asc, eq } from "drizzle-orm";
import type {
	ProjectInsert,
	ProjectPatch,
	ProjectRepository,
} from "./repository";

function toIso(value: Date | string | null): string | null {
	if (value === null) return null;
	return value instanceof Date ? value.toISOString() : value;
}

function rowToProject(row: typeof projects.$inferSelect): Project {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description ?? null,
		status: row.status as ProjectStatus,
		createdAt: toIso(row.createdAt) as string,
		updatedAt: toIso(row.updatedAt) as string,
		archivedAt: toIso(row.archivedAt),
	};
}

export class DrizzleProjectRepository implements ProjectRepository {
	constructor(private readonly db: AuriiDb) {}

	async insert(data: ProjectInsert): Promise<Project> {
		const [row] = await this.db
			.insert(projects)
			.values({
				name: data.name,
				slug: data.slug,
				description: data.description,
				status: data.status,
				archivedAt: data.archivedAt ? new Date(data.archivedAt) : null,
			})
			.returning();
		if (!row) {
			throw new Error("Failed to insert project");
		}
		return rowToProject(row);
	}

	async findById(id: string): Promise<Project | null> {
		const [row] = await this.db
			.select()
			.from(projects)
			.where(eq(projects.id, id))
			.limit(1);
		return row ? rowToProject(row) : null;
	}

	async findBySlug(slug: string): Promise<Project | null> {
		const [row] = await this.db
			.select()
			.from(projects)
			.where(eq(projects.slug, slug))
			.limit(1);
		return row ? rowToProject(row) : null;
	}

	async list(filters?: ProjectListFilters): Promise<Project[]> {
		const rows = filters?.status
			? await this.db
					.select()
					.from(projects)
					.where(eq(projects.status, filters.status))
					.orderBy(asc(projects.name))
			: await this.db
					.select()
					.from(projects)
					.orderBy(asc(projects.name));
		return rows.map(rowToProject);
	}

	async update(id: string, patch: ProjectPatch): Promise<Project | null> {
		const values: Partial<typeof projects.$inferInsert> & {
			updatedAt: Date;
		} = {
			updatedAt: new Date(patch.updatedAt),
		};
		if (patch.name !== undefined) values.name = patch.name;
		if (patch.slug !== undefined) values.slug = patch.slug;
		if (patch.description !== undefined) values.description = patch.description;
		if (patch.status !== undefined) values.status = patch.status;
		if (patch.archivedAt !== undefined) {
			values.archivedAt = patch.archivedAt
				? new Date(patch.archivedAt)
				: null;
		}

		const [row] = await this.db
			.update(projects)
			.set(values)
			.where(eq(projects.id, id))
			.returning();
		return row ? rowToProject(row) : null;
	}
}
