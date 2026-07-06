import type { FieldType, SchemaDefinition } from "../schema/types";
import { parseCsv } from "./sources/csv";
import type { FieldTransform, SourceType } from "./types";

export interface AnalysisResult {
	format: SourceType;
	delimiter?: string;
	columns: string[];
	rowCount: number;
	preview: Record<string, unknown>[];
	inferredTypes: Record<string, FieldType>;
	suggestedSchema: SchemaDefinition;
	suggestedMapping: Record<string, string>;
	suggestedTransforms: FieldTransform[];
}

const DELIMITERS = [",", ";", "\t", "|"];

const BOOL_VALUES = new Set([
	"true",
	"false",
	"0",
	"1",
	"yes",
	"no",
	"ja",
	"nei",
	"y",
	"n",
]);
const DATE_RES = [
	/^\d{4}-\d{2}-\d{2}/,
	/^\d{1,2}\/\d{1,2}\/\d{4}$/,
	/^\d{1,2}\.\d{1,2}\.\d{4}$/,
];

export function slugifyFieldName(name: string): string {
	const cleaned = name
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[-\s]+/g, " ")
		.trim();
	const parts = cleaned.split(" ").filter(Boolean);
	if (parts.length === 0) return "field";
	return (
		parts[0]!.toLowerCase() +
		parts
			.slice(1)
			.map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase())
			.join("")
	);
}

export function detectFormat(filename: string, content: string): SourceType {
	if (/\.json$/i.test(filename)) return "json";
	if (/\.csv$/i.test(filename)) return "csv";
	const trimmed = content.trimStart();
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
	return "csv";
}

export function detectDelimiter(content: string): string {
	const lines = content
		.split(/\r?\n/)
		.filter((l) => l.trim())
		.slice(0, 10);
	if (lines.length === 0) return ",";

	let best = ",";
	let bestScore = -1;

	for (const delim of DELIMITERS) {
		const counts = lines.map((l) => {
			// Count delimiters outside quotes
			let count = 0;
			let inQuotes = false;
			for (const ch of l) {
				if (ch === '"') inQuotes = !inQuotes;
				else if (ch === delim && !inQuotes) count++;
			}
			return count;
		});

		const first = counts[0]!;
		if (first === 0) continue;
		const consistent = counts.every((c) => c === first);
		const score = consistent ? first * 10 : first;
		if (score > bestScore) {
			bestScore = score;
			best = delim;
		}
	}

	return best;
}

function isIdentifierColumn(name: string): boolean {
	const n = name.toLowerCase();
	return (
		n === "id" ||
		n === "code" ||
		n.endsWith("id") ||
		n.includes("nummer") ||
		n.includes("number")
	);
}

function inferType(values: string[], columnName?: string): FieldType {
	if (columnName && isIdentifierColumn(columnName)) {
		return "string";
	}

	const nonEmpty = values.filter(
		(v) => v !== "" && v !== null && v !== undefined,
	);
	if (nonEmpty.length === 0) return "string";

	if (nonEmpty.every((v) => BOOL_VALUES.has(v.toLowerCase().trim()))) {
		// Distinguish "0/1" columns that are actually numeric IDs: require at
		// least one non-numeric boolean word to call it boolean.
		const hasWord = nonEmpty.some((v) => isNaN(Number(v)));
		if (hasWord) return "boolean";
	}

	if (
		nonEmpty.every(
			(v) => !isNaN(Number(v.replace(",", "."))) && v.trim() !== "",
		)
	) {
		return "number";
	}

	if (nonEmpty.every((v) => DATE_RES.some((re) => re.test(v.trim())))) {
		return "date";
	}

	return "string";
}

function transformFor(type: FieldType): FieldTransform["fn"] | null {
	switch (type) {
		case "boolean":
			return "toBoolean";
		case "number":
			return "toNumber";
		case "date":
			return "toDate";
		default:
			return null;
	}
}

export function analyzeContent(
	filename: string,
	content: string,
	suggestedId?: string,
): AnalysisResult {
	const format = detectFormat(filename, content);

	let rows: Record<string, unknown>[];
	let delimiter: string | undefined;

	if (format === "csv") {
		delimiter = detectDelimiter(content);
		rows = parseCsv(content, delimiter);
	} else {
		const parsed = JSON.parse(content) as unknown;
		if (!Array.isArray(parsed)) {
			throw new Error("JSON source must be an array of objects");
		}
		rows = parsed as Record<string, unknown>[];
	}

	const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
	const sampleSize = Math.min(rows.length, 100);

	const inferredTypes: Record<string, FieldType> = {};
	for (const col of columns) {
		const values = rows.slice(0, sampleSize).map((r) => String(r[col] ?? ""));
		inferredTypes[col] = inferType(values, col);
	}

	const schemaId =
		suggestedId ??
		slugifyFieldName(filename.replace(/\.(csv|json)$/i, ""))
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");

	const suggestedMapping: Record<string, string> = {};
	const suggestedTransforms: FieldTransform[] = [];
	const fields = columns.map((col) => {
		const fieldName = slugifyFieldName(col);
		suggestedMapping[fieldName] = col;
		const type = inferredTypes[col]!;
		const fn = transformFor(type);
		if (fn) suggestedTransforms.push({ field: fieldName, fn });
		return { name: fieldName, type, label: col };
	});

	const suggestedSchema: SchemaDefinition = {
		id: schemaId,
		name: filename.replace(/\.(csv|json)$/i, ""),
		description: `Generated from ${filename}`,
		fields,
	};

	return {
		format,
		...(delimiter !== undefined ? { delimiter } : {}),
		columns,
		rowCount: rows.length,
		preview: rows.slice(0, 10),
		inferredTypes,
		suggestedSchema,
		suggestedMapping,
		suggestedTransforms,
	};
}
