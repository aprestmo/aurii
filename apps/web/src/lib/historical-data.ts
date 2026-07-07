/**
 * Historical Norwegian administrative units — separate from current norwegian-geo data.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getCounty,
  getMunicipality,
  type County,
  type Municipality,
} from "./data";

const ROOT = resolve(process.cwd(), "../..");
const HISTORICAL_DATA = resolve(
  ROOT,
  "demo/norwegian-geo/core/historical/data",
);

export type ChangeType =
  | "merged"
  | "incorporated"
  | "split"
  | "split_between"
  | "reestablished"
  | "renamed"
  | "unknown";

export interface CoatOfArms {
  sourceUrl: string;
  localPath: string;
  mimeType: "image/svg+xml" | "image/png" | "image/jpeg";
  attribution?: string;
  license?: string;
}

export interface HistoricalMunicipality {
  id: string;
  type: "municipality";
  name: string;
  municipalityNumber?: string;
  countyNameAtSource?: string;
  validFrom?: number;
  validTo?: number;
  changeType?: ChangeType;
  notes?: string;
  resultNames: string[];
  resultIds?: string[];
  sourceUrl: string;
  wikipediaUrl?: string;
  coatOfArms?: CoatOfArms;
}

export interface HistoricalCounty {
  id: string;
  type: "county";
  name: string;
  countyNumber?: string;
  administrativeCenter?: string;
  validFrom?: number;
  validTo?: number;
  todayPartOfNames: string[];
  todayPartOfIds?: string[];
  newCountyNumber?: string;
  changeType?: ChangeType;
  status?: "historical" | "intermediate" | "current";
  sourceUrl: string;
  wikipediaUrl?: string;
  coatOfArms?: CoatOfArms;
}

export interface WikiCurrentCounty {
  id: string;
  type: "county";
  name: string;
  countyNumber: string;
  administrativeCenter?: string;
  validFrom: number;
  status: "current";
  sourceUrl: string;
  wikipediaUrl?: string;
  coatOfArms?: CoatOfArms;
}

export interface AdministrativeChange {
  id: string;
  entityType: "municipality" | "county";
  changeYear?: number;
  changeType: ChangeType;
  from: Array<{ name: string; number?: string; id?: string }>;
  to: Array<{ name: string; number?: string; id?: string }>;
  notes?: string;
  sourceUrl: string;
}

export interface MunicipalityEnrichment {
  id: string;
  name: string;
  administrativeCenter?: string;
  areaKm2?: number;
  languageForm?: string;
  languageArea?: string;
  wikipediaUrl?: string;
  established?: string;
  establishedYear?: number;
  prehistory?: string;
  historicalNames?: Array<{ name: string; until?: string; notes?: string }>;
  directPredecessors?: Array<{ number: string; name: string }>;
  formedFrom?: Array<{ number: string; name: string }>;
  predecessors?: Array<{
    id?: string;
    name: string;
    number?: string;
    validFrom?: number;
    validTo?: number;
    changeType?: ChangeType;
    notes?: string;
  }>;
  timeline?: Array<{
    year?: number;
    date?: string;
    type: string;
    description: string;
    entities?: Array<{ number: string; name: string }>;
  }>;
  sources: string[];
}

export interface TimelineStep {
  id?: string;
  name: string;
  number?: string;
  validFrom?: number;
  validTo?: number;
  changeType?: ChangeType;
  isCurrent: boolean;
  entityType: "municipality" | "county";
  coatOfArms?: CoatOfArms;
  link?: string;
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  merged: "Slått sammen med",
  incorporated: "Innlemmet i",
  split: "Delt i",
  split_between: "Delt mellom",
  reestablished: "Gjenopprettet",
  renamed: "Navneendring",
  unknown: "Ukjent endring",
};

export function changeTypeLabel(type?: ChangeType): string {
  return type ? CHANGE_TYPE_LABELS[type] : "Ukjent endring";
}

async function readHistoricalJson<T>(file: string): Promise<T> {
  const text = await readFile(resolve(HISTORICAL_DATA, file), "utf-8");
  return JSON.parse(text) as T;
}

export async function loadHistoricalMunicipalities(): Promise<
  HistoricalMunicipality[]
> {
  return readHistoricalJson<HistoricalMunicipality[]>("municipalities.json");
}

export async function loadCurrentCountiesWiki(): Promise<WikiCurrentCounty[]> {
  return readHistoricalJson<WikiCurrentCounty[]>("current-counties.json");
}

export async function getWikiCurrentCounty(
  id: string,
): Promise<WikiCurrentCounty | undefined> {
  const counties = await loadCurrentCountiesWiki();
  return counties.find((c) => c.id === id || c.countyNumber === id);
}

export async function loadHistoricalCounties(): Promise<HistoricalCounty[]> {
  return readHistoricalJson<HistoricalCounty[]>("counties.json");
}

export async function loadAdministrativeChanges(): Promise<
  AdministrativeChange[]
> {
  return readHistoricalJson<AdministrativeChange[]>(
    "administrative-changes.json",
  );
}

export async function loadMunicipalityEnrichment(): Promise<
  MunicipalityEnrichment[]
> {
  return readHistoricalJson<MunicipalityEnrichment[]>(
    "municipality-enrichment.json",
  );
}

export async function getMunicipalityEnrichment(
  id: string,
): Promise<MunicipalityEnrichment | undefined> {
  const enrichments = await loadMunicipalityEnrichment();
  return enrichments.find((entry) => entry.id === id);
}

export async function getHistoricalMunicipality(
  id: string,
): Promise<HistoricalMunicipality | undefined> {
  const municipalities = await loadHistoricalMunicipalities();
  return municipalities.find((m) => m.id === id);
}

export async function getHistoricalCounty(
  id: string,
): Promise<HistoricalCounty | undefined> {
  const counties = await loadHistoricalCounties();
  return counties.find((c) => c.id === id);
}

export function getCountyNamesFromMunicipalities(
  municipalities: HistoricalMunicipality[],
): string[] {
  const names = new Set<string>();
  for (const mun of municipalities) {
    if (mun.countyNameAtSource) names.add(mun.countyNameAtSource);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "nb"));
}

export async function buildMunicipalityTimeline(
  startId: string,
): Promise<TimelineStep[]> {
  const municipalities = await loadHistoricalMunicipalities();
  const byId = new Map(municipalities.map((m) => [m.id, m]));
  const timeline: TimelineStep[] = [];
  const visited = new Set<string>();

  let current = byId.get(startId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    timeline.push({
      id: current.id,
      name: current.name,
      number: current.municipalityNumber,
      validFrom: current.validFrom,
      validTo: current.validTo,
      changeType: current.changeType,
      isCurrent: false,
      entityType: "municipality",
      coatOfArms: current.coatOfArms,
      link: `historikk/kommuner/${current.id}`,
    });

    const nextId = current.resultIds?.[0];
    if (!nextId) break;

    const nextHistorical = byId.get(nextId);
    if (nextHistorical) {
      current = nextHistorical;
      continue;
    }

    const currentMun = await getMunicipality(nextId);
    if (currentMun) {
      timeline.push({
        id: currentMun.id,
        name: currentMun.name,
        number: currentMun.id,
        isCurrent: true,
        entityType: "municipality",
        link: `kommuner/${currentMun.id}`,
      });
    } else {
      timeline.push({
        name: current.resultNames[0] ?? nextId,
        isCurrent: true,
        entityType: "municipality",
      });
    }
    break;
  }

  return timeline;
}

export async function buildCountyTimeline(
  startId: string,
): Promise<TimelineStep[]> {
  const county = await getHistoricalCounty(startId);
  if (!county) return [];

  const timeline: TimelineStep[] = [
    {
      id: county.id,
      name: county.name,
      number: county.countyNumber,
      validTo: county.validTo,
      changeType: county.changeType,
      isCurrent: false,
      entityType: "county",
      coatOfArms: county.coatOfArms,
      link: `historikk/fylker/${county.id}`,
    },
  ];

  if (county.changeType === "reestablished" && county.newCountyNumber) {
    const current = await getCounty(county.newCountyNumber);
    if (current) {
      timeline.push({
        id: current.id,
        name: current.name,
        number: current.id,
        isCurrent: true,
        entityType: "county",
        changeType: "reestablished",
        link: `fylker/${current.id}`,
      });
    }
    return timeline;
  }

  for (const partId of county.todayPartOfIds ?? []) {
    const current = await getCounty(partId);
    if (current) {
      timeline.push({
        id: current.id,
        name: current.name,
        number: current.id,
        isCurrent: true,
        entityType: "county",
        link: `fylker/${current.id}`,
      });
    }
  }

  return timeline;
}

export function formatPeriod(
  validFrom?: number,
  validTo?: number,
): string {
  if (validFrom && validTo) return `${validFrom}–${validTo}`;
  if (validFrom) return `fra ${validFrom}`;
  if (validTo) return `til ${validTo}`;
  return "—";
}

export function describeChange(mun: HistoricalMunicipality): string {
  const label = changeTypeLabel(mun.changeType);
  const targets = mun.resultNames.join(", ");
  if (!targets) return mun.notes ?? label;
  if (mun.notes) return `${mun.notes} → ${targets}`;
  return `${label} → ${targets}`;
}

export async function resolveEntityName(
  id: string,
  entityType: "municipality" | "county",
): Promise<{ name: string; isCurrent: boolean } | undefined> {
  if (entityType === "municipality") {
    const historical = await getHistoricalMunicipality(id);
    if (historical) return { name: historical.name, isCurrent: false };
    const current = await getMunicipality(id);
    if (current) return { name: current.name, isCurrent: true };
  } else {
    const historical = await getHistoricalCounty(id);
    if (historical) return { name: historical.name, isCurrent: false };
    const current = await getCounty(id);
    if (current) return { name: current.name, isCurrent: true };
  }
  return undefined;
}

export async function loadHistoricalSummary(): Promise<{
  municipalityCount: number;
  countyCount: number;
  changeCount: number;
  heraldryCount: number;
}> {
  const [municipalities, counties, changes] = await Promise.all([
    loadHistoricalMunicipalities(),
    loadHistoricalCounties(),
    loadAdministrativeChanges(),
  ]);
  const heraldryCount =
    municipalities.filter((m) => m.coatOfArms).length +
    counties.filter((c) => c.coatOfArms).length;

  return {
    municipalityCount: municipalities.length,
    countyCount: counties.length,
    changeCount: changes.length,
    heraldryCount,
  };
}

export type { County, Municipality };
export { getCounty, getMunicipality } from "./data";
