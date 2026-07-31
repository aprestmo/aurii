/**
 * Idempotent project seed data.
 *
 * Safe to run repeatedly — upserts by slug, never creates duplicates.
 *
 * Order:
 * 1. Ensure Legacy fallback project (for unclassified pre-migration datasets)
 * 2. Seed example projects (Norge Data, Valgdata, News CMS)
 *
 * New example data should be attached to these named projects — not Legacy.
 * Legacy is only for datasets that lack explicit classification.
 */

import { eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { LEGACY_PROJECT } from "../src/legacy-project";
import { projects } from "../src/schema/projects";

const SEED_PROJECTS = [
	{
		name: LEGACY_PROJECT.name,
		slug: LEGACY_PROJECT.slug,
		description: LEGACY_PROJECT.description,
		id: LEGACY_PROJECT.id,
	},
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
				...("id" in seed && seed.id ? { id: seed.id } : {}),
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
