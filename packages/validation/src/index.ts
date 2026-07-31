export type { ValidationIssue, ValidationResult } from "./result";
export { fail, ok } from "./result";
export type {
	NormalizedCreateProject,
	NormalizedUpdateProject,
} from "./project";
export {
	generateSlugFromName,
	normalizeSlug,
	validateCreateProject,
	validateProjectStatus,
	validateUpdateProject,
} from "./project";
