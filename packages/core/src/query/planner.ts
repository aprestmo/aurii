/**
 * Query planner — converts AST to storage-agnostic execution plans.
 */

import type { QueryAST } from "./ast";
import type { ExecutionPlan, PlanExplanation, ScanStep } from "./plan";

export function planQuery(ast: QueryAST): ExecutionPlan {
	if (ast.kind === "aggregate") {
		return {
			kind: "aggregate",
			fn: ast.fn,
			schemaId: ast.from,
			...(ast.field ? { field: ast.field } : {}),
			...(ast.where ? { where: ast.where } : {}),
		};
	}

	const left: ScanStep = {
		kind: "scan",
		schemaId: ast.from,
		alias: ast.fromAlias,
		...(ast.select ? { select: ast.select } : {}),
		...(ast.where ? { where: ast.where } : {}),
		...(ast.orderBy ? { orderBy: ast.orderBy } : {}),
		...(ast.limit !== undefined ? { limit: ast.limit } : {}),
		...(ast.offset !== undefined ? { offset: ast.offset } : {}),
	};

	if (!ast.join) return left;

	const right: ScanStep = {
		kind: "scan",
		schemaId: ast.join.schema,
		alias: ast.join.alias,
	};

	return {
		kind: "join",
		left,
		right,
		on: ast.join.on,
		...(ast.select ? { select: ast.select } : {}),
		...(ast.where ? { where: ast.where } : {}),
		...(ast.orderBy ? { orderBy: ast.orderBy } : {}),
		...(ast.limit !== undefined ? { limit: ast.limit } : {}),
		...(ast.offset !== undefined ? { offset: ast.offset } : {}),
	};
}

export function explainPlan(plan: ExecutionPlan): PlanExplanation {
	const steps: string[] = [];
	const schemas = new Set<string>();

	switch (plan.kind) {
		case "scan": {
			schemas.add(plan.schemaId);
			steps.push(`Scan entities of schema "${plan.schemaId}"`);
			if (plan.where) steps.push("Apply filter predicates");
			if (plan.orderBy)
				steps.push(
					`Sort by "${plan.orderBy.field}" ${plan.orderBy.direction}`,
				);
			if (plan.limit !== undefined) steps.push(`Limit to ${plan.limit} rows`);
			if (plan.offset !== undefined) steps.push(`Skip first ${plan.offset} rows`);
			if (plan.select) steps.push(`Project fields: ${plan.select.join(", ")}`);
			break;
		}
		case "join": {
			schemas.add(plan.left.schemaId);
			schemas.add(plan.right.schemaId);
			steps.push(`Scan left: schema "${plan.left.schemaId}"`);
			steps.push(`Scan right: schema "${plan.right.schemaId}"`);
			steps.push(
				`Hash join on ${plan.on.leftAlias}.${plan.on.leftField} = ${plan.on.rightAlias}.${plan.on.rightField}`,
			);
			if (plan.where) steps.push("Apply post-join filter predicates");
			if (plan.orderBy)
				steps.push(
					`Sort by "${plan.orderBy.field}" ${plan.orderBy.direction}`,
				);
			if (plan.limit !== undefined) steps.push(`Limit to ${plan.limit} rows`);
			break;
		}
		case "aggregate": {
			schemas.add(plan.schemaId);
			steps.push(
				`Aggregate ${plan.fn.toUpperCase()} on schema "${plan.schemaId}" (SQL COUNT when predicates are pushdown-safe)`,
			);
			if (plan.where) steps.push("Apply filter predicates before aggregation");
			break;
		}
	}

	return {
		plan,
		steps,
		estimatedSchemas: [...schemas],
	};
}
