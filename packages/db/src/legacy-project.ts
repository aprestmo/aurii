/**
 * Legacy fallback project — single source of truth for migration backfill.
 *
 * Existing `aurii_datasets` rows without a project are assigned here.
 * Re-running migrations or ensureLegacyProject is idempotent.
 */

import {
	LEGACY_PROJECT_ID,
	LEGACY_PROJECT_SLUG,
} from "@aurii/types";

export { LEGACY_PROJECT_ID, LEGACY_PROJECT_SLUG };

export const LEGACY_PROJECT = {
	id: LEGACY_PROJECT_ID,
	name: "Legacy",
	slug: LEGACY_PROJECT_SLUG,
	description:
		"Fallback project for datasets that existed before project scoping. Reclassify datasets into real projects when ready.",
	status: "active" as const,
};
