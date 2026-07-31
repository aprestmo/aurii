/**
 * Idempotent project seed data.
 *
 * Safe to run repeatedly — upserts by slug, never creates duplicates.
 */

import { eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { projects } from "../src/schema/projects";

const SEED_PROJECTS = [
	{
		name: "Norge Data",
		slug: "norge-data",
		description:
			"Norwegian reference geodata — counties, municipalities, postal codes, and related modules.",
	},
	{
		name: "Valgdata",
		slug: "valgdata",
		description: "Offisielle og bearbeidede norske valgdata.",
	},
	{
		name: "News CMS",
		slug: "news-cms",
		description:
			"Editorial content project for articles that may reference data in other Aurii projects.",
	},
] as const;

async function main() {
	const db = createDb();

	for (const seed of SEED_PROJECTS) {
		const existing = await db
			.select()
			.from(projects)
			.where(eq(projects.slug, seed.slug))
			.limit(1);

		if (existing[0]) {
			await db
				.update(projects)
				.set({
					name: seed.name,
					description: seed.description,
					updatedAt: new Date(),
				})
				.where(eq(projects.slug, seed.slug));
			console.log(`update ${seed.slug}`);
		} else {
			await db.insert(projects).values({
				name: seed.name,
				slug: seed.slug,
				description: seed.description,
				status: "active",
			});
			console.log(`insert ${seed.slug}`);
		}
	}

	await db.$close();
	console.log("Seed complete.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
