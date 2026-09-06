import type { FieldDefinition, SchemaDefinition } from "./types";
import { referenceTarget } from "./types";

export type SchemaChangeKind =
	| "compatible"
	| "potentially_breaking"
	| "breaking";

export interface SchemaChangeClassification {
	kind: SchemaChangeKind;
	reasons: string[];
}

function fieldMap(fields: FieldDefinition[]): Map<string, FieldDefinition> {
	return new Map(fields.map((f) => [f.name, f]));
}

/**
 * Classify a schema definition change relative to a previously stored schema.
 *
 * Detects breaking / potentially breaking changes so they are never silently
 * treated as compatible. See docs/SCHEMA_EVOLUTION.md.
 */
export function classifySchemaChange(
	previous: SchemaDefinition,
	next: SchemaDefinition,
): SchemaChangeClassification {
	const reasons: string[] = [];
	let kind: SchemaChangeKind = "compatible";

	const raise = (nextKind: SchemaChangeKind, reason: string) => {
		reasons.push(reason);
		if (nextKind === "breaking") kind = "breaking";
		else if (nextKind === "potentially_breaking" && kind === "compatible") {
			kind = "potentially_breaking";
		}
	};

	const prevFields = fieldMap(previous.fields);
	const nextFields = fieldMap(next.fields);

	for (const [name, prev] of prevFields) {
		const cur = nextFields.get(name);
		if (!cur) {
			raise("breaking", `Removed field "${name}"`);
			continue;
		}
		if (prev.type !== cur.type) {
			raise(
				"breaking",
				`Changed type of field "${name}" from ${prev.type} to ${cur.type}`,
			);
		}
		if ((prev.multiple ?? false) !== (cur.multiple ?? false)) {
			raise(
				"potentially_breaking",
				`Changed multiple flag on field "${name}"`,
			);
		}
		if (prev.type === "reference" || cur.type === "reference") {
			const prevTo = referenceTarget(prev);
			const curTo = referenceTarget(cur);
			if (prevTo !== curTo) {
				raise(
					"potentially_breaking",
					`Changed reference target of field "${name}" from ${prevTo ?? "?"} to ${curTo ?? "?"}`,
				);
			}
		}
		if (!prev.required && cur.required) {
			raise(
				"potentially_breaking",
				`Made field "${name}" required`,
			);
		}
	}

	// Renames are indistinguishable from remove+add at this layer; callers that
	// rename should bump schemaVersion and treat as breaking via remove+add.
	for (const [name, cur] of nextFields) {
		if (!prevFields.has(name) && cur.required) {
			raise(
				"potentially_breaking",
				`Added required field "${name}"`,
			);
		}
	}

	return { kind, reasons };
}

/**
 * Suggest the next schemaVersion when registering an updated definition.
 * Compatible metadata-only changes may keep the same version if the caller
 * passes an explicit version; otherwise bump when the classification is not
 * purely empty/compatible with identical field sets.
 */
export function nextSchemaVersion(
	previousVersion: number,
	classification: SchemaChangeClassification,
	explicitVersion?: number,
): number {
	if (explicitVersion !== undefined) {
		return Math.max(explicitVersion, previousVersion);
	}
	if (classification.kind === "compatible" && classification.reasons.length === 0) {
		// Still bump when fields were added (optional) so history is explicit.
		return previousVersion;
	}
	if (classification.kind === "compatible") {
		return previousVersion + 1;
	}
	return previousVersion + 1;
}
