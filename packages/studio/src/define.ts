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
	const item: StudioNavItem = {
		kind: "collection",
		schemaId,
	};
	if (options?.title !== undefined) item.title = options.title;
	if (options) {
		const collectionOptions: StudioCollectionOptions = {};
		if (options.columns !== undefined) collectionOptions.columns = options.columns;
		if (options.filters !== undefined) collectionOptions.filters = options.filters;
		if (options.orderBy !== undefined) collectionOptions.orderBy = options.orderBy;
		if (options.hidden !== undefined) collectionOptions.hidden = options.hidden;
		if (options.featured !== undefined) collectionOptions.featured = options.featured;
		if (Object.keys(collectionOptions).length > 0) {
			item.options = collectionOptions;
		}
	}
	return item;
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
	const item: StudioNavItem = {
		kind: "custom",
		viewId,
		title: opts.title,
	};
	if (opts.href !== undefined) item.href = opts.href;
	else item.href = `/views/${viewId}`;
	return item;
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
