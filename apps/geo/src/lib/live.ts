/**
 * Live Core / published-route delivery for apps/geo.
 * Frontend never imports Studio. Snapshot mode remains the offline default.
 */

export interface LiveGeoConfig {
	coreUrl: string;
	projectSlug: string;
}

export function getLiveGeoConfig(
	env: Record<string, string | undefined> = process.env,
): LiveGeoConfig | null {
	const coreUrl = env["AURII_CORE_URL"] ?? env["PUBLIC_AURII_CORE_URL"];
	if (!coreUrl) return null;
	return {
		coreUrl: coreUrl.replace(/\/$/, ""),
		projectSlug:
			env["AURII_PROJECT_SLUG"] ??
			env["PUBLIC_AURII_PROJECT_SLUG"] ??
			"norge-data",
	};
}

export async function fetchPublished<T>(
	config: LiveGeoConfig,
	path: string,
): Promise<T[]> {
	const url = `${config.coreUrl}/public/${config.projectSlug}/v1${path}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Published route ${path} failed: ${res.status}`);
	}
	const body = (await res.json()) as { data: T[] };
	return body.data;
}
