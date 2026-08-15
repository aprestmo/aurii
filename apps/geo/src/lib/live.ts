/**
 * Live Core / published-route delivery for apps/geo.
 *
 * Live mode is the production integration contract:
 *   Import → Core → published route / @aurii/sdk → this frontend
 *
 * Snapshot mode is an explicit offline / build-time fallback.
 * This module never imports Studio.
 *
 * See `docs/DELIVERY.md`.
 */

import { AuriiError, createClient, type AuriiClient } from "@aurii/sdk";

export type GeoDeliveryMode = "live" | "snapshot";

export interface LiveGeoConfig {
	coreUrl: string;
	projectSlug: string;
}

export interface ResolvedGeoDelivery {
	mode: GeoDeliveryMode;
	config: LiveGeoConfig | null;
}

/** Canonical published-route paths for Norwegian Geo core schemas. */
export const LIVE_GEO_ROUTES = {
	counties: "/counties",
	municipalities: "/municipalities",
	postalCodes: "/postal-codes",
} as const;

export class LiveDeliveryError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "LiveDeliveryError";
	}
}

function readEnv(
	env: Record<string, string | undefined>,
	key: string,
): string | undefined {
	const value = env[key];
	return value && value.length > 0 ? value : undefined;
}

function liveConfigFromEnv(
	env: Record<string, string | undefined>,
): LiveGeoConfig | null {
	const coreUrl =
		readEnv(env, "AURII_CORE_URL") ?? readEnv(env, "PUBLIC_AURII_CORE_URL");
	if (!coreUrl) return null;
	return {
		coreUrl: coreUrl.replace(/\/$/, ""),
		projectSlug:
			readEnv(env, "AURII_PROJECT_SLUG") ??
			readEnv(env, "PUBLIC_AURII_PROJECT_SLUG") ??
			"norge-data",
	};
}

/**
 * Resolve live vs snapshot mode.
 *
 * - `AURII_DELIVERY_MODE=snapshot` forces snapshot even if a Core URL is set.
 * - `AURII_DELIVERY_MODE=live` requires a Core URL and never reads snapshots.
 * - Otherwise live is selected when `AURII_CORE_URL` (or `PUBLIC_AURII_CORE_URL`)
 *   is set; snapshot is the default offline/build mode.
 */
export function resolveGeoDelivery(
	env: Record<string, string | undefined> = process.env,
): ResolvedGeoDelivery {
	const explicit =
		readEnv(env, "AURII_DELIVERY_MODE") ??
		readEnv(env, "PUBLIC_AURII_DELIVERY_MODE");
	const config = liveConfigFromEnv(env);

	if (explicit === "snapshot") {
		return { mode: "snapshot", config: null };
	}

	if (explicit === "live") {
		if (!config) {
			throw new LiveDeliveryError(
				"AURII_DELIVERY_MODE=live requires AURII_CORE_URL (or PUBLIC_AURII_CORE_URL)",
			);
		}
		return { mode: "live", config };
	}

	if (config) {
		return { mode: "live", config };
	}

	return { mode: "snapshot", config: null };
}

/** @deprecated Use `resolveGeoDelivery`. Kept for existing tests. */
export function getLiveGeoConfig(
	env: Record<string, string | undefined> = process.env,
): LiveGeoConfig | null {
	return resolveGeoDelivery(env).config;
}

export function createGeoDeliveryClient(config: LiveGeoConfig): AuriiClient {
	return createClient({ baseUrl: config.coreUrl });
}

export async function fetchPublished<T>(
	config: LiveGeoConfig,
	path: string,
	client: AuriiClient = createGeoDeliveryClient(config),
): Promise<T[]> {
	try {
		const page = await client.published.get<T>(config.projectSlug, path);
		if (!Array.isArray(page.data)) {
			throw new LiveDeliveryError(
				`Published route ${path} returned no data array`,
			);
		}
		return page.data;
	} catch (error) {
		if (error instanceof LiveDeliveryError) throw error;
		const status = error instanceof AuriiError ? error.status : undefined;
		const message = error instanceof Error ? error.message : String(error);
		const statusPart = status !== undefined ? ` (${status})` : "";
		throw new LiveDeliveryError(
			`Live delivery failed for ${path}${statusPart}; snapshot fallback is disabled in live mode: ${message}`,
			error,
		);
	}
}
