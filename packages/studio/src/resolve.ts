import type { AuriiStudioConfig, StudioNavGroup, StudioNavItem } from "@aurii/types";
import { defaultStudioConfig } from "./define";

export class StudioConfigError extends Error {
	readonly issues: Array<{ path: string; message: string }>;
	constructor(issues: Array<{ path: string; message: string }>) {
		super(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
		this.name = "StudioConfigError";
		this.issues = issues;
	}
}

/**
 * Resolve Studio config: use project config or fall back to generic defaults.
 * Validates that collection items reference known schemas when schemaIds provided.
 */
export function resolveStudioConfig(
	config: AuriiStudioConfig | null | undefined,
	options?: { knownSchemaIds?: string[]; projectTitle?: string },
): AuriiStudioConfig {
	const resolved =
		config ?? defaultStudioConfig(options?.projectTitle ?? "Aurii Studio");

	const issues: Array<{ path: string; message: string }> = [];
	const known = options?.knownSchemaIds
		? new Set(options.knownSchemaIds)
		: null;

	const nav = resolved.navigation ?? [];
	nav.forEach((group, gi) => {
		group.items.forEach((item, ii) => {
			if (item.kind === "collection" && item.schemaId && known) {
				if (
					item.schemaId !== "entities" &&
					!known.has(item.schemaId)
				) {
					issues.push({
						path: `navigation[${gi}].items[${ii}].schemaId`,
						message: `Unknown schema "${item.schemaId}"`,
					});
				}
			}
			if (item.kind === "custom" && !item.viewId) {
				issues.push({
					path: `navigation[${gi}].items[${ii}].viewId`,
					message: "Custom nav item requires viewId",
				});
			}
		});
	});

	if (resolved.views) {
		const ids = new Set<string>();
		for (const v of resolved.views) {
			if (ids.has(v.id)) {
				issues.push({
					path: `views.${v.id}`,
					message: `Duplicate custom view id "${v.id}"`,
				});
			}
			ids.add(v.id);
			if (!v.module) {
				issues.push({
					path: `views.${v.id}.module`,
					message: "Custom view requires module path",
				});
			}
		}
	}

	if (issues.length) throw new StudioConfigError(issues);
	return resolved;
}

export function flattenNavItems(groups: StudioNavGroup[]): StudioNavItem[] {
	return groups.flatMap((g) => g.items);
}

export function navHref(item: StudioNavItem): string {
	if (item.href) return item.href;
	switch (item.kind) {
		case "collection":
			return item.schemaId && item.schemaId !== "entities"
				? `/entities?schema=${encodeURIComponent(item.schemaId)}`
				: "/entities";
		case "sources":
			return "/sources";
		case "imports":
			return "/imports";
		case "apiRoutes":
			return "/routes";
		case "query":
			return "/query";
		case "schemas":
			return "/schemas";
		case "dashboard":
			return "/";
		case "system":
			return "/system";
		case "custom":
			return `/views/${item.viewId ?? ""}`;
		default:
			return "/";
	}
}

export function navLabel(item: StudioNavItem): string {
	if (item.title) return item.title;
	if (item.kind === "collection") return item.schemaId ?? "Collection";
	return item.kind;
}
