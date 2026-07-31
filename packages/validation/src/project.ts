/**
 * Project input validation and slug normalization.
 *
 * Rules live here — not in HTTP handlers — so Core and API share one path.
 */

import type {
	CreateProjectInput,
	ProjectStatus,
	UpdateProjectInput,
} from "@aurii/types";
import { isProjectStatus } from "@aurii/types";
import { fail, ok, type ValidationIssue, type ValidationResult } from "./result";

const NAME_MIN = 2;
const NAME_MAX = 100;
const SLUG_MAX = 100;
const DESCRIPTION_MAX = 1000;

/** Lowercase letters, digits, hyphens; no leading/trailing hyphen. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface NormalizedCreateProject {
	name: string;
	slug: string;
	description: string | null;
}

export interface NormalizedUpdateProject {
	name?: string;
	slug?: string;
	description?: string | null;
}

/**
 * Generate a URL-safe slug from a display name.
 * Norwegian letters are folded to ASCII approximations.
 */
export function generateSlugFromName(name: string): string {
	const folded = name
		.trim()
		.toLowerCase()
		.replace(/æ/g, "ae")
		.replace(/ø/g, "o")
		.replace(/å/g, "a")
		.normalize("NFD")
		.replace(/\p{M}/gu, "");

	return folded
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, SLUG_MAX)
		.replace(/-+$/g, "");
}

export function normalizeSlug(raw: string): string {
	return raw.trim().toLowerCase();
}

function validateName(raw: unknown, issues: ValidationIssue[]): string | null {
	if (typeof raw !== "string") {
		issues.push({ path: "name", message: "name is required" });
		return null;
	}
	const name = raw.trim();
	if (name.length < NAME_MIN) {
		issues.push({
			path: "name",
			message: `name must be at least ${NAME_MIN} characters`,
		});
		return null;
	}
	if (name.length > NAME_MAX) {
		issues.push({
			path: "name",
			message: `name must be at most ${NAME_MAX} characters`,
		});
		return null;
	}
	return name;
}

function validateSlugValue(
	raw: unknown,
	issues: ValidationIssue[],
): string | null {
	if (typeof raw !== "string") {
		issues.push({ path: "slug", message: "slug must be a string" });
		return null;
	}
	const slug = normalizeSlug(raw);
	if (slug.length === 0) {
		issues.push({ path: "slug", message: "slug must not be empty" });
		return null;
	}
	if (slug.length > SLUG_MAX) {
		issues.push({
			path: "slug",
			message: `slug must be at most ${SLUG_MAX} characters`,
		});
		return null;
	}
	if (!SLUG_PATTERN.test(slug)) {
		issues.push({
			path: "slug",
			message:
				"slug must be lowercase letters, digits, and hyphens; cannot start or end with a hyphen",
		});
		return null;
	}
	return slug;
}

function validateDescription(
	raw: unknown,
	issues: ValidationIssue[],
	required: boolean,
): string | null | undefined {
	if (raw === undefined) {
		if (required) {
			return null;
		}
		return undefined;
	}
	if (raw === null) {
		return null;
	}
	if (typeof raw !== "string") {
		issues.push({ path: "description", message: "description must be a string" });
		return undefined;
	}
	const description = raw.trim();
	if (description.length > DESCRIPTION_MAX) {
		issues.push({
			path: "description",
			message: `description must be at most ${DESCRIPTION_MAX} characters`,
		});
		return undefined;
	}
	return description.length === 0 ? null : description;
}

export function validateCreateProject(
	input: CreateProjectInput,
): ValidationResult<NormalizedCreateProject> {
	const issues: ValidationIssue[] = [];
	const name = validateName(input.name, issues);

	let slug: string | null = null;
	if (input.slug !== undefined && input.slug !== null && input.slug !== "") {
		slug = validateSlugValue(input.slug, issues);
	} else if (name) {
		const generated = generateSlugFromName(name);
		if (!generated || !SLUG_PATTERN.test(generated)) {
			issues.push({
				path: "slug",
				message:
					"could not generate a valid slug from name; provide an explicit slug",
			});
		} else {
			slug = generated;
		}
	}

	const description = validateDescription(input.description, issues, false);
	const resolvedDescription =
		description === undefined ? null : (description ?? null);

	if (issues.length > 0 || !name || !slug) {
		return fail(issues.length > 0 ? issues : [{ path: "name", message: "invalid" }]);
	}

	return ok({
		name,
		slug,
		description: resolvedDescription,
	});
}

export function validateUpdateProject(
	input: UpdateProjectInput,
): ValidationResult<NormalizedUpdateProject> {
	const issues: ValidationIssue[] = [];
	const result: NormalizedUpdateProject = {};

	if (input.name !== undefined) {
		const name = validateName(input.name, issues);
		if (name) result.name = name;
	}

	if (input.slug !== undefined) {
		const slug = validateSlugValue(input.slug, issues);
		if (slug) result.slug = slug;
	}

	if (input.description !== undefined) {
		const description = validateDescription(input.description, issues, false);
		if (description !== undefined) {
			result.description = description;
		}
	}

	if (
		result.name === undefined &&
		result.slug === undefined &&
		result.description === undefined &&
		issues.length === 0
	) {
		issues.push({
			path: "",
			message: "at least one of name, slug, or description is required",
		});
	}

	if (issues.length > 0) {
		return fail(issues);
	}

	return ok(result);
}

export function validateProjectStatus(
	raw: unknown,
): ValidationResult<ProjectStatus> {
	if (!isProjectStatus(raw)) {
		return fail([
			{
				path: "status",
				message: 'status must be "active", "inactive", or "archived"',
			},
		]);
	}
	return ok(raw);
}
