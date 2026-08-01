/**
 * Minimal 5-field cron next-run calculator.
 *
 * Supports: wildcards (*), single numbers, and simple lists (1,2,3).
 * Not a full cron parser — sufficient for beta schedules.
 * Timezone: uses Intl to get wall-clock parts in the target zone.
 */

export function computeNextCronRun(
	expression: string,
	timezone: string,
	from: Date = new Date(),
): string {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(`Invalid cron expression: ${expression}`);
	}
	const [minuteF, hourF, domF, monthF, dowF] = parts as [
		string,
		string,
		string,
		string,
		string,
	];

	// Search up to 366 days ahead, minute by minute from the next minute
	const cursor = new Date(from.getTime());
	cursor.setUTCSeconds(0, 0);
	cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

	for (let i = 0; i < 366 * 24 * 60; i++) {
		const partsInTz = getZonedParts(cursor, timezone);
		if (
			matchesField(minuteF, partsInTz.minute) &&
			matchesField(hourF, partsInTz.hour) &&
			matchesField(domF, partsInTz.day) &&
			matchesField(monthF, partsInTz.month) &&
			matchesField(dowF, partsInTz.weekday)
		) {
			return cursor.toISOString();
		}
		cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
	}
	throw new Error(`Could not compute next run for: ${expression}`);
}

function matchesField(field: string, value: number): boolean {
	if (field === "*") return true;
	const options = field.split(",");
	return options.some((opt) => {
		if (opt.includes("/")) {
			const [range, stepStr] = opt.split("/");
			const step = Number(stepStr);
			if (!step) return false;
			if (range === "*") return value % step === 0;
			return false;
		}
		if (opt.includes("-")) {
			const [a, b] = opt.split("-").map(Number);
			return value >= (a as number) && value <= (b as number);
		}
		return Number(opt) === value;
	});
}

function getZonedParts(
	date: Date,
	timeZone: string,
): { minute: number; hour: number; day: number; month: number; weekday: number } {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone,
		minute: "numeric",
		hour: "numeric",
		hourCycle: "h23",
		day: "numeric",
		month: "numeric",
		weekday: "short",
	});
	const map: Record<string, string> = {};
	for (const p of fmt.formatToParts(date)) {
		if (p.type !== "literal") map[p.type] = p.value;
	}
	const weekdayMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};
	return {
		minute: Number(map["minute"]),
		hour: Number(map["hour"]),
		day: Number(map["day"]),
		month: Number(map["month"]),
		weekday: weekdayMap[map["weekday"] ?? "Sun"] ?? 0,
	};
}
