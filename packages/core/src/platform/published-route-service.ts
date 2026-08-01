import type {
	PublishedRouteDefinition,
	PublishedRouteState,
	UpdatePublishedRouteStateInput,
	UpsertPublishedRouteInput,
} from "@aurii/types";
import { validatePublishedRouteDefinition } from "@aurii/validation";
import { listEntities } from "../entity/store";
import { requireDatasetInProject, requireWritableDatasetProject } from "../project/dataset-context";
import { getSchema } from "../schema/registry";
import { getPlatformStore, type PlatformStore } from "./store";
import { appendAudit } from "./audit";

export class PublishedRouteError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "PublishedRouteError";
	}
}

export function defineRoute(
	definition: PublishedRouteDefinition,
): PublishedRouteDefinition {
	const validated = validatePublishedRouteDefinition(definition);
	if (!validated.success) {
		throw new PublishedRouteError(
			validated.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
			"validation_error",
		);
	}
	return validated.data;
}

export class PublishedRouteService {
	constructor(private readonly store: PlatformStore = getPlatformStore()) {}

	async upsert(
		projectId: string,
		input: UpsertPublishedRouteInput,
		actor = "system",
	): Promise<PublishedRouteState> {
		const validated = validatePublishedRouteDefinition(input.definition);
		if (!validated.success) {
			throw new PublishedRouteError(
				validated.issues.map((i) => i.message).join("; "),
				"validation_error",
			);
		}
		await requireWritableDatasetProject(input.datasetId, "upsert published route");
		await requireDatasetInProject(projectId, input.datasetId);

		const schema = await getSchema(validated.data.query.schema, input.datasetId);
		if (!schema) {
			throw new PublishedRouteError(
				`Schema "${validated.data.query.schema}" not found in dataset "${input.datasetId}"`,
				"validation_error",
			);
		}

		// Validate select fields exist
		if (validated.data.query.select) {
			const fieldIds = new Set(schema.fields.map((f) => f.name));
			for (const f of validated.data.query.select) {
				if (!fieldIds.has(f)) {
					throw new PublishedRouteError(
						`Unknown select field "${f}" on schema "${schema.id}"`,
						"validation_error",
					);
				}
			}
		}

		const existing = await this.store.getPublishedRoute(projectId, input.routeId);
		const now = new Date().toISOString();
		const defaults = validated.data.defaults ?? {};
		const row: PublishedRouteState = {
			routeId: input.routeId,
			projectId,
			datasetId: input.datasetId,
			enabled:
				input.enabled ?? existing?.enabled ?? defaults.enabled ?? false,
			access:
				input.access ??
				existing?.access ??
				defaults.access ??
				"private",
			cacheTtl:
				input.cacheTtl ?? existing?.cacheTtl ?? defaults.cacheTtl ?? 3600,
			version: input.version ?? existing?.version ?? validated.data.version ?? "1",
			definition: validated.data,
			lastError: existing?.lastError ?? null,
			hitCount: existing?.hitCount ?? 0,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};

		const saved = await this.store.upsertPublishedRoute(row);
		await appendAudit(this.store, {
			projectId,
			action: existing ? "route.updated" : "route.registered",
			actor,
			resourceType: "published_route",
			resourceId: input.routeId,
			detail: { enabled: saved.enabled, access: saved.access },
		});
		return saved;
	}

	async updateState(
		projectId: string,
		routeId: string,
		input: UpdatePublishedRouteStateInput,
		actor = "system",
	): Promise<PublishedRouteState> {
		const existing = await this.store.getPublishedRoute(projectId, routeId);
		if (!existing) {
			throw new PublishedRouteError(
				`Route "${routeId}" not found`,
				"not_found",
				404,
			);
		}
		const datasetId = input.datasetId ?? existing.datasetId;
		await requireWritableDatasetProject(datasetId, "update published route");
		await requireDatasetInProject(projectId, datasetId);

		if (input.enabled === true) {
			const schema = await getSchema(
				existing.definition.query.schema,
				datasetId,
			);
			if (!schema) {
				throw new PublishedRouteError(
					`Cannot enable route: schema "${existing.definition.query.schema}" missing`,
					"validation_error",
				);
			}
		}

		const now = new Date().toISOString();
		const next: PublishedRouteState = {
			...existing,
			datasetId,
			enabled: input.enabled ?? existing.enabled,
			access: input.access ?? existing.access,
			cacheTtl: input.cacheTtl ?? existing.cacheTtl,
			version: input.version ?? existing.version,
			definition: input.definition ?? existing.definition,
			lastError:
				input.lastError !== undefined ? input.lastError : existing.lastError,
			updatedAt: now,
		};
		const saved = await this.store.upsertPublishedRoute(next);

		if (input.enabled !== undefined && input.enabled !== existing.enabled) {
			await appendAudit(this.store, {
				projectId,
				action: input.enabled ? "route.enabled" : "route.disabled",
				actor,
				resourceType: "published_route",
				resourceId: routeId,
				detail: { access: saved.access },
			});
		}

		return saved;
	}

	async get(projectId: string, routeId: string): Promise<PublishedRouteState> {
		const row = await this.store.getPublishedRoute(projectId, routeId);
		if (!row) {
			throw new PublishedRouteError(`Route "${routeId}" not found`, "not_found", 404);
		}
		return row;
	}

	async list(projectId: string): Promise<PublishedRouteState[]> {
		return this.store.listPublishedRoutes(projectId);
	}

	/**
	 * Execute a published route for public delivery.
	 * Returns null if disabled / not found (caller should 404).
	 */
	async execute(
		projectId: string,
		path: string,
		options: { authenticated?: boolean; pathParams?: Record<string, string> } = {},
	): Promise<{ data: unknown[]; cacheTtl: number; routeId: string } | null> {
		const routes = await this.store.listPublishedRoutes(projectId);
		const match = matchRoute(routes, path);
		if (!match || !match.enabled) return null;

		if (match.access !== "public" && !options.authenticated) {
			throw new PublishedRouteError("Authentication required", "unauthorized", 401);
		}

		await requireDatasetInProject(projectId, match.datasetId);

		const q = match.definition.query;
		let entities = await listEntities(q.schema, match.datasetId, q.limit ?? 1000, 0);

		// Apply simple equality filters
		if (q.filter) {
			entities = entities.filter((e) => {
				for (const [key, val] of Object.entries(q.filter!)) {
					const actual = (e.data as Record<string, unknown>)[key];
					if (val === null) {
						if (actual !== null && actual !== undefined) return false;
					} else if (actual !== val) {
						return false;
					}
				}
				return true;
			});
		}

		// Path param :id filter
		if (options.pathParams?.["id"]) {
			const id = options.pathParams["id"];
			entities = entities.filter(
				(e) =>
					e.id === id || (e.data as Record<string, unknown>)["id"] === id,
			);
		}

		if (q.orderBy?.length) {
			const { field, direction } = q.orderBy[0]!;
			entities = [...entities].sort((a, b) => {
				const av = (a.data as Record<string, unknown>)[field];
				const bv = (b.data as Record<string, unknown>)[field];
				const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
				return direction === "desc" ? -cmp : cmp;
			});
		}

		let data: unknown[] = entities.map((e) => e.data);
		if (q.select?.length) {
			data = data.map((row) => {
				const r = row as Record<string, unknown>;
				const out: Record<string, unknown> = {};
				for (const f of q.select!) out[f] = r[f];
				return out;
			});
		}

		await this.store.upsertPublishedRoute({
			...match,
			hitCount: match.hitCount + 1,
			updatedAt: new Date().toISOString(),
		});

		return { data, cacheTtl: match.cacheTtl, routeId: match.routeId };
	}
}

function matchRoute(
	routes: PublishedRouteState[],
	requestPath: string,
): PublishedRouteState | null {
	const normalized = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
	for (const r of routes) {
		const pattern = r.definition.path;
		if (pattern === normalized) return r;
		// Simple :param matching
		const patternParts = pattern.split("/");
		const pathParts = normalized.split("/");
		if (patternParts.length !== pathParts.length) continue;
		let ok = true;
		for (let i = 0; i < patternParts.length; i++) {
			const pp = patternParts[i]!;
			if (pp.startsWith(":")) continue;
			if (pp !== pathParts[i]) {
				ok = false;
				break;
			}
		}
		if (ok) return r;
	}
	return null;
}

export function extractPathParams(
	pattern: string,
	requestPath: string,
): Record<string, string> {
	const params: Record<string, string> = {};
	const patternParts = pattern.split("/");
	const pathParts = requestPath.split("/");
	for (let i = 0; i < patternParts.length; i++) {
		const pp = patternParts[i]!;
		if (pp.startsWith(":")) {
			params[pp.slice(1)] = pathParts[i] ?? "";
		}
	}
	return params;
}

export function createPublishedRouteService(
	store?: PlatformStore,
): PublishedRouteService {
	return new PublishedRouteService(store ?? getPlatformStore());
}
