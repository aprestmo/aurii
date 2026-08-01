import type {
	AuriiStudioConfig,
	StudioCollectionOptions,
	StudioCustomView,
	StudioNavGroup,
	StudioNavItem,
} from "@aurii/types";

/**
 * Define a project-specific Studio configuration.
 * Pure data — no UI framework dependency.
 */
export function defineStudio(config: AuriiStudioConfig): AuriiStudioConfig {
	return config;
}

export function collection(
	schemaId: string,
	options?: StudioCollectionOptions & { title?: string },
): StudioNavItem {
	return {
		kind: "collection",
		schemaId,
		title: options?.title,
		options: options
			? {
					columns: options.columns,
					filters: options.filters,
					orderBy: options.orderBy,
					hidden: options.hidden,
					featured: options.featured,
				}
			: undefined,
	};
}

export function sources(title = "Sources"): StudioNavItem {
	return { kind: "sources", title, href: "/sources" };
}

export function imports(title = "Imports"): StudioNavItem {
	return { kind: "imports", title, href: "/imports" };
}

export function apiRoutes(title = "API routes"): StudioNavItem {
	return { kind: "apiRoutes", title, href: "/routes" };
}

export function queryPlayground(title = "Query"): StudioNavItem {
	return { kind: "query", title, href: "/query" };
}

export function schemasNav(title = "Schemas"): StudioNavItem {
	return { kind: "schemas", title, href: "/schemas" };
}

export function dashboard(title = "Overview"): StudioNavItem {
	return { kind: "dashboard", title, href: "/" };
}

export function systemStatus(title = "System"): StudioNavItem {
	return { kind: "system", title, href: "/system" };
}

export function customView(
	viewId: string,
	opts: { title: string; href?: string },
): StudioNavItem {
	return {
		kind: "custom",
		viewId,
		title: opts.title,
		href: opts.href ?? `/views/${viewId}`,
	};
}

export function view(def: StudioCustomView): StudioCustomView {
	return def;
}

/** Default navigation when a project has no studio config. */
export function defaultStudioNavigation(): StudioNavGroup[] {
	return [
		{
			title: "Project",
			items: [dashboard(), schemasNav(), collection("entities", { title: "Entities" })],
		},
		{
			title: "Data intake",
			items: [sources(), imports()],
		},
		{
			title: "Delivery",
			items: [apiRoutes(), queryPlayground()],
		},
		{
			title: "Ops",
			items: [systemStatus()],
		},
	];
}

export function defaultStudioConfig(title = "Aurii Studio"): AuriiStudioConfig {
	return {
		title,
		navigation: defaultStudioNavigation(),
	};
}
