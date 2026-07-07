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
  wikidataId?: string;
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
  /** historical = opphørt, intermediate = midlertidig enhet (f.eks. Viken), current = dagens */
  status?: "historical" | "intermediate" | "current";
  sourceUrl: string;
  wikidataId?: string;
  wikipediaUrl?: string;
  coatOfArms?: CoatOfArms;
}

/** Dagens fylker fra Wikipedia-tabellen «Norges fylker 2024–». */
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

export interface AdministrativeChangeEntity {
  name: string;
  number?: string;
  id?: string;
}

export interface AdministrativeChange {
  id: string;
  entityType: "municipality" | "county";
  changeYear?: number;
  changeType: ChangeType;
  from: AdministrativeChangeEntity[];
  to: AdministrativeChangeEntity[];
  notes?: string;
  sourceUrl: string;
}

export interface UnresolvedMatch {
  entityType: "municipality" | "county";
  historicalId: string;
  historicalName: string;
  historicalNumber?: string;
  targetName: string;
  reason: string;
  countyNameAtSource?: string;
}

export interface HeraldryManifestEntry {
  entityType: "municipality" | "county";
  name: string;
  number?: string;
  sourceUrl: string;
  localPath: string;
  license?: string;
  attribution?: string;
}

/** Historisk navneform fra Norske kommunenummer. */
export interface HistoricalNameForm {
  name: string;
  until?: string;
  notes?: string;
}

/** Referanse til en forgjenger-kommune (nummer + navn). */
export interface MunicipalityNumberRef {
  number: string;
  name: string;
}

/** Oppsummert forgjenger fra Liste over tidligere norske kommuner. */
export interface EnrichmentPredecessor {
  id?: string;
  name: string;
  number?: string;
  validFrom?: number;
  validTo?: number;
  changeType?: ChangeType;
  notes?: string;
}

/** Kronologisk hendelse i kommunens historikk. */
export interface EnrichmentTimelineEvent {
  year?: number;
  date?: string;
  type: string;
  description: string;
  entities?: MunicipalityNumberRef[];
}

/**
 * Berikelsesdata for dagens kommuner — kombinerer Norges kommuner,
 * Norske kommunenummer og tidligere kommuner.
 */
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
  historicalNames?: HistoricalNameForm[];
  /** Direkte forgjengere ved siste større reform (typisk 2020). */
  directPredecessors?: MunicipalityNumberRef[];
  /** Kommuner som inngikk ved opprettelsen (fra kommunenummer-tabellen). */
  formedFrom?: MunicipalityNumberRef[];
  /** Alle utgåtte kommuner som inngår i dagens kommune. */
  predecessors?: EnrichmentPredecessor[];
  timeline?: EnrichmentTimelineEvent[];
  sources: string[];
}
