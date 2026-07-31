/**
 * Aurii SDK Client.
 *
 * Provides a typed interface over the Aurii Core HTTP API.
 * Studio, CLI tools, external applications and AI agents should use this
 * client instead of constructing raw HTTP requests.
 */

import type {
	AnalyzeResponse,
	ApiEnvelope,
	AuriiClientConfig,
	Dataset,
	DatasetInput,
	Entity,
	EntityPage,
	HealthResponse,
	ImportResult,
	ImportRunRecord,
	ImportRunRequest,
	Project,
	QueryResult,
	PlanExplanation,
	SchemaDefinition,
	StorageStats,
	StoredSchema,
	UpdateDatasetInput,
} from "./types";
import { AuriiError } from "./types";

// ── HTTP Transport ────────────────────────────────────────────────────────────

async function request<T>(
	baseUrl: string,
	path: string,
	token: string | undefined,
	init: RequestInit = {},
): Promise<T> {
	const headers: Record<string, string> = {};

	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	const body = init.body;
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${baseUrl}${path}`, {
		...init,
		headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
	});

	if (!res.ok) {
		let message = `Request failed: ${res.status}`;
		try {
			const err = (await res.json()) as { error?: string };
			if (err.error) message = err.error;
		} catch {
			// ignore JSON parse failure
		}
		throw new AuriiError(message, res.status);
	}

	return res.json() as Promise<T>;
}

// ── Dataset API (deprecated — Legacy project only) ────────────────────────────

/**
 * @deprecated Prefer `client.projects.byId(projectId).datasets`.
 * These methods call the global `/datasets` routes which are scoped to the
 * Legacy fallback project and do not accept cross-project access.
 */
function buildDatasetsApi(baseUrl: string, token: string | undefined) {
	return {
		/** @deprecated Use `client.projects.byId(projectId).datasets.list()`. */
		list(): Promise<Dataset[]> {
			return request(baseUrl, "/datasets", token);
		},
		/** @deprecated Use `client.projects.byId(projectId).datasets.create()`. */
		create(input: DatasetInput): Promise<Dataset> {
			return request(baseUrl, "/datasets", token, {
				method: "POST",
				body: JSON.stringify(input),
			});
		},
	};
}

// ── Project-scoped Dataset API ────────────────────────────────────────────────

function buildProjectDatasetsApi(
	baseUrl: string,
	token: string | undefined,
	projectId: string,
) {
	const root = `/api/projects/${encodeURIComponent(projectId)}/datasets`;
	return {
		async list(): Promise<Dataset[]> {
			const res = await request<ApiEnvelope<Dataset[]>>(
				baseUrl,
				root,
				token,
			);
			return res.data;
		},
		async get(datasetId: string): Promise<Dataset> {
			const res = await request<ApiEnvelope<Dataset>>(
				baseUrl,
				`${root}/${encodeURIComponent(datasetId)}`,
				token,
			);
			return res.data;
		},
		async create(input: DatasetInput): Promise<Dataset> {
			const res = await request<ApiEnvelope<Dataset>>(baseUrl, root, token, {
				method: "POST",
				body: JSON.stringify(input),
			});
			return res.data;
		},
		async update(
			datasetId: string,
			input: UpdateDatasetInput,
		): Promise<Dataset> {
			const res = await request<ApiEnvelope<Dataset>>(
				baseUrl,
				`${root}/${encodeURIComponent(datasetId)}`,
				token,
				{ method: "PATCH", body: JSON.stringify(input) },
			);
			return res.data;
		},
	};
}

function buildProjectsApi(baseUrl: string, token: string | undefined) {
	return {
		async list(status?: Project["status"]): Promise<Project[]> {
			const qs = status ? `?status=${encodeURIComponent(status)}` : "";
			const res = await request<ApiEnvelope<Project[]>>(
				baseUrl,
				`/api/projects${qs}`,
				token,
			);
			return res.data;
		},
		async get(id: string): Promise<Project> {
			const res = await request<ApiEnvelope<Project>>(
				baseUrl,
				`/api/projects/${encodeURIComponent(id)}`,
				token,
			);
			return res.data;
		},
		byId(projectId: string) {
			return {
				datasets: buildProjectDatasetsApi(baseUrl, token, projectId),
			};
		},
	};
}

// ── Schema API ────────────────────────────────────────────────────────────────

function buildSchemasApi(
	baseUrl: string,
	token: string | undefined,
	defaultDataset: string,
) {
	return {
		list(dataset?: string): Promise<StoredSchema[]> {
			const ds = dataset ?? defaultDataset;
			return request(baseUrl, `/schemas?dataset=${encodeURIComponent(ds)}`, token);
		},
		get(id: string, dataset?: string): Promise<StoredSchema> {
			const ds = dataset ?? defaultDataset;
			return request(
				baseUrl,
				`/schemas/${encodeURIComponent(id)}?dataset=${encodeURIComponent(ds)}`,
				token,
			);
		},
		create(definition: SchemaDefinition, dataset?: string): Promise<StoredSchema> {
			const ds = dataset ?? defaultDataset;
			return request(
				baseUrl,
				`/schemas?dataset=${encodeURIComponent(ds)}`,
				token,
				{ method: "POST", body: JSON.stringify(definition) },
			);
		},
	};
}

// ── Entity API ────────────────────────────────────────────────────────────────

function buildEntitiesApi(
	baseUrl: string,
	token: string | undefined,
	defaultDataset: string,
) {
	return {
		list(
			schemaId: string,
			options: { dataset?: string; limit?: number; offset?: number } = {},
		): Promise<EntityPage> {
			const ds = options.dataset ?? defaultDataset;
			const params = new URLSearchParams({
				schema: schemaId,
				dataset: ds,
				limit: String(options.limit ?? 50),
				offset: String(options.offset ?? 0),
			});
			return request(baseUrl, `/entities?${params}`, token);
		},
		get(id: string): Promise<Entity> {
			return request(baseUrl, `/entities/${encodeURIComponent(id)}`, token);
		},
	};
}

// ── Query API ─────────────────────────────────────────────────────────────────

function buildQueryApi(
	baseUrl: string,
	token: string | undefined,
	defaultDataset: string,
) {
	return {
		run(q: string, dataset?: string, options?: { explain?: boolean }): Promise<QueryResult> {
			const ds = dataset ?? defaultDataset;
			const params = new URLSearchParams({ q, dataset: ds });
			if (options?.explain) params.set("explain", "true");
			return request(baseUrl, `/query?${params}`, token);
		},
		explain(q: string): Promise<PlanExplanation> {
			const params = new URLSearchParams({ q });
			return request(baseUrl, `/query/explain?${params}`, token);
		},
	};
}

// ── Import API ────────────────────────────────────────────────────────────────

function buildImportApi(
	baseUrl: string,
	token: string | undefined,
	defaultDataset: string,
) {
	return {
		analyze(file: File | Blob, filename?: string): Promise<AnalyzeResponse> {
			const form = new FormData();
			form.append("file", file, filename);
			return request(baseUrl, "/import/analyze", token, {
				method: "POST",
				body: form,
			});
		},
		run(req: ImportRunRequest): Promise<ImportResult> {
			const body: ImportRunRequest = {
				...req,
				datasetId: req.datasetId ?? defaultDataset,
			};
			return request(baseUrl, "/import/run", token, {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		history(options: { dataset?: string; limit?: number } = {}): Promise<ImportRunRecord[]> {
			const ds = options.dataset ?? defaultDataset;
			const params = new URLSearchParams({
				dataset: ds,
				limit: String(options.limit ?? 20),
			});
			return request(baseUrl, `/imports?${params}`, token);
		},
	};
}

// ── Stats API ─────────────────────────────────────────────────────────────────

function buildStatsApi(
	baseUrl: string,
	token: string | undefined,
	defaultDataset: string,
) {
	return {
		get(dataset?: string): Promise<StorageStats> {
			const ds = dataset ?? defaultDataset;
			return request(baseUrl, `/stats?dataset=${encodeURIComponent(ds)}`, token);
		},
	};
}

// ── Health API ────────────────────────────────────────────────────────────────

function buildHealthApi(baseUrl: string) {
	return {
		check(): Promise<HealthResponse> {
			return fetch(`${baseUrl}/health`).then(
				(res) => res.json() as Promise<HealthResponse>,
			);
		},
	};
}

// ── AuriiClient ───────────────────────────────────────────────────────────────

/**
 * The primary entry point for the Aurii SDK.
 *
 * @example
 * ```ts
 * import { createClient } from "@aurii/sdk";
 *
 * const client = createClient({ baseUrl: "http://localhost:3000", token: "..." });
 *
 * const datasets = await client.projects.byId(projectId).datasets.list();
 * const schemas  = await client.schemas.list();
 * const result   = await client.query.run("FROM article WHERE state = active LIMIT 10");
 * ```
 */
export class AuriiClient {
	/**
	 * @deprecated Prefer `projects.byId(projectId).datasets`.
	 * Global dataset methods are Legacy-project-scoped.
	 */
	readonly datasets: ReturnType<typeof buildDatasetsApi>;
	readonly projects: ReturnType<typeof buildProjectsApi>;
	readonly schemas: ReturnType<typeof buildSchemasApi>;
	readonly entities: ReturnType<typeof buildEntitiesApi>;
	readonly query: ReturnType<typeof buildQueryApi>;
	readonly import: ReturnType<typeof buildImportApi>;
	readonly stats: ReturnType<typeof buildStatsApi>;
	readonly health: ReturnType<typeof buildHealthApi>;

	constructor(private readonly config: AuriiClientConfig) {
		const { baseUrl, token } = config;
		const defaultDataset = config.defaultDataset ?? "default";

		this.datasets = buildDatasetsApi(baseUrl, token);
		this.projects = buildProjectsApi(baseUrl, token);
		this.schemas = buildSchemasApi(baseUrl, token, defaultDataset);
		this.entities = buildEntitiesApi(baseUrl, token, defaultDataset);
		this.query = buildQueryApi(baseUrl, token, defaultDataset);
		this.import = buildImportApi(baseUrl, token, defaultDataset);
		this.stats = buildStatsApi(baseUrl, token, defaultDataset);
		this.health = buildHealthApi(baseUrl);
	}
}

/**
 * Create a new Aurii SDK client.
 */
export function createClient(config: AuriiClientConfig): AuriiClient {
	return new AuriiClient(config);
}
