#!/usr/bin/env bun
/**
 * Fetch fresh Norwegian public reference data from authoritative open sources.
 *
 * Usage (from repo root):
 *   bun run fetch:norwegian-geo
 */

import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "../../..");
const DATA_DIR = resolve(ROOT, "demo/norwegian-geo/data");

const KARTVERKET_COUNTIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/fylker";
const KARTVERKET_MUNICIPALITIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/kommuner";
const BRING_POSTNUMMER_TSV_URL =
	"https://www.bring.no/tjenester/adressetjenester/postnummer/_/attachment/download/7f0186f6-cf90-4657-8b5b-70707abeb789:62b42f1b8274a60db4bba965e64c7cf2c43143e9/Postnummerregister-ansi.txt";
const NSR_UNITS_URL = "https://data-nsr.udir.no/v4/enheter";
const NBR_UNITS_URL = "https://data-nbr.udir.no/v4/enheter";
const BRREG_UNITS_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";
const HOLIDAY_API_URL = "https://date.nager.at/api/v3/PublicHolidays";

const HOLIDAY_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const HOSPITAL_INDUSTRY_CODE = "86.10";
const SSB_POPULATION_URL =
	"https://data.ssb.no/api/pxwebapi/v2/tables/07459/data?lang=no&valueCodes[Region]=*&valueCodes[ContentsCode]=Personer1&valueCodes[Tid]=top(1)&outputFormat=csv";

interface KartverketCounty {
	fylkesnummer: string;
	fylkesnavn: string;
}

interface KartverketMunicipality {
	kommunenummer: string;
	kommunenavnNorsk: string;
}

interface UdirUnit {
	Organisasjonsnummer: string;
	Navn: string;
	Fylkesnummer?: string;
	Kommunenummer?: string;
	ErAktiv?: boolean;
	ErSkole?: boolean;
	ErBarnehage?: boolean;
	ErOffentligSkole?: boolean;
	ErPrivatskole?: boolean;
	ErGrunnskole?: boolean;
	ErVideregaaendeSkole?: boolean;
	ErOffentligBarnehage?: boolean;
	ErPrivatBarnehage?: boolean;
}

interface UdirPage {
	Sidenummer: number;
	AntallPerSide: number;
	AntallSider: number;
	TotaltAntallEnheter: number;
	EnhetListe: UdirUnit[];
}

interface BrregEntity {
	organisasjonsnummer: string;
	navn: string;
	naeringskode1?: { kode: string; beskrivelse: string };
	forretningsadresse?: { kommunenummer?: string };
}

interface BrregPage {
	_embedded?: { enheter: BrregEntity[] };
	page?: { totalPages?: number };
}

interface HolidayRow {
	date: string;
	localName: string;
	name: string;
	global: boolean;
	types?: string[];
}

function padMunicipalityId(value: string | undefined): string {
	return String(value ?? "").padStart(4, "0");
}

function padCountyId(value: string | undefined): string {
	return String(value ?? "").padStart(2, "0");
}

function isTestUdirUnit(unit: UdirUnit): boolean {
	const org = String(unit.Organisasjonsnummer ?? "");
	return unit.Kommunenummer === "2599" || org.startsWith("U");
}

async function fetchCounties() {
	const res = await fetch(KARTVERKET_COUNTIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket counties: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketCounty[];
	return data.map((c) => ({
		id: c.fylkesnummer,
		name: c.fylkesnavn,
		source: "kartverket",
	}));
}

async function fetchMunicipalities() {
	const res = await fetch(KARTVERKET_MUNICIPALITIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket municipalities: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketMunicipality[];
	return data.map((m) => ({
		id: m.kommunenummer,
		name: m.kommunenavnNorsk,
		countyId: m.kommunenummer.slice(0, 2),
		source: "kartverket",
	}));
}

async function fetchPostalCodes() {
	const res = await fetch(BRING_POSTNUMMER_TSV_URL);
	if (!res.ok) throw new Error(`Bring postnummer TSV: HTTP ${res.status}`);

	const bytes = new Uint8Array(await res.arrayBuffer());
	const text = new TextDecoder("latin1" as "utf-8").decode(bytes);
	const lines = text.trim().split("\n");

	return lines.map((line) => {
		const [postnummer, poststed, kommunenummer, kommunenavn, type] =
			line.split("\t");
		return {
			code: String(postnummer ?? "").padStart(4, "0"),
			city: String(poststed ?? ""),
			municipalityId: String(kommunenummer ?? ""),
			municipalityName: String(kommunenavn ?? ""),
			postalCodeType: String(type ?? ""),
			source: "bring",
		};
	});
}

async function fetchUdirUnits(
	baseUrl: string,
	label: string,
	predicate: (unit: UdirUnit) => boolean,
	mapper: (unit: UdirUnit) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
	const results: Record<string, unknown>[] = [];
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages) {
		const url = `${baseUrl}?Sidenummer=${page}&AntallPerSide=1000`;
		const res = await fetch(url, { headers: { Accept: "application/json" } });
		if (!res.ok) throw new Error(`${label}: HTTP ${res.status} on page ${page}`);

		const data = (await res.json()) as UdirPage;
		totalPages = data.AntallSider;
		for (const unit of data.EnhetListe) {
			if (!predicate(unit) || isTestUdirUnit(unit)) continue;
			results.push(mapper(unit));
		}
		page += 1;
	}

	return results;
}

async function fetchSchools() {
	return fetchUdirUnits(
		NSR_UNITS_URL,
		"UDIR NSR",
		(unit) => Boolean(unit.ErAktiv && unit.ErSkole),
		(unit) => ({
			id: unit.Organisasjonsnummer,
			name: unit.Navn,
			municipalityId: padMunicipalityId(unit.Kommunenummer),
			countyId: padCountyId(unit.Fylkesnummer),
			isPublic: Boolean(unit.ErOffentligSkole),
			isPrimary: Boolean(unit.ErGrunnskole),
			isSecondary: Boolean(unit.ErVideregaaendeSkole),
			isActive: true,
			source: "udir-nsr",
		}),
	);
}

async function fetchKindergartens() {
	return fetchUdirUnits(
		NBR_UNITS_URL,
		"UDIR NBR",
		(unit) => Boolean(unit.ErAktiv && unit.ErBarnehage),
		(unit) => ({
			id: unit.Organisasjonsnummer,
			name: unit.Navn,
			municipalityId: padMunicipalityId(unit.Kommunenummer),
			countyId: padCountyId(unit.Fylkesnummer),
			isPublic: Boolean(unit.ErOffentligBarnehage),
			isActive: true,
			source: "udir-nbr",
		}),
	);
}

async function fetchHospitals() {
	const results: Record<string, unknown>[] = [];
	let page = 0;
	let totalPages = 1;

	while (page < totalPages) {
		const url = `${BRREG_UNITS_URL}?naeringskode=${encodeURIComponent(HOSPITAL_INDUSTRY_CODE)}&page=${page}&size=100`;
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) throw new Error(`Brreg hospitals: HTTP ${res.status}`);

		const data = (await res.json()) as BrregPage;
		totalPages = data.page?.totalPages ?? 1;
		for (const entity of data._embedded?.enheter ?? []) {
			const municipalityId = padMunicipalityId(
				entity.forretningsadresse?.kommunenummer,
			);
			if (!municipalityId || municipalityId === "0000") continue;
			results.push({
				id: entity.organisasjonsnummer,
				name: entity.navn,
				municipalityId,
				industryCode: entity.naeringskode1?.kode ?? HOSPITAL_INDUSTRY_CODE,
				industryDescription: entity.naeringskode1?.beskrivelse ?? "",
				source: "brreg",
			});
		}
		page += 1;
	}

	return results;
}

function filterByKnownMunicipalities<T extends { municipalityId: string }>(
	rows: T[],
	validMunicipalityIds: Set<string>,
): T[] {
	return rows.filter((row) => validMunicipalityIds.has(row.municipalityId));
}

async function fetchPublicHolidays() {
	const holidays: Record<string, unknown>[] = [];

	for (const year of HOLIDAY_YEARS) {
		const res = await fetch(`${HOLIDAY_API_URL}/${year}/NO`, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) throw new Error(`Public holidays ${year}: HTTP ${res.status}`);
		const rows = (await res.json()) as HolidayRow[];
		for (const row of rows) {
			holidays.push({
				id: row.date,
				date: row.date,
				localName: row.localName,
				name: row.name,
				year,
				isNational: row.global,
				holidayType: row.types?.join(", ") ?? "Public",
				source: "nager-date",
			});
		}
	}

	return holidays;
}

async function writeJson(file: string, data: unknown) {
	await Bun.write(resolve(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function parseSsbPopulationCsv(
	csv: string,
): Map<string, { population: number; year: number }> {
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

		if (!/^\d{4}$/.test(region) || !Number.isFinite(population)) continue;

		result.set(region, { population, year });
	}

	return result;
}

async function fetchPopulationFromSsb() {
	const res = await fetch(SSB_POPULATION_URL, {
		headers: { Accept: "text/csv", "User-Agent": "Aurii/1.0" },
	});
	if (!res.ok) throw new Error(`SSB population API: HTTP ${res.status}`);

	const csv = await res.text();
	if (csv.includes("feilkode")) {
		throw new Error("SSB population API returned an error page");
	}

	return parseSsbPopulationCsv(csv);
}

function enrichWithPopulation<
	T extends { id: string; countyId?: string; population?: number; populationYear?: number },
>(
	rows: T[],
	populationByMunicipality: Map<string, { population: number; year: number }>,
): T[] {
	let populationYear: number | undefined;

	const enriched = rows.map((row) => {
		const stats = populationByMunicipality.get(row.id);
		if (!stats) return row;
		populationYear = stats.year;
		return {
			...row,
			population: stats.population,
			populationYear: stats.year,
		};
	});

	return enriched;
}

function aggregateCountyPopulation(
	counties: Array<{ id: string; name: string; source?: string }>,
	municipalities: Array<{
		countyId: string;
		population?: number;
		populationYear?: number;
	}>,
) {
	const totals = new Map<string, number>();
	let populationYear: number | undefined;

	for (const mun of municipalities) {
		if (mun.population === undefined) continue;
		populationYear = mun.populationYear ?? populationYear;
		totals.set(mun.countyId, (totals.get(mun.countyId) ?? 0) + mun.population);
	}

	return counties.map((county) => ({
		...county,
		population: totals.get(county.id),
		populationYear,
	}));
}

const [counties, municipalities, postalCodes, hospitals, publicHolidays] =
	await Promise.all([
		fetchCounties(),
		fetchMunicipalities(),
		fetchPostalCodes(),
		fetchHospitals(),
		fetchPublicHolidays(),
	]);

const validMunicipalityIds = new Set(municipalities.map((m) => m.id));
const [schools, kindergartens, populationByMunicipality] = await Promise.all([
	fetchSchools().then((rows) =>
		filterByKnownMunicipalities(rows as { municipalityId: string }[], validMunicipalityIds),
	),
	fetchKindergartens().then((rows) =>
		filterByKnownMunicipalities(rows as { municipalityId: string }[], validMunicipalityIds),
	),
	fetchPopulationFromSsb(),
]);

const enrichedMunicipalities = enrichWithPopulation(
	municipalities,
	populationByMunicipality,
);
const enrichedCounties = aggregateCountyPopulation(counties, enrichedMunicipalities);

await Promise.all([
	writeJson("counties.json", enrichedCounties),
	writeJson("municipalities.json", enrichedMunicipalities),
	writeJson("postal-codes.json", postalCodes),
	writeJson("schools.json", schools),
	writeJson("kindergartens.json", kindergartens),
	writeJson("hospitals.json", hospitals),
	writeJson("public-holidays.json", publicHolidays),
]);

console.log(`Wrote ${enrichedCounties.length} counties`);
console.log(`Wrote ${enrichedMunicipalities.length} municipalities`);
console.log(`Wrote ${postalCodes.length} postal codes`);
console.log(`Wrote ${schools.length} schools`);
console.log(`Wrote ${kindergartens.length} kindergartens`);
console.log(`Wrote ${hospitals.length} hospitals`);
console.log(`Wrote ${publicHolidays.length} public holidays`);
console.log(`Output: ${DATA_DIR}`);
