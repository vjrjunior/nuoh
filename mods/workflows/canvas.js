import { graphOf, nodeKind, reach, ancestors } from "../../lib/workflow.js";

export const NODE_W = 300;
export const LABEL = 22;
export const PORT_Y = 24;
export const GRID = 24;
export const ZOOM = { min: 0.25, max: 2, step: 1.2 };
export const FIT_MARGIN = 64;
export const TIDY = { column: 96, row: 48, part: 96 };
export const BEND = 48;
export const LOOP = { drop: 56, side: 48 };
export const EDGE_HIT = 14;
export const MAP = { width: 200, height: 128, pad: 8 };
export const RESULT_H = 74;
const FIELD_1 = 34;
const FIELD_3 = 70;

export function clampZoom(z) {
  return Math.min(ZOOM.max, Math.max(ZOOM.min, z));
}

export function toScreen(point, camera) {
  return { x: point.x * camera.z + camera.x, y: point.y * camera.z + camera.y };
}

export function toWorld(point, camera) {
  return { x: (point.x - camera.x) / camera.z, y: (point.y - camera.y) / camera.z };
}

export function zoomAt(camera, z, point) {
  const next = clampZoom(z);
  const world = toWorld(point, camera);
  return { z: next, x: point.x - world.x * next, y: point.y - world.y * next };
}

export function nodeHeight(node, { result = false, fields = 0, waiting = false, inputs = 0 } = {}) {
  const kind = nodeKind(node);
  const card = (inner) => LABEL + 20 + inner;
  const extra = result ? 8 + (fields ? 23 + fields * 17 : RESULT_H) : 0;
  if (kind === "start") return card(inputs * (FIELD_1 + 8) + 28);
  if (kind === "agent" || kind === "continue") return card(FIELD_3 + 8 + 24 + 8 + 28) + extra;
  if (kind === "run") return card(FIELD_1 + 8 + 22 + 8 + 28) + extra;
  if (kind === "condition") return card(FIELD_1 + 8 + 22 + 8 + 22);
  if (kind === "approve") return card(18 + (node.show ? 8 + 34 : 0) + (waiting ? 8 + 28 : 0)) + extra;
  return card(28);
}

export function inPort(node, place) {
  return { x: place.x, y: place.y + LABEL + PORT_Y };
}

export function outPort(node, place, branch) {
  if (nodeKind(node) === "condition") {
    const row = LABEL + 10 + FIELD_1 + 8 + 11;
    return { x: place.x + NODE_W, y: place.y + (branch === "no" ? row + 30 : row) };
  }
  return { x: place.x + NODE_W, y: place.y + LABEL + PORT_Y };
}

export function curve(from, to) {
  const bend = Math.max(BEND, Math.abs(to.x - from.x) / 2);
  return { from, c1: { x: from.x + bend, y: from.y }, c2: { x: to.x - bend, y: to.y }, to };
}

export function loopRoute(from, to, floor) {
  const y = floor + LOOP.drop;
  return [
    { from, c1: { x: from.x + LOOP.side, y: from.y }, c2: { x: from.x + LOOP.side, y }, to: { x: from.x, y } },
    { line: true, from: { x: from.x, y }, to: { x: to.x, y } },
    { from: { x: to.x, y }, c1: { x: to.x - LOOP.side, y }, c2: { x: to.x - LOOP.side, y: to.y }, to },
  ];
}

function bezierAt(seg, t) {
  const u = 1 - t;
  const p = (a, b, c, d) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  return { x: p(seg.from.x, seg.c1.x, seg.c2.x, seg.to.x), y: p(seg.from.y, seg.c1.y, seg.c2.y, seg.to.y) };
}

export function samples(segments, steps = 24) {
  const points = [];
  for (const seg of segments) {
    if (seg.line) points.push(seg.from, seg.to);
    else for (let i = 0; i <= steps; i += 1) points.push(bezierAt(seg, i / steps));
  }
  return points;
}

function segmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceTo(segments, point) {
  const points = samples(segments);
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) best = Math.min(best, segmentDistance(point, points[i - 1], points[i]));
  return best;
}

export function midpoint(segments) {
  const points = samples(segments);
  return points[Math.floor(points.length / 2)];
}

export function placeOf(node, places) {
  return places[node.id] ?? { x: 0, y: 0 };
}

export function edgeRoutes(workflow, places, heights) {
  const graph = graphOf(workflow);
  return graph.edges.map((edge) => {
    const from = graph.byId.get(edge.from);
    const to = graph.byId.get(edge.to);
    const start = outPort(from, placeOf(from, places), edge.branch);
    const end = inPort(to, placeOf(to, places));
    if (!graph.loops.has(edge.index)) return { edge, loop: false, segments: [curve(start, end)] };
    const body = new Set([...reach(graph, edge.to)].filter((id) => id === edge.from || ancestors(graph, edge.from).has(id)));
    body.add(edge.to);
    body.add(edge.from);
    const floor = Math.max(...[...body].map((id) => placeOf(graph.byId.get(id), places).y + (heights[id] ?? 0)));
    const segments = loopRoute(start, end, floor);
    return { edge, loop: true, segments, badge: { x: (start.x + end.x) / 2, y: floor + LOOP.drop } };
  });
}

export function hitEdge(routes, point, z) {
  let best = null;
  for (const route of routes) {
    const distance = distanceTo(route.segments, point) * z;
    if (distance <= EDGE_HIT && (!best || distance < best.distance)) best = { index: route.edge.index, distance };
  }
  return best?.index ?? null;
}

export function bounds(nodes, places, heights) {
  if (!nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const place = placeOf(node, places);
    minX = Math.min(minX, place.x);
    minY = Math.min(minY, place.y);
    maxX = Math.max(maxX, place.x + NODE_W);
    maxY = Math.max(maxY, place.y + (heights[node.id] ?? 0));
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fit(box, viewport) {
  if (!box || !viewport.width || !viewport.height) return { x: FIT_MARGIN, y: FIT_MARGIN, z: 1 };
  const z = clampZoom(Math.min(1, (viewport.width - 2 * FIT_MARGIN) / Math.max(box.w, 1), (viewport.height - 2 * FIT_MARGIN) / Math.max(box.h, 1)));
  return { z, x: (viewport.width - box.w * z) / 2 - box.x * z, y: (viewport.height - box.h * z) / 2 - box.y * z };
}

export function tidy(workflow, heights) {
  const graph = graphOf(workflow);
  const column = new Map();
  for (const id of graph.order) {
    const before = (graph.forwardIn.get(id) ?? []).map((edge) => column.get(edge.from) ?? 0);
    column.set(id, before.length ? Math.max(...before) + 1 : 0);
  }
  const columns = [];
  for (const id of graph.order) (columns[column.get(id)] ??= []).push(id);
  const rank = new Map();
  const renumber = () => columns.forEach((ids) => ids.forEach((id, index) => rank.set(id, index)));
  renumber();
  const mean = (ids) => (ids.length ? ids.reduce((sum, id) => sum + rank.get(id), 0) / ids.length : null);
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const forward = sweep % 2 === 0;
    for (const ids of forward ? columns.slice(1) : columns.slice(0, -1).reverse()) {
      const key = (id) => mean(forward ? (graph.forwardIn.get(id) ?? []).map((edge) => edge.from) : (graph.forwardOut.get(id) ?? []).map((edge) => edge.to)) ?? rank.get(id);
      ids.sort((a, b) => key(a) - key(b) || rank.get(a) - rank.get(b));
      renumber();
    }
  }
  const tall = (ids) => ids.reduce((sum, id) => sum + (heights[id] ?? 0), 0) + TIDY.row * Math.max(0, ids.length - 1);
  const highest = Math.max(0, ...columns.map(tall));
  const places = {};
  columns.forEach((ids, index) => {
    let y = (highest - tall(ids)) / 2;
    for (const id of ids) {
      places[id] = { x: index * (NODE_W + TIDY.column), y: Math.round(y) };
      y += (heights[id] ?? 0) + TIDY.row;
    }
  });
  return places;
}

export function placesOf(workflow, heights) {
  const nodes = workflow?.nodes ?? [];
  const missing = nodes.some((node) => !Array.isArray(node.at));
  const auto = missing ? tidy(workflow, heights) : {};
  const places = {};
  for (const node of nodes) places[node.id] = Array.isArray(node.at) ? { x: node.at[0], y: node.at[1] } : auto[node.id] ?? { x: 0, y: 0 };
  return places;
}

export function gridLines(viewport, camera) {
  let spacing = GRID * camera.z;
  while (spacing < 20) spacing *= 2;
  const startX = ((camera.x % spacing) + spacing) % spacing;
  const startY = ((camera.y % spacing) + spacing) % spacing;
  const rows = [];
  for (let y = startY; y < viewport.height; y += spacing) rows.push(y);
  return { spacing, startX, rows };
}

function overlaps(a, b, margin) {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

export function freeSpot(nodes, places, heights, center, height = 200) {
  const boxes = nodes.map((node) => ({ ...placeOf(node, places), w: NODE_W, h: heights[node.id] ?? 0 }));
  const origin = { x: Math.round((center.x - NODE_W / 2) / GRID) * GRID, y: Math.round((center.y - height / 2) / GRID) * GRID };
  const free = (spot) => !boxes.some((box) => overlaps({ ...spot, w: NODE_W, h: height }, box, GRID));
  if (free(origin)) return origin;
  for (let ring = 1; ring <= 40; ring += 1) {
    const step = GRID * 2;
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const spot = { x: origin.x + dx * step * 2, y: origin.y + dy * step };
        if (free(spot)) return spot;
      }
    }
  }
  return origin;
}

export function minimapOf(box, viewport, camera) {
  if (!box) return { scale: 1, offset: { x: 0, y: 0 }, view: null };
  const view = { x: -camera.x / camera.z, y: -camera.y / camera.z, w: viewport.width / camera.z, h: viewport.height / camera.z };
  const left = Math.min(box.x, view.x);
  const top = Math.min(box.y, view.y);
  const right = Math.max(box.x + box.w, view.x + view.w);
  const bottom = Math.max(box.y + box.h, view.y + view.h);
  const scale = Math.min((MAP.width - 2 * MAP.pad) / Math.max(right - left, 1), (MAP.height - 2 * MAP.pad) / Math.max(bottom - top, 1));
  const offset = { x: MAP.pad - left * scale, y: MAP.pad - top * scale };
  return { scale, offset, view: { x: view.x * scale + offset.x, y: view.y * scale + offset.y, w: view.w * scale, h: view.h * scale } };
}

export function fromMinimap(point, map, viewport, camera) {
  const world = { x: (point.x - map.offset.x) / map.scale, y: (point.y - map.offset.y) / map.scale };
  return { ...camera, x: viewport.width / 2 - world.x * camera.z, y: viewport.height / 2 - world.y * camera.z };
}
