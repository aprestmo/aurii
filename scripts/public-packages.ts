/**
 * Public Aurii packages that external products may consume.
 *
 * Experimental 0.x distribution — no marketplace, no license tiers.
 * Workspace protocol stays in the monorepo; pack/publish rewrites it.
 */

export interface PublicPackage {
	name: string;
	dir: string;
	/** Extra paths included in the packed artifact (relative to package root). */
	extraFiles?: string[];
}

/** Smallest surface a product frontend needs. */
export const PRODUCT_CLIENT_PACKAGES = ["@aurii/sdk"] as const;

/** Project-package / bootstrap tooling (not imported by product UIs). */
export const PROJECT_PACKAGE_PACKAGES = [
	"@aurii/core",
	"@aurii/studio",
] as const;

/** Transitive runtime packages required by Core / Studio. */
export const SUPPORTING_PACKAGES = [
	"@aurii/types",
	"@aurii/validation",
	"@aurii/db",
] as const;

/** Pack/publish order: leaves first so tarball versions resolve. */
export const PUBLIC_PACKAGES: PublicPackage[] = [
	{ name: "@aurii/types", dir: "packages/types" },
	{ name: "@aurii/validation", dir: "packages/validation" },
	{ name: "@aurii/db", dir: "packages/db", extraFiles: ["scripts"] },
	{ name: "@aurii/core", dir: "packages/core", extraFiles: ["examples"] },
	{ name: "@aurii/sdk", dir: "packages/sdk" },
	{ name: "@aurii/studio", dir: "packages/studio" },
];

export const REPO_URL = "https://github.com/aprestmo/aurii.git";
