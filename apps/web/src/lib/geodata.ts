import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "../..");
const GEODATA_DIR = resolve(ROOT, "apps/geo/public/assets/geodata");

export interface GeoManifestEntry {
	name: string;
	bbox: [number, number, number, number];
	countyId?: string;
}

export interface GeoManifest {
	source: string;
	license: string;
	projection: string;
	simplifyTolerance: number;
	generatedAt: string;
	counties: Record<string, GeoManifestEntry>;
	municipalities: Record<string, GeoManifestEntry>;
}

export async function loadGeoManifest(): Promise<GeoManifest> {
	const raw = await readFile(resolve(GEODATA_DIR, "manifest.json"), "utf8");
	return JSON.parse(raw) as GeoManifest;
}

export function geoAssetPaths() {
	return {
		counties: "assets/geodata/counties.geojson",
		municipalities: "assets/geodata/municipalities.geojson",
		manifest: "assets/geodata/manifest.json",
	};
}
