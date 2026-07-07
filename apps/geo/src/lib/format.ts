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
