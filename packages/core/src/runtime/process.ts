import { closeStorage } from "../storage";
import { RuntimeConfigError, validateRuntimeConfig } from "./config";

/**
 * Fail the process immediately when critical production/runtime config is invalid.
 * Call this only from HTTP entrypoints, never from `buildApp()` (tests).
 */
export function assertRuntimeConfigOrExit(
	env: Record<string, string | undefined> = process.env,
): void {
	try {
		const config = validateRuntimeConfig(env);
		console.log(
			`Aurii runtime ${config.identity.version}` +
				`${config.identity.gitSha ? ` (${config.identity.gitSha})` : ""}` +
				` storage=${config.storage}` +
				` auth=${config.apiTokenConfigured ? "token" : "open"}` +
				` cors=${config.cors.mode}` +
				` env=${config.production ? "production" : "development"}`,
		);
	} catch (error) {
		const message =
			error instanceof RuntimeConfigError
				? error.message
				: error instanceof Error
					? error.message
					: String(error);
		console.error(`Aurii refused to start: ${message}`);
		process.exit(1);
	}
}

/**
 * SIGTERM/SIGINT: stop accepting traffic, close storage, then exit.
 */
export function attachShutdownHandlers(stop: () => Promise<void> | void): void {
	let shuttingDown = false;
	const onSignal = (signal: string) => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		console.log(`Aurii received ${signal}; shutting down`);
		Promise.resolve()
			.then(() => stop())
			.catch((error) => {
				console.error(error);
			})
			.then(() => closeStorage())
			.catch(() => undefined)
			.finally(() => {
				process.exit(0);
			});
	};
	process.on("SIGTERM", () => onSignal("SIGTERM"));
	process.on("SIGINT", () => onSignal("SIGINT"));
}
