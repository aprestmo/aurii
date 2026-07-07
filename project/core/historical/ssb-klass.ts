/**
 * SSB Klass API client for municipality (131) and county (104) classifications.
 * @see https://data.ssb.no/api/klass/v1/api-guide.html
 */

const BASE_URL = "https://data.ssb.no/api/klass/v1";
const USER_AGENT =
  "AuriiHistoricalGeoBot/1.0 (https://github.com/aprestmo/aurii; research)";

export const MUNICIPALITY_CLASSIFICATION_ID = 131;
export const COUNTY_CLASSIFICATION_ID = 104;

export const SSB_KLASS_SOURCE = "https://data.ssb.no/api/klass/v1/classifications/131";

export interface KlassVersion {
  id: number;
  name: string;
  validFrom: string;
  validTo: string | null;
}

export interface KlassCode {
  code: string;
  name: string;
  validFromInRequestedRange?: string;
  validToInRequestedRange?: string;
}

export interface KlassCodeChange {
  oldCode: string;
  oldName: string;
  newCode: string;
  newName: string;
  changeOccurred: string;
}

export interface KlassClassification {
  id: number;
  name: string;
  versions: KlassVersion[];
}

async function klassFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`SSB Klass API ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchClassification(
  classificationId: number,
): Promise<KlassClassification> {
  return klassFetch<KlassClassification>(`/classifications/${classificationId}`);
}

export async function fetchCodeChanges(
  classificationId: number,
  from: string,
  to: string,
): Promise<KlassCodeChange[]> {
  const data = await klassFetch<{ codeChanges: KlassCodeChange[] }>(
    `/classifications/${classificationId}/changes?from=${from}&to=${to}`,
  );
  return data.codeChanges ?? [];
}

export async function fetchCodesInRange(
  classificationId: number,
  from: string,
  to: string,
): Promise<KlassCode[]> {
  const data = await klassFetch<{ codes: KlassCode[] }>(
    `/classifications/${classificationId}/codes?from=${from}&to=${to}`,
  );
  return data.codes ?? [];
}

/** Last inclusive calendar day before version.validTo (exclusive boundary). */
export function lastValidDay(validTo: string | null): string {
  if (!validTo) return "2099-12-31";
  const date = new Date(`${validTo}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function versionsInRange(
  versions: KlassVersion[],
  from: string,
  to: string,
): KlassVersion[] {
  return versions.filter((version) => {
    const versionEnd = version.validTo ?? "2099-12-31";
    return version.validFrom <= to && versionEnd > from;
  });
}
