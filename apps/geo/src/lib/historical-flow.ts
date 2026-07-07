import {
  changeTypeLabel,
  getCounty,
  getMunicipality,
  loadAdministrativeChanges,
  loadCurrentCountiesWiki,
  loadCurrentMunicipalitiesWiki,
  loadHistoricalCounties,
  loadHistoricalMunicipalities,
  type ChangeType,
  type CoatOfArms,
} from "./historical-data";

export interface FlowNode {
  id: string;
  name: string;
  number?: string;
  isCurrent: boolean;
  validFrom?: number;
  validTo?: number;
  layer: number;
  link?: string;
  coatOfArms?: import("./historical-data").CoatOfArms;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  changeYear?: number;
  changeType: ChangeType;
  label: string;
}

export interface AdministrativeFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Node ids grouped left-to-right (oldest → newest). */
  layers: string[][];
  focusNodeId: string;
  terminalNodeIds: string[];
}

interface EntityRef {
  name: string;
  number?: string;
  id?: string;
}

function entityKey(entity: EntityRef): string {
  return entity.id ?? `${entity.name}::${entity.number ?? ""}`;
}

async function lookupCountyCoat(
  name: string,
  number?: string,
  isCurrent?: boolean,
): Promise<CoatOfArms | undefined> {
  const historical = await loadHistoricalCounties();
  const hist = historical.find(
    (c) =>
      c.name === name &&
      (!number || c.countyNumber === number.padStart(2, "0").slice(-2)),
  );
  if (hist?.coatOfArms) return hist.coatOfArms;

  if (isCurrent || number) {
    const currentWiki = await loadCurrentCountiesWiki();
    const wiki = currentWiki.find(
      (c) =>
        c.name === name ||
        (number && c.countyNumber === number.padStart(2, "0").slice(-2)),
    );
    if (wiki?.coatOfArms) return wiki.coatOfArms;
  }

  return undefined;
}

async function lookupMunicipalityCoat(
  name: string,
  number?: string,
  isCurrent?: boolean,
): Promise<CoatOfArms | undefined> {
  const historical = await loadHistoricalMunicipalities();
  const hist = historical.find(
    (m) =>
      m.name === name &&
      (!number || m.municipalityNumber === number.padStart(4, "0").slice(-4)),
  );
  if (hist?.coatOfArms) return hist.coatOfArms;

  if (isCurrent || number) {
    const currentWiki = await loadCurrentMunicipalitiesWiki();
    const wiki = currentWiki.find(
      (m) =>
        m.name === name ||
        (number && m.id === number.padStart(4, "0").slice(-4)),
    );
    if (wiki?.coatOfArms) return wiki.coatOfArms;
  }

  return undefined;
}

function edgeLabel(changeType: ChangeType, year?: number): string {
  const type = changeTypeLabel(changeType);
  return year ? `${type} (${year})` : type;
}

async function resolveNode(
  entity: EntityRef,
  entityType: "municipality" | "county",
  layer: number,
  cache: Map<string, FlowNode>,
): Promise<FlowNode> {
  const key = entityKey(entity);
  const cached = cache.get(key);
  if (cached) return cached;

  let node: FlowNode;

  if (entityType === "municipality") {
    const municipalities = await loadHistoricalMunicipalities();
    const historical = entity.id
      ? municipalities.find((m) => m.id === entity.id)
      : municipalities.find(
          (m) =>
            m.name === entity.name &&
            (!entity.number || m.municipalityNumber === entity.number),
        );
    const current = entity.id
      ? await getMunicipality(entity.id)
      : entity.number
        ? await getMunicipality(entity.number.padStart(4, "0").slice(-4))
        : undefined;

    if (historical && (!current || historical.id === entity.id)) {
      node = {
        id: key,
        name: historical.name,
        number: historical.municipalityNumber,
        isCurrent: false,
        validFrom: historical.validFrom,
        validTo: historical.validTo,
        layer,
        link: `historikk/kommuner/${historical.id}`,
        coatOfArms: historical.coatOfArms,
      };
    } else if (current) {
      const coatOfArms = await lookupMunicipalityCoat(
        current.name,
        current.id,
        true,
      );
      node = {
        id: key,
        name: current.name,
        number: current.id,
        isCurrent: true,
        layer,
        link: `kommuner/${current.id}`,
        coatOfArms,
      };
    } else {
      node = {
        id: key,
        name: entity.name,
        number: entity.number,
        isCurrent: false,
        layer,
      };
    }
  } else {
    const counties = await loadHistoricalCounties();
    const historical = entity.id
      ? counties.find((c) => c.id === entity.id)
      : counties.find(
          (c) =>
            c.name === entity.name &&
            (!entity.number || c.countyNumber === entity.number),
        );
    const current = entity.id
      ? await getCounty(entity.id)
      : entity.number
        ? await getCounty(entity.number.padStart(2, "0").slice(-2))
        : undefined;

    if (historical && (!current || historical.id === entity.id)) {
      node = {
        id: key,
        name: historical.name,
        number: historical.countyNumber,
        isCurrent: false,
        validFrom: historical.validFrom,
        validTo: historical.validTo,
        layer,
        link: `historikk/fylker/${historical.id}`,
        coatOfArms: historical.coatOfArms,
      };
    } else if (current) {
      const coatOfArms = await lookupCountyCoat(current.name, current.id, true);
      node = {
        id: key,
        name: current.name,
        number: current.id,
        isCurrent: true,
        layer,
        link: `fylker/${current.id}`,
        coatOfArms,
      };
    } else {
      node = {
        id: key,
        name: entity.name,
        number: entity.number,
        isCurrent: false,
        layer,
      };
    }
  }

  cache.set(key, node);
  return node;
}

function groupMergeChanges(
  change: Awaited<ReturnType<typeof loadAdministrativeChanges>>[number],
  allChanges: Awaited<ReturnType<typeof loadAdministrativeChanges>>,
): Awaited<ReturnType<typeof loadAdministrativeChanges>> {
  const toKeys = change.to.map(entityKey).sort().join("|");
  return allChanges.filter(
    (c) =>
      c.entityType === change.entityType &&
      c.changeYear === change.changeYear &&
      c.to.map(entityKey).sort().join("|") === toKeys,
  );
}

function assignLayers(
  nodes: Map<string, FlowNode>,
  edges: FlowEdge[],
  focusNodeId: string,
): string[][] {
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!incoming.has(edge.to)) incoming.set(edge.to, new Set());
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, new Set());
    incoming.get(edge.to)!.add(edge.from);
    outgoing.get(edge.from)!.add(edge.to);
  }

  const layerByNode = new Map<string, number>();
  const queue: Array<{ id: string; layer: number }> = [];

  const roots = [...nodes.keys()].filter((id) => !incoming.has(id) || incoming.get(id)!.size === 0);
  if (roots.length === 0) {
    queue.push({ id: focusNodeId, layer: 0 });
  } else {
    for (const root of roots) {
      queue.push({ id: root, layer: 0 });
    }
  }

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    const existing = layerByNode.get(id);
    if (existing !== undefined && existing >= layer) continue;
    layerByNode.set(id, layer);

    for (const next of outgoing.get(id) ?? []) {
      queue.push({ id: next, layer: layer + 1 });
    }
  }

  for (const node of nodes.values()) {
    if (!layerByNode.has(node.id)) {
      layerByNode.set(node.id, node.layer);
    }
    node.layer = layerByNode.get(node.id) ?? 0;
  }

  const maxLayer = Math.max(0, ...layerByNode.values());
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);

  for (const [id, layer] of layerByNode) {
    layers[layer]!.push(id);
  }

  for (const layer of layers) {
    layer.sort((a, b) => {
      const nodeA = nodes.get(a)!;
      const nodeB = nodes.get(b)!;
      return nodeA.name.localeCompare(nodeB.name, "nb");
    });
  }

  return layers;
}

async function buildFromChanges(
  focusEntity: EntityRef,
  entityType: "municipality" | "county",
  direction: "forward" | "backward" | "full",
): Promise<AdministrativeFlow> {
  const changes = (await loadAdministrativeChanges()).filter(
    (c) => c.entityType === entityType,
  );
  const nodeCache = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const edgeIds = new Set<string>();
  const focusKey = entityKey(focusEntity);

  await resolveNode(focusEntity, entityType, 0, nodeCache);

  const visitedChanges = new Set<string>();

  function addEdge(
    from: string,
    to: string,
    change: (typeof changes)[number],
  ): void {
    if (from === to) return;
    const edgeId = `${from}->${to}:${change.id}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);
    edges.push({
      id: edgeId,
      from,
      to,
      changeYear: change.changeYear,
      changeType: change.changeType,
      label: edgeLabel(change.changeType, change.changeYear),
    });
  }

  async function walkForward(entity: EntityRef, depth: number): Promise<void> {
    const key = entityKey(entity);
    await resolveNode(entity, entityType, depth, nodeCache);

    const outgoing = changes.filter((c) =>
      c.from.some((f) => entityKey(f) === key),
    );

    for (const change of outgoing) {
      if (visitedChanges.has(change.id)) continue;
      visitedChanges.add(change.id);

      const mergeGroup =
        change.to.length === 1
          ? groupMergeChanges(change, changes)
          : [change];

      for (const groupChange of mergeGroup) {
        visitedChanges.add(groupChange.id);
      }

      const fromEntities = mergeGroup.flatMap((c) => c.from);
      const toEntities = change.to;

      for (const fromEntity of fromEntities) {
        await resolveNode(fromEntity, entityType, depth, nodeCache);
      }
      for (const toEntity of toEntities) {
        if (entityKey(toEntity) === key) continue;
        const toNode = await resolveNode(toEntity, entityType, depth + 1, nodeCache);
        for (const fromEntity of fromEntities) {
          addEdge(entityKey(fromEntity), toNode.id, change);
        }
        if (direction !== "backward") {
          await walkForward(toEntity, depth + 1);
        }
      }
    }

    if (entityType === "municipality" && outgoing.length === 0) {
      const municipalities = await loadHistoricalMunicipalities();
      const historical = municipalities.find((m) => m.id === entity.id);
      const nextId = historical?.resultIds?.[0];
      if (nextId && nextId !== entity.id) {
        const nextHistorical = municipalities.find((m) => m.id === nextId);
        if (nextHistorical) {
          const toNode = await resolveNode(
            { id: nextHistorical.id, name: nextHistorical.name, number: nextHistorical.municipalityNumber },
            entityType,
            depth + 1,
            nodeCache,
          );
          const syntheticChange = {
            id: `chain-${key}-${nextId}`,
            changeYear: historical.validTo,
            changeType: historical.changeType ?? "unknown",
          } as (typeof changes)[number];
          addEdge(key, toNode.id, syntheticChange);
          await walkForward(
            { id: nextHistorical.id, name: nextHistorical.name, number: nextHistorical.municipalityNumber },
            depth + 1,
          );
        } else {
          const current = await getMunicipality(nextId);
          if (current) {
            const toNode = await resolveNode(
              { id: current.id, name: current.name, number: current.id },
              entityType,
              depth + 1,
              nodeCache,
            );
            const syntheticChange = {
              id: `chain-${key}-${nextId}`,
              changeYear: historical?.validTo,
              changeType: historical?.changeType ?? "unknown",
            } as (typeof changes)[number];
            addEdge(key, toNode.id, syntheticChange);
          }
        }
      }
    }
  }

  async function walkBackward(entity: EntityRef, depth: number): Promise<void> {
    const key = entityKey(entity);
    await resolveNode(entity, entityType, depth, nodeCache);

    const incoming = changes.filter((c) =>
      c.to.some((t) => entityKey(t) === key),
    );

    for (const change of incoming) {
      if (visitedChanges.has(change.id)) continue;

      const mergeGroup = groupMergeChanges(change, changes);
      for (const groupChange of mergeGroup) {
        visitedChanges.add(groupChange.id);
      }

      const fromEntities = mergeGroup.flatMap((c) => c.from);
      const toEntities = change.to;

      for (const toEntity of toEntities) {
        const toNode = await resolveNode(toEntity, entityType, depth, nodeCache);
        for (const fromEntity of fromEntities) {
          const fromNode = await resolveNode(
            fromEntity,
            entityType,
            depth - 1,
            nodeCache,
          );
          addEdge(fromNode.id, toNode.id, change);
          if (direction !== "forward") {
            await walkBackward(fromEntity, depth - 1);
          }
        }
      }
    }
  }

  if (direction === "forward" || direction === "full") {
    await walkForward(focusEntity, 0);
  }
  if (direction === "backward" || direction === "full") {
    await walkBackward(focusEntity, 0);
  }

  const layers = assignLayers(nodeCache, edges, focusKey);
  const terminalNodeIds = [...nodeCache.values()]
    .filter((n) => n.isCurrent)
    .map((n) => n.id);

  return {
    nodes: [...nodeCache.values()],
    edges,
    layers,
    focusNodeId: focusKey,
    terminalNodeIds,
  };
}

/** Flow from a historical unit forward to today's entity. */
export async function buildForwardFlow(
  historicalId: string,
  entityType: "municipality" | "county",
): Promise<AdministrativeFlow> {
  if (entityType === "municipality") {
    const municipalities = await loadHistoricalMunicipalities();
    const mun = municipalities.find((m) => m.id === historicalId);
    if (!mun) {
      return emptyFlow(historicalId);
    }
    return buildFromChanges(
      { id: mun.id, name: mun.name, number: mun.municipalityNumber },
      "municipality",
      "forward",
    );
  }

  const counties = await loadHistoricalCounties();
  const county = counties.find((c) => c.id === historicalId);
  if (!county) {
    return emptyFlow(historicalId);
  }
  return buildFromChanges(
    { id: county.id, name: county.name, number: county.countyNumber },
    "county",
    "forward",
  );
}

/** Ancestry flow for a current unit — how it came to be. */
export async function buildAncestryFlow(
  currentId: string,
  entityType: "municipality" | "county",
): Promise<AdministrativeFlow> {
  if (entityType === "municipality") {
    const current = await getMunicipality(currentId);
    if (!current) return emptyFlow(currentId);
    return buildFromChanges(
      { id: current.id, name: current.name, number: current.id },
      "municipality",
      "backward",
    );
  }

  const current = await getCounty(currentId);
  if (!current) return emptyFlow(currentId);
  return buildFromChanges(
    { id: current.id, name: current.name, number: current.id },
    "county",
    "backward",
  );
}

/** Full flow centred on any entity (ancestors + descendants to current). */
export async function buildFullFlow(
  entity: EntityRef,
  entityType: "municipality" | "county",
): Promise<AdministrativeFlow> {
  return buildFromChanges(entity, entityType, "full");
}

function emptyFlow(focusNodeId: string): AdministrativeFlow {
  return {
    nodes: [],
    edges: [],
    layers: [],
    focusNodeId,
    terminalNodeIds: [],
  };
}

export function hasFlowContent(flow: AdministrativeFlow): boolean {
  return flow.nodes.length > 1 || flow.edges.length > 0;
}
