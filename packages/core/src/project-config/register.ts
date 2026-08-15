/**
 * Shared project-package registration.
 *
 * One code path for CLI scripts and tests: load `aurii.config.ts`, materialize
 * source/import/route payloads, then bind them into Core (HTTP or in-process).
 *
 * This is not a Product Runtime. Product composition stays in `product.yaml`.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
	CreateDataSourceInput,
	CreateSavedImportInput,
	DataSourceKind,
	ImportTriggerMode,
	PublishedRouteDefinition,
	SavedImportStatus,
	ScheduleState,
	UpsertPublishedRouteInput,
} from "@aurii/types";
import type { DataSourceService } from "../platform/data-source-service";
import type { PublishedRouteService } from "../platform/published-route-service";
import type { SavedImportService } from "../platform/saved-import-service";
import { loadProjectPackage, type LoadedProjectPackage } from "./load";

export interface ProjectPackageSourceDef {
	id: string;
	name: string;
	kind: DataSourceKind;
	datasetId?: string;
	config?: CreateDataSourceInput["config"];
}

export interface ProjectPackageImportDef {
	id: string;
	name: string;
	schemaId: string;
	datasetId?: string;
	sourceId?: string;
	definitionPath: string;
	triggerMode?: ImportTriggerMode;
	status?: SavedImportStatus;
	schedule?: {
		enabled: boolean;
		spec: ScheduleState["spec"];
	} | null;
}

export interface MaterializedSource {
	id: string;
	payload: CreateDataSourceInput;
}

export interface MaterializedImport {
	id: string;
	payload: CreateSavedImportInput;
}

export interface MaterializedRoute {
	id: string;
	payload: UpsertPublishedRouteInput;
}

export interface MaterializedProjectPackage {
	pkg: LoadedProjectPackage;
	datasetId: string;
	projectSlug: string;
	sources: MaterializedSource[];
	imports: MaterializedImport[];
	routes: MaterializedRoute[];
}

export type RegisterOutcome = "created" | "exists" | "upserted" | "failed";

export interface RegisterEvent {
	kind: "source" | "import" | "route" | "project";
	id: string;
	outcome: RegisterOutcome | "ok";
	status?: number;
	error?: string;
}

export interface RegisterProjectPackageResult {
	project: { id: string; slug: string };
	datasetId: string;
	packageId: string;
	events: RegisterEvent[];
}

export interface RegisterProjectPackageOptions {
	/** Package root or path to `aurii.config.ts`. Required unless `pkg` is set. */
	root?: string;
	pkg?: LoadedProjectPackage;
	coreUrl: string;
	token?: string;
	/** Used when the Core Project must be created. */
	project?: {
		name?: string;
		description?: string;
		slug?: string;
	};
	fetch?: typeof globalThis.fetch;
	onEvent?: (event: RegisterEvent) => void;
}

export interface ApplyProjectPackageOptions {
	pkg?: LoadedProjectPackage;
	root?: string;
	projectId: string;
	sources: DataSourceService;
	imports: SavedImportService;
	routes: PublishedRouteService;
	/**
	 * When false, route upsert failures (missing schema, etc.) are reported
	 * instead of thrown. Sources and imports still fail closed.
	 */
	strictRoutes?: boolean;
	onEvent?: (event: RegisterEvent) => void;
}

function defaultDataset(pkg: LoadedProjectPackage): string {
	return pkg.config.core.defaultDataset;
}

async function importDefault<T>(absPath: string): Promise<T> {
	const mod = (await import(pathToFileURL(absPath).href)) as {
		default?: T;
	};
	if (!mod.default) {
		throw new Error(`Module ${absPath} is missing a default export`);
	}
	return mod.default;
}

function isConflict(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const status = "status" in error ? (error as { status?: unknown }).status : undefined;
	const code = "code" in error ? (error as { code?: unknown }).code : undefined;
	return status === 409 || code === "conflict";
}

/**
 * Resolve source, saved-import, and route payloads from a loaded package.
 */
export async function materializeProjectPackage(
	pkg: LoadedProjectPackage,
): Promise<MaterializedProjectPackage> {
	const datasetId = defaultDataset(pkg);
	const sources: MaterializedSource[] = [];
	for (const sp of pkg.sourcePaths) {
		const def = await importDefault<ProjectPackageSourceDef>(sp);
		sources.push({
			id: def.id,
			payload: {
				id: def.id,
				datasetId: def.datasetId ?? datasetId,
				name: def.name,
				kind: def.kind,
				config: def.config,
			},
		});
	}

	const imports: MaterializedImport[] = [];
	for (const ip of [...pkg.importPaths, ...pkg.syncPaths]) {
		const def = await importDefault<ProjectPackageImportDef>(ip);
		imports.push({
			id: def.id,
			payload: {
				id: def.id,
				datasetId: def.datasetId ?? datasetId,
				sourceId: def.sourceId,
				name: def.name,
				schemaId: def.schemaId,
				status: def.status ?? "active",
				triggerMode: def.triggerMode,
				definitionPath: resolve(pkg.root, def.definitionPath),
				schedule: def.schedule
					? {
							enabled: def.schedule.enabled,
							spec: def.schedule.spec,
							nextRunAt: null,
							lastRunAt: null,
						}
					: null,
			},
		});
	}

	const routes: MaterializedRoute[] = pkg.routes.map((route: PublishedRouteDefinition) => ({
		id: route.id,
		payload: {
			routeId: route.id,
			datasetId,
			definition: route,
			enabled: route.defaults?.enabled ?? false,
			access: route.defaults?.access ?? "public",
			cacheTtl: route.defaults?.cacheTtl ?? 3600,
			version: route.version ?? "1",
		},
	}));

	return {
		pkg,
		datasetId,
		projectSlug: pkg.config.core.projectSlug,
		sources,
		imports,
		routes,
	};
}

async function resolvePackage(
	options: Pick<RegisterProjectPackageOptions, "root" | "pkg">,
): Promise<LoadedProjectPackage> {
	if (options.pkg) return options.pkg;
	if (!options.root) {
		throw new Error("registerProjectPackage requires `root` or `pkg`");
	}
	return loadProjectPackage(options.root);
}

/**
 * Register package sources, saved imports/sync, and published routes
 * against a running Core HTTP API. Idempotent: existing ids are kept.
 */
export async function registerProjectPackage(
	options: RegisterProjectPackageOptions,
): Promise<RegisterProjectPackageResult> {
	const pkg = await resolvePackage(options);
	const materialized = await materializeProjectPackage(pkg);
	const coreUrl = options.coreUrl.replace(/\/$/, "");
	const fetchFn = options.fetch ?? globalThis.fetch;
	const events: RegisterEvent[] = [];

	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

	const api = async <T>(
		path: string,
		init?: RequestInit,
	): Promise<{ status: number; body: T }> => {
		const res = await fetchFn(`${coreUrl}${path}`, {
			...init,
			headers: { ...headers, ...(init?.headers ?? {}) },
		});
		const body = (await res.json().catch(() => ({}))) as T;
		return { status: res.status, body };
	};

	const emit = (event: RegisterEvent) => {
		events.push(event);
		options.onEvent?.(event);
	};

	const slug = options.project?.slug ?? materialized.projectSlug;
	const list = await api<{ data?: Array<{ id: string; slug: string }> }>(
		"/api/projects",
	);
	let project = list.body.data?.find((p) => p.slug === slug);
	if (!project) {
		const created = await api<{ data: { id: string; slug: string } }>(
			"/api/projects",
			{
				method: "POST",
				body: JSON.stringify({
					name: options.project?.name ?? pkg.config.title,
					slug,
					description:
						options.project?.description ?? pkg.config.description ?? "",
				}),
			},
		);
		if (created.status !== 201 && created.status !== 200) {
			throw new Error(
				`Failed to create project: ${created.status} ${JSON.stringify(created.body)}`,
			);
		}
		project = created.body.data;
		emit({ kind: "project", id: project.slug, outcome: "created", status: created.status });
	} else {
		emit({ kind: "project", id: project.slug, outcome: "exists" });
	}

	for (const source of materialized.sources) {
		const res = await api(`/api/projects/${project.id}/sources`, {
			method: "POST",
			body: JSON.stringify(source.payload),
		});
		const outcome: RegisterOutcome =
			res.status === 201 ? "created" : res.status === 409 ? "exists" : "created";
		if (res.status !== 201 && res.status !== 409) {
			throw new Error(
				`Failed to register source ${source.id}: ${res.status} ${JSON.stringify(res.body)}`,
			);
		}
		emit({ kind: "source", id: source.id, outcome, status: res.status });
	}

	for (const imp of materialized.imports) {
		const res = await api(`/api/projects/${project.id}/saved-imports`, {
			method: "POST",
			body: JSON.stringify(imp.payload),
		});
		const outcome: RegisterOutcome =
			res.status === 201 ? "created" : res.status === 409 ? "exists" : "created";
		if (res.status !== 201 && res.status !== 409) {
			throw new Error(
				`Failed to register import ${imp.id}: ${res.status} ${JSON.stringify(res.body)}`,
			);
		}
		emit({ kind: "import", id: imp.id, outcome, status: res.status });
	}

	for (const route of materialized.routes) {
		const res = await api(`/api/projects/${project.id}/routes`, {
			method: "POST",
			body: JSON.stringify(route.payload),
		});
		if (res.status !== 201 && res.status !== 200) {
			throw new Error(
				`Failed to register route ${route.id}: ${res.status} ${JSON.stringify(res.body)}`,
			);
		}
		emit({
			kind: "route",
			id: route.id,
			outcome: "upserted",
			status: res.status,
		});
	}

	return {
		project,
		datasetId: materialized.datasetId,
		packageId: pkg.config.id,
		events,
	};
}

/**
 * Bind a project package into in-process platform services (CI / bootstrap).
 * Idempotent: existing source/import ids are kept.
 */
export async function applyProjectPackage(
	options: ApplyProjectPackageOptions,
): Promise<RegisterProjectPackageResult> {
	const pkg = await resolvePackage(options);
	const materialized = await materializeProjectPackage(pkg);
	const events: RegisterEvent[] = [];
	const emit = (event: RegisterEvent) => {
		events.push(event);
		options.onEvent?.(event);
	};

	for (const source of materialized.sources) {
		try {
			await options.sources.create(options.projectId, source.payload);
			emit({ kind: "source", id: source.id, outcome: "created" });
		} catch (error) {
			if (!isConflict(error)) throw error;
			emit({ kind: "source", id: source.id, outcome: "exists" });
		}
	}

	for (const imp of materialized.imports) {
		try {
			await options.imports.create(options.projectId, imp.payload);
			emit({ kind: "import", id: imp.id, outcome: "created" });
		} catch (error) {
			if (!isConflict(error)) throw error;
			emit({ kind: "import", id: imp.id, outcome: "exists" });
		}
	}

	for (const route of materialized.routes) {
		try {
			await options.routes.upsert(options.projectId, route.payload);
			emit({ kind: "route", id: route.id, outcome: "upserted" });
		} catch (error) {
			if (options.strictRoutes !== false) throw error;
			emit({
				kind: "route",
				id: route.id,
				outcome: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		project: { id: options.projectId, slug: materialized.projectSlug },
		datasetId: materialized.datasetId,
		packageId: pkg.config.id,
		events,
	};
}
