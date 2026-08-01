/**
 * Custom Studio view descriptor for Norwegian Geo coverage.
 * The Studio app loads this metadata; data is fetched via SDK in the page.
 * No direct database access. No Core domain logic.
 */
export const coverageView = {
	id: "coverage",
	title: "Datadekning",
	schemas: ["county", "municipality", "postal-code"],
	description:
		"Shows entity counts and reminds operators that coverage stats come from Core /stats.",
};

export default coverageView;
