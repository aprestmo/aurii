import { fail, ok, type ValidationIssue, type ValidationResult } from "./result";

const CRON_RE =
	/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

export function validateCronExpression(
	expression: unknown,
): ValidationResult<string> {
	if (typeof expression !== "string" || !expression.trim()) {
		return fail([{ path: "expression", message: "Cron expression is required" }]);
	}
	const trimmed = expression.trim();
	if (!CRON_RE.test(trimmed)) {
		return fail([
			{
				path: "expression",
				message:
					"Cron expression must have 5 fields: minute hour day-of-month month day-of-week",
			},
		]);
	}
	return ok(trimmed);
}

export function validateTimezone(tz: unknown): ValidationResult<string> {
	if (typeof tz !== "string" || !tz.trim()) {
		return fail([{ path: "timezone", message: "Timezone is required" }]);
	}
	try {
		// Throws RangeError for invalid IANA zones in modern engines
		Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
		return ok(tz.trim());
	} catch {
		return fail([
			{ path: "timezone", message: `Invalid IANA timezone: ${String(tz)}` },
		]);
	}
}

export function validateScheduleSpec(
	input: unknown,
): ValidationResult<{ type: "cron"; expression: string; timezone: string }> {
	const issues: ValidationIssue[] = [];
	if (!input || typeof input !== "object") {
		return fail([{ path: "", message: "Expected a schedule object" }]);
	}
	const raw = input as Record<string, unknown>;
	if (raw["type"] !== "cron") {
		issues.push({ path: "type", message: 'Only type "cron" is supported' });
	}
	const expr = validateCronExpression(raw["expression"]);
	if (!expr.success) issues.push(...expr.issues);
	const tz = validateTimezone(raw["timezone"]);
	if (!tz.success) issues.push(...tz.issues);
	if (issues.length) return fail(issues);
	return ok({
		type: "cron",
		expression: (expr as { success: true; data: string }).data,
		timezone: (tz as { success: true; data: string }).data,
	});
}
