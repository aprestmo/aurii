import type { ChangeType } from "./historical-data";
import type { AdministrativeFlow, FlowEdge, FlowNode } from "./historical-flow";

export interface FlowStoryEvent {
  id: string;
  year?: number;
  changeType?: ChangeType;
  heading: string;
  summary: string;
  resultLine: string;
  fromNodes: FlowNode[];
  toNodes: FlowNode[];
  edges: FlowEdge[];
  hasDetails: boolean;
}

export type EntityKind = "kommune" | "fylke";

/** Norwegian-style list: "A", "A og B", "A, B og C". */
export function formatNameList(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} og ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} og ${unique[unique.length - 1]}`;
}

/** Short explanatory line for timeline cards (mobile). */
export function describeChangeAction(changeType?: ChangeType): string | undefined {
  switch (changeType) {
    case "merged":
      return "Opphørte ved sammenslåing";
    case "incorporated":
      return "Ble innlemmet i en annen enhet";
    case "split":
      return "Delt i flere enheter";
    case "split_between":
      return "Delt mellom flere enheter";
    case "reestablished":
      return "Gjenopprettet";
    case "renamed":
      return "Fikk nytt navn";
    case "renumbered":
      return "Fikk nytt nummer";
    default:
      return undefined;
  }
}

export function buildChangeSummary(
  changeType: ChangeType | undefined,
  fromNames: string[],
  toNames: string[],
): string {
  const from = formatNameList(fromNames);
  const to = formatNameList(toNames);

  if (!from && !to) return "Administrativ endring.";

  switch (changeType) {
    case "merged":
      if (fromNames.length > 1) {
        return to
          ? `${from} ble slått sammen${toNames.length === 1 ? ` til ${to}` : ""}.`
          : `${from} ble slått sammen.`;
      }
      if (from && to && from !== to) {
        return `${from} ble slått sammen med ${to}.`;
      }
      return `${from || to} ble slått sammen.`;
    case "incorporated":
      return to
        ? `${from} ble innlemmet i ${to}.`
        : `${from} ble innlemmet i en annen enhet.`;
    case "split":
      return to
        ? `${from} ble delt i ${to}.`
        : `${from} ble delt i flere enheter.`;
    case "split_between":
      return to
        ? `${from} ble delt mellom ${to}.`
        : `${from} ble delt mellom flere enheter.`;
    case "reestablished":
      return to
        ? `${from} ble gjenopprettet som ${to}.`
        : `${from} ble gjenopprettet.`;
    case "renamed":
      return to
        ? `${from} fikk nytt navn: ${to}.`
        : `${from} fikk nytt navn.`;
    case "renumbered":
      return to
        ? `${from} fikk nytt nummer (${to}).`
        : `${from} fikk nytt nummer.`;
    default:
      if (from && to && from !== to) {
        return `${from} ble endret til ${to}.`;
      }
      return from
        ? `${from} endret administrativ status.`
        : "Administrativ endring.";
  }
}

function primaryChangeType(edges: FlowEdge[]): ChangeType | undefined {
  if (edges.length === 0) return undefined;
  const counts = new Map<ChangeType, number>();
  for (const edge of edges) {
    counts.set(edge.changeType, (counts.get(edge.changeType) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function primaryYear(edges: FlowEdge[], nodes: FlowNode[]): number | undefined {
  const years = edges
    .map((e) => e.changeYear)
    .filter((y): y is number => y !== undefined);
  if (years.length > 0) return Math.min(...years);

  const endYears = nodes
    .map((n) => n.validTo)
    .filter((y): y is number => y !== undefined);
  if (endYears.length > 0) return Math.max(...endYears);

  return undefined;
}

function buildEventHeading(
  index: number,
  total: number,
  year: number | undefined,
  toNodesAreCurrent: boolean,
): string {
  if (toNodesAreCurrent && index === total - 1) {
    return "Dagens enhet";
  }
  if (year) return `Endring i ${year}`;
  if (index === 0) return "Opprinnelig enhet";
  return "Administrativ endring";
}

function buildResultLine(
  toNodes: FlowNode[],
  entityKind: EntityKind,
): string {
  const current = toNodes.find((n) => n.isCurrent);
  if (current) {
    return `→ Dagens ${entityKind}: ${current.name}`;
  }
  const names = formatNameList(toNodes.map((n) => n.name));
  return names ? `→ ${names}` : "";
}

function inferEntityKind(flow: AdministrativeFlow): EntityKind {
  for (const node of flow.nodes) {
    if (node.link?.includes("/fylker/") || node.link?.includes("historikk/fylker/")) {
      return "fylke";
    }
  }
  return "kommune";
}

function edgesBetween(
  flow: AdministrativeFlow,
  fromLayer: string[],
  toLayer: string[],
): FlowEdge[] {
  return flow.edges.filter(
    (e) => fromLayer.includes(e.from) && toLayer.includes(e.to),
  );
}

function hasMeaningfulDetails(
  fromNodes: FlowNode[],
  toNodes: FlowNode[],
): boolean {
  const fromNames = new Set(fromNodes.map((n) => n.name));
  const hasExtraTo = toNodes.some((n) => !fromNames.has(n.name));
  const hasMeta = [...fromNodes, ...toNodes].some(
    (n) => n.number || n.coatOfArms || n.validFrom || n.validTo,
  );
  const hasUncertain = [...fromNodes, ...toNodes].some(
    (n) => !n.link && !n.isCurrent,
  );
  return (
    fromNodes.length + toNodes.length > 2 ||
    hasExtraTo ||
    hasMeta ||
    hasUncertain ||
    fromNodes.length > 1
  );
}

/** Transform an administrative flow into mobile-friendly story events. */
export function buildFlowStoryEvents(flow: AdministrativeFlow): FlowStoryEvent[] {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const entityKind = inferEntityKind(flow);
  const events: FlowStoryEvent[] = [];

  const transitions: Array<{
    edges: FlowEdge[];
    fromNodes: string[];
    toNodes: string[];
  }> = [];

  for (let i = 0; i < flow.layers.length - 1; i++) {
    const fromLayer = flow.layers[i]!;
    const toLayer = flow.layers[i + 1]!;
    const edges = edgesBetween(flow, fromLayer, toLayer);
    if (edges.length > 0 || fromLayer.length > 0 || toLayer.length > 0) {
      transitions.push({ edges, fromNodes: fromLayer, toNodes: toLayer });
    }
  }

  transitions.forEach((transition, index) => {
    const fromNodes = transition.fromNodes.map((id) => nodeById.get(id)!);
    const toNodes = transition.toNodes.map((id) => nodeById.get(id)!);
    const changeType = primaryChangeType(transition.edges);
    const year = primaryYear(transition.edges, fromNodes);
    const fromNames = fromNodes.map((n) => n.name);
    const toNames = toNodes.map((n) => n.name);
    const summary = buildChangeSummary(changeType, fromNames, toNames);
    const toNodesAreCurrent = toNodes.some((n) => n.isCurrent);
    const heading = buildEventHeading(
      index,
      transitions.length,
      year,
      toNodesAreCurrent,
    );
    const resultLine = buildResultLine(toNodes, entityKind);

    events.push({
      id: `event-${index}`,
      year,
      changeType,
      heading,
      summary,
      resultLine,
      fromNodes,
      toNodes,
      edges: transition.edges,
      hasDetails: hasMeaningfulDetails(fromNodes, toNodes),
    });
  });

  return events;
}

/** Brief «Kort fortalt» summary for an administrative flow. */
export function buildFlowBriefSummary(
  flow: AdministrativeFlow,
  entityKind?: EntityKind,
): string | null {
  if (flow.nodes.length === 0) return null;

  const kind = entityKind ?? inferEntityKind(flow);
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const oldestLayer = flow.layers[0] ?? [];
  const oldestNodes = oldestLayer.map((id) => nodeById.get(id)!).filter(Boolean);

  const startYears = oldestNodes
    .map((n) => n.validFrom)
    .filter((y): y is number => y !== undefined);
  const startYear = startYears.length > 0 ? Math.min(...startYears) : undefined;

  const changeCount = flow.edges.filter((e) => e.from !== e.to).length;
  const terminal = flow.nodes.find((n) => n.isCurrent);

  const definite = kind === "kommune" ? "kommunen" : "fylket";
  const parts: string[] = [];

  if (startYear) {
    parts.push(`${definite.charAt(0).toUpperCase() + definite.slice(1)} ble opprettet i ${startYear}`);
  } else {
    parts.push(
      `${definite.charAt(0).toUpperCase() + definite.slice(1)} har en historisk administrativ utvikling`,
    );
  }

  if (changeCount > 0) {
    const hendelse = changeCount === 1 ? "hendelse" : "hendelser";
    parts.push(
      `endret gjennom ${changeCount} administrative ${hendelse}`,
    );
  }

  if (terminal) {
    parts.push(`og er i dag ${terminal.name}`);
  }

  if (parts.length === 1) return `${parts[0]}.`;
  if (parts.length === 2) return `${parts[0]} ${parts[1]}.`;
  return `${parts[0]}, ${parts[1]} ${parts[2]}.`;
}

export interface TimelineStepInput {
  name: string;
  validFrom?: number;
  validTo?: number;
  changeType?: ChangeType;
  isCurrent: boolean;
}

/** Brief «Kort fortalt» summary for a timeline. */
export function buildTimelineBriefSummary(
  steps: TimelineStepInput[],
  entityKind: EntityKind = "kommune",
): string | null {
  if (steps.length === 0) return null;

  const definite = entityKind === "kommune" ? "kommunen" : "fylket";
  const first = steps[0]!;
  const current = steps.find((s) => s.isCurrent);
  const changeCount = steps.filter((s) => !s.isCurrent && s.changeType).length;

  const parts: string[] = [];

  if (first.validFrom) {
    parts.push(
      `${definite.charAt(0).toUpperCase() + definite.slice(1)} ble opprettet i ${first.validFrom}`,
    );
  } else if (first.name) {
    parts.push(`Historien starter med ${first.name}`);
  }

  if (changeCount > 0) {
    const hendelse = changeCount === 1 ? "hendelse" : "hendelser";
    parts.push(
      `endret gjennom ${changeCount} administrative ${hendelse}`,
    );
  } else if (steps.length > 1) {
    parts.push(`har ${steps.length - 1} historiske ledd`);
  }

  if (current && current.name !== first.name) {
    parts.push(`og er i dag ${current.name}`);
  }

  if (parts.length === 1) return `${parts[0]}.`;
  if (parts.length === 2) return `${parts[0]} ${parts[1]}.`;
  return `${parts[0]}, ${parts[1]} ${parts[2]}.`;
}

/** Year label for a timeline step (mobile time marker). */
export function timelineStepYear(step: TimelineStepInput): string | undefined {
  if (step.isCurrent) return "I dag";
  if (step.validTo) return String(step.validTo);
  if (step.validFrom) return String(step.validFrom);
  return undefined;
}
