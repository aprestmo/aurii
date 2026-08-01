import type {
	CreateSavedImportInput,
	SavedImportDefinition,
	ScheduleState,
	UpdateSavedImportInput,
} from "@aurii/types";
import { validateScheduleSpec } from "@aurii/validation";
import { resolve } from "node:path";
import { loadImportDefinition, runImport } from "../import/engine";
import type { ImportDefinition, ImportResult } from "../import/types";
import { requireDatasetInProject, requireWritableDatasetProject } from "../project/dataset-context";
import { getPlatformStore, type PlatformStore } from "./store";
import { computeNextCronRun } from "../schedule/cron";

export class SavedImportError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "SavedImportError";
	}
}

export class SavedImportService {
	constructor(private readonly store: PlatformStore = getPlatformStore()) {}

	async create(
		projectId: string,
		input: CreateSavedImportInput,
	): Promise<SavedImportDefinition> {
		if (!input.name?.trim()) {
			throw new SavedImportError("name is required", "validation_error");
		}
		if (!input.schemaId?.trim()) {
			throw new SavedImportError("schemaId is required", "validation_error");
		}
		if (!input.datasetId?.trim()) {
			throw new SavedImportError("datasetId is required", "validation_error");
		}
		await requireWritableDatasetProject(input.datasetId, "create saved import");
		await requireDatasetInProject(projectId, input.datasetId);

		const schedule = input.schedule
			? this.normalizeSchedule(input.schedule)
			: null;

		const id = input.id ?? crypto.randomUUID();
		if (await this.store.getSavedImport(projectId, id)) {
			throw new SavedImportError(
				`Saved import "${id}" already exists`,
				"conflict",
				409,
			);
		}

		const now = new Date().toISOString();
		const row: SavedImportDefinition = {
			id,
			projectId,
			datasetId: input.datasetId,
			sourceId: input.sourceId ?? null,
			name: input.name.trim(),
			schemaId: input.schemaId.trim(),
			status: input.status ?? "active",
			triggerMode: input.triggerMode ?? "manual",
			definitionPath: input.definitionPath ?? null,
			pipeline: input.pipeline ?? null,
			filePath: input.filePath ?? null,
			fileFormat: input.fileFormat ?? null,
			schedule,
			createdAt: now,
			updatedAt: now,
		};
		return this.store.insertSavedImport(row);
	}

	async get(projectId: string, id: string): Promise<SavedImportDefinition> {
		const row = await this.store.getSavedImport(projectId, id);
		if (!row) {
			throw new SavedImportError(`Saved import "${id}" not found`, "not_found", 404);
		}
		return row;
	}

	async list(projectId: string, datasetId?: string): Promise<SavedImportDefinition[]> {
		return this.store.listSavedImports(projectId, datasetId);
	}

	async update(
		projectId: string,
		id: string,
		input: UpdateSavedImportInput,
	): Promise<SavedImportDefinition> {
		const existing = await this.get(projectId, id);
		await requireWritableDatasetProject(existing.datasetId, "update saved import");
		await requireDatasetInProject(projectId, existing.datasetId);

		const schedule =
			input.schedule !== undefined
				? input.schedule
					? this.normalizeSchedule(input.schedule)
					: null
				: existing.schedule;

		const next: SavedImportDefinition = {
			...existing,
			name: input.name ?? existing.name,
			sourceId: input.sourceId !== undefined ? input.sourceId : existing.sourceId,
			schemaId: input.schemaId ?? existing.schemaId,
			status: input.status ?? existing.status,
			triggerMode: input.triggerMode ?? existing.triggerMode,
			definitionPath:
				input.definitionPath !== undefined
					? input.definitionPath
					: existing.definitionPath,
			pipeline: input.pipeline !== undefined ? input.pipeline : existing.pipeline,
			filePath: input.filePath !== undefined ? input.filePath : existing.filePath,
			fileFormat:
				input.fileFormat !== undefined ? input.fileFormat : existing.fileFormat,
			schedule,
			updatedAt: new Date().toISOString(),
		};
		const saved = await this.store.updateSavedImport(projectId, id, next);
		if (!saved) {
			throw new SavedImportError(`Saved import "${id}" not found`, "not_found", 404);
		}
		return saved;
	}

	/**
	 * Run a saved definition (dry or persist). Uses existing import engine.
	 * Prevents overlapping runs for the same definition.
	 */
	async run(
		projectId: string,
		id: string,
		options: { dryRun?: boolean; trigger?: "user" | "schedule" | "system" } = {},
	): Promise<ImportResult & { trigger: string }> {
		const def = await this.get(projectId, id);
		if (def.status === "disabled") {
			throw new SavedImportError("Import definition is disabled", "disabled", 400);
		}
		await requireWritableDatasetProject(def.datasetId, "run saved import");
		await requireDatasetInProject(projectId, def.datasetId);

		const acquired = await this.store.tryAcquireRunLock(id);
		if (!acquired) {
			throw new SavedImportError(
				"Import already running for this definition",
				"conflict",
				409,
			);
		}

		try {
			const importDef = await this.toImportDefinition(def);
			const basePath = def.definitionPath
				? resolve(def.definitionPath, "..")
				: def.filePath
					? resolve(def.filePath, "..")
					: process.cwd();
			const result = await runImport(importDef, basePath, {
				dryRun: options.dryRun ?? false,
			});

			if (def.sourceId) {
				const source = await this.store.getDataSource(projectId, def.sourceId);
				if (source) {
					const now = new Date().toISOString();
					const ok = result.failed === 0 || result.imported > 0;
					await this.store.updateDataSource(projectId, def.sourceId, {
						...source,
						lastSuccessAt: ok ? now : source.lastSuccessAt,
						lastFailureAt: !ok ? now : source.lastFailureAt,
						lastError: !ok
							? result.errors[0]?.message ?? "Import failed"
							: null,
						updatedAt: now,
					});
				}
			}

			if (def.schedule) {
				const nextRun = def.schedule.enabled
					? computeNextCronRun(
							def.schedule.spec.expression,
							def.schedule.spec.timezone,
						)
					: null;
				await this.store.updateSavedImport(projectId, id, {
					...def,
					schedule: {
						...def.schedule,
						lastRunAt: new Date().toISOString(),
						nextRunAt: nextRun,
					},
					updatedAt: new Date().toISOString(),
				});
			}

			return { ...result, trigger: options.trigger ?? "user" };
		} finally {
			await this.store.releaseRunLock(id);
		}
	}

	private async toImportDefinition(
		def: SavedImportDefinition,
	): Promise<ImportDefinition> {
		if (def.definitionPath) {
			const loaded = await loadImportDefinition(def.definitionPath);
			return {
				...loaded,
				dataset: def.datasetId,
				schema: def.schemaId,
			};
		}

		if (!def.filePath || !def.fileFormat) {
			throw new SavedImportError(
				"Saved import needs definitionPath or filePath+fileFormat",
				"validation_error",
			);
		}

		const mapping = def.pipeline?.mapping ?? {};
		const steps: ImportDefinition["pipeline"]["steps"] = [
			{ type: "map", mapping },
		];
		if (def.pipeline?.transforms?.length) {
			steps.push({
				type: "transform",
				transforms: def.pipeline.transforms.map((t) => ({
					field: t.field,
					fn: t.fn as never,
				})),
			});
		}
		steps.push({ type: "validate" }, { type: "persist" });

		const result: ImportDefinition = {
			id: def.id,
			name: def.name,
			schema: def.schemaId,
			dataset: def.datasetId,
			source: {
				type: def.fileFormat,
				path: def.filePath,
			},
			pipeline: { steps },
		};
		if (def.pipeline?.deduplicateBy !== undefined) {
			result.deduplicateBy = def.pipeline.deduplicateBy;
		}
		if (def.pipeline?.referenceValidation !== undefined) {
			result.referenceValidation = def.pipeline.referenceValidation;
		}
		return result;
	}

	private normalizeSchedule(schedule: ScheduleState): ScheduleState {
		const spec = validateScheduleSpec(schedule.spec);
		if (!spec.success) {
			throw new SavedImportError(
				spec.issues.map((i) => i.message).join("; "),
				"validation_error",
			);
		}
		const enabled = schedule.enabled ?? false;
		return {
			enabled,
			spec: spec.data,
			lastRunAt: schedule.lastRunAt ?? null,
			nextRunAt: enabled
				? computeNextCronRun(spec.data.expression, spec.data.timezone)
				: null,
		};
	}
}

export function createSavedImportService(store?: PlatformStore): SavedImportService {
	return new SavedImportService(store ?? getPlatformStore());
}
