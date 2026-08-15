// Storage

// Entity
export {
	countEntities,
	createEntities,
	createEntity,
	getEntity,
	listEntities,
} from "./entity/store";
export type {
	Entity,
	EntityInput,
	EntityPage,
	EntityState,
} from "./entity/types";
export type { AnalysisResult } from "./import/analyze";
export {
	analyzeContent,
	detectDelimiter,
	detectFormat,
	slugifyFieldName,
} from "./import/analyze";
// Import
export type { ReferenceValidationMode } from "./import/reference-validator";
export { validateReferences } from "./import/reference-validator";
export { loadImportDefinition, runImport } from "./import/engine";
export type {
	FieldTransform,
	ImportDefinition,
	ImportPipeline,
	ImportResult,
	PipelineStep,
} from "./import/types";
// Pipeline
export { runPipeline, runStep } from "./pipeline/runner";
export { applyTransform } from "./pipeline/transforms";
export type { QueryResult } from "./query/executor";
export { executeQuery, explainQuery } from "./query/executor";
export type {
	AggregateQuery,
	Condition,
	JoinClause,
	QueryAST,
	Operator,
	OrderBy,
	ScalarValue,
	SelectQuery,
	WhereExpr,
} from "./query/ast";
export type { ParsedQuery } from "./query/parser";
// Query
export { parseQuery, toLegacyParsedQuery } from "./query/parser";
export type { ExecutionPlan, PlanExplanation } from "./query/plan";
export { explainPlan, planQuery } from "./query/planner";
// Schema
export {
	deleteSchema,
	getSchema,
	listSchemas,
	registerSchema,
} from "./schema/registry";
export type {
	FieldDefinition,
	FieldType,
	SchemaDefinition,
	StoredSchema,
	ValidationResult,
} from "./schema/types";
export { validateEntity, validateSchemaDefinition } from "./schema/validator";
export type {
	Dataset,
	DatasetInput,
	ImportRunRecord,
	SchemaStats,
	StorageAdapter,
	StorageStats,
} from "./storage";
export {
	closeStorage,
	DEFAULT_DATASET,
	getStorage,
	PostgresAdapter,
	SqliteAdapter,
} from "./storage";
// Capabilities
export {
	clearCapabilities,
	getCapability,
	hasCapability,
	listCapabilities,
	listCapabilitiesByKind,
	registerCapability,
	updateCapabilityStatus,
} from "./capabilities";
export type {
	Capability,
	CapabilityKind,
	CapabilityRegistration,
	CapabilityStatus,
} from "./capabilities";
// Events
export { clearHandlers, emit, on, onAny } from "./events";
export type {
	BaseEvent,
	DatasetCreatedEvent,
	DomainEvent,
	DomainEventType,
	EntityCreatedEvent,
	EntityDeletedEvent,
	EntityUpdatedEvent,
	EventHandler,
	ImportFinishedEvent,
	ImportStartedEvent,
} from "./events";
// Projects
export {
	assertProjectWritable,
	configureProjectService,
	createProjectService,
	DrizzleProjectRepository,
	ensureLegacyProject,
	getProjectService,
	InvalidProjectStatusTransitionError,
	isProjectError,
	isProjectWritable,
	MemoryProjectRepository,
	ProjectError,
	ProjectNotFoundError,
	ProjectNotWritableError,
	ProjectService,
	ProjectSlugConflictError,
	ProjectValidationError,
	requireDatasetInProject,
	requireWritableDatasetProject,
	resetProjectService,
	resolveDatasetProject,
} from "./project";
export type {
	DatasetProjectContext,
	ProjectErrorCode,
	ProjectInsert,
	ProjectPatch,
	ProjectRepository,
} from "./project";
// Datasets (project-scoped administration)
export {
	createDatasetService,
	DatasetError,
	DatasetIdConflictError,
	DatasetNotFoundError,
	DatasetService,
	DatasetValidationError,
	isDatasetError,
} from "./dataset";
export type {
	CreateDatasetInput,
	DatasetErrorCode,
	UpdateDatasetInput,
} from "./dataset";
// HTTP (for apps/api composition)
export { buildApp } from "./api/server";
export type { AppOptions } from "./api/server";
// Project package configuration
export {
	applyProjectPackage,
	defineProject,
	loadProjectConfigJson,
	loadProjectPackage,
	materializeProjectPackage,
	ProjectConfigError,
	registerProjectPackage,
	validateProjectReferences,
} from "./project-config";
export type {
	ApplyProjectPackageOptions,
	LoadedProjectPackage,
	MaterializedProjectPackage,
	ProjectPackageImportDef,
	ProjectPackageSourceDef,
	RegisterEvent,
	RegisterProjectPackageOptions,
	RegisterProjectPackageResult,
} from "./project-config";

export { defineRoute } from "./platform";
// Platform services (sources, saved imports, published routes, tokens)
export {
	appendAudit,
	configurePlatformStore,
	createDataSourceService,
	createDurablePlatformStore,
	createProjectTokenService,
	createPublishedRouteService,
	createSavedImportService,
	DataSourceError,
	DataSourceService,
	extractPathParams,
	getPlatformStore,
	hashToken,
	listAuditEvents,
	MemoryPlatformStore,
	parseBearer,
	ProjectTokenService,
	PublishedRouteError,
	PublishedRouteService,
	resetPlatformStore,
	SavedImportError,
	SavedImportService,
	SqlitePlatformStore,
	TokenError,
} from "./platform";
export type { PlatformStore } from "./platform";
// Scheduling
export {
	computeNextCronRun,
	getImportScheduler,
	ImportScheduler,
	resetImportScheduler,
} from "./schedule";
