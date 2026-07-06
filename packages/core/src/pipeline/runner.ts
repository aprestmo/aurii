import type { PipelineStep } from "../import/types";
import type { SchemaDefinition } from "../schema/types";
import { validateEntity } from "../schema/validator";
import { applyTransform } from "./transforms";

export interface PipelineContext {
	schema: SchemaDefinition;
	row: Record<string, unknown>;
	rowIndex: number;
}

export interface PipelineStepResult {
	ok: boolean;
	row: Record<string, unknown>;
	errors: string[];
}

export function runStep(
	step: PipelineStep,
	ctx: PipelineContext,
): PipelineStepResult {
	switch (step.type) {
		case "map": {
			// The mapping is the contract: only mapped fields survive.
			const mapped: Record<string, unknown> = {};
			for (const [schemaField, sourceField] of Object.entries(step.mapping)) {
				if (sourceField in ctx.row) {
					mapped[schemaField] = ctx.row[sourceField];
				}
			}
			return { ok: true, row: mapped, errors: [] };
		}

		case "transform": {
			const transformed = { ...ctx.row };
			for (const { field, fn } of step.transforms) {
				if (field in transformed) {
					transformed[field] = applyTransform(transformed[field], fn);
				}
			}
			return { ok: true, row: transformed, errors: [] };
		}

		case "validate": {
			const result = validateEntity(ctx.row, ctx.schema);
			return { ok: result.valid, row: ctx.row, errors: result.errors };
		}

		case "persist": {
			// Persist is handled by the Import Engine after the pipeline completes.
			// This step is a no-op within the runner — it signals intent.
			return { ok: true, row: ctx.row, errors: [] };
		}

		default: {
			const s = step as { type: string };
			return {
				ok: false,
				row: ctx.row,
				errors: [`Unknown pipeline step type: "${s.type}"`],
			};
		}
	}
}

export function runPipeline(
	steps: PipelineStep[],
	initialRow: Record<string, unknown>,
	schema: SchemaDefinition,
	rowIndex: number,
): PipelineStepResult {
	let current = initialRow;

	for (const step of steps) {
		if (step.type === "persist") continue; // handled by engine

		const result = runStep(step, { schema, row: current, rowIndex });
		if (!result.ok) {
			return { ok: false, row: current, errors: result.errors };
		}
		current = result.row;
	}

	return { ok: true, row: current, errors: [] };
}
