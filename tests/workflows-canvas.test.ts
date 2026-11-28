import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BEND,
  bounds,
  clampZoom,
  curve,
  distanceTo,
  edgeRoutes,
  FIT_MARGIN,
  fit,
  freeSpot,
  fromMinimap,
  gridLines,
  hitEdge,
  inPort,
  midpoint,
  minimapOf,
  NODE_W,
  nodeHeight,
  outPort,
  placesOf,
  TIDY,
  tidy,
  toScreen,
  toWorld,
  zoomAt,
  ZOOM,
} from "../mods/workflows/canvas.js";
import { heightsOf } from "../mods/workflows/logic.js";
import { repo } from "./helpers";

const FLOW = JSON.parse(readFileSync(join(repo, "tests/fixtures/workflows/implement-review.json"), "utf8"));
const heights = heightsOf(FLOW, {});

function boxesOverlap(places: Record<string, { x: number; y: number }>, all: Record<string, number>) {
  const ids = Object.keys(places);
  for (const a of ids)
    for (const b of ids) {
      if (a >= b) continue;
      const p = places[a];
      const q = places[b];
      if (p.x < q.x + NODE_W && q.x < p.x + NODE_W && p.y < q.y + all[b] && q.y < p.y + all[a]) return [a, b];
    }
  return null;
}

describe("the camera", () => {
  test("world and screen points go back and forth", () => {
    const camera = { x: 120, y: -40, z: 1.5 };
    const point = { x: 33, y: 71 };
    expect(toWorld(toScreen(point, camera), camera)).toEqual(point);
    expect(toScreen({ x: 10, y: 10 }, camera)).toEqual({ x: 135, y: -25 });
  });

  test("zooming keeps the point under the pointer still, between 25% and 200%", () => {
    const camera = { x: 50, y: 20, z: 1 };
    const pointer = { x: 400, y: 300 };
    const before = toWorld(pointer, camera);
    const next = zoomAt(camera, 1.7, pointer);
    expect(toWorld(pointer, next).x).toBeCloseTo(before.x);
    expect(toWorld(pointer, next).y).toBeCloseTo(before.y);
    expect(zoomAt(camera, 9, pointer).z).toBe(ZOOM.max);
    expect(clampZoom(0.01)).toBe(ZOOM.min);
    expect([ZOOM.min, ZOOM.max]).toEqual([0.25, 2]);
  });

  test("fit centres the whole graph with a margin and never zooms past 100%", () => {
    const box = { x: 0, y: 0, w: 2000, h: 400 };
    const camera = fit(box, { width: 1064, height: 600 });
    expect(camera.z).toBeCloseTo((1064 - 2 * FIT_MARGIN) / 2000);
    const left = toScreen({ x: 0, y: 0 }, camera);
    const right = toScreen({ x: 2000, y: 400 }, camera);
    expect(left.x).toBeCloseTo(FIT_MARGIN);
    expect(1064 - right.x).toBeCloseTo(FIT_MARGIN);
    expect((left.y + right.y) / 2).toBeCloseTo(300);
    expect(fit({ x: 0, y: 0, w: 100, h: 100 }, { width: 1000, height: 800 }).z).toBe(1);
    expect(fit(null, { width: 0, height: 0 })).toEqual({ x: FIT_MARGIN, y: FIT_MARGIN, z: 1 });
  });
});

describe("connections", () => {
  test("a curve leaves and enters level, bending at least 48px", () => {
    const near = curve({ x: 0, y: 0 }, { x: 40, y: 100 });
    expect(near.c1).toEqual({ x: BEND, y: 0 });
    expect(near.c2).toEqual({ x: 40 - BEND, y: 100 });
    const far = curve({ x: 0, y: 0 }, { x: 400, y: 0 });
    expect(far.c1.x).toBe(200);
  });

  test("ports sit on the card's sides, a condition's two outputs on its yes and no rows", () => {
    const place = { x: 100, y: 50 };
    const agent = FLOW.nodes.find((node: { id: string }) => node.id === "implement");
    const clean = FLOW.nodes.find((node: { id: string }) => node.id === "clean");
    expect(inPort(agent, place)).toEqual({ x: 100, y: 96 });
    expect(outPort(agent, place, null)).toEqual({ x: 400, y: 96 });
    const yes = outPort(clean, place, "yes");
    const no = outPort(clean, place, "no");
    expect(yes.x).toBe(400);
    expect(no.y - yes.y).toBe(30);
  });

  test("a loop goes under every step it runs again, then back into its target", () => {
    const places = tidy(FLOW, heights);
    const routes = edgeRoutes(FLOW, places, heights);
    const loop = routes.find((route: { loop: boolean }) => route.loop);
    expect(loop.edge).toMatchObject({ from: "fix", to: "test", max: 3 });
    const floor = Math.max(...["test", "review", "clean", "fix"].map((id) => places[id].y + heights[id]));
    expect(loop.badge.y).toBeGreaterThan(floor);
    expect(loop.segments.at(-1).to).toEqual(inPort({ id: "test" }, places.test));
    expect(routes.filter((route: { loop: boolean }) => !route.loop)).toHaveLength(FLOW.edges.length - 1);
  });

  test("a click within 14 screen px of a connection hits it, whatever the zoom", () => {
    const places = tidy(FLOW, heights);
    const routes = edgeRoutes(FLOW, places, heights);
    const first = routes[0];
    const on = midpoint(first.segments);
    expect(distanceTo(first.segments, on)).toBeLessThan(1);
    expect(hitEdge(routes, on, 1)).toBe(first.edge.index);
    expect(hitEdge(routes, { x: on.x, y: on.y - 12 }, 1)).toBe(first.edge.index);
    expect(hitEdge(routes, { x: on.x, y: on.y - 12 }, 2)).toBeNull();
    expect(hitEdge(routes, { x: -5000, y: -5000 }, 1)).toBeNull();
  });
});

describe("placing nodes", () => {
  test("tidy puts each step a column after its furthest input, without overlaps", () => {
    const places = tidy(FLOW, heights);
    const column = (id: string) => places[id].x / (NODE_W + TIDY.column);
    expect(["start", "implement", "test", "review", "clean"].map(column)).toEqual([0, 1, 2, 3, 4]);
    expect(column("ship")).toBe(5);
    expect(column("fix")).toBe(5);
    expect(column("pr")).toBe(6);
    expect(boxesOverlap(places, heights)).toBeNull();
  });

  test("steps side by side share a column and a join waits a column after both", () => {
    const wide = {
      nodes: [{ id: "start", start: {} }, { id: "a", run: ["x"] }, { id: "b", run: ["x"] }, { id: "c", run: ["x"] }, { id: "join", run: ["x"] }],
      edges: [
        { from: "start", to: "a" },
        { from: "start", to: "b" },
        { from: "a", to: "c" },
        { from: "c", to: "join" },
        { from: "b", to: "join" },
      ],
    };
    const all = heightsOf(wide, {});
    const places = tidy(wide, all);
    expect(places.a.x).toBe(places.b.x);
    expect(places.join.x).toBeGreaterThan(places.c.x);
    expect(boxesOverlap(places, all)).toBeNull();
  });

  test("a step's at is kept; the ones without are tidied", () => {
    const some = { ...FLOW, nodes: FLOW.nodes.map(({ at, ...node }: { id: string; at: number[] }) => (node.id === "review" ? { ...node, at: [5, 7] } : node)) };
    const places = placesOf(some, heights);
    expect(places.review).toEqual({ x: 5, y: 7 });
    expect(places.start).toEqual(tidy(some, heights).start);
  });

  test("a new node goes where nothing is, nearest the middle", () => {
    const nodes = [{ id: "a" }];
    const places = { a: { x: -150, y: -100 } };
    const spot = freeSpot(nodes, places, { a: 200 }, { x: 0, y: 0 });
    const clear = spot.x >= 150 + 24 || spot.x + NODE_W <= -150 - 24 || spot.y >= 100 + 24 || spot.y + 200 <= -100 - 24;
    expect(clear).toBe(true);
    expect(freeSpot([], {}, {}, { x: 0, y: 0 })).toEqual({ x: -144, y: -96 });
  });

  test("heights follow what a node shows", () => {
    const agent = { id: "a", agent: ["claude"], task: "" };
    expect(nodeHeight(agent, { result: true })).toBeGreaterThan(nodeHeight(agent));
    expect(nodeHeight({ id: "s", start: {} }, { inputs: 2 })).toBeGreaterThan(nodeHeight({ id: "s", start: {} }));
    expect(nodeHeight({ id: "g", approve: "Go?" }, { waiting: true })).toBeGreaterThan(nodeHeight({ id: "g", approve: "Go?" }));
  });

  test("the grid's dots stay at least 20px apart on screen", () => {
    const grid = gridLines({ width: 800, height: 600 }, { x: 10, y: 5, z: 0.25 });
    expect(grid.spacing).toBeGreaterThanOrEqual(20);
    expect(grid.rows.every((y: number) => y >= 0 && y < 600)).toBe(true);
    expect(grid.startX).toBeLessThan(grid.spacing);
  });

  test("the minimap shows the graph and the view, and a click there centres the camera", () => {
    const places = tidy(FLOW, heights);
    const box = bounds(FLOW.nodes, places, heights);
    const viewport = { width: 1000, height: 700 };
    const camera = { x: 0, y: 0, z: 1 };
    const map = minimapOf(box, viewport, camera);
    expect(map.view.w).toBeLessThanOrEqual(200);
    const target = { x: map.offset.x + 500 * map.scale, y: map.offset.y + 100 * map.scale };
    const moved = fromMinimap(target, map, viewport, camera);
    const centre = toWorld({ x: 500, y: 350 }, moved);
    expect(centre.x).toBeCloseTo(500);
    expect(centre.y).toBeCloseTo(100);
  });
});
