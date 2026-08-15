import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { Entity, EntityInput } from "../entity/types";
import { emit } from "../events/emitter";
import {
	referenceIssuesToErrors,
	validateReferences,
} from "./reference-validator";
import { runPipeline } from "../pipeline/runner";
import { ProjectNotWritableError } from "../project/errors";
import { requireWritableDatasetProject } from "../project/dataset-context";
import { DEFAULT_DATASET, getStorage } from "../storage";
import { readCsvFile } from "./sources/csv";
import { readJsonFile } from "./sources/json";
import type { ImportDefinition, ImportResult, RowError } from "./types";

export interface RunImportOptions {
	datasetId?: string;
	dryRun?: boolean;
	/** How the run was initiated (persisted on the import-run record). */
	trigger?: "user" | "schedule" | "system" | "webhook";
	/**
	 * Optional hook invoked immediately before entity writes.
	 * Used in tests to simulate project status changing after job start.
	 */
	beforePersist?: () => Promise<void> | void;
}

export async function loadImportDefinition(
	filePath: string,
): Promise<ImportDefinition> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`Import definition file not found: ${filePath}`);
	}
	const content = await file.text();
	return parseYaml(content) as ImportDefinition;
}

async function loadRows(
	def: ImportDefinition,
	basePath: string,
): Promise<Record<string, unknown>[]> {
	const sourcePath = resolve(basePath, def.source.path);

	if (def.source.type === "csv") {
		const delimiter = def.source.options?.delimiter ?? ",";
		return await readCsvFile(sourcePath, delimiter);
	}

	if (def.source.type === "json") {
		return await readJsonFile(sourcePath);
	}

	throw new Error(`Unsupported source type: "${def.source.type}"`);
}

async function failImportRun(
	runId: string,
	error: ProjectNotWritableError,
): Promise<void> {
	const storage = await getStorage();
	await storage.updateImportRun(runId, {
		status: "failed",
		total: 0,
		imported: 0,
		failed: 0,
		errors: [
			{
				row: 0,
				message: error.message,
			},
		],
		completedAt: new Date().toISOString(),
	});
}

export async function runImport(
	def: ImportDefinition,
	basePath: string = process.cwd(),
	options: RunImportOptions = {},
): Promise<ImportResult> {
	const startedAt = Date.now();
	const storage = await getStorage();
	const datasetId = options.datasetId ?? def.dataset ?? DEFAULT_DATASET;
	const dryRun = options.dryRun ?? false;
	const runId = crypto.randomUUID();

	// Enforce project write policy at job start (Import → Dataset → Project).
	await requireWritableDatasetProject(datasetId, "import.run");

	const schema = await storage.getSchema(def.schema, datasetId);
	if (!schema) {
		throw new Error(
			`Schema "${def.schema}" not found in dataset "${datasetId}". Register it first.`,
		);
	}

	await storage.recordImportRun({
		id: runId,
		definitionId: def.id,
		datasetId,
		schemaId: def.schema,
		status: "running",
		dryRun,
		total: 0,
		imported: 0,
		failed: 0,
		errors: [],
		startedAt: new Date().toISOString(),
		completedAt: null,
		trigger: options.trigger ?? null,
	});

	emit({
		type: "import.started",
		runId,
		definitionId: def.id,
		schemaId: def.schema,
		datasetId,
		dryRun,
	});

	try {
		const rows = await loadRows(def, basePath);
		const total = rows.length;
		const errors: RowError[] = [];
		const toInsert: EntityInput[] = [];
		const refMode = def.referenceValidation ?? "strict";

		const refCache = new Map<string, Entity | null>();
		const lookupRef = async (
			targetSchema: string,
			id: string,
		): Promise<Entity | null> => {
			const key = `${targetSchema}\0${id}`;
			if (refCache.has(key)) return refCache.get(key) ?? null;
			const found = await storage.findEntityByField(
				targetSchema,
				datasetId,
				"id",
				id,
			);
			refCache.set(key, found);
			return found;
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]!;

			const result = runPipeline(def.pipeline.steps, row, schema, i + 1);

			if (!result.ok) {
				errors.push({ row: i + 1, message: result.errors.join("; "), data: row });
				continue;
			}

			const refResult = await validateReferences(
				result.row,
				schema,
				lookupRef,
				refMode,
			);

			const refMessages = referenceIssuesToErrors(refResult.issues, refMode);
			if (refMode === "strict" && refMessages.length > 0) {
				errors.push({
					row: i + 1,
					message: refMessages.join("; "),
					data: row,
				});
				continue;
			}

			if (refMode === "warning" && refMessages.length > 0) {
				for (const msg of refMessages) {
					errors.push({
						row: i + 1,
						message: msg,
						data: row,
						severity: "warning",
					});
				}
			}

			const finalRow = refResult.data;
			const cleanData: Record<string, unknown> = {};
			for (const field of schema.fields) {
				const v = finalRow[field.name];
				if (v !== null && v !== undefined && v !== "") {
					cleanData[field.name] = v;
				} else if (field.default !== undefined) {
					cleanData[field.name] = field.default;
				}
			}
			toInsert.push({ schemaId: def.schema, data: cleanData });
		}

		// Re-check immediately before writes — project may have been deactivated
		// after the job was accepted / while rows were processed.
		if (options.beforePersist) {
			await options.beforePersist();
		}
		try {
			await requireWritableDatasetProject(datasetId, "import.persist");
		} catch (error) {
			if (error instanceof ProjectNotWritableError) {
				await failImportRun(runId, error);
				emit({
					type: "import.finished",
					runId,
					definitionId: def.id,
					schemaId: def.schema,
					datasetId,
					dryRun,
					total,
					imported: 0,
					failed: 0,
					durationMs: Date.now() - startedAt,
				});
				throw error;
			}
			throw error;
		}

		let inserted = 0;
		let updated = 0;

		if (!dryRun && toInsert.length > 0) {
			if (def.deduplicateBy) {
				const upsertResult = await storage.upsertEntitiesByField(
					toInsert,
					datasetId,
					def.deduplicateBy,
				);
				inserted = upsertResult.inserted;
				updated = upsertResult.updated;
			} else {
				await storage.insertEntities(toInsert, datasetId);
				inserted = toInsert.length;
			}
		} else if (dryRun) {
			inserted = toInsert.length;
		}

		const imported = inserted + updated;
		const failed = errors.filter((e) => e.severity !== "warning").length;
		const durationMs = Date.now() - startedAt;

		await storage.updateImportRun(runId, {
			status:
				failed > 0 && imported === 0
					? "failed"
					: failed > 0
						? "partial"
						: "completed",
			total,
			imported,
			failed,
			errors,
			completedAt: new Date().toISOString(),
		});

		emit({
			type: "import.finished",
			runId,
			definitionId: def.id,
			schemaId: def.schema,
			datasetId,
			dryRun,
			total,
			imported,
			failed,
			durationMs,
		});

		return {
			definitionId: def.id,
			schemaId: def.schema,
			datasetId,
			dryRun,
			total,
			imported,
			inserted,
			updated,
			failed,
			errors,
			durationMs,
			// In dry-run mode, include a sample of transformed rows so the wizard
			// can show the user exactly what would be written.
			...(dryRun ? { sample: toInsert.slice(0, 10).map((e) => e.data) } : {}),
		};
	} catch (error) {
		if (error instanceof ProjectNotWritableError) {
			throw error;
		}
		const durationMs = Date.now() - startedAt;
		const message = error instanceof Error ? error.message : String(error);
		await storage.updateImportRun(runId, {
			status: "failed",
			errors: [{ row: 0, message }],
			completedAt: new Date().toISOString(),
		});
		emit({
			type: "import.finished",
			runId,
			definitionId: def.id,
			schemaId: def.schema,
			datasetId,
			dryRun,
			total: 0,
			imported: 0,
			failed: 0,
			durationMs,
		});
		throw error;
	}
}
