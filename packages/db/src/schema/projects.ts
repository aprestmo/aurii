/**
 * projects — administrative top-level boundary for Aurii resources.
 *
 * Runtime table `aurii_datasets` references `projects.id` via `project_id`
 * (see migration 0001_datasets_project_id.sql and ADR-0012). The dataset
 * table itself remains owned by Core storage adapters — do not redefine it
 * here as a second Drizzle model.
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
