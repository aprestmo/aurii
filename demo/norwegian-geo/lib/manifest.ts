import { resolve } from "node:path";
import {
	CORE_DIR,
	MODULES_DIR,
	PRODUCT_ROOT,
	coreImportDir,
	coreSchemaDir,
	moduleImportDir,
	moduleSchemaDir,
} from "./paths";

export interface ProductModule {
	id: string;
	name: string;
	description: string;
	dependsOn: string[];
	schemas: string[];
	imports: string[];
}

export interface ProductManifest {
	id: string;
	name: string;
	dataset: { id: string; name: string };
	layers: {
		norwegianGeoCore: {
			schemas: string[];
			imports: string[];
		};
	};
	modules: ProductModule[];
}

export interface SchemaRef {
	schemaId: string;
	file: string;
	layer: "core" | "module";
	moduleId?: string;
}

export interface ImportRef {
	importId: string;
	file: string;
	layer: "core" | "module";
	moduleId?: string;
}

/** Programmatic manifest — keep in sync with `product.yaml`. */
export const MANIFEST: ProductManifest = {
	id: "norwegian-geo",
	name: "Norwegian Geo",
	dataset: {
		id: "norwegian-geo",
		name: "Norwegian Public Reference Data",
	},
	layers: {
		norwegianGeoCore: {
			schemas: ["county", "municipality", "postal-code"],
			imports: ["counties", "municipalities", "postal-codes"],
		},
	},
	modules: [
		{
			id: "education",
			name: "Education",
			description: "Schools and kindergartens from UDIR",
			dependsOn: ["norwegian-geo-core"],
			schemas: ["school", "kindergarten"],
			imports: ["schools", "kindergartens"],
		},
		{
			id: "health",
			name: "Health",
			description: "Hospitals from Brønnøysundregistrene",
			dependsOn: ["norwegian-geo-core"],
			schemas: ["hospital"],
			imports: ["hospitals"],
		},
		{
			id: "calendar",
			name: "Calendar",
			description: "Norwegian public holidays",
			dependsOn: [],
			schemas: ["public-holiday"],
			imports: ["public-holidays"],
		},
	],
};

export function loadManifest(): ProductManifest {
	return MANIFEST;
}

export function getDatasetId(manifest: ProductManifest): string {
	return manifest.dataset.id;
}

export function listCoreSchemas(manifest: ProductManifest): SchemaRef[] {
	return manifest.layers.norwegianGeoCore.schemas.map((schemaId) => ({
		schemaId,
		file: resolve(coreSchemaDir(), `${schemaId}.yaml`),
		layer: "core" as const,
	}));
}

export function listModuleSchemas(
	manifest: ProductManifest,
	module: ProductModule,
): SchemaRef[] {
	return module.schemas.map((schemaId) => ({
		schemaId,
		file: resolve(moduleSchemaDir(module.id), `${schemaId}.yaml`),
		layer: "module" as const,
		moduleId: module.id,
	}));
}

export function listAllSchemas(manifest: ProductManifest): SchemaRef[] {
	const core = listCoreSchemas(manifest);
	const modules = manifest.modules.flatMap((m) => listModuleSchemas(manifest, m));
	return [...core, ...modules];
}

export function listCoreImports(manifest: ProductManifest): ImportRef[] {
	return manifest.layers.norwegianGeoCore.imports.map((importId) => ({
		importId,
		file: resolve(coreImportDir(), `${importId}.yaml`),
		layer: "core" as const,
	}));
}

export function listModuleImports(
	manifest: ProductManifest,
	module: ProductModule,
): ImportRef[] {
	return module.imports.map((importId) => ({
		importId,
		file: resolve(moduleImportDir(module.id), `${importId}.yaml`),
		layer: "module" as const,
		moduleId: module.id,
	}));
}

/** Core imports first, then modules in manifest order. */
export function listAllImports(manifest: ProductManifest): ImportRef[] {
	const core = listCoreImports(manifest);
	const modules = manifest.modules.flatMap((m) => listModuleImports(manifest, m));
	return [...core, ...modules];
}

export function resolveModuleManifestPath(moduleId: string): string {
	return resolve(MODULES_DIR, moduleId, "module.yaml");
}

export { CORE_DIR, MODULES_DIR, PRODUCT_ROOT };
