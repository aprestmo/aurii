import { listCapabilities } from "../capabilities/registry";
import { getPlatformStore } from "../platform/store";
import { getImportScheduler } from "../schedule/scheduler";
import { getStorage } from "../storage";
import {
	isProductionEnv,
	resolveRuntimeIdentity,
	type RuntimeIdentity,
} from "./config";

export type HealthStatus = "ok" | "unavailable";

export interface HealthDatabase {
	connected: boolean;
}

export interface HealthBody {
	status: HealthStatus;
	phase: string;
	version: string;
	storage: "sqlite" | "postgres";
	scheduler: { enabled: boolean };
	platformStore: { mode: "memory" | "sqlite" | "postgres" };
	release: RuntimeIdentity;
	database: HealthDatabase;
	capabilities?: Array<{ id: string; kind: string; status: string }>;
}

export interface HealthReport {
	httpStatus: number;
	body: HealthBody;
}

function configuredStorageKind(
	env: Record<string, string | undefined> = process.env,
): "sqlite" | "postgres" {
	return env["AURII_STORAGE"] === "postgres" ? "postgres" : "sqlite";
}

/**
 * Build the /health payload. Storage/database failures become HTTP 503.
 * Never include connection strings or tokens.
 */
export async function buildHealthReport(
	env: Record<string, string | undefined> = process.env,
): Promise<HealthReport> {
	const identity = resolveRuntimeIdentity(env);
	let storageKind = configuredStorageKind(env);
	let connected = false;

	try {
		const storage = await getStorage();
		storageKind = storage.kind;
		await storage.ping();
		connected = true;
	} catch (error) {
		if (!isProductionEnv(env)) {
			console.error("Health storage probe failed:", error);
		} else {
			console.error("Health storage probe failed");
		}
	}

	const body: HealthBody = {
		status: connected ? "ok" : "unavailable",
		phase: "4.6",
		version: identity.version,
		storage: storageKind,
		scheduler: { enabled: getImportScheduler().isStarted() },
		platformStore: { mode: getPlatformStore().kind },
		release: identity,
		database: { connected },
	};
	if (connected) {
		body.capabilities = listCapabilities().map((c) => ({
			id: c.id,
			kind: c.kind,
			status: c.status,
		}));
	}

	return {
		httpStatus: connected ? 200 : 503,
		body,
	};
}
