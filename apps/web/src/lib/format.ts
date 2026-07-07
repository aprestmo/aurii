export function formatPopulation(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("nb-NO");
}

export function formatPercent(value: number | undefined, fractionDigits = 1): string {
  if (value === undefined) return "—";
  return `${value.toLocaleString("nb-NO", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} %`;
}

/** Compare geographic entity ids (fylkes-/kommunenummer) with numeric ordering. */
export function compareGeoIds(a: string, b: string): number {
  return a.localeCompare(b, "nb", { numeric: true });
}

/** Format a Norwegian organisation number as XXX XXX XXX. */
export function formatOrgNumber(value: string | undefined | null): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}
