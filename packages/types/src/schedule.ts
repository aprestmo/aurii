/**
 * Minimal scheduling model for import / sync definitions.
 *
 * Beta: single-process cron evaluation. Not a distributed job system.
 * See ADR-0018.
 */

export type ScheduleType = "cron";

export interface CronSchedule {
	type: "cron";
	/** Standard 5-field cron expression (minute hour day-of-month month day-of-week). */
	expression: string;
	/** IANA timezone, e.g. Europe/Oslo. */
	timezone: string;
}

export type ScheduleSpec = CronSchedule;

export interface ScheduleState {
	/** Whether the scheduler may fire this definition. */
	enabled: boolean;
	spec: ScheduleSpec;
	/** Computed next fire time (ISO), null when disabled or unknown. */
	nextRunAt: string | null;
	/** Last fire attempt (ISO). */
	lastRunAt: string | null;
}

export interface CreateScheduleInput {
	enabled?: boolean;
	spec: ScheduleSpec;
}
