/**
 * Idempotently ensure the Legacy fallback project exists.
 *
 * Used by seeds, tests, and administrative tooling. The stable UUID lives in
 * `@aurii/types` (LEGACY_PROJECT_ID) — do not invent a second id.
 */

import {
	LEGACY_PROJECT_ID,
	LEGACY_PROJECT_SLUG,
	type Project,
} from "@aurii/types";
import type { ProjectRepository } from "./repository";

export async function ensureLegacyProject(
	repo: ProjectRepository,
): Promise<Project> {
	const bySlug = await repo.findBySlug(LEGACY_PROJECT_SLUG);
	if (bySlug) return bySlug;

	const byId = await repo.findById(LEGACY_PROJECT_ID);
	if (byId) return byId;

	return repo.insert({
		id: LEGACY_PROJECT_ID,
		name: "Legacy",
		slug: LEGACY_PROJECT_SLUG,
		description:
			"Fallback project for datasets that existed before project scoping. Reclassify datasets into real projects when ready.",
		status: "active",
		archivedAt: null,
	});
}
