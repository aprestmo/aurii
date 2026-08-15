/**
 * Pure helpers for applying defineStudio groups and collection columns.
 * Studio UI consumes these; Core does not.
 */

import type { AuriiStudioConfig } from "@aurii/types";
import { flattenNavItems } from "./resolve";

export interface StudioIdGroup {
	title: string;
	ids: string[];
}

export interface GroupedItems<T> {
	title: string;
	items: T[];
}

/**
 * Partition items by declared id groups. Ungrouped items land in "Other".
 * With no groups, all items are returned under a single untitled section.
 */
export function groupItemsByIds<T>(
	items: T[],
	groups: StudioIdGroup[] | undefined,
	getId: (item: T) => string,
): GroupedItems<T>[] {
	if (!items.length) return [];
	if (!groups?.length) {
		return [{ title: "", items: [...items] }];
	}

	const used = new Set<string>();
	const result: GroupedItems<T>[] = [];

	for (const group of groups) {
		const grouped = items.filter((item) => {
			const id = getId(item);
			return group.ids.includes(id);
		});
		for (const item of grouped) used.add(getId(item));
		if (grouped.length) {
			result.push({ title: group.title, items: grouped });
		}
	}

	const rest = items.filter((item) => !used.has(getId(item)));
	if (rest.length) {
		result.push({ title: "Other", items: rest });
	}
	return result;
}

export function importGroupsFromConfig(
	config: Pick<AuriiStudioConfig, "importGroups">,
): StudioIdGroup[] {
	return (config.importGroups ?? []).map((g) => ({
		title: g.title,
		ids: g.definitionIds,
	}));
}

export function routeGroupsFromConfig(
	config: Pick<AuriiStudioConfig, "routeGroups">,
): StudioIdGroup[] {
	return (config.routeGroups ?? []).map((g) => ({
		title: g.title,
		ids: g.routeIds,
	}));
}

/** Featured / declared collection columns for a schema, if any. */
export function collectionColumns(
	config: Pick<AuriiStudioConfig, "navigation">,
	schemaId: string,
): string[] | undefined {
	for (const item of flattenNavItems(config.navigation ?? [])) {
		if (
			item.kind === "collection" &&
			item.schemaId === schemaId &&
			item.options?.columns?.length
		) {
			return item.options.columns;
		}
	}
	return undefined;
}

export function collectionColumnsBySchema(
	config: Pick<AuriiStudioConfig, "navigation">,
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const item of flattenNavItems(config.navigation ?? [])) {
		if (
			item.kind === "collection" &&
			item.schemaId &&
			item.options?.columns?.length
		) {
			out[item.schemaId] = item.options.columns;
		}
	}
	return out;
}
