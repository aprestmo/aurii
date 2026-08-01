/**
 * Declarative Aurii project package configuration (`aurii.config.ts`).
 *
 * A project package describes schemas, sources, imports, routes, and Studio
 * config as files. It links to a Core Project by slug. It is not a Product
 * Runtime and does not replace product.yaml conventions — see ADR-0014.
 */

export const PROJECT_CONFIG_VERSION = 1 as const;

export interface ProjectCoreLink {
	/** Core project slug to bind to (e.g. norge-data). */
	projectSlug: string;
	/** Default dataset id within that project. */
	defaultDataset: string;
}

export interface AuriiProjectConfig {
	/** Config schema version. */
	version: typeof PROJECT_CONFIG_VERSION;
	/** Stable project package id (often matches product id). */
	id: string;
	title: string;
	description?: string;
	core: ProjectCoreLink;
	/** Relative paths to schema files. */
	schemas?: string[];
	/** Relative paths to data source definition files. */
	sources?: string[];
	/** Relative paths to saved import definition files. */
	imports?: string[];
	/** Relative paths to sync definition files. */
	sync?: string[];
	/** Relative paths to published route definition files. */
	routes?: string[];
	/** Relative path to studio.config.ts. */
	studio?: string;
}

export type AuriiProjectConfigInput = Omit<AuriiProjectConfig, "version"> & {
	version?: number;
};
