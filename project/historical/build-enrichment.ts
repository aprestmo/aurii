#!/usr/bin/env bun
/**
 * Builds municipality history enrichment from three Wikipedia sources:
 * - Norges kommuner (current metadata)
 * - Norske kommunenummer (1946 + 2018 series)
 * - Liste over tidligere norske kommuner (via existing historical JSON)
 *
 * Run: bun run build:municipality-enrichment
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AdministrativeChange,
  EnrichmentPredecessor,
  EnrichmentTimelineEvent,
  HistoricalMunicipality,
  MunicipalityEnrichment,
} from "./types";
import {
  CURRENT_MUNICIPALITIES_SOURCE,
  MUNICIPALITY_NUMBERS_SOURCE,
  parseCurrentMunicipalitiesPage,
  parseKommunenummer1946Series,
  parseKommunenummerCurrentSeries,
  resolvePrimary1946Number,
  type KommunenummerEntry,
} from "./parse-wiki-enrichment";

const USER_AGENT =
  "AuriiHistoricalGeoBot/1.0 (https://github.com/aprestmo/aurii; research)";
const FORMER_MUNICIPALITIES_SOURCE =
  "https://no.wikipedia.org/wiki/Liste_over_tidligere_norske_kommuner";

const ROOT = resolve(import.meta.dir, "../../..");
const DATA_DIR = resolve(ROOT, "data/historical");
const CURRENT_DATA = resolve(ROOT, "demo/norwegian-geo/data");

async function fetchWikipediaHtml(page: string): Promise<string> {
  const params = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    format: "json",
  });
  const response = await fetch(
    `https://no.wikipedia.org/w/api.php?${params}`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!response.ok) {
    throw new Error(`Wikipedia API failed for ${page}: ${response.status}`);
  }
  const data = (await response.json()) as {
    parse?: { text?: { "*": string } };
  };
  const html = data.parse?.text?.["*"];
  if (!html) throw new Error(`No HTML returned for ${page}`);
  return html;
}

function aggregatePredecessors(
  municipalityId: string,
  changes: AdministrativeChange[],
  historicalMunicipalities: HistoricalMunicipality[],
): EnrichmentPredecessor[] {
  const histById = new Map(historicalMunicipalities.map((m) => [m.id, m]));
  const predecessors = new Map<string, EnrichmentPredecessor>();

  for (const change of changes) {
    if (change.entityType !== "municipality") continue;
    const targetsCurrent = change.to.some((t) => t.id === municipalityId);
    if (!targetsCurrent) continue;

    for (const from of change.from) {
      const hist = from.id ? histById.get(from.id) : undefined;
      const key = from.id ?? `${from.name}::${from.number ?? ""}`;
      if (predecessors.has(key)) continue;

      predecessors.set(key, {
        id: from.id,
        name: from.name,
        number: from.number ?? hist?.municipalityNumber,
        validFrom: hist?.validFrom,
        validTo: hist?.validTo ?? change.changeYear,
        changeType: change.changeType,
        notes: hist?.notes ?? change.notes,
      });
    }
  }

  return [...predecessors.values()].sort((a, b) => {
    const yearA = a.validTo ?? a.validFrom ?? 0;
    const yearB = b.validTo ?? b.validFrom ?? 0;
    return yearA - yearB || a.name.localeCompare(b.name, "nb");
  });
}

function buildTimelineFromKommunenummer(
  currentSeriesEntry: ReturnType<typeof parseKommunenummerCurrentSeries>[number] | undefined,
  primaryEntry: KommunenummerEntry | undefined,
  predecessors: EnrichmentPredecessor[],
): EnrichmentTimelineEvent[] {
  const events: EnrichmentTimelineEvent[] = [];
  const seen = new Set<string>();

  function add(event: EnrichmentTimelineEvent): void {
    const key = `${event.year ?? ""}::${event.type}::${event.description}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push(event);
  }

  if (currentSeriesEntry?.established) {
    add({
      year: currentSeriesEntry.establishedYear,
      date: currentSeriesEntry.established,
      type: "renumbered",
      description: `Fikk kommunenummer ${currentSeriesEntry.number} fra ${currentSeriesEntry.established}`,
      entities: currentSeriesEntry.directPredecessors,
    });
  }

  if (primaryEntry?.established) {
    add({
      year: primaryEntry.establishedYear,
      date: primaryEntry.established,
      type: "established",
      description: `${primaryEntry.name} opprettet ${primaryEntry.established}`,
    });
  }

  for (const event of primaryEntry?.events ?? []) {
    if (!event.description || /^\d{1,2}\.\s/.test(event.description)) continue;
    add({
      year: event.year,
      date: event.date,
      type: "change",
      description: event.description,
      entities: event.entities,
    });
  }

  if (primaryEntry?.continuedTo?.length) {
    const last = primaryEntry.continuedTo[primaryEntry.continuedTo.length - 1]!;
    add({
      type: "continued",
      description: `${primaryEntry.name} (${primaryEntry.number}) videreført som ${last.number} ${last.name}`,
      entities: primaryEntry.continuedTo,
    });
  }

  for (const pred of predecessors) {
    if (!pred.validTo) continue;
    add({
      year: pred.validTo,
      type: pred.changeType ?? "incorporated",
      description: pred.notes ?? `${pred.name} opphørte`,
      entities: pred.number
        ? [{ number: pred.number, name: pred.name }]
        : [{ number: "", name: pred.name }],
    });
  }

  return events.sort((a, b) => {
    const yearA = a.year ?? 9999;
    const yearB = b.year ?? 9999;
    return yearA - yearB;
  });
}

function primaryLineageEntry(
  municipalityId: string,
  currentEntry: ReturnType<typeof parseKommunenummerCurrentSeries>[number] | undefined,
  seriesByNumber: Map<string, KommunenummerEntry>,
  seriesEntries: KommunenummerEntry[],
): KommunenummerEntry | undefined {
  const primaryNumber = resolvePrimary1946Number(
    municipalityId,
    currentEntry,
    seriesByNumber,
    seriesEntries,
  );
  return primaryNumber ? seriesByNumber.get(primaryNumber) : undefined;
}

function mergeHistoricalNames(
  primaryEntry: KommunenummerEntry | undefined,
): MunicipalityEnrichment["historicalNames"] {
  const names = primaryEntry?.historicalNames ?? [];
  return names.length > 0 ? names : undefined;
}

function mergePrehistory(
  primaryEntry: KommunenummerEntry | undefined,
): string | undefined {
  return primaryEntry?.prehistory?.trim() || undefined;
}

async function main(): Promise<void> {
  console.log("Loading existing historical data…");
  const [changes, historicalMunicipalities, currentMunicipalities] =
    await Promise.all([
      readFile(resolve(DATA_DIR, "administrative-changes.json"), "utf-8").then(
        (t) => JSON.parse(t) as AdministrativeChange[],
      ),
      readFile(resolve(DATA_DIR, "municipalities.json"), "utf-8").then(
        (t) => JSON.parse(t) as HistoricalMunicipality[],
      ),
      readFile(resolve(CURRENT_DATA, "municipalities.json"), "utf-8").then(
        (t) => JSON.parse(t) as Array<{ id: string; name: string }>,
      ),
    ]);

  console.log("Fetching Wikipedia pages…");
  const [currentHtml, numbersHtml] = await Promise.all([
    fetchWikipediaHtml("Norges_kommuner"),
    fetchWikipediaHtml("Norske_kommunenummer"),
  ]);

  console.log("Parsing Wikipedia tables…");
  const wikiCurrent = parseCurrentMunicipalitiesPage(currentHtml);
  const wikiById = new Map(wikiCurrent.map((m) => [m.id, m]));

  const series1946 = parseKommunenummer1946Series(numbersHtml);
  const currentSeries = parseKommunenummerCurrentSeries(numbersHtml);
  const seriesByNumber = new Map(series1946.map((e) => [e.number, e]));
  const currentSeriesByNumber = new Map(currentSeries.map((e) => [e.number, e]));

  console.log(`  Wiki current municipalities: ${wikiCurrent.length}`);
  console.log(`  1946 series entries: ${series1946.length}`);
  console.log(`  2018/2020 series entries: ${currentSeries.length}`);

  const enrichments: MunicipalityEnrichment[] = [];

  for (const mun of currentMunicipalities) {
    const wiki = wikiById.get(mun.id);
    const currentEntry = currentSeriesByNumber.get(mun.id);
    const primaryEntry = primaryLineageEntry(
      mun.id,
      currentEntry,
      seriesByNumber,
      series1946,
    );

    const predecessors = aggregatePredecessors(
      mun.id,
      changes,
      historicalMunicipalities,
    );

    const timeline = buildTimelineFromKommunenummer(
      currentEntry,
      primaryEntry,
      predecessors,
    );

    const established =
      currentEntry?.established ?? primaryEntry?.established;
    const establishedYear =
      currentEntry?.establishedYear ?? primaryEntry?.establishedYear;

    enrichments.push({
      id: mun.id,
      name: wiki?.name ?? mun.name,
      administrativeCenter:
        wiki?.administrativeCenter ??
        currentEntry?.administrativeCenter ??
        primaryEntry?.administrativeCenter,
      areaKm2: wiki?.areaKm2,
      languageForm: wiki?.languageForm,
      languageArea: wiki?.languageArea,
      wikipediaUrl: wiki?.wikipediaUrl,
      established,
      establishedYear,
      prehistory: mergePrehistory(primaryEntry),
      historicalNames: mergeHistoricalNames(primaryEntry),
      directPredecessors: currentEntry?.directPredecessors?.filter(
        (p) => p.number !== mun.id,
      ),
      formedFrom: primaryEntry?.formedFrom,
      predecessors: predecessors.length > 0 ? predecessors : undefined,
      timeline: timeline.length > 0 ? timeline : undefined,
      sources: [
        CURRENT_MUNICIPALITIES_SOURCE,
        MUNICIPALITY_NUMBERS_SOURCE,
        FORMER_MUNICIPALITIES_SOURCE,
      ],
    });
  }

  enrichments.sort((a, b) => a.id.localeCompare(b.id));

  await mkdir(DATA_DIR, { recursive: true });
  const outputPath = resolve(DATA_DIR, "municipality-enrichment.json");
  await writeFile(outputPath, JSON.stringify(enrichments, null, 2) + "\n");

  const withPredecessors = enrichments.filter(
    (e) => (e.predecessors?.length ?? 0) > 0,
  ).length;
  const withTimeline = enrichments.filter(
    (e) => (e.timeline?.length ?? 0) > 0,
  ).length;
  const withHistoricalNames = enrichments.filter(
    (e) => (e.historicalNames?.length ?? 0) > 0,
  ).length;

  console.log("\nDone!");
  console.log(`  Enrichment records: ${enrichments.length}`);
  console.log(`  With predecessors: ${withPredecessors}`);
  console.log(`  With timeline: ${withTimeline}`);
  console.log(`  With historical names: ${withHistoricalNames}`);
  console.log(`  Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
