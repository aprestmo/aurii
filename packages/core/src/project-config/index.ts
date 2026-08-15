export { defineProject, ProjectConfigError } from "./define";
export {
	loadProjectConfigJson,
	loadProjectPackage,
	validateProjectReferences,
	type LoadedProjectPackage,
} from "./load";
export {
	applyProjectPackage,
	materializeProjectPackage,
	registerProjectPackage,
} from "./register";
export type {
	ApplyProjectPackageOptions,
	MaterializedImport,
	MaterializedProjectPackage,
	MaterializedRoute,
	MaterializedSource,
	ProjectPackageImportDef,
	ProjectPackageSourceDef,
	RegisterEvent,
	RegisterOutcome,
	RegisterProjectPackageOptions,
	RegisterProjectPackageResult,
} from "./register";
