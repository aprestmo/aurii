import type { TransformFn } from "../import/types";

const ISO_DATE_PATTERNS = [
	// ISO 8601 — pass through
	/^\d{4}-\d{2}-\d{2}/,
	// MM/DD/YYYY
	/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
	// DD.MM.YYYY
	/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
];

function tryParseDate(value: string): string | null {
	const v = value.trim();
	if (!v) return null;

	if (ISO_DATE_PATTERNS[0]!.test(v)) return v;

	const mmddyyyy = v.match(ISO_DATE_PATTERNS[1]!);
	if (mmddyyyy) {
		const [, mm, dd, yyyy] = mmddyyyy;
		return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
	}

	const ddmmyyyy = v.match(ISO_DATE_PATTERNS[2]!);
	if (ddmmyyyy) {
		const [, dd, mm, yyyy] = ddmmyyyy;
		return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
	}

	const ts = Date.parse(v);
	if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);

	return null;
}

const TRUTHY = new Set(["true", "1", "yes", "on", "y", "ja"]);
const FALSY = new Set(["false", "0", "no", "off", "n", "nei", ""]);

export function applyTransform(value: unknown, fn: TransformFn): unknown {
	const str = value === null || value === undefined ? "" : String(value);

	switch (fn) {
		case "toBoolean": {
			const lower = str.toLowerCase().trim();
			if (TRUTHY.has(lower)) return true;
			if (FALSY.has(lower)) return false;
			return null;
		}

		case "toNumber": {
			const n = parseFloat(str);
			return isNaN(n) ? null : n;
		}

		case "toDate": {
			return tryParseDate(str);
		}

		case "toSlug": {
			return str
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, "")
				.replace(/[\s_]+/g, "-")
				.replace(/^-+|-+$/g, "");
		}

		case "trim":
			return str.trim();

		case "toLowerCase":
			return str.toLowerCase();

		case "toUpperCase":
			return str.toUpperCase();

		default:
			return value;
	}
}
