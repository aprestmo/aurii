/**
 * Parsers for Wikipedia pages used in municipality history enrichment.
 */

import {
  decodeHtmlEntities,
  extractCoatOfArmsSource,
  extractLinkTexts,
  extractTableRows,
  extractWikipediaUrl,
  stripTags,
} from "./parse-html";
import type { HistoricalNameForm, MunicipalityNumberRef } from "./types";

export const CURRENT_MUNICIPALITIES_SOURCE =
  "https://no.wikipedia.org/wiki/Norges_kommuner";
export const MUNICIPALITY_NUMBERS_SOURCE =
  "https://no.wikipedia.org/wiki/Norske_kommunenummer";

export interface WikiCurrentMunicipality {
  id: string;
  name: string;
  administrativeCenter?: string;
  countyName?: string;
  population?: number;
  areaKm2?: number;
  languageForm?: string;
  languageArea?: string;
  wikipediaUrl?: string;
  coatOfArmsSource?: string;
}

export interface KommunenummerEntry {
  number: string;
  name: string;
  administrativeCenter?: string;
  established?: string;
  establishedYear?: number;
  prehistory?: string;
  formedFrom?: MunicipalityNumberRef[];
  historicalNames?: HistoricalNameForm[];
  continuedTo?: MunicipalityNumberRef[];
  events: Array<{
    date?: string;
    year?: number;
    description: string;
    entities?: MunicipalityNumberRef[];
  }>;
}

export interface CurrentSeriesEntry {
  number: string;
  name: string;
  administrativeCenter?: string;
  established?: string;
  establishedYear?: number;
  directPredecessors: MunicipalityNumberRef[];
  fromCounty?: string;
}

function parsePopulation(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseAreaKm2(value: string): number | undefined {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function parseLanguageCell(value: string): {
  languageForm?: string;
  languageArea?: string;
} {
  const text = stripTags(value);
  const match = text.match(/^(\S+)(?:\(([^)]+)\))?/);
  if (!match) return { languageForm: text || undefined };
  return {
    languageForm: match[1] || undefined,
    languageArea: match[2] || undefined,
  };
}

function parseDateYear(value: string): number | undefined {
  const match = value.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
}

function isMunicipalityNumber(value: string): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const county = Number.parseInt(value.slice(0, 2), 10);
  return county >= 1 && county <= 56;
}

function parseNumberNameRefs(text: string): MunicipalityNumberRef[] {
  const refs: MunicipalityNumberRef[] = [];
  const regex = /(\d{4})\s+([^0-9]+?)(?=\d{4}|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (!isMunicipalityNumber(match[1]!)) continue;
    const name = match[2]!.trim().replace(/\s+/g, " ");
    if (name) refs.push({ number: match[1]!, name });
  }
  return refs;
}

function parseHistoricalNames(text: string): HistoricalNameForm[] {
  const names: HistoricalNameForm[] = [];
  if (!text.trim()) return names;

  const segments = text.split(/(?<=\))(?=[A-ZÆØÅÞÐ])/);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const untilMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (untilMatch) {
      const name = untilMatch[1]!.trim();
      if (name.length >= 2) {
        names.push({ name, until: untilMatch[2]!.trim() });
      }
      continue;
    }

    if (trimmed.length >= 2 && /[A-Za-zÆØÅæøå]/.test(trimmed)) {
      names.push({ name: trimmed });
    }
  }

  return names;
}

function extractTableByHeading(
  html: string,
  headingText: string,
  maxLength = 600_000,
): string | undefined {
  const idx = html.indexOf(headingText);
  if (idx === -1) return undefined;
  const tableIdx = html.indexOf("<table", idx);
  if (tableIdx === -1 || tableIdx - idx > 10_000) return undefined;

  let pos = tableIdx;
  let depth = 0;
  const limit = Math.min(html.length, tableIdx + maxLength);
  while (pos < limit) {
    const open = html.indexOf("<table", pos);
    const close = html.indexOf("</table>", pos);
    if (close === -1 || close >= limit) break;
    if (open !== -1 && open < close) {
      depth++;
      pos = open + 6;
    } else {
      depth--;
      pos = close + 8;
      if (depth === 0) return html.slice(tableIdx, pos);
    }
  }
  return undefined;
}

export function parseCurrentMunicipalitiesPage(
  html: string,
): WikiCurrentMunicipality[] {
  const idx = html.indexOf('id="Kommunene"');
  const tableIdx = html.indexOf('<table class="wikitable sortable">', idx);
  if (tableIdx === -1) {
    throw new Error("Could not find current municipalities table on Norges kommuner");
  }

  let pos = tableIdx;
  let depth = 0;
  while (pos < html.length) {
    const open = html.indexOf("<table", pos);
    const close = html.indexOf("</table>", pos);
    if (close === -1) break;
    if (open !== -1 && open < close) {
      depth++;
      pos = open + 6;
    } else {
      depth--;
      pos = close + 8;
      if (depth === 0) break;
    }
  }

  const tableHtml = html.slice(tableIdx, pos);
  const municipalities: WikiCurrentMunicipality[] = [];

  for (const row of extractTableRows(tableHtml)) {
    if (row.cells.length < 9) continue;

    const id = stripTags(row.cells[0]!);
    if (!/^\d{4}$/.test(id)) continue;

    const nameCell = row.cells[1]!;
    const name = extractLinkTexts(nameCell)[0] ?? stripTags(nameCell);
    const administrativeCenter =
      extractLinkTexts(row.cells[2]!)[0] ?? stripTags(row.cells[2]!);
    const countyName =
      extractLinkTexts(row.cells[3]!)[0] ?? stripTags(row.cells[3]!);
    const population = parsePopulation(stripTags(row.cells[4]!));
    const areaKm2 = parseAreaKm2(stripTags(row.cells[5]!));
    const { languageForm, languageArea } = parseLanguageCell(row.cells[8]!);
    const coatOfArmsSource = extractCoatOfArmsSource(row.cells[7]!);

    municipalities.push({
      id,
      name,
      administrativeCenter: administrativeCenter || undefined,
      countyName: countyName || undefined,
      population,
      areaKm2,
      languageForm,
      languageArea,
      wikipediaUrl: extractWikipediaUrl(nameCell),
      coatOfArmsSource,
    });
  }

  return municipalities;
}

function classifyFormationColumn(text: string): {
  prehistory?: string;
  formedFrom?: MunicipalityNumberRef[];
} {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const refs = parseNumberNameRefs(trimmed);
  if (refs.length > 0 && refs.length * 8 <= trimmed.length) {
    return { formedFrom: refs };
  }

  return { prehistory: trimmed };
}

function parseKommunenummerRowCells(cells: string[]): {
  number?: string;
  name?: string;
  administrativeCenter?: string;
  established?: string;
  prehistory?: string;
  formedFrom?: MunicipalityNumberRef[];
  historicalNames?: string;
  eventText?: string;
  continuedTo?: string;
} {
  if (cells.length >= 8) {
    const number = stripTags(cells[0]!);
    const name = stripTags(cells[1]!).replace(/[★◎●◆#*‡†]/g, "").trim();
    const formation = classifyFormationColumn(stripTags(cells[4]!));
    return {
      number: /^\d{4}$/.test(number) ? number : undefined,
      name: name || undefined,
      administrativeCenter: stripTags(cells[2]!) || undefined,
      established: stripTags(cells[3]!) || undefined,
      prehistory: formation.prehistory,
      formedFrom: formation.formedFrom,
      historicalNames: stripTags(cells[5]!) || undefined,
      eventText: stripTags(cells[6]!) || undefined,
      continuedTo: stripTags(cells[7]!) || undefined,
    };
  }

  if (cells.length === 4) {
    return {
      eventText: stripTags(cells[0]!) || undefined,
      continuedTo: stripTags(cells[1]!) || undefined,
      established: stripTags(cells[2]!) || undefined,
      prehistory: stripTags(cells[3]!) || undefined,
    };
  }

  return {};
}

export function parseKommunenummer1946Series(html: string): KommunenummerEntry[] {
  const entries: KommunenummerEntry[] = [];
  const sectionRegex =
    /<h3[^>]*>[\s\S]*?(\d{2})\.\s*([^<◆]+)/gi;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const sectionStart = sectionMatch.index;
    const nextSection = html.indexOf("<h3", sectionStart + 10);
    const sectionEnd =
      nextSection > 0 ? nextSection : html.indexOf("<h2", sectionStart + 10);
    const sectionHtml = html.slice(
      sectionStart,
      sectionEnd > 0 ? sectionEnd : sectionStart + 400_000,
    );

    const tableIdx = sectionHtml.indexOf("<table");
    if (tableIdx === -1) continue;

    let pos = tableIdx;
    let depth = 0;
    while (pos < sectionHtml.length) {
      const open = sectionHtml.indexOf("<table", pos);
      const close = sectionHtml.indexOf("</table>", pos);
      if (close === -1) break;
      if (open !== -1 && open < close) {
        depth++;
        pos = open + 6;
      } else {
        depth--;
        pos = close + 8;
        if (depth === 0) break;
      }
    }

    const tableHtml = sectionHtml.slice(tableIdx, pos);
    let current: KommunenummerEntry | undefined;

    for (const row of extractTableRows(tableHtml)) {
      const parsed = parseKommunenummerRowCells(row.cells);
      if (parsed.number && parsed.name) {
        current = {
          number: parsed.number,
          name: parsed.name,
          administrativeCenter: parsed.administrativeCenter,
          established: parsed.established,
          establishedYear: parsed.established
            ? parseDateYear(parsed.established)
            : undefined,
          prehistory: parsed.prehistory,
          formedFrom: parsed.formedFrom,
          historicalNames: parsed.historicalNames
            ? parseHistoricalNames(parsed.historicalNames)
            : undefined,
          continuedTo: parsed.continuedTo
            ? parseNumberNameRefs(parsed.continuedTo)
            : undefined,
          events: [],
        };
        entries.push(current);
      } else if (current) {
        if (parsed.eventText || parsed.continuedTo) {
          current.events.push({
            date: parsed.eventText,
            year: parsed.eventText ? parseDateYear(parsed.eventText) : undefined,
            description: parsed.eventText ?? "",
            entities: parsed.continuedTo
              ? parseNumberNameRefs(parsed.continuedTo)
              : undefined,
          });
        }
        if (parsed.continuedTo) {
          current.continuedTo = parseNumberNameRefs(parsed.continuedTo);
        }
        if (parsed.established && !current.established) {
          current.established = parsed.established;
          current.establishedYear = parseDateYear(parsed.established);
        }
      }
    }
  }

  return entries;
}

export function parseKommunenummerCurrentSeries(
  html: string,
): CurrentSeriesEntry[] {
  const entries: CurrentSeriesEntry[] = [];
  const marker = html.indexOf("2018-nummerserien");
  if (marker === -1) return entries;

  const sectionHtml = html.slice(marker);
  const headingRegex = /<h3[^>]*>[\s\S]*?<\/h3>/gi;
  let headingMatch: RegExpExecArray | null;

  while ((headingMatch = headingRegex.exec(sectionHtml)) !== null) {
    const headingText = stripTags(headingMatch[0]!);
    if (!/^\d{2}\.\s/.test(headingText)) continue;

    const tableHtml = extractTableByHeading(
      sectionHtml,
      headingMatch[0]!,
      120_000,
    );
    if (!tableHtml) continue;

    let current: CurrentSeriesEntry | undefined;

    for (const row of extractTableRows(tableHtml)) {
      const number = stripTags(row.cells[0]!);
      const hasNumber = /^\d{4}$/.test(number);

      if (hasNumber && row.cells.length >= 5) {
        const name = stripTags(row.cells[1]!);
        const administrativeCenter = stripTags(row.cells[2]!) || undefined;
        const established = stripTags(row.cells[3]!) || undefined;
        const predecessorText = stripTags(row.cells[4]!);
        const fromCounty =
          row.cells.length >= 6 ? stripTags(row.cells[5]!) : undefined;

        current = {
          number,
          name,
          administrativeCenter,
          established,
          establishedYear: established ? parseDateYear(established) : undefined,
          directPredecessors: parseNumberNameRefs(predecessorText),
          fromCounty: fromCounty || undefined,
        };
        entries.push(current);
        continue;
      }

      if (!hasNumber && current && row.cells.length >= 2) {
        const continuationText = stripTags(row.cells[1]!);
        const extra = parseNumberNameRefs(continuationText).filter(
          (ref) => ref.number !== current!.number,
        );
        for (const ref of extra) {
          if (!current.directPredecessors.some((p) => p.number === ref.number)) {
            current.directPredecessors.push(ref);
          }
        }
      }
    }
  }

  return entries;
}

export function resolvePrimary1946Number(
  municipalityId: string,
  currentEntry: CurrentSeriesEntry | undefined,
  seriesByNumber: Map<string, KommunenummerEntry>,
  seriesEntries: KommunenummerEntry[],
): string | undefined {
  if (currentEntry?.directPredecessors.length) {
    const sameName = currentEntry.directPredecessors.find(
      (p) => p.name.toLowerCase() === currentEntry.name.toLowerCase(),
    );
    return sameName?.number ?? currentEntry.directPredecessors[0]!.number;
  }

  if (seriesByNumber.has(municipalityId)) {
    return municipalityId;
  }

  const viaContinuation = seriesEntries.find((entry) =>
    entry.continuedTo?.some((target) => target.number === municipalityId),
  );
  return viaContinuation?.number;
}

export function buildNumberLineageIndex(
  currentSeries: CurrentSeriesEntry[],
  series1946: KommunenummerEntry[],
): Map<string, string[]> {
  const predecessorMap = new Map<string, string[]>();

  for (const entry of currentSeries) {
    predecessorMap.set(
      entry.number,
      entry.directPredecessors.map((p) => p.number),
    );
  }

  for (const entry of series1946) {
    if (entry.continuedTo?.length) {
      for (const target of entry.continuedTo) {
        const existing = predecessorMap.get(target.number) ?? [];
        if (!existing.includes(entry.number)) {
          predecessorMap.set(target.number, [...existing, entry.number]);
        }
      }
    }
  }

  return predecessorMap;
}

export function collectLineageNumbers(
  currentNumber: string,
  predecessorMap: Map<string, string[]>,
  maxDepth = 8,
): string[] {
  const seen = new Set<string>([currentNumber]);
  const queue = [currentNumber];
  const result: string[] = [];

  while (queue.length > 0 && result.length < 50) {
    const num = queue.shift()!;
    const preds = predecessorMap.get(num) ?? [];
    for (const pred of preds) {
      if (!seen.has(pred)) {
        seen.add(pred);
        result.push(pred);
        if (result.length < maxDepth) queue.push(pred);
      }
    }
  }

  return result;
}

export function decodeHtml(html: string): string {
  return decodeHtmlEntities(html);
}
