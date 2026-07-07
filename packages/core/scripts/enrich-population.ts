#!/usr/bin/env bun
/**
 * Enrich county and municipality snapshots with population from SSB Statbank.
 *
 * Table 07459: Befolkning per 1.1., kommuner (Personer1 = total population).
 * County totals are aggregated from municipalities.
 *
 * Usage (from repo root):
 *   bun run packages/core/scripts/enrich-population.ts
 */

import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "../../..");
const DATA_DIR = resolve(ROOT, "demo/norwegian-geo/data");

const SSB_POPULATION_URL =
	"https://data.ssb.no/api/pxwebapi/v2/tables/07459/data?lang=no&valueCodes[Region]=*&valueCodes[ContentsCode]=Personer1&valueCodes[Tid]=top(1)&outputFormat=csv";

interface MunicipalityRow {
	id: string;
	name: string;
	countyId: string;
	source?: string;
	population?: number;
	populationYear?: number;
}

interface CountyRow {
	id: string;
	name: string;
	source?: string;
	population?: number;
	populationYear?: number;
}

function parseSsbCsv(csv: string): Map<string, { population: number; year: number }> {
	const lines = csv.trim().split("\n");
	if (lines.length < 2) {
		throw new Error("SSB CSV response was empty");
	}

	const header = lines[0]!.split(",");
	const regionIdx = header.findIndex((h) => h.trim() === "region");
	const yearIdx = header.findIndex((h) => h.trim() === "Tid");
	const valueIdx = header.findIndex((h) => h.trim() === "Personer1");

	if (regionIdx < 0 || yearIdx < 0 || valueIdx < 0) {
		throw new Error(`Unexpected SSB CSV header: ${lines[0]}`);
	}

	const result = new Map<string, { population: number; year: number }>();

	for (const line of lines.slice(1)) {
		const cols = line.split(",");
		const region = cols[regionIdx]?.trim() ?? "";
		const year = Number.parseInt(cols[yearIdx]?.trim() ?? "", 10);
		const population = Number.parseInt(cols[valueIdx]?.trim() ?? "", 10);

		// Municipality codes are 4-digit; county codes are 2-digit (skip those here).
		if (!/^\d{4}$/.test(region) || !Number.isFinite(population)) continue;

		result.set(region, { population, year });
	}

	return result;
}

async function fetchPopulationFromSsb(): Promise<
	Map<string, { population: number; year: number }>
> {
	const res = await fetch(SSB_POPULATION_URL, {
		headers: { Accept: "text/csv", "User-Agent": "Aurii/1.0" },
	});
	if (!res.ok) {
		throw new Error(`SSB population API: HTTP ${res.status}`);
	}

	const csv = await res.text();
	if (csv.includes("feilkode")) {
		throw new Error("SSB population API returned an error page");
	}

	return parseSsbCsv(csv);
}

async function writeJson(file: string, data: unknown) {
	await Bun.write(resolve(DATA_DIR, file), JSON.stringify(data, null, 2));
}

const municipalities = (await Bun.file(
	resolve(DATA_DIR, "municipalities.json"),
).json()) as MunicipalityRow[];
const counties = (await Bun.file(resolve(DATA_DIR, "counties.json")).json()) as CountyRow[];

const populationByMunicipality = await fetchPopulationFromSsb();
let populationYear: number | undefined;

const enrichedMunicipalities = municipalities.map((mun) => {
	const stats = populationByMunicipality.get(mun.id);
	if (!stats) return mun;
	populationYear = stats.year;
	return {
		...mun,
		population: stats.population,
		populationYear: stats.year,
	};
});

const missing = enrichedMunicipalities.filter((m) => m.population === undefined);
if (missing.length > 0) {
	const sample = missing
		.slice(0, 5)
		.map((m) => m.id)
		.join(", ");
	throw new Error(
		`Population missing for ${missing.length} municipalities (e.g. ${sample})`,
	);
}

const populationByCounty = new Map<string, number>();
for (const mun of enrichedMunicipalities) {
	if (mun.population === undefined) continue;
	populationByCounty.set(
		mun.countyId,
		(populationByCounty.get(mun.countyId) ?? 0) + mun.population,
	);
}

const enrichedCounties = counties.map((county) => ({
	...county,
	population: populationByCounty.get(county.id),
	populationYear,
}));

await Promise.all([
	writeJson("municipalities.json", enrichedMunicipalities),
	writeJson("counties.json", enrichedCounties),
]);

console.log(
	`Enriched ${enrichedMunicipalities.length} municipalities and ${enrichedCounties.length} counties`,
);
console.log(`Population year: ${populationYear ?? "unknown"}`);
console.log(
	`Total population: ${enrichedMunicipalities.reduce((sum, m) => sum + (m.population ?? 0), 0).toLocaleString("nb-NO")}`,
);
