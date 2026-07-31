/**
 * projects — administrative top-level boundary for Aurii resources.
 *
 * Future tables (datasets, imports, api_routes, …) will reference projectId.
 */

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectStatusEnum = [
	"active",
	"inactive",
	"archived",
] as const;

export const projects = pgTable(
	"projects",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		description: text("description"),
		status: text("status", { enum: projectStatusEnum })
			.notNull()
			.default("active"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
	},
	(table) => [
		index("projects_slug_idx").on(table.slug),
		index("projects_status_idx").on(table.status),
	],
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
