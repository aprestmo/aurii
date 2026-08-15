/**
 * Pure formatting helpers for Studio ops pages (sources, imports, runs).
 * No secrets; no Core imports.
 */

export function formatErrorItem(error: unknown): string {
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		if ("message" in error && error.message != null) {
			const row =
				"row" in error && error.row != null ? `row ${String(error.row)}: ` : "";
			return `${row}${String(error.message)}`;
		}
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}

export function formatErrorList(errors: unknown[] | undefined): string[] {
	if (!errors?.length) return [];
	return errors.map(formatErrorItem);
}

export function formatErrorPreview(
	errors: unknown[] | undefined,
	limit = 3,
): string {
	const list = formatErrorList(errors);
	if (!list.length) return "";
	const shown = list.slice(0, limit);
	const extra = list.length > limit ? ` (+${list.length - limit} more)` : "";
	return shown.join("; ") + extra;
}

export function linkedDefinitionIds(
	source: {
		id: string;
		config?: { definitionIds?: string[] };
	},
	savedImports: Array<{ id: string; sourceId?: string | null }>,
): string[] {
	const fromConfig = source.config?.definitionIds ?? [];
	const fromImports = savedImports
		.filter((d) => d.sourceId === source.id)
		.map((d) => d.id);
	return [...new Set([...fromConfig, ...fromImports])];
}

export type StudioOpsConfig = {
	importGroups: Array<{ title: string; ids: string[] }>;
	routeGroups: Array<{ title: string; ids: string[] }>;
	featuredSchemas: string[];
	collectionColumns: Record<string, string[]>;
};

export function emptyStudioOpsConfig(): StudioOpsConfig {
	return {
		importGroups: [],
		routeGroups: [],
		featuredSchemas: [],
		collectionColumns: {},
	};
}

export function pickEntityColumns(
	data: Record<string, unknown>,
	featured?: string[],
	fallbackLimit = 5,
): string[] {
	if (featured?.length) {
		return featured.filter((k) => k === "id" || k in data || k.endsWith("Id"));
	}
	return Object.keys(data).slice(0, fallbackLimit);
}
