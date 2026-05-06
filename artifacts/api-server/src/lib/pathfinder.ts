import type { RawEdge } from "./data.js";

export interface PathResult {
  distance: number;
  path: Array<{ x: number; y: number }>;
}

type NodeKey = `${number},${number}`;

function key(x: number, y: number): NodeKey {
  return `${x},${y}`;
}

export function buildGraph(edges: RawEdge[]): Map<NodeKey, Array<{ to: NodeKey; cost: number; x: number; y: number }>> {
  const graph = new Map<NodeKey, Array<{ to: NodeKey; cost: number; x: number; y: number }>>();

  for (const edge of edges) {
    const fromKey = key(edge.from_x, edge.from_y);
    const toKey = key(edge.to_x, edge.to_y);
    const cost = edge.distance_minutes * edge.delay_multiplier;

    if (!graph.has(fromKey)) graph.set(fromKey, []);
    graph.get(fromKey)!.push({ to: toKey, cost, x: edge.to_x, y: edge.to_y });

    if (!graph.has(toKey)) graph.set(toKey, []);
    graph.get(toKey)!.push({ to: fromKey, cost, x: edge.from_x, y: edge.from_y });
  }

  return graph;
}

export function dijkstra(
  graph: Map<NodeKey, Array<{ to: NodeKey; cost: number; x: number; y: number }>>,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): PathResult {
  const startKey = key(startX, startY);
  const endKey = key(endX, endY);

  if (startKey === endKey) {
    return { distance: 0, path: [{ x: startX, y: startY }] };
  }

  const dist = new Map<NodeKey, number>();
  const prev = new Map<NodeKey, { nodeKey: NodeKey; x: number; y: number } | null>();
  const visited = new Set<NodeKey>();

  dist.set(startKey, 0);

  const queue: Array<{ key: NodeKey; cost: number; x: number; y: number }> = [
    { key: startKey, cost: 0, x: startX, y: startY },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.key === endKey) break;

    const neighbors = graph.get(current.key) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.to)) continue;
      const newDist = (dist.get(current.key) ?? Infinity) + neighbor.cost;
      if (newDist < (dist.get(neighbor.to) ?? Infinity)) {
        dist.set(neighbor.to, newDist);
        prev.set(neighbor.to, { nodeKey: current.key, x: current.x, y: current.y });
        queue.push({ key: neighbor.to, cost: newDist, x: neighbor.x, y: neighbor.y });
      }
    }
  }

  const totalDist = dist.get(endKey) ?? Infinity;

  const path: Array<{ x: number; y: number }> = [];
  let cur: NodeKey | undefined = endKey;
  const nodePositions = new Map<NodeKey, { x: number; y: number }>();

  for (const edge of edges ?? []) {
    nodePositions.set(key(edge.from_x, edge.from_y), { x: edge.from_x, y: edge.from_y });
    nodePositions.set(key(edge.to_x, edge.to_y), { x: edge.to_x, y: edge.to_y });
  }
  nodePositions.set(startKey, { x: startX, y: startY });
  nodePositions.set(endKey, { x: endX, y: endY });

  while (cur) {
    const pos = nodePositions.get(cur);
    if (pos) path.unshift(pos);
    const p = prev.get(cur);
    cur = p?.nodeKey;
  }

  if (path.length === 0 || path[0].x !== startX || path[0].y !== startY) {
    path.unshift({ x: startX, y: startY });
  }

  return { distance: totalDist, path };
}

let _edges: RawEdge[] = [];

export function setEdges(edges: RawEdge[]) {
  _edges = edges;
}

export function getEdges(): RawEdge[] {
  return _edges;
}

export function dijkstraWithEdges(
  graph: Map<NodeKey, Array<{ to: NodeKey; cost: number; x: number; y: number }>>,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): PathResult {
  const startKey = key(startX, startY);
  const endKey = key(endX, endY);

  if (startKey === endKey) {
    return { distance: 0, path: [{ x: startX, y: startY }] };
  }

  const dist = new Map<NodeKey, number>();
  const prev = new Map<NodeKey, { nodeKey: NodeKey; x: number; y: number } | null>();
  const visited = new Set<NodeKey>();

  dist.set(startKey, 0);

  const allNodes = new Map<NodeKey, { x: number; y: number }>();
  for (const edge of _edges) {
    allNodes.set(key(edge.from_x, edge.from_y), { x: edge.from_x, y: edge.from_y });
    allNodes.set(key(edge.to_x, edge.to_y), { x: edge.to_x, y: edge.to_y });
  }

  const queue: Array<{ key: NodeKey; cost: number; x: number; y: number }> = [
    { key: startKey, cost: 0, x: startX, y: startY },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.key === endKey) break;

    const neighbors = graph.get(current.key) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.to)) continue;
      const newDist = (dist.get(current.key) ?? Infinity) + neighbor.cost;
      if (newDist < (dist.get(neighbor.to) ?? Infinity)) {
        dist.set(neighbor.to, newDist);
        prev.set(neighbor.to, { nodeKey: current.key, x: current.x, y: current.y });
        queue.push({ key: neighbor.to, cost: newDist, x: neighbor.x, y: neighbor.y });
      }
    }
  }

  const totalDist = dist.get(endKey) ?? Infinity;

  const path: Array<{ x: number; y: number }> = [];
  let cur: NodeKey | undefined = endKey;

  while (cur) {
    const pos = allNodes.get(cur) ?? (cur === startKey ? { x: startX, y: startY } : null);
    if (pos) path.unshift(pos);
    const p = prev.get(cur);
    cur = p?.nodeKey;
  }

  if (path.length === 0 || path[0].x !== startX || path[0].y !== startY) {
    path.unshift({ x: startX, y: startY });
  }
  if (path[path.length - 1]?.x !== endX || path[path.length - 1]?.y !== endY) {
    path.push({ x: endX, y: endY });
  }

  return { distance: totalDist, path };
}
