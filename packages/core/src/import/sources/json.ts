export async function readJsonFile(
	path: string,
): Promise<Record<string, unknown>[]> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`JSON file not found: ${path}`);
	}

	const content = await file.text();
	let parsed: unknown;

	try {
		parsed = JSON.parse(content);
	} catch (e) {
		throw new Error(`Failed to parse JSON file "${path}": ${String(e)}`);
	}

	if (!Array.isArray(parsed)) {
		throw new Error(
			`JSON source must be an array of objects, got ${typeof parsed}`,
		);
	}

	return parsed as Record<string, unknown>[];
}
