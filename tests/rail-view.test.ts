import { beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node, walk } from "./app-mocks";

const { default: Rail } = await import("../mods/rail/main.js");

const VIEWS = [
  { id: "workspace", label: "Workspace", icon: "terminal", key: "ctrl-cmd-1" },
  { id: "board", label: "Board", icon: "square-kanban", key: "ctrl-cmd-2" },
];

let active = "workspace";
let focus: Record<string, unknown> | null = null;
let paneIds: string[] = [];
let agentList: { status: string }[] = [];
let runs: [string, unknown][] = [];

beforeEach(() => {
  active = "workspace";
  focus = { space: "s1", tab: "t1", pane: "p1" };
  paneIds = ["p1", "p2"];
  agentList = [];
  runs = [];
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }),
    props: () => ({ views: VIEWS }),
    layout: () => ({ id: "root", children: [{ id: "rail" }, { id: "views", type: "stack", active, children: [{ id: "workspace" }, { id: "board" }] }] }),
    focused: () => focus,
    panes: () => paneIds.map((pane) => ({ pane })),
    agents: () => agentList,
    keys: () => [
      { section: "global", keys: "cmd-shift-p", action: "app.palette" },
      { section: "global", keys: "cmd-,", action: "app.settings" },
    ],
    window: () => ({ platform: "macos" }),
    run: (name: string, args: unknown) => runs.push([name, args]),
  });
});

const find = (node: Node, key: string) => walk(node).find((n) => n.key === key) as Node;
const calls = (node: Node, name: string) => node.calls.filter(([call]) => call === name).map(([, args]) => args[0]);
const svgs = (node: Node) => walk(node).flatMap((n) => calls(n, "svg"));
const click = (node: Node) => node.handlers.click?.[0]?.({}, {});

function start() {
  const rail = new Rail();
  rail.init();
  return rail;
}

const draw = (rail: InstanceType<typeof Rail>) => rail.render() as Node;

describe("tiles", () => {
  test("search on top, then each view in order, then settings", () => {
    const root = draw(start());
    const tiles = walk(root).filter((node) => node.key?.startsWith("rail-")).map((node) => node.key);
    expect(tiles).toEqual(["rail-search", "rail-workspace", "rail-board", "rail-settings"]);
    expect(svgs(root)).toEqual(["mods/kit/icons/search.svg", "mods/kit/icons/terminal.svg", "mods/kit/icons/square-kanban.svg", "mods/kit/icons/settings.svg"]);
  });

  test("leave room for the traffic lights on top of the rail", () => {
    expect(calls(draw(start()), "pt")).toEqual([46]);
  });

  test("are 40 px with 11 px corners", () => {
    const tile = find(draw(start()), "rail-workspace");
    expect(calls(tile, "size")).toEqual([40]);
    expect(calls(tile, "rounded")).toEqual([11]);
  });

  test("the shown view is selected and the others are muted", () => {
    active = "board";
    const root = draw(start());
    expect(calls(find(root, "rail-board"), "bg")).toEqual(["t.selected"]);
    expect(calls(find(root, "rail-board"), "text_color")).toEqual(["t.foreground"]);
    expect(calls(find(root, "rail-workspace"), "bg")).toEqual([]);
    expect(calls(find(root, "rail-workspace"), "text_color")).toEqual(["t.muted"]);
  });

  test("each tile names itself and its key", () => {
    const root = draw(start());
    expect(calls(find(root, "rail-workspace"), "tooltip")).toEqual(["Workspace  ⌃⌘1"]);
    expect(calls(find(root, "rail-board"), "tooltip")).toEqual(["Board  ⌃⌘2"]);
    expect(calls(find(root, "rail-search"), "tooltip")).toEqual(["Search  ⌘⇧P"]);
    expect(calls(find(root, "rail-settings"), "tooltip")).toEqual(["Settings  ⌘,"]);
  });

  test("a press on a tile never drags the window", () => {
    let stopped = false;
    find(draw(start()), "rail-board").handlers["down:left"]?.[0]?.({}, { stop_propagation: () => (stopped = true) });
    expect(stopped).toBe(true);
  });
});

describe("clicks", () => {
  test("a view tile selects its view", () => {
    click(find(draw(start()), "rail-board"));
    expect(runs).toEqual([["layout.select", { stack: "views", child: "board" }]]);
  });

  test("search opens the palette and settings opens Settings", () => {
    const root = draw(start());
    click(find(root, "rail-search"));
    click(find(root, "rail-settings"));
    expect(runs).toEqual([
      ["mod.open", { name: "palette" }],
      ["mod.open", { name: "settings" }],
    ]);
  });
});

describe("the Workspace badge", () => {
  const badge = (root: Node) => walk(find(root, "rail-workspace")).find((node) => calls(node, "absolute").length > 0);

  test("shows the most urgent agent, ringed in the rail's color", () => {
    agentList = [{ status: "working" }, { status: "blocked" }];
    const dot = badge(draw(start())) as Node;
    expect(calls(dot, "bg")).toEqual(["t.blocked"]);
    expect(calls(dot, "border_color")).toEqual(["t.chrome"]);
  });

  test("stays off when no agent needs anything", () => {
    agentList = [{ status: "idle" }];
    expect(badge(draw(start()))).toBeUndefined();
  });

  test("only the Workspace tile carries it", () => {
    agentList = [{ status: "done" }];
    const root = draw(start());
    expect(walk(find(root, "rail-board")).some((node) => calls(node, "absolute").length > 0)).toBe(false);
  });
});

describe("back to the Workspace", () => {
  test("a focus moved from outside while Board shows selects the Workspace", () => {
    active = "board";
    const rail = start();
    draw(rail);
    focus = { space: "s1", tab: "t2", pane: "p2" };
    draw(rail);
    expect(runs).toEqual([["layout.select", { stack: "views", child: "workspace" }]]);
  });

  test("the rail's own click remembers the focus it leaves", () => {
    const rail = start();
    const before = draw(rail);
    focus = { space: "s1", tab: "t2", pane: "p2" };
    click(find(before, "rail-board"));
    active = "board";
    draw(rail);
    expect(runs).toEqual([["layout.select", { stack: "views", child: "board" }]]);
  });

  test("nothing moves while the Workspace shows", () => {
    const rail = start();
    draw(rail);
    focus = { space: "s1", tab: "t2", pane: "p2" };
    draw(rail);
    expect(runs).toEqual([]);
  });
});
