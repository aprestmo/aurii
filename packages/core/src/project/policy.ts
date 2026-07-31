/**
 * Shared project write policy.
 *
 * Independent of HTTP. Dataset, import, and schema mutations all use this
 * so write rules are not duplicated ad hoc.
 *
 * Rules (ADR-0011 / ADR-0013):
 * - active   → writes allowed
 * - inactive → reads allowed, writes rejected
 * - archived → reads allowed, writes rejected
 */

import type { Project } from "@aurii/types";
import { ProjectNotWritableError } from "./errors";

/**
 * Assert that a project allows write operations.
 *
 * @param project - Loaded project entity
 * @param operation - Optional label for logging/debug (e.g. "import.run")
 */
export function assertProjectWritable(
	project: Project,
	operation?: string,
): void {
	if (project.status !== "active") {
		throw new ProjectNotWritableError(project.id, project.status, operation);
	}
}

/** Whether the project currently accepts mutations. */
export function isProjectWritable(project: Project): boolean {
	return project.status === "active";
}
