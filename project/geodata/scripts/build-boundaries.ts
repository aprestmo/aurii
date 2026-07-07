#!/usr/bin/env bun
/**
 * Fetch official administrative boundaries from GeoNorge, simplify for web,
 * and publish GeoJSON snapshots for apps/geo.
 *
 * Usage (from repo root):
 *   bun run build:geodata
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import simplify from "@turf/simplify";
import bbox from "@turf/bbox";

const ROOT = resolve(import.meta.dir, "../../../..");
const OUTPUT_DIR = resolve(ROOT, "apps/geo/public/assets/geodata");

const MUNICIPALITY_METADATA_UUID = "041f1e6e-bdbc-4091-b48f-8a5990f3cc5b";
const COUNTY_METADATA_UUID = "6093c8a8-fa80-11e6-bc64-92361f002671";

const SIMPLIFY_TOLERANCE = 0.0008;
const GEOJSON_FORMAT = "GeoJSON ";
const PROJECTION_4258 = {
	code: "4258",
	name: "EUREF 89 Geografisk (ETRS 89) 2d",
	codespace: "http://www.opengis.net/def/crs/EPSG/0/4258",
};

interface GeoJsonFeature {
	type: "Feature";
	properties: Record<string, string>;
	geometry: GeoJSON.Geometry;
}

interface GeoJsonFeatureCollection {
	type: "FeatureCollection";
	features: GeoJsonFeature[];
}

interface DownloadOrderFile {
	downloadUrl: string;
	status: string;
}

interface DownloadOrderResponse {
	files: DownloadOrderFile[];
}

async function orderGeoJson(metadataUuid: string): Promise<string> {
	const response = await fetch("https://nedlasting.geonorge.no/api/order", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			orderLines: [
				{
					metadataUuid,
					areas: [
						{
							type: "landsdekkende",
							name: "Hele landet",
							code: "0000",
						},
					],
					formats: [{ name: GEOJSON_FORMAT }],
					projections: [PROJECTION_4258],
				},
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`GeoNorge order failed: HTTP ${response.status}`);
	}

	const order = (await response.json()) as DownloadOrderResponse;
	const file = order.files.find((entry) => entry.status === "ReadyForDownload");
	if (!file?.downloadUrl) {
		throw new Error("GeoNorge order returned no downloadable file");
	}

	return file.downloadUrl;
}

async function downloadGeoJsonZip(downloadUrl: string): Promise<GeoJsonFeatureCollection> {
	const response = await fetch(downloadUrl);
	if (!response.ok) {
		throw new Error(`GeoNorge download failed: HTTP ${response.status}`);
	}

	const zipBytes = await response.arrayBuffer();
	const { unzipSync } = await import("fflate");
	const archive = unzipSync(new Uint8Array(zipBytes));
	const geojsonName = Object.keys(archive).find(
		(name) =>
			name.endsWith(".geojson") &&
			!name.includes("Grense") &&
			(KommuneOrFylke(name)),
	);

	if (!geojsonName) {
		throw new Error("No municipality/county GeoJSON found in archive");
	}

	const text = new TextDecoder("utf-8").decode(archive[geojsonName]!);
	return JSON.parse(text.replace(/^\uFEFF/, "")) as GeoJsonFeatureCollection;
}

function KommuneOrFylke(name: string): boolean {
	return /Kommune|Fylke/i.test(name);
}

function padId(value: string, length: number): string {
	return String(value).padStart(length, "0");
}

function slimProperties(
	properties: Record<string, string>,
	kind: "municipality" | "county",
): Record<string, string> {
	if (kind === "municipality") {
		const id = padId(properties.kommunenummer, 4);
		return {
			id,
			name: properties.kommunenavn,
			countyId: id.slice(0, 2),
		};
	}

	return {
		id: padId(properties.fylkesnummer, 2),
		name: properties.fylkesnavn,
	};
}

function simplifyCollection(
	collection: GeoJsonFeatureCollection,
	kind: "municipality" | "county",
): GeoJsonFeatureCollection {
	const features = collection.features.map((feature) => {
		const simplified = simplify(feature, {
			tolerance: SIMPLIFY_TOLERANCE,
			highQuality: false,
		}) as GeoJsonFeature;

		return {
			type: "Feature" as const,
			properties: slimProperties(feature.properties, kind),
			geometry: simplified.geometry,
		};
	});

	return { type: "FeatureCollection", features };
}

function buildManifest(
	municipalities: GeoJsonFeatureCollection,
	counties: GeoJsonFeatureCollection,
) {
	return {
		source: "Kartverket / GeoNorge",
		license: "CC-BY-4.0",
		projection: "EPSG:4258",
		simplifyTolerance: SIMPLIFY_TOLERANCE,
		generatedAt: new Date().toISOString(),
		counties: Object.fromEntries(
			counties.features.map((feature) => [
				feature.properties.id,
				{
					name: feature.properties.name,
					bbox: bbox(feature),
				},
			]),
		),
		municipalities: Object.fromEntries(
			municipalities.features.map((feature) => [
				feature.properties.id,
				{
					name: feature.properties.name,
					countyId: feature.properties.countyId,
					bbox: bbox(feature),
				},
			]),
		),
	};
}

async function main() {
	console.log("Ordering municipality boundaries from GeoNorge…");
	const municipalityUrl = await orderGeoJson(MUNICIPALITY_METADATA_UUID);
	const municipalityRaw = await downloadGeoJsonZip(municipalityUrl);
	const municipalities = simplifyCollection(municipalityRaw, "municipality");
	console.log(`  ${municipalities.features.length} municipalities`);

	console.log("Ordering county boundaries from GeoNorge…");
	const countyUrl = await orderGeoJson(COUNTY_METADATA_UUID);
	const countyRaw = await downloadGeoJsonZip(countyUrl);
	const counties = simplifyCollection(countyRaw, "county");
	console.log(`  ${counties.features.length} counties`);

	await mkdir(OUTPUT_DIR, { recursive: true });

	const municipalityPath = resolve(OUTPUT_DIR, "municipalities.geojson");
	const countyPath = resolve(OUTPUT_DIR, "counties.geojson");
	const manifestPath = resolve(OUTPUT_DIR, "manifest.json");

	await writeFile(municipalityPath, JSON.stringify(municipalities));
	await writeFile(countyPath, JSON.stringify(counties));
	await writeFile(
		manifestPath,
		JSON.stringify(buildManifest(municipalities, counties), null, 2),
	);

	const municipalitySize = (await Bun.file(municipalityPath).size) / 1024 / 1024;
	const countySize = (await Bun.file(countyPath).size) / 1024 / 1024;
	console.log(`Wrote ${municipalityPath} (${municipalitySize.toFixed(2)} MB)`);
	console.log(`Wrote ${countyPath} (${countySize.toFixed(2)} MB)`);
	console.log(`Wrote ${manifestPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
