import type { AuditEvent } from "@aurii/types";
import type { PlatformStore } from "./store";
import { getPlatformStore } from "./store";

export async function appendAudit(
	store: PlatformStore,
	input: Omit<AuditEvent, "id" | "createdAt"> & { id?: string },
): Promise<AuditEvent> {
	const event: AuditEvent = {
		id: input.id ?? crypto.randomUUID(),
		projectId: input.projectId,
		action: input.action,
		actor: input.actor,
		resourceType: input.resourceType,
		resourceId: input.resourceId,
		detail: input.detail,
		createdAt: new Date().toISOString(),
	};
	await store.appendAudit(event);
	return event;
}

export async function listAuditEvents(
	projectId: string,
	limit = 100,
	store: PlatformStore = getPlatformStore(),
): Promise<AuditEvent[]> {
	return store.listAudit(projectId, limit);
}
