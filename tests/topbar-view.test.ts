import { beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node, texts, walk } from "./app-mocks";

const { default: Topbar } = await import("../mods/topbar/main.js");

let role: string | undefined = "title";
let sidebarPx = 268;
let spaceList: Record<string, unknown>[] = [];
let focus: Record<string, unknown> | null = null;
let paneList: Record<string, unknown>[] = [];
let store: Record<string, unknown> = {};
let runs: [string, unknown][] = [];

beforeEach(() => {
  role = "title";
  sidebarPx = 268;
  spaceList = [
    { id: "s0", name: "other", active: false, machine: null, branch: "main", tabs: [{ id: "t0" }] },
    { id: "s1", name: "nuoh", active: true, machine: null, branch: "main", tabs: [{ id: "t1" }] },
  ];
  focus = { space: "s1", tab: "t1", pane: "p1" };
  paneList = [{ pane: "p1", tab: "t1", branch: "feat/nuoh-frame" }];
  store = { "space.colors": { s1: "ansi4" } };
  runs = [];
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }),
    props: () => (role == null ? {} : { role }),
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: sidebarPx } }] }),
    spaces: () => spaceList,
    focused: () => focus,
    panes: () => paneList,
    shared: (key: string) => store[key],
    setShared: (key: string, value: unknown) => (store[key] = value),
    run: (name: string, args: unknown) => runs.push([name, args]),
  });
});

const find = (node: Node, key: string) => walk(node).find((n) => n.key === key) as Node;
const calls = (node: Node, name: string) => node.calls.filter(([call]) => call === name).map(([, args]) => args[0]);
const svgs = (node: Node) => walk(node).flatMap((n) => calls(n, "svg"));
const draw = () => new Topbar().render() as Node;
const click = (node: Node) => node.handlers.click?.[0]?.({}, { stop_propagation() {} });
const press = (node: Node) => {
  let stopped = false;
  node.handlers["down:left"]?.[0]?.({}, { stop_propagation: () => (stopped = true) });
  return stopped;
};

describe("the title", () => {
  test("shows the fold button, the space's avatar in its color, its name and the focused pane's branch", () => {
    const root = draw();
    expect(svgs(root)).toEqual(["mods/kit/icons/panel-left.svg", "mods/kit/icons/git-branch.svg"]);
    expect(texts(root)).toEqual(["N", "nuoh", "feat/nuoh-frame"]);
    const avatar = walk(root).find((node) => node.texts.includes("N")) as Node;
    expect(calls(avatar, "bg")).toEqual(["#5b8def"]);
    expect(calls(avatar, "size")).toEqual([28]);
    expect(calls(avatar, "rounded")).toEqual([8]);
  });

  test("the name is 17 px semibold in the foreground color", () => {
    const name = walk(draw()).find((node) => node.texts.includes("nuoh")) as Node;
    expect(calls(name, "text_size")).toEqual([17]);
    expect(calls(name, "font_semibold")).toHaveLength(1);
    expect(calls(name, "text_color")).toEqual(["t.foreground"]);
  });

  test("the branch chip sits on raised with the branch icon in a quieter gray", () => {
    const chip = find(draw(), "branch");
    expect(calls(chip, "bg")).toEqual(["t.raised"]);
    expect(calls(chip, "h")).toEqual([22]);
    expect(calls(chip, "tooltip")).toEqual(["feat/nuoh-frame"]);
    expect(calls(chip.kids[0] as Node, "text_color")).toEqual(["t.unknown"]);
  });

  test("a space outside git shows no chip", () => {
    spaceList = [{ id: "s1", name: "~", active: true, machine: null, branch: null, tabs: [{ id: "t1" }] }];
    paneList = [{ pane: "p1", tab: "t1", branch: null }];
    expect(find(draw(), "branch")).toBeUndefined();
    expect(texts(draw())).toEqual(["~", "~"]);
  });

  test("folded, only the fold button shows, centered", () => {
    sidebarPx = 44;
    const root = draw();
    expect(svgs(root)).toEqual(["mods/kit/icons/panel-left.svg"]);
    expect(texts(root)).toEqual([]);
    expect(calls(root, "justify_center")).toHaveLength(1);
    expect(calls(find(root, "sidebar-toggle"), "tooltip")).toEqual(["Expand sidebar"]);
  });

  test("with no space yet, only the fold button shows", () => {
    spaceList = [];
    expect(texts(draw())).toEqual([]);
  });
});

describe("the fold button", () => {
  test("folds an open sidebar to 44 px and keeps its width", () => {
    const toggle = find(draw(), "sidebar-toggle");
    expect(calls(toggle, "tooltip")).toEqual(["Collapse sidebar"]);
    click(toggle);
    expect(store["sidebar.width"]).toBe(268);
    expect(store["sidebar.collapsed"]).toBe(true);
    expect(runs).toEqual([["layout.resize", { id: "sidebar", px: 44 }]]);
  });

  test("opens a folded sidebar to the width it had", () => {
    sidebarPx = 44;
    store["sidebar.width"] = 320;
    click(find(draw(), "sidebar-toggle"));
    expect(store["sidebar.width"]).toBe(320);
    expect(store["sidebar.collapsed"]).toBe(false);
    expect(runs).toEqual([["layout.resize", { id: "sidebar", px: 320 }]]);
  });

  test("a press on it never drags the window", () => {
    expect(press(find(draw(), "sidebar-toggle"))).toBe(true);
  });
});

describe("the machine pill", () => {
  beforeEach(() => {
    role = "machine";
  });

  test("names this computer with a monitor and a chevron, at the right end", () => {
    const root = draw();
    expect(calls(root, "justify_end")).toHaveLength(1);
    expect(texts(root)).toEqual(["This computer"]);
    expect(svgs(root)).toEqual(["mods/kit/icons/monitor.svg", "mods/kit/icons/chevron-down.svg"]);
    const pill = find(root, "machine");
    expect(calls(pill, "h")).toEqual([34]);
    expect(calls(pill, "bg")).toEqual(["t.surface"]);
    expect(calls(pill, "border_color")).toEqual(["t.border"]);
    expect(calls(pill, "tooltip")).toEqual(["Add machine"]);
  });

  test("names the shown space's machine with a server", () => {
    spaceList = [{ id: "s1", name: "api", active: true, machine: "vps", branch: null, tabs: [] }];
    const root = draw();
    expect(texts(root)).toEqual(["vps"]);
    expect(svgs(root)[0]).toBe("mods/kit/icons/server.svg");
  });

  test("a click opens Add machine, and a press never drags the window", () => {
    const pill = find(draw(), "machine");
    expect(press(pill)).toBe(true);
    click(pill);
    expect(runs).toEqual([["mod.open", { name: "machine-add" }]]);
  });
});

describe("the band under the traffic lights", () => {
  test("draws nothing", () => {
    role = "lights";
    const root = draw();
    expect(root.kids).toEqual([]);
    expect(texts(root)).toEqual([]);
    expect(calls(root, "bg")).toEqual([]);
  });

  test("is what a block without a role shows", () => {
    role = undefined;
    expect(draw().kids).toEqual([]);
  });
});
