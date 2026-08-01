import type {
	CreateDataSourceInput,
	DataSource,
	UpdateDataSourceInput,
} from "@aurii/types";
import { validateCreateDataSource, redactDataSourceConfig } from "@aurii/validation";
import { requireDatasetInProject, requireWritableDatasetProject } from "../project/dataset-context";
import { getProjectService } from "../project/runtime";
import { getStorage } from "../storage";
import { getPlatformStore, type PlatformStore } from "./store";

export class DataSourceError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "DataSourceError";
	}
}

export class DataSourceService {
	constructor(private readonly store: PlatformStore = getPlatformStore()) {}

	async create(projectId: string, input: CreateDataSourceInput): Promise<DataSource> {
		const validated = validateCreateDataSource(input);
		if (!validated.success) {
			throw new DataSourceError(
				validated.issues.map((i) => i.message).join("; "),
				"validation_error",
			);
		}
		await requireWritableDatasetProject(validated.data.datasetId, "create data source");
		await requireDatasetInProject(projectId, validated.data.datasetId);

		const id = validated.data.id ?? crypto.randomUUID();
		const existing = await this.store.getDataSource(projectId, id);
		if (existing) {
			throw new DataSourceError(`DataSource "${id}" already exists`, "conflict", 409);
		}

		const now = new Date().toISOString();
		const row: DataSource = {
			id,
			projectId,
			datasetId: validated.data.datasetId,
			name: validated.data.name,
			kind: validated.data.kind,
			status: validated.data.status,
			config: validated.data.config,
			lastSuccessAt: null,
			lastFailureAt: null,
			nextRunAt: null,
			lastError: null,
			createdAt: now,
			updatedAt: now,
		};
		return this.publicView(await this.store.insertDataSource(row));
	}

	async get(projectId: string, id: string): Promise<DataSource> {
		const row = await this.store.getDataSource(projectId, id);
		if (!row) throw new DataSourceError(`DataSource "${id}" not found`, "not_found", 404);
		return this.publicView(row);
	}

	async list(projectId: string, datasetId?: string): Promise<DataSource[]> {
		await (await getProjectService()).getProjectById(projectId);
		const rows = await this.store.listDataSources(projectId, datasetId);
		return rows.map((r) => this.publicView(r));
	}

	async update(
		projectId: string,
		id: string,
		input: UpdateDataSourceInput,
	): Promise<DataSource> {
		const existing = await this.store.getDataSource(projectId, id);
		if (!existing) {
			throw new DataSourceError(`DataSource "${id}" not found`, "not_found", 404);
		}
		await requireWritableDatasetProject(existing.datasetId, "update data source");
		await requireDatasetInProject(projectId, existing.datasetId);

		const now = new Date().toISOString();
		const next: DataSource = {
			...existing,
			name: input.name ?? existing.name,
			kind: input.kind ?? existing.kind,
			status: input.status ?? existing.status,
			config: input.config ?? existing.config,
			lastSuccessAt:
				input.lastSuccessAt !== undefined
					? input.lastSuccessAt
					: existing.lastSuccessAt,
			lastFailureAt:
				input.lastFailureAt !== undefined
					? input.lastFailureAt
					: existing.lastFailureAt,
			nextRunAt: input.nextRunAt !== undefined ? input.nextRunAt : existing.nextRunAt,
			lastError: input.lastError !== undefined ? input.lastError : existing.lastError,
			updatedAt: now,
		};
		const saved = await this.store.updateDataSource(projectId, id, next);
		if (!saved) {
			throw new DataSourceError(`DataSource "${id}" not found`, "not_found", 404);
		}
		return this.publicView(saved);
	}

	/** Ensure dataset exists (read path). */
	async assertDataset(datasetId: string): Promise<void> {
		const ds = await getStorage().getDataset(datasetId);
		if (!ds) {
			throw new DataSourceError(`Dataset "${datasetId}" not found`, "not_found", 404);
		}
	}

	private publicView(row: DataSource): DataSource {
		return {
			...row,
			config: redactDataSourceConfig(row.config),
		};
	}
}

export function createDataSourceService(store?: PlatformStore): DataSourceService {
	return new DataSourceService(store ?? getPlatformStore());
}
