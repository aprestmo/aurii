/**
 * Shared execution-plan logic for storage adapters.
 *
 * Adapters delegate scan and COUNT operations to native SQL when predicates
 * are pushdown-safe. Joins and EXISTS remain in-memory so behaviour stays
 * identical across engines.
 */

import type { Entity } from "../entity/types";
import type { Condition, ScalarValue, WhereExpr } from "../query/ast";
import type { AggregateStep, ExecutionPlan, JoinStep, ScanStep } from "../query/plan";
import type { FieldDefinition } from "../schema/types";
import { isReferenceField, referenceTarget } from "../schema/types";

export interface PlanExecutorContext {
	datasetId: string;
	scan: (step: ScanStep) => Promise<Entity[]>;
	count: (schemaId: string, where?: WhereExpr) => Promise<number>;
	getSchemaFields: (schemaId: string) => Promise<FieldDefinition[]>;
	/** Lookup entity by natural key (data field value) within a schema. */
	findByField: (
		schemaId: string,
		field: string,
		value: string,
	) => Promise<Entity | null>;
}

export interface PlanResult {
	entities: Entity[];
	count: number;
	aggregate?: { fn: string; value: number };
}

export async function executePlan(
	plan: ExecutionPlan,
	ctx: PlanExecutorContext,
): Promise<PlanResult> {
	switch (plan.kind) {
		case "scan": {
			const entities = await ctx.scan(plan);
			return { entities, count: entities.length };
		}
		case "join":
			return executeJoin(plan, ctx);
		case "aggregate": {
			const value = await executeAggregate(plan, ctx);
			return { entities: [], count: value, aggregate: { fn: plan.fn, value } };
		}
	}
}

async function executeJoin(
	plan: JoinStep,
	ctx: PlanExecutorContext,
): Promise<PlanResult> {
	const { where: _leftWhere, ...leftScan } = plan.left;
	const leftEntities = await ctx.scan(leftScan);
	const rightEntities = await ctx.scan(plan.right);

	const rightIndex = new Map<string, Entity>();
	for (const e of rightEntities) {
		const key = String(e.data[plan.on.rightField] ?? "");
		rightIndex.set(key, e);
	}

	const resolveField = (field: string): string => {
		const dot = field.indexOf(".");
		if (dot <= 0) return field;
		const alias = field.slice(0, dot);
		const name = field.slice(dot + 1);
		if (alias === plan.on.leftAlias) return name;
		if (alias === plan.on.rightAlias) return `${alias}.${name}`;
		return field;
	};

	const remapWhere = (expr: WhereExpr): WhereExpr => {
		if (expr.type === "condition") {
			return {
				type: "condition",
				condition: {
					...expr.condition,
					field: resolveField(expr.condition.field),
				},
			};
		}
		if (expr.type === "and") {
			return { type: "and", exprs: expr.exprs.map(remapWhere) };
		}
		if (expr.type === "or") {
			return { type: "or", exprs: expr.exprs.map(remapWhere) };
		}
		return { type: "not", expr: remapWhere(expr.expr) };
	};

	const where = plan.where ? remapWhere(plan.where) : undefined;

	const joined: Entity[] = [];
	for (const left of leftEntities) {
		const joinKey = String(left.data[plan.on.leftField] ?? "");
		const right = rightIndex.get(joinKey);
		if (!right) continue;

		const mergedData: Record<string, unknown> = { ...left.data };
		const rightPrefix = `${plan.on.rightAlias}.`;
		for (const [k, v] of Object.entries(right.data)) {
			mergedData[`${rightPrefix}${k}`] = v;
		}

		const entity: Entity = {
			...left,
			data: mergedData,
		};

		if (where && !evaluateWhere(where, entity.data)) continue;
		joined.push(applySelect(entity, plan.select));
	}

	let result = joined;
	if (plan.orderBy) {
		result = sortEntities(result, plan.orderBy.field, plan.orderBy.direction);
	}
	if (plan.offset !== undefined) result = result.slice(plan.offset);
	if (plan.limit !== undefined) result = result.slice(0, plan.limit);

	return { entities: result, count: result.length };
}

async function executeAggregate(
	plan: AggregateStep,
	ctx: PlanExecutorContext,
): Promise<number> {
	return ctx.count(plan.schemaId, plan.where);
}

function applySelect(entity: Entity, select?: string[]): Entity {
	if (!select || select.length === 0) return entity;
	const data: Record<string, unknown> = {};
	for (const field of select) {
		if (field in entity.data) data[field] = entity.data[field];
	}
	return { ...entity, data };
}

function sortEntities(
	entities: Entity[],
	field: string,
	direction: "asc" | "desc",
): Entity[] {
	return [...entities].sort((a, b) => {
		const av = a.data[field];
		const bv = b.data[field];
		if (av === bv) return 0;
		if (av === undefined || av === null) return 1;
		if (bv === undefined || bv === null) return -1;
		const cmp = av < bv ? -1 : 1;
		return direction === "asc" ? cmp : -cmp;
	});
}

export function evaluateWhere(expr: WhereExpr, data: Record<string, unknown>): boolean {
	switch (expr.type) {
		case "condition":
			return evaluateCondition(expr.condition, data);
		case "and":
			return expr.exprs.every((e) => evaluateWhere(e, data));
		case "or":
			return expr.exprs.some((e) => evaluateWhere(e, data));
		case "not":
			return !evaluateWhere(expr.expr, data);
	}
}

export function evaluateCondition(
	condition: Condition,
	data: Record<string, unknown>,
): boolean {
	const fieldValue = data[condition.field];

	if (condition.op === "exists") {
		return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
	}

	if (condition.op === "in") {
		const values = condition.value as ScalarValue[];
		return values.includes(fieldValue as ScalarValue);
	}

	const value = condition.value;
	switch (condition.op) {
		case "==":
			if (value === null) {
				return fieldValue === null || fieldValue === undefined;
			}
			return fieldValue === value;
		case "!=":
			return fieldValue !== value;
		case ">":
			return (fieldValue as number) > (value as number);
		case "<":
			return (fieldValue as number) < (value as number);
		case ">=":
			return (fieldValue as number) >= (value as number);
		case "<=":
			return (fieldValue as number) <= (value as number);
		case "contains":
			return String(fieldValue ?? "")
				.toLowerCase()
				.includes(String(value ?? "").toLowerCase());
		default:
			return false;
	}
}

/**
 * True when every predicate can be expressed by `whereExprToSqlClauses`.
 * NOT and EXISTS stay in-memory; partial SQL COUNT would be wrong.
 */
export function canPushdownWhere(expr?: WhereExpr): boolean {
	if (!expr) return true;
	switch (expr.type) {
		case "condition":
			return expr.condition.op !== "exists";
		case "and":
		case "or":
			return expr.exprs.every((child) => canPushdownWhere(child));
		case "not":
			return false;
	}
}

/** Build SQL-friendly WHERE for simple conditions (non-EXISTS, non-IN with many values). */
export type SqlDialect = "sqlite" | "postgres";

export function whereExprToSqlClauses(
	expr: WhereExpr,
	fieldPath: (field: string) => string,
	bind: (value: unknown) => string,
	dialect: SqlDialect = "sqlite",
): string[] {
	const clauses: string[] = [];

	function compareClause(
		path: string,
		op: string,
		value: unknown,
	): string {
		const ops: Record<string, string> = {
			"==": "=",
			"!=": "!=",
			">": ">",
			"<": "<",
			">=": ">=",
			"<=": "<=",
		};
		const sqlOp = ops[op]!;

		if (typeof value === "number") {
			if (dialect === "postgres") {
				return `(${path})::numeric ${sqlOp} ${bind(value)}`;
			}
			return `${path} ${sqlOp} ${bind(value)}`;
		}
		if (typeof value === "boolean") {
			if (dialect === "postgres") {
				return `(${path})::boolean ${sqlOp} ${bind(value)}`;
			}
			return `${path} ${sqlOp} ${bind(value ? 1 : 0)}`;
		}
		return `${path} ${sqlOp} ${bind(value)}`;
	}

	function walk(e: WhereExpr): void {
		if (e.type === "condition") {
			const c = e.condition;
			if (c.op === "exists") return; // handled in-memory
			const path = fieldPath(c.field);
			if (c.op === "in" && Array.isArray(c.value)) {
				const parts = c.value.map((v) => compareClause(path, "==", v));
				clauses.push(`(${parts.join(" OR ")})`);
				return;
			}
			if (c.op === "contains") {
				const likeOp = dialect === "postgres" ? "ILIKE" : "LIKE";
				clauses.push(`${path} ${likeOp} ${bind(`%${c.value}%`)}`);
				return;
			}
			if (c.value === null) {
				clauses.push(c.op === "==" ? `${path} IS NULL` : `${path} IS NOT NULL`);
				return;
			}
			clauses.push(compareClause(path, c.op, c.value));
		} else if (e.type === "and") {
			for (const child of e.exprs) walk(child);
		} else if (e.type === "or") {
			const parts: string[] = [];
			const saved = clauses.length;
			for (const child of e.exprs) {
				const before = clauses.length;
				walk(child);
				if (clauses.length > before) {
					parts.push(clauses.splice(before).join(" AND "));
				}
			}
			clauses.splice(saved);
			if (parts.length > 0) clauses.push(`(${parts.join(" OR ")})`);
		} else if (e.type === "not") {
			// NOT handled in-memory for complex cases
		}
	}

	walk(expr);
	return clauses;
}

export async function validateReferenceValue(
	ctx: PlanExecutorContext,
	field: FieldDefinition,
	value: unknown,
): Promise<boolean> {
	if (!isReferenceField(field)) return true;
	const target = referenceTarget(field);
	if (!target) return true;

	if (field.multiple) {
		if (!Array.isArray(value)) return false;
		for (const id of value) {
			if (typeof id !== "string") return false;
			const found = await ctx.findByField(target, "id", id);
			if (!found) return false;
		}
		return true;
	}

	if (typeof value !== "string") return false;
	const found = await ctx.findByField(target, "id", value);
	return found !== null;
}
