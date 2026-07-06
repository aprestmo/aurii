/**
 * Minimal CSV reader that handles:
 * - Header row
 * - Quoted fields (including fields with embedded commas and newlines)
 * - Configurable delimiter
 * - Empty lines skipped
 */

export function parseCsv(
	content: string,
	delimiter = ",",
): Record<string, string>[] {
	const lines = splitCsvLines(content);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]!, delimiter).map((h) => h.trim());
	const records: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]!.trim();
		if (!line) continue;

		const values = parseCsvLine(line, delimiter);
		const record: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			record[headers[j]!] = (values[j] ?? "").trim();
		}
		records.push(record);
	}

	return records;
}

function parseCsvLine(line: string, delimiter: string): string[] {
	const fields: string[] = [];
	let field = "";
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i]!;

		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					// Escaped quote
					field += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				field += ch;
				i++;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (line.slice(i, i + delimiter.length) === delimiter) {
				fields.push(field);
				field = "";
				i += delimiter.length;
			} else {
				field += ch;
				i++;
			}
		}
	}

	fields.push(field);
	return fields;
}

/**
 * Split CSV content into lines, preserving quoted newlines.
 */
function splitCsvLines(content: string): string[] {
	const lines: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < content.length; i++) {
		const ch = content[i]!;
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
		} else if ((ch === "\n" || ch === "\r") && !inQuotes) {
			if (ch === "\r" && content[i + 1] === "\n") i++;
			if (current.trim()) lines.push(current);
			current = "";
		} else {
			current += ch;
		}
	}

	if (current.trim()) lines.push(current);
	return lines;
}

export async function readCsvFile(
	path: string,
	delimiter = ",",
): Promise<Record<string, string>[]> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`CSV file not found: ${path}`);
	}
	const content = await file.text();
	return parseCsv(content, delimiter);
}
