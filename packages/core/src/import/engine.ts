import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { EntityInput } from "../entity/types";
import { runPipeline } from "../pipeline/runner";
import { DEFAULT_DATASET, getStorage } from "../storage";
import { readCsvFile } from "./sources/csv";
import { readJsonFile } from "./sources/json";
import type { ImportDefinition, ImportResult, RowError } from "./types";

export interface RunImportOptions {
	datasetId?: string;
	dryRun?: boolean;
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
	});

	const rows = await loadRows(def, basePath);
	const total = rows.length;
	const errors: RowError[] = [];
	const toInsert: EntityInput[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]!;

		const result = runPipeline(def.pipeline.steps, row, schema, i + 1);

		if (!result.ok) {
			errors.push({ row: i + 1, message: result.errors.join("; "), data: row });
		} else {
			const cleanData: Record<string, unknown> = {};
			for (const field of schema.fields) {
				const v = result.row[field.name];
				if (v !== null && v !== undefined && v !== "") {
					cleanData[field.name] = v;
				} else if (field.default !== undefined) {
					cleanData[field.name] = field.default;
				}
			}
			toInsert.push({ schemaId: def.schema, data: cleanData });
		}
	}

	if (!dryRun && toInsert.length > 0) {
		await storage.insertEntities(toInsert, datasetId);
	}

	const imported = toInsert.length;
	const failed = errors.length;
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

	return {
		definitionId: def.id,
		schemaId: def.schema,
		datasetId,
		dryRun,
		total,
		imported,
		failed,
		errors,
		durationMs,
		// In dry-run mode, include a sample of transformed rows so the wizard
		// can show the user exactly what would be written.
		...(dryRun ? { sample: toInsert.slice(0, 10).map((e) => e.data) } : {}),
	};
}
