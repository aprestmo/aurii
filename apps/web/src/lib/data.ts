/**
 * Data access for the geo demo site.
 *
 * Reads bundled snapshots from demo/norwegian-geo/data/ (same data imported into Core).
 * Uses Node fs so Astro's static build works outside the Bun runtime.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Resolved from the current working directory (apps/geo) rather than
// import.meta.dirname, since the build output nests compiled chunks at
// varying depths (e.g. dist/.prerender/chunks/) across Astro versions.
const ROOT = resolve(process.cwd(), "../..");
const DATA = resolve(ROOT, "demo/norwegian-geo/data");

export interface County {
  id: string;
  name: string;
  source?: string;
  population?: number;
  populationYear?: number;
}

export interface Municipality {
  id: string;
  name: string;
  countyId: string;
  source?: string;
  population?: number;
  populationYear?: number;
}

export interface PostalCode {
  code: string;
  city: string;
  municipalityId: string;
  municipalityName?: string;
  postalCodeType?: string;
}

export interface School {
  id: string;
  name: string;
  municipalityId: string;
  countyId: string;
  isPublic?: boolean;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isActive?: boolean;
  source?: string;
}

export interface Kindergarten {
  id: string;
  name: string;
  municipalityId: string;
  countyId: string;
  isPublic?: boolean;
  isActive?: boolean;
  source?: string;
}

export interface Hospital {
  id: string;
  name: string;
  municipalityId: string;
  industryCode?: string;
  industryDescription?: string;
  source?: string;
}

export interface PublicHoliday {
  id: string;
  date: string;
  localName: string;
  name: string;
  year: number;
  isNational?: boolean;
  holidayType?: string;
  source?: string;
}

export interface DatasetSummary {
  id: string;
  title: string;
  count: number;
  path: string;
  source: string;
}

async function readJson<T>(file: string): Promise<T> {
  const text = await readFile(resolve(DATA, file), "utf-8");
  return JSON.parse(text) as T;
}

export async function loadCounties(): Promise<County[]> {
  return readJson<County[]>("counties.json");
}

export async function loadMunicipalities(): Promise<Municipality[]> {
  return readJson<Municipality[]>("municipalities.json");
}

export async function loadPostalCodes(): Promise<PostalCode[]> {
  return readJson<PostalCode[]>("postal-codes.json");
}

export async function loadSchools(): Promise<School[]> {
  return readJson<School[]>("schools.json");
}

export async function loadKindergartens(): Promise<Kindergarten[]> {
  return readJson<Kindergarten[]>("kindergartens.json");
}

export async function loadHospitals(): Promise<Hospital[]> {
  return readJson<Hospital[]>("hospitals.json");
}

export async function loadPublicHolidays(): Promise<PublicHoliday[]> {
  return readJson<PublicHoliday[]>("public-holidays.json");
}

export async function getCounty(id: string): Promise<County | undefined> {
  const counties = await loadCounties();
  return counties.find((c) => c.id === id);
}

export async function getMunicipality(
  id: string,
): Promise<Municipality | undefined> {
  const municipalities = await loadMunicipalities();
  return municipalities.find((m) => m.id === id);
}

export async function getSchool(id: string): Promise<School | undefined> {
  const schools = await loadSchools();
  return schools.find((s) => s.id === id);
}

export async function getKindergarten(
  id: string,
): Promise<Kindergarten | undefined> {
  const kindergartens = await loadKindergartens();
  return kindergartens.find((k) => k.id === id);
}

export async function getHospital(id: string): Promise<Hospital | undefined> {
  const hospitals = await loadHospitals();
  return hospitals.find((h) => h.id === id);
}

export async function getMunicipalitiesByCounty(
  countyId: string,
): Promise<Municipality[]> {
  const municipalities = await loadMunicipalities();
  return municipalities
    .filter((m) => m.countyId === countyId)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export interface CountyStats {
  municipalityCount: number;
  population: number;
  populationYear?: number;
  largestMunicipality?: Municipality;
  smallestMunicipality?: Municipality;
  schoolCount: number;
  kindergartenCount: number;
}

export interface MunicipalityStats {
  postalCodeCount: number;
  schoolCount: number;
  kindergartenCount: number;
  publicSchoolCount: number;
  publicKindergartenCount: number;
  populationShareOfCounty?: number;
}

export async function getCountyStats(countyId: string): Promise<CountyStats> {
  const [municipalities, schools, kindergartens] = await Promise.all([
    getMunicipalitiesByCounty(countyId),
    loadSchools(),
    loadKindergartens(),
  ]);

  const withPopulation = municipalities.filter((m) => m.population !== undefined);
  const sortedByPopulation = [...withPopulation].sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0),
  );

  return {
    municipalityCount: municipalities.length,
    population: municipalities.reduce((sum, m) => sum + (m.population ?? 0), 0),
    populationYear: municipalities.find((m) => m.populationYear)?.populationYear,
    largestMunicipality: sortedByPopulation[0],
    smallestMunicipality: sortedByPopulation.at(-1),
    schoolCount: schools.filter((s) => s.countyId === countyId).length,
    kindergartenCount: kindergartens.filter((k) => k.countyId === countyId).length,
  };
}

export async function getMunicipalityStats(
  municipalityId: string,
  countyPopulation?: number,
): Promise<MunicipalityStats> {
  const [postalCodes, schools, kindergartens, municipality] = await Promise.all([
    getPostalCodesByMunicipality(municipalityId),
    getSchoolsByMunicipality(municipalityId),
    getKindergartensByMunicipality(municipalityId),
    getMunicipality(municipalityId),
  ]);

  const populationShareOfCounty =
    municipality?.population !== undefined &&
    countyPopulation !== undefined &&
    countyPopulation > 0
      ? (municipality.population / countyPopulation) * 100
      : undefined;

  return {
    postalCodeCount: postalCodes.length,
    schoolCount: schools.length,
    kindergartenCount: kindergartens.length,
    publicSchoolCount: schools.filter((s) => s.isPublic).length,
    publicKindergartenCount: kindergartens.filter((k) => k.isPublic).length,
    populationShareOfCounty,
  };
}

export async function getPostalCodesByMunicipality(
  municipalityId: string,
  limit?: number,
): Promise<PostalCode[]> {
  const codes = await loadPostalCodes();
  const filtered = codes
    .filter((p) => p.municipalityId === municipalityId)
    .sort((a, b) => a.code.localeCompare(b.code));
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

export async function getSchoolsByMunicipality(
  municipalityId: string,
  limit?: number,
): Promise<School[]> {
  const schools = await loadSchools();
  const filtered = schools
    .filter((s) => s.municipalityId === municipalityId)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

export async function getKindergartensByMunicipality(
  municipalityId: string,
  limit?: number,
): Promise<Kindergarten[]> {
  const kindergartens = await loadKindergartens();
  const filtered = kindergartens
    .filter((k) => k.municipalityId === municipalityId)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

export async function getHospitalsByMunicipality(
  municipalityId: string,
): Promise<Hospital[]> {
  const hospitals = await loadHospitals();
  return hospitals
    .filter((h) => h.municipalityId === municipalityId)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function loadDatasetSummaries(): Promise<DatasetSummary[]> {
  const [
    counties,
    municipalities,
    postalCodes,
    schools,
    kindergartens,
    hospitals,
    holidays,
  ] = await Promise.all([
    loadCounties(),
    loadMunicipalities(),
    loadPostalCodes(),
    loadSchools(),
    loadKindergartens(),
    loadHospitals(),
    loadPublicHolidays(),
  ]);

  return [
    {
      id: "county",
      title: "Fylker",
      count: counties.length,
      path: "",
      source: "Kartverket, SSB",
    },
    {
      id: "municipality",
      title: "Kommuner",
      count: municipalities.length,
      path: "",
      source: "Kartverket, SSB",
    },
    {
      id: "postal-code",
      title: "Postnummer",
      count: postalCodes.length,
      path: "",
      source: "Bring",
    },
    {
      id: "school",
      title: "Skoler",
      count: schools.length,
      path: "skoler",
      source: "UDIR NSR",
    },
    {
      id: "kindergarten",
      title: "Barnehager",
      count: kindergartens.length,
      path: "barnehager",
      source: "UDIR NBR",
    },
    {
      id: "hospital",
      title: "Sykehus",
      count: hospitals.length,
      path: "sykehus",
      source: "Brønnøysundregistrene",
    },
    {
      id: "public-holiday",
      title: "Helligdager",
      count: holidays.length,
      path: "helligdager",
      source: "Nager.Date",
    },
  ];
}

export const SAMPLE_QUERIES = [
  'from county where name == "Oslo"',
  'from municipality where countyId == "03" order by population desc limit 5',
  'from municipality where population > 50000 order by population desc',
  'from postal-code where municipalityId == "0301" limit 10',
  'from school where municipalityId == "0301" and isPublic == true limit 10',
  'from kindergarten where municipalityId == "0301" limit 10',
  'from hospital where municipalityId == "0301"',
  'from public-holiday where year == 2026 order by date asc',
] as const;
