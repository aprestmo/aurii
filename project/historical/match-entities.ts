import type { UnresolvedMatch } from "./types";

export interface CurrentMunicipality {
  id: string;
  name: string;
  countyId: string;
}

export interface CurrentCounty {
  id: string;
  name: string;
}

export interface MatchContext {
  municipalitiesByName: Map<string, CurrentMunicipality[]>;
  municipalitiesById: Map<string, CurrentMunicipality>;
  countiesByName: Map<string, CurrentCounty[]>;
  countiesById: Map<string, CurrentCounty>;
  historicalMunicipalitiesByName: Map<string, { id: string; municipalityNumber?: string }[]>;
  historicalCountiesByName: Map<string, { id: string; countyNumber?: string }[]>;
  unresolved: UnresolvedMatch[];
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a");
}

export function createMatchContext(
  currentMunicipalities: CurrentMunicipality[],
  currentCounties: CurrentCounty[],
): MatchContext {
  const municipalitiesByName = new Map<string, CurrentMunicipality[]>();
  const municipalitiesById = new Map<string, CurrentMunicipality>();
  for (const mun of currentMunicipalities) {
    municipalitiesById.set(mun.id, mun);
    const key = normalizeName(mun.name);
    const list = municipalitiesByName.get(key) ?? [];
    list.push(mun);
    municipalitiesByName.set(key, list);
  }

  const countiesByName = new Map<string, CurrentCounty[]>();
  const countiesById = new Map<string, CurrentCounty>();
  for (const county of currentCounties) {
    countiesById.set(county.id, county);
    const key = normalizeName(county.name);
    const list = countiesByName.get(key) ?? [];
    list.push(county);
    countiesByName.set(key, list);
  }

  return {
    municipalitiesByName,
    municipalitiesById,
    countiesByName,
    countiesById,
    historicalMunicipalitiesByName: new Map(),
    historicalCountiesByName: new Map(),
    unresolved: [],
  };
}

export function registerHistoricalMunicipality(
  ctx: MatchContext,
  id: string,
  name: string,
  municipalityNumber?: string,
): void {
  const key = normalizeName(name);
  const list = ctx.historicalMunicipalitiesByName.get(key) ?? [];
  list.push({ id, municipalityNumber });
  ctx.historicalMunicipalitiesByName.set(key, list);
}

export function registerHistoricalCounty(
  ctx: MatchContext,
  id: string,
  name: string,
  countyNumber?: string,
): void {
  const key = normalizeName(name);
  const list = ctx.historicalCountiesByName.get(key) ?? [];
  list.push({ id, countyNumber });
  ctx.historicalCountiesByName.set(key, list);
}

export function matchMunicipalityName(
  ctx: MatchContext,
  targetName: string,
  options: {
    historicalId: string;
    historicalName: string;
    historicalNumber?: string;
    countyNameAtSource?: string;
    preferNumber?: string;
  },
): string | undefined {
  const byNumber = options.preferNumber
    ? ctx.municipalitiesById.get(options.preferNumber.padStart(4, "0").slice(-4))
    : undefined;
  if (byNumber && normalizeName(byNumber.name) === normalizeName(targetName)) {
    return byNumber.id;
  }

  const matches = ctx.municipalitiesByName.get(normalizeName(targetName)) ?? [];
  if (matches.length === 1) return matches[0]!.id;

  if (matches.length > 1) {
    ctx.unresolved.push({
      entityType: "municipality",
      historicalId: options.historicalId,
      historicalName: options.historicalName,
      historicalNumber: options.historicalNumber,
      targetName,
      reason: `Ambiguous name: ${matches.length} current municipalities named "${targetName}"`,
      countyNameAtSource: options.countyNameAtSource,
    });
    return undefined;
  }

  const historicalMatches = (
    ctx.historicalMunicipalitiesByName.get(normalizeName(targetName)) ?? []
  ).filter((match) => match.id !== options.historicalId);
  if (historicalMatches.length === 1) return historicalMatches[0]!.id;

  ctx.unresolved.push({
    entityType: "municipality",
    historicalId: options.historicalId,
    historicalName: options.historicalName,
    historicalNumber: options.historicalNumber,
    targetName,
    reason:
      historicalMatches.length > 1
        ? `Ambiguous historical name: ${historicalMatches.length} matches`
        : "No matching current or historical municipality found",
    countyNameAtSource: options.countyNameAtSource,
  });
  return undefined;
}

export function matchCountyName(
  ctx: MatchContext,
  targetName: string,
  options: {
    historicalId: string;
    historicalName: string;
    historicalNumber?: string;
    preferNumber?: string;
  },
): string | undefined {
  const byNumber = options.preferNumber
    ? ctx.countiesById.get(options.preferNumber.padStart(2, "0").slice(-2))
    : undefined;
  if (byNumber && normalizeName(byNumber.name) === normalizeName(targetName)) {
    return byNumber.id;
  }

  const matches = ctx.countiesByName.get(normalizeName(targetName)) ?? [];
  if (matches.length === 1) return matches[0]!.id;

  if (matches.length > 1) {
    ctx.unresolved.push({
      entityType: "county",
      historicalId: options.historicalId,
      historicalName: options.historicalName,
      historicalNumber: options.historicalNumber,
      targetName,
      reason: `Ambiguous name: ${matches.length} current counties named "${targetName}"`,
    });
    return undefined;
  }

  const historicalMatches =
    ctx.historicalCountiesByName.get(normalizeName(targetName)) ?? [];
  if (historicalMatches.length === 1) return historicalMatches[0]!.id;

  ctx.unresolved.push({
    entityType: "county",
    historicalId: options.historicalId,
    historicalName: options.historicalName,
    historicalNumber: options.historicalNumber,
    targetName,
    reason:
      historicalMatches.length > 1
        ? `Ambiguous historical name: ${historicalMatches.length} matches`
        : "No matching current or historical county found",
  });
  return undefined;
}
