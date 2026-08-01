/**
 * Single-process scheduler. Polls saved imports with enabled cron schedules.
 * Limitations: see ADR-0018.
 */

import type { SavedImportDefinition } from "@aurii/types";
import { createSavedImportService } from "../platform/saved-import-service";
import { getPlatformStore, type PlatformStore } from "../platform/store";
import { computeNextCronRun } from "./cron";

export interface SchedulerOptions {
	store?: PlatformStore;
	/** Poll interval ms (default 30_000). */
	intervalMs?: number;
	/** When true, do not start automatically — useful for tests. */
	manual?: boolean;
}

export class ImportScheduler {
	private timer: ReturnType<typeof setInterval> | null = null;
	private readonly store: PlatformStore;
	private readonly intervalMs: number;
	private running = false;

	constructor(options: SchedulerOptions = {}) {
		this.store = options.store ?? getPlatformStore();
		this.intervalMs = options.intervalMs ?? 30_000;
	}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => {
			void this.tick();
		}, this.intervalMs);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async tick(now: Date = new Date()): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			const service = createSavedImportService(this.store);
			// Scan all projects' imports — store lists per project; we need all.
			// Memory store: gather by listing known imports via internal access.
			const due = await this.collectDue(now);
			for (const def of due) {
				try {
					await service.run(def.projectId, def.id, {
						dryRun: false,
						trigger: "schedule",
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					const latest = await this.store.getSavedImport(def.projectId, def.id);
					if (latest?.schedule) {
						await this.store.updateSavedImport(def.projectId, def.id, {
							...latest,
							schedule: {
								...latest.schedule,
								lastRunAt: now.toISOString(),
								nextRunAt: latest.schedule.enabled
									? computeNextCronRun(
											latest.schedule.spec.expression,
											latest.schedule.spec.timezone,
											now,
										)
									: null,
							},
							updatedAt: now.toISOString(),
						});
					}
					if (def.sourceId) {
						const source = await this.store.getDataSource(
							def.projectId,
							def.sourceId,
						);
						if (source) {
							await this.store.updateDataSource(def.projectId, def.sourceId, {
								...source,
								status: "error",
								lastFailureAt: now.toISOString(),
								lastError: message,
								updatedAt: now.toISOString(),
							});
						}
					}
				}
			}
		} finally {
			this.running = false;
		}
	}

	/**
	 * Test helper: expose due-collection. Uses SavedImportService.list per
	 * known project ids passed in, or scans via a provided list.
	 */
	async collectDueForProjects(
		projectIds: string[],
		now: Date = new Date(),
	): Promise<SavedImportDefinition[]> {
		const due: SavedImportDefinition[] = [];
		for (const projectId of projectIds) {
			const defs = await this.store.listSavedImports(projectId);
			for (const def of defs) {
				if (def.status !== "active") continue;
				if (!def.schedule?.enabled) continue;
				if (!def.schedule.nextRunAt) continue;
				if (new Date(def.schedule.nextRunAt).getTime() <= now.getTime()) {
					due.push(def);
				}
			}
		}
		return due;
	}

	private async collectDue(now: Date): Promise<SavedImportDefinition[]> {
		// Without a global index, tick is a no-op unless project ids are registered.
		// API server registers project ids via setWatchedProjects.
		return this.collectDueForProjects(this.watchedProjects, now);
	}

	private watchedProjects: string[] = [];

	setWatchedProjects(projectIds: string[]): void {
		this.watchedProjects = [...projectIds];
	}
}

let singleton: ImportScheduler | null = null;

export function getImportScheduler(): ImportScheduler {
	if (!singleton) singleton = new ImportScheduler();
	return singleton;
}

export function resetImportScheduler(): void {
	singleton?.stop();
	singleton = null;
}
