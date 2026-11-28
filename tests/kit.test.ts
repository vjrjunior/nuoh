import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { click, type Node, own, svgs, texts, walk } from "./app-mocks";

const { ICONS, avatar, button, cardHeader, cardLink, checkRow, chip, columnHead, detailLine, emptyState, flightRow, iconButton, iconPath, input, laneRow, lastClick, logLine, menuItem, meta, needRow, nextStep, paneTile, pill, prRow, profile, programIcon, releaseCard, segment, segmentGroup, statCard, statusChip, stepCard, stepNode, tag, taskCard, taskRow, timelineStep, toneColor, viewCard, viewTile } = await import("../kit/kit.js");

const repo = join(import.meta.dir, "..");
const t = new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }) as any;

const calls = (node: Node, name: string) => walk(node).flatMap((n) => own(n, name));

test("every icon name has a file and every file is named", () => {
  const files = readdirSync(join(repo, "kit/icons")).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)).sort();
  expect(files).toEqual([...ICONS]);
});

test("every icon is a 24 px currentColor svg", () => {
  for (const name of ICONS) {
    const source = readFileSync(join(repo, "kit/icons", `${name}.svg`), "utf8");
    expect(source).toContain('viewBox="0 0 24 24"');
    expect(source).toContain("currentColor");
    expect(source).not.toContain("<title>");
  }
});

test("iconPath points into the kit mod", () => expect(iconPath("eye")).toBe("mods/kit/icons/eye.svg"));

test("a done step is a filled node with a heavy check", () => {
  const node = stepNode("done", t);
  expect(calls(node, "bg")).toContainEqual(["t.done"]);
  expect(svgs(node)).toEqual(["mods/kit/icons/check-heavy.svg"]);
});

test("the current step is an accent ring with a dot", () => {
  const node = stepNode("current", t);
  expect(own(node, "border_color")).toContainEqual(["t.accent"]);
  expect(node.kids).toHaveLength(1);
  expect(own(node.kids[0], "bg")).toContainEqual(["t.accent"]);
  expect(svgs(node)).toEqual([]);
});

test("a bad step is a blocked ring with an exclamation", () => {
  const node = stepNode("bad", t);
  expect(own(node, "border_color")).toContainEqual(["t.blocked"]);
  expect(svgs(node)).toEqual(["mods/kit/icons/exclamation.svg"]);
});

test("a todo step is an empty input ring", () => {
  const node = stepNode("todo", t);
  expect(own(node, "border_color")).toContainEqual(["t.input"]);
  expect(node.kids).toHaveLength(0);
});

test("an icon button has its tooltip, and its color on the button so the icon follows its hover", () => {
  const node = iconButton("b", { icon: "github", tooltip: "GitHub", color: "t.accent", onClick() {} }, t);
  expect(calls(node, "tooltip")).toContainEqual(["GitHub"]);
  expect(svgs(node)).toEqual(["mods/kit/icons/github.svg"]);
  expect(own(node, "text_color")).toEqual([["t.accent"]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([]);
});

test("an icon button is a 28 px ghost by default, 22 or 18 px smaller, and 34 px bordered on the surface", () => {
  const ghost = iconButton("g", { icon: "x", onClick() {} }, t);
  expect(own(ghost, "size")).toEqual([[28]]);
  expect(own(ghost, "rounded")).toEqual([[7]]);
  expect(own(ghost, "bg")).toEqual([]);
  expect(own(ghost.kids[0] as Node, "size")).toEqual([[14]]);
  expect(own(iconButton("s", { icon: "x", size: "sm", onClick() {} }, t), "size")).toEqual([[22]]);
  expect(own(iconButton("x", { icon: "x", size: "xs", onClick() {} }, t), "size")).toEqual([[18]]);
  const bordered = iconButton("b", { icon: "x", variant: "bordered", onClick() {} }, t);
  expect(own(bordered, "size")).toEqual([[34]]);
  expect(own(bordered, "rounded")).toEqual([[10]]);
  expect(own(bordered, "bg")).toEqual([["t.surface"]]);
  expect(own(bordered, "border_color")).toEqual([["t.foreground12"]]);
  expect(own(iconButton("on", { icon: "x", selected: true, onClick() {} }, t), "bg")).toEqual([["t.foreground14"]]);
});

test("a button's variant sets its fill, line, text and icon", () => {
  const look = (variant: string) => {
    const node = button("b", { label: "Go", icon: "play", variant, onClick() {} }, t);
    return { bg: own(node, "bg"), border: own(node, "border_color"), text: own(node, "text_color"), icon: own(node.kids[0] as Node, "text_color") };
  };
  expect(look("primary")).toEqual({ bg: [["t.solid"]], border: [], text: [["t.solid_foreground"]], icon: [["t.solid_foreground"]] });
  expect(look("secondary")).toEqual({ bg: [["t.foreground0D"]], border: [["t.foreground14"]], text: [["t.foreground"]], icon: [["t.muted"]] });
  expect(look("tinted")).toEqual({ bg: [["t.accent1F"]], border: [], text: [["t.accent"]], icon: [["t.accent"]] });
  expect(look("ghost")).toEqual({ bg: [], border: [], text: [["t.muted"]], icon: [["t.unknown"]] });
  expect(look("danger")).toEqual({ bg: [["t.blocked1F"]], border: [], text: [["t.blocked"]], icon: [["t.blocked"]] });
  expect(own(button("b", { label: "Go", onClick() {} }, t), "bg")).toEqual([["t.foreground0D"]]);
});

test("a disabled button fades and still reports its click", () => {
  let clicks = 0;
  const node = button("d", { label: "Next", variant: "primary", disabled: true, onClick: () => clicks++ }, t);
  expect(own(node, "opacity")).toEqual([[0.4]]);
  click(node);
  expect(clicks).toBe(1);
});

test("a loading button spins the loader in place of its icon", () => {
  const node = button("l", { label: "Working…", icon: "play", loading: true, onClick() {} }, t);
  expect(svgs(node)).toEqual(["mods/kit/icons/loader-circle.svg"]);
  expect(own(node.kids[0] as Node, "spin")).toEqual([[900]]);
});

test("a chip is a light fill of its tone, 18 px small and 24 px with a dot at md", () => {
  const sm = chip("passed", { tone: "done" }, t);
  expect(sm.texts).toEqual(["passed"]);
  expect(own(sm, "h")).toEqual([[18]]);
  expect(own(sm, "bg")).toEqual([["t.done1A"]]);
  expect(own(sm, "text_color")).toEqual([["t.done"]]);
  expect(sm.kids).toHaveLength(0);
  const neutral = chip("pending", {}, t);
  expect(own(neutral, "bg")).toEqual([["t.foreground0F"]]);
  expect(own(neutral, "text_color")).toEqual([["t.muted"]]);
  const md = chip("Working", { tone: "working", size: "md" }, t);
  expect(own(md, "h")).toEqual([[24]]);
  expect(own(md, "rounded")).toEqual([[7]]);
  expect(own(md.kids[0] as Node, "bg")).toEqual([["t.working"]]);
});

test("a button's icon takes iconColor while the label keeps the text color", () => {
  const node = button("b", { label: "Passed", icon: "check", iconColor: "t.done", onClick() {} }, t);
  const iconNode = node.kids.find((k) => k.calls.some(([c]) => c === "svg")) as Node;
  expect(own(iconNode, "text_color")).toEqual([["t.done"]]);
  expect(own(node, "text_color")).toEqual([["t.foreground"]]);
});

test("an avatar is its name's first letter, bold, on its fill", () => {
  const node = avatar("nuoh", { fill: "#22a99a", letter: "#ffffff" }, { size: 28, radius: 8 });
  expect(own(node, "size")).toEqual([[28]]);
  expect(own(node, "rounded")).toEqual([[8]]);
  expect(own(node, "bg")).toEqual([["#22a99a"]]);
  expect(own(node, "text_color")).toEqual([["#ffffff"]]);
  expect(node.texts).toEqual(["N"]);
});

test("an avatar without a name shows a question mark, 22 px with 6 px corners", () => {
  const node = avatar("", { fill: "t.dim", letter: "t.foreground" });
  expect(own(node, "size")).toEqual([[22]]);
  expect(own(node, "rounded")).toEqual([[6]]);
  expect(node.texts).toEqual(["?"]);
});

test("kit.js has no hex color", () => {
  const source = readFileSync(join(repo, "kit/kit.js"), "utf8");
  expect([...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]).sort()).toEqual([]);
});

const ADOPTERS = [
  "kit/kit.js",
  "mods/kit/main.js",
  "mods/spaces-tree/main.js",
  "mods/agent-list/main.js",
  "mods/markdown/main.js",
  "mods/markdown/picker.js",
  "mods/files/main.js",
  "mods/files/menu.js",
  "mods/move-tab/main.js",
  "tools/test-panel/main.js",
];

for (const file of ADOPTERS) {
  test(`${file} draws no glyphs`, () => {
    const source = readFileSync(join(repo, file), "utf8");
    expect(source).not.toMatch(/[\u2713\u25cf\u25cb\u2197\u25b8\u25be\u21bb\u2190\u2715\u25a0\u25a1]/);
    expect(source).not.toMatch(/["'`]!["'`]/);
  });
}

test("a button's size sets its height, sides, corners, text and icon", () => {
  const dims = (size: string) => {
    const node = button("b", { label: "Go", icon: "play", size, onClick() {} }, t);
    return [own(node, "h")[0][0], own(node, "px")[0][0], own(node, "rounded")[0][0], own(node, "text_size")[0][0], own(node.kids[0] as Node, "size")[0][0]];
  };
  expect(dims("sm")).toEqual([22, 8, 6, 11.5, 10]);
  expect(dims("md")).toEqual([28, 10, 8, 12, 12]);
  expect(dims("lg")).toEqual([34, 12, 10, 12.5, 13]);
});

test("toneColor maps the accent tone to the accent color", () => {
  expect(toneColor("accent", t)).toBe("t.accent");
});

test("toneColor maps a tone to its theme color", () => {
  expect(toneColor("blocked", t)).toBe("t.blocked");
  expect(toneColor("working", t)).toBe("t.working");
  expect(toneColor("done", t)).toBe("t.done");
  expect(toneColor("idle", t)).toBe("t.unknown");
  expect(toneColor(undefined, t)).toBe("t.unknown");
});

test("an icon button runs onPress on its press, before it stops the press", () => {
  const order: string[] = [];
  const press = (node: Node) => {
    for (const handler of node.handlers["down:left"] ?? []) handler({}, { stop_propagation: () => order.push("stop") });
  };
  press(iconButton("s", { icon: "x", stop: true, onPress: () => order.push("press"), onClick() {} }, t));
  expect(order).toEqual(["press", "stop"]);
  order.length = 0;
  press(iconButton("p", { icon: "x", onPress: () => order.push("press"), onClick() {} }, t));
  expect(order).toEqual(["press"]);
  order.length = 0;
  press(iconButton("o", { icon: "x", stop: true, onClick() {} }, t));
  expect(order).toEqual(["stop"]);
  expect(iconButton("n", { icon: "x", onClick() {} }, t).handlers["down:left"]).toBeUndefined();
});

test("an icon button without a tooltip makes no tooltip call", () => {
  const node = iconButton("i", { icon: "x", onClick() {} }, t);
  expect(own(node, "tooltip")).toEqual([]);
  expect(own(iconButton("i", { icon: "x", tooltip: "Close", onClick() {} }, t), "tooltip")).toEqual([["Close"]]);
});

test("a button without a label adds no text child", () => {
  const node = button("b", { icon: "plus", onClick() {} }, t);
  expect(node.texts).toEqual([]);
  expect(svgs(node)).toEqual(["mods/kit/icons/plus.svg"]);
});

test("a menu item has its icon, label and detail, and runs its click", () => {
  let clicks = 0;
  const node = menuItem("r", { icon: "columns-2", label: "Split right", detail: "cmd-d", onClick: () => clicks++ }, t);
  expect(svgs(node)).toEqual(["mods/kit/icons/columns-2.svg"]);
  expect(texts(node)).toEqual(["Split right", "cmd-d"]);
  expect(own(node, "min_h")).toEqual([[30]]);
  expect(own(node, "rounded")).toEqual([[7]]);
  expect(own(node, "bg")).toEqual([]);
  click(node);
  expect(clicks).toBe(1);
});

test("a menu item shows the keyboard's choice as a light fill and a chosen one with an accent check", () => {
  expect(own(menuItem("s", { icon: "x", label: "Here", selected: true, onClick() {} }, t), "bg")).toEqual([["t.foreground0D"]]);
  const checked = menuItem("c", { dot: "t.ansi4", label: "Clients", check: true, onClick() {} }, t);
  expect(svgs(checked)).toEqual(["mods/kit/icons/check.svg"]);
  expect(calls(checked, "text_color")).toContainEqual(["t.accent"]);
  expect(calls(checked, "bg")).toContainEqual(["t.ansi4"]);
});

test("a danger menu item is blocked, icon and label", () => {
  const node = menuItem("d", { icon: "x", label: "Delete", danger: true, onClick() {} }, t);
  expect(own(node, "text_color")).toContainEqual(["t.blocked"]);
  expect(calls(node, "text_color").filter(([color]) => color === "t.muted")).toEqual([]);
});

test("a menu item can put a line under its label", () => {
  const node = menuItem("w", { label: "Work", description: "the team's flow", onClick() {} }, t);
  expect(texts(node)).toEqual(["Work", "the team's flow"]);
});

test("a status chip says what an agent's state asks of the person, on a light fill of its color", () => {
  const cases = [
    ["blocked", "Needs you", "t.blocked1F"],
    ["working", "Working", "t.working1F"],
    ["done", "Done", "t.done1A"],
  ];
  for (const [status, text, fill] of cases) {
    const node = statusChip(status, t) as Node;
    expect(node.texts).toEqual([text]);
    expect(own(node, "bg")).toEqual([[fill]]);
    expect(own(node, "text_color")).toEqual([[`t.${status}`]]);
    expect(own(node, "h")).toEqual([[18]]);
    expect(own(node, "px")).toEqual([[6]]);
    expect(own(node, "rounded")).toEqual([[5]]);
    expect(own(node, "text_size")).toEqual([[11]]);
  }
});

test("an idle or unknown agent gets no status chip", () => {
  expect(statusChip("idle", t)).toBeNull();
  expect(statusChip("unknown", t)).toBeNull();
  expect(statusChip(null, t)).toBeNull();
});

test("a status chip can carry its own words", () => {
  expect((statusChip("blocked", t, { label: "2 need you" }) as Node).texts).toEqual(["2 need you"]);
});

test("a card header is 40 px with its icon, its label and its count, and keeps what it is given on the right", () => {
  const node = cardHeader("head", { icon: "bot", label: "Agents", count: 4 }, t).child("right") as Node;
  expect(node.key).toBe("head");
  expect(own(node, "h")).toEqual([[40]]);
  expect(own(node, "pl")).toEqual([[14]]);
  expect(own(node, "pr")).toEqual([[8]]);
  expect(svgs(node)).toEqual(["mods/kit/icons/bot.svg"]);
  const [glyph, label, count, spacer] = node.kids;
  expect(own(glyph as Node, "text_color")).toEqual([["t.muted"]]);
  expect((label as Node).texts).toEqual(["Agents"]);
  expect(own(label as Node, "text_size")).toEqual([[13]]);
  expect(own(label as Node, "text_color")).toEqual([["t.muted"]]);
  expect((count as Node).texts).toEqual(["4"]);
  expect(own(count as Node, "text_color")).toEqual([["t.dim"]]);
  expect(own(spacer as Node, "flex_1")).toEqual([[]]);
  expect(node.texts).toEqual(["right"]);
});

test("a card header without a count shows none", () => {
  const node = cardHeader("head", { icon: "layers", label: "Spaces" }, t) as Node;
  expect(node.kids.flatMap((kid) => kid.texts)).toEqual(["Spaces"]);
});

test("a view tile is a 28 px rounded square with a 16 px icon in the foreground", () => {
  const node = viewTile("brain", t) as Node;
  expect(own(node, "size")).toEqual([[28]]);
  expect(own(node, "rounded")).toEqual([[8]]);
  expect(own(node, "bg")).toEqual([["t.foreground14"]]);
  expect(own(node, "border_color")).toEqual([["t.foreground1F"]]);
  expect(svgs(node)).toEqual(["mods/kit/icons/brain.svg"]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[16]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.foreground"]]);
});

test("a pill is 34 px high on the surface, keeps its press from the window drag and runs its click", () => {
  const order: string[] = [];
  const node = pill("sync", { icon: "rotate-cw", label: "Read 2m ago", tooltip: "Read again", onClick: () => order.push("click") }, t) as Node;
  expect(node.key).toBe("sync");
  expect(own(node, "h")).toEqual([[34]]);
  expect(own(node, "px")).toEqual([[10]]);
  expect(own(node, "w")).toEqual([]);
  expect(own(node, "rounded")).toEqual([[10]]);
  expect(own(node, "bg")).toEqual([["t.surface"]]);
  expect(own(node, "border_color")).toEqual([["t.foreground12"]]);
  expect(own(node, "tooltip")).toEqual([["Read again"]]);
  expect(texts(node)).toEqual(["Read 2m ago"]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[13]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.muted"]]);
  node.handlers["down:left"][0]({}, { stop_propagation: () => order.push("stop") });
  click(node);
  expect(order).toEqual(["stop", "click"]);
});

test("a pill without a label is a 34 px square with a 14 px icon", () => {
  const node = pill("gear", { icon: "settings", onClick() {} }, t) as Node;
  expect(own(node, "w")).toEqual([[34]]);
  expect(own(node, "px")).toEqual([]);
  expect(own(node, "tooltip")).toEqual([]);
  expect(node.texts).toEqual([]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[14]]);
});

test("a picker pill has a 14 px icon and a dim chevron after its label", () => {
  const node = pill("machine", { icon: "monitor", label: "This computer", chevron: true, onClick() {} }, t) as Node;
  expect(svgs(node)).toEqual(["mods/kit/icons/monitor.svg", "mods/kit/icons/chevron-down.svg"]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[14]]);
  expect(own(node.kids.at(-1) as Node, "text_color")).toEqual([["t.dim"]]);
});

test("a pill can spin its icon and color it", () => {
  const node = pill("sync", { icon: "rotate-cw", label: "Reading…", spin: true, color: "t.blocked", onClick() {} }, t) as Node;
  expect(own(node.kids[0] as Node, "spin")).toEqual([[900]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.blocked"]]);
  expect(own(pill("still", { icon: "rotate-cw", label: "Read", onClick() {} }, t).kids[0] as Node, "spin")).toEqual([]);
});

test("a tag is a 22 px light chip with a gray icon, its label cut to fit, and a chevron when it picks", () => {
  const node = tag("branch", { icon: "git-branch", label: "main", tooltip: "main", maxWidth: 140 }, t) as Node;
  expect(own(node, "h")).toEqual([[22]]);
  expect(own(node, "px")).toEqual([[7]]);
  expect(own(node, "rounded")).toEqual([[6]]);
  expect(own(node, "bg")).toEqual([["t.foreground0D"]]);
  expect(own(node, "max_w")).toEqual([[140]]);
  expect(own(node, "tooltip")).toEqual([["main"]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.unknown"]]);
  expect(own(node.kids[1] as Node, "truncate")).toEqual([[]]);
  expect(svgs(tag("p", { icon: "building-2", label: "Team", chevron: true, onClick() {} }, t))).toEqual(["mods/kit/icons/building-2.svg", "mods/kit/icons/chevron-down.svg"]);
});

test("a segment is 28 px, the chosen one on a light fill in the foreground", () => {
  const on = segment("board", { icon: "square-kanban", label: "Board", selected: true, onClick() {} }, t) as Node;
  expect(own(on, "h")).toEqual([[28]]);
  expect(own(on, "px")).toEqual([[10]]);
  expect(own(on, "bg")).toEqual([["t.foreground14"]]);
  expect(own(on, "text_color")).toEqual([["t.foreground"]]);
  const off = segment("list", { icon: "list", onClick() {} }, t) as Node;
  expect(own(off, "px")).toEqual([[7]]);
  expect(own(off, "bg")).toEqual([]);
  expect(own(off, "text_color")).toEqual([["t.muted"]]);
});

test("a pane tile is a 24 px square with 7 px corners on a light fill", () => {
  const node = paneTile("x", t) as Node;
  expect(own(node, "size")).toEqual([[24]]);
  expect(own(node, "rounded")).toEqual([[7]]);
  expect(own(node, "bg")).toEqual([["t.foreground0D"]]);
});

test("an input is 32 px with 9 px corners, an accent line while focused, a search glyph or a dashed start", () => {
  const state = {} as any;
  const focused = input(state, t) as Node;
  expect(own(focused, "h")).toEqual([[32]]);
  expect(own(focused, "rounded")).toEqual([[9]]);
  expect(own(focused, "border_color")).toEqual([["t.accentB3"]]);
  expect(own(input(state, t, { focused: false }) as Node, "border_color")).toEqual([["t.foreground14"]]);
  expect(svgs(input(state, t, { kind: "search" }))).toEqual(["mods/kit/icons/search.svg"]);
  const start = input(state, t, { kind: "start", focused: false }) as Node;
  expect(own(start, "border_dashed")).toEqual([[]]);
  expect(svgs(start)).toEqual(["mods/kit/icons/plus.svg"]);
});

test("a view card is a surface card with 14 px corners, a light line and a medium shadow", () => {
  const node = viewCard("today", t) as Node;
  expect(node.key).toBe("today");
  expect(own(node, "bg")).toEqual([["t.surface"]]);
  expect(own(node, "rounded")).toEqual([[14]]);
  expect(own(node, "border_color")).toEqual([["t.foreground12"]]);
  expect(own(node, "shadow_md")).toEqual([[]]);
});

test("a program's icon is its picture, or its glyph tinted in its tile color, or the color given", () => {
  const picture = programIcon({ icon: "icons/zed.png" }, { size: 12 }, t) as Node;
  expect(picture.calls.some(([call, args]) => call === "image" && args[0] === "icons/zed.png")).toBe(true);
  const tinted = programIcon({ icon: "icons/claude.svg", tint: true, tile: "#d97757" }, {}, t) as Node;
  expect(svgs(tinted)).toEqual(["icons/claude.svg"]);
  expect(tinted.calls).toContainEqual(["text_color", ["#d97757"]]);
  expect((programIcon({ icon: "icons/claude.svg", tint: true }, { color: t.muted }, t) as Node).calls).toContainEqual(["text_color", ["t.muted"]]);
});

test("a program without an icon draws nothing, or the fallback glyph in muted", () => {
  expect(programIcon({ name: "zsh" }, {}, t)).toBeNull();
  const fallback = programIcon(null, { fallback: "terminal" }, t) as Node;
  expect(svgs(fallback)).toEqual(["mods/kit/icons/terminal.svg"]);
  expect(fallback.calls).toContainEqual(["text_color", ["t.muted"]]);
});

test("a step card is the surface with 10 px corners, 8 px in and a faint line", () => {
  const node = stepCard(t) as Node;
  expect(own(node, "p")).toEqual([[8]]);
  expect(own(node, "rounded")).toEqual([[10]]);
  expect(own(node, "bg")).toEqual([["t.surface"]]);
  expect(own(node, "border_color")).toEqual([["t.foreground0F"]]);
});

test("a detail line is a faint rule over a 26 px row, its mark and detail in its color", () => {
  const node = detailLine("Tests", { detail: "failure", color: "t.blocked", mark: "exclamation" }, t) as Node;
  expect(own(node.kids[0] as Node, "bg")).toEqual([["t.foreground0A"]]);
  const row = node.kids[1] as Node;
  expect(own(row, "h")).toEqual([[26]]);
  expect(texts(row)).toEqual(["Tests", "failure"]);
  expect(svgs(row)).toEqual(["mods/kit/icons/exclamation.svg"]);
});

test("a timeline step colors its name and note by where it stands", () => {
  const note = (options: Record<string, unknown>) => {
    const node = timelineStep("s", { name: "Ship", note: "n", ...options }, t) as Node;
    return walk(node).find((n) => n.texts.includes("n")) as Node;
  };
  expect(own(note({ node: "done" }), "text_color")).toEqual([["t.done"]]);
  expect(own(note({ node: "done" }), "opacity")).toEqual([[0.75]]);
  expect(own(note({ node: "current", current: true }), "text_color")).toEqual([["t.accent"]]);
  expect(own(note({ node: "bad", current: true }), "text_color")).toEqual([["t.blocked"]]);
  expect(own(note({}), "text_color")).toEqual([["t.unknown"]]);
  const name = walk(timelineStep("s", { name: "Ship", node: "current", current: true }, t) as Node).find((n) => n.texts.includes("Ship")) as Node;
  expect(own(name, "font_semibold")).toEqual([[]]);
});

test("a timeline step's chevron points down while it is open, and its body sits 8 px under the name", () => {
  const open = timelineStep("s", { name: "Task", node: "done", chevron: "down", body: "the body" }, t) as Node;
  expect(svgs(open)).toContain("mods/kit/icons/chevron-down.svg");
  expect(texts(open)).toContain("the body");
  expect(svgs(timelineStep("s", { name: "Task", node: "done", chevron: "right" }, t))).toContain("mods/kit/icons/chevron-right.svg");
  const last = timelineStep("s", { name: "Clear", last: true }, t) as Node;
  expect(walk(last).filter((n) => own(n, "w").some(([w]) => w === 1.5))).toEqual([]);
});

test("a check row being asked sits on the selection with an accent edge, its state as a chip", () => {
  const asking = checkRow("c", { code: "D02", steps: "Reply", expected: "It reopens", state: "asking" }, t) as Node;
  expect(own(asking, "bg")).toEqual([["t.selection"]]);
  expect(own(asking, "border_color")).toEqual([["t.accent80"]]);
  expect(texts(asking)).toEqual(["D02", "Reply", "asking", "→ It reopens"]);
  const chipNode = walk(asking).find((n) => n.texts.includes("asking")) as Node;
  expect(own(chipNode, "bg")).toEqual([["t.working1F"]]);
  const pending = checkRow("p", { code: "D03", steps: "Run", expected: "Left out", state: "pending" }, t) as Node;
  expect(own(pending, "bg")).toEqual([]);
  expect(own(walk(pending).find((n) => n.texts.includes("pending")) as Node, "bg")).toEqual([["t.foreground0F"]]);
  expect(texts(checkRow("s", { code: "D01", steps: "Close", expected: "Quiet", state: "sent", label: "sent" }, t))).toContain("sent");
});

test("a lane row draws a dot per step: done ones faded, the current one in its color, the rest as rings", () => {
  const node = laneRow("l", { color: "t.blocked", code: "T-1", title: "A task", step: "Check", why: "asks", dots: ["done", "current", "todo"] }, t) as Node;
  const dots = walk(node).filter((n) => own(n, "size").some(([size]) => size === 6));
  expect(dots.map((n) => own(n, "bg")[0]?.[0] ?? own(n, "border_color")[0]?.[0])).toEqual(["t.done", "t.blocked", "t.dim"]);
  expect(own(dots[0] as Node, "opacity")).toEqual([[0.6]]);
  expect(texts(node)).toEqual(["T-1", "A task", "Check", "asks"]);
  expect(own(node.kids.at(-1) as Node, "bg")).toEqual([["t.foreground0A"]]);
  expect(laneRow("l", { color: "t.done", code: "T", title: "x", step: "s", last: true }, t).kids).toHaveLength(1);
});

test("the next step is a full-width large primary button with where it goes under it", () => {
  const node = nextStep("next", { label: "Run it", icon: "play", target: "the agent", onClick() {} }, t) as Node;
  const button = node.kids[0] as Node;
  expect(own(button, "h")).toEqual([[34]]);
  expect(own(button, "bg")).toEqual([["t.solid"]]);
  expect(own(button, "w_full")).toEqual([[]]);
  expect(texts(node)).toEqual(["Run it", "→ the agent"]);
});

test("a release card puts its screenshots two to a row", () => {
  const shots = [1, 2, 3].map((n) => ({ id: `shot-${n}`, image: `/s/${n}.png`, caption: `Shot ${n}` }));
  const node = releaseCard({ heading: "Release 4", title: "Title", shots }, t) as Node;
  const images = walk(node).filter((n) => n.calls.some(([c]) => c === "image"));
  expect(images).toHaveLength(3);
  expect(texts(node)).toEqual(["RELEASE 4", "Title", "Shot 1", "Shot 2", "Shot 3"]);
});

test("an empty state centers its title and detail under a 32 px tile", () => {
  const node = emptyState({ title: "Nothing here", detail: "Why" }, t) as Node;
  expect(own(node.kids[0] as Node, "size")).toEqual([[32]]);
  expect(svgs(node)).toEqual(["mods/kit/icons/command.svg"]);
  expect(texts(node)).toEqual(["Nothing here", "Why"]);
  expect(texts(emptyState({ title: "Reading" }, t))).toEqual(["Reading"]);
});

test("the last click's line has a check in done when it worked and an exclamation in working when it didn't", () => {
  const ok = lastClick("Sent", {}, t) as Node;
  expect(svgs(ok)).toEqual(["mods/kit/icons/check.svg"]);
  expect(own(ok.kids[1] as Node, "text_color")).toEqual([["t.done"]]);
  const failed = lastClick("Not sent", { ok: false }, t) as Node;
  expect(svgs(failed)).toEqual(["mods/kit/icons/exclamation.svg"]);
  expect(own(failed.kids[1] as Node, "text_color")).toEqual([["t.working"]]);
});

test("a profile button says the flow with an accent dot, or Off with a dim one", () => {
  const on = profile("p", { label: "Work", onClick() {} }, t) as Node;
  expect(own(on, "h")).toEqual([[24]]);
  expect(own(on.kids[0] as Node, "bg")).toEqual([["t.accent"]]);
  expect(texts(on)).toEqual(["Work"]);
  const off = profile("p", { off: true, onClick() {} }, t) as Node;
  expect(own(off.kids[0] as Node, "bg")).toEqual([["t.dim"]]);
  expect(texts(off)).toEqual(["Off"]);
});

test("a chip can be the 16 px subtask tag, or carry an icon in place of its dot", () => {
  const xs = chip("Subtask", { size: "xs" }, t) as Node;
  expect(own(xs, "h")).toEqual([[16]]);
  expect(own(xs, "rounded")).toEqual([[4]]);
  expect(own(xs, "text_size")).toEqual([[10.5]]);
  const flagged = chip("High", { size: "md", icon: "flag", iconColor: "t.working" }, t) as Node;
  expect(svgs(flagged)).toEqual(["mods/kit/icons/flag.svg"]);
  expect(own(flagged.kids[0] as Node, "text_color")).toEqual([["t.working"]]);
});

test("a button with a width limit cuts its label to fit", () => {
  const node = button("b", { label: "A long label for a small place", maxWidth: 210, onClick() {} }, t) as Node;
  expect(own(node, "max_w")).toEqual([[210]]);
  expect(own(node.kids.at(-1) as Node, "truncate")).toEqual([[]]);
});

test("a segment group holds its segments 2 px apart on the surface", () => {
  const node = segmentGroup("g", [segment("a", { label: "A", onClick() {} }, t), segment("b", { label: "B", onClick() {} }, t)], t) as Node;
  expect(own(node, "p")).toEqual([[3]]);
  expect(own(node, "rounded")).toEqual([[11]]);
  expect(node.kids).toHaveLength(2);
});

test("a card link is a 26 px chip with its label and an arrow", () => {
  const node = cardLink("l", { label: "GitHub", onClick() {} }, t) as Node;
  expect(own(node, "h")).toEqual([[26]]);
  expect(own(node, "bg")).toEqual([["t.foreground08"]]);
  expect(texts(node)).toEqual(["GitHub"]);
  expect(svgs(node)).toEqual(["mods/kit/icons/arrow-up-right.svg"]);
});

test("a stat card shows its value large, or a word smaller and muted, over its legend", () => {
  const node = statCard("s", { icon: "bot", label: "Agents", value: 4, legend: [{ text: "1 needs you", color: "t.blocked" }] }, t) as Node;
  expect(texts(node)).toEqual(["Agents", "4", "1 needs you"]);
  const value = walk(node).find((n) => n.texts.includes("4")) as Node;
  expect(own(value, "text_size")).toEqual([[30]]);
  const word = walk(statCard("s", { icon: "list", label: "Tasks", value: "Connect" }, t) as Node).find((n) => n.texts.includes("Connect")) as Node;
  expect(own(word, "text_size")).toEqual([[15]]);
  expect(own(word, "text_color")).toEqual([["t.muted"]]);
});

test("the rows are 58, 56, 52 and 54 px with 10 px corners", () => {
  const face = "face";
  expect(own(needRow("n", { avatar: face, title: "a" }, t) as Node, "h")).toEqual([[58]]);
  expect(own(flightRow("f", { avatar: face, title: "a", step: "s", color: "t.done", segments: ["done"] }, t) as Node, "h")).toEqual([[56]]);
  expect(own(prRow("p", { avatar: face, title: "a", checks: { icon: "circle", color: "t.dim", text: "No checks" } }, t) as Node, "h")).toEqual([[52]]);
  expect(own(taskRow("r", { ring: "t.dim", title: "a" }, t) as Node, "h")).toEqual([[54]]);
  expect(own(needRow("n", { avatar: face, title: "a" }, t) as Node, "rounded")).toEqual([[10]]);
});

test("a flight row draws one bar per step: done ones faded, the current one in its color", () => {
  const node = flightRow("f", { avatar: "x", title: "a", step: "Check", color: "t.blocked", count: "2/3", segments: ["done", "current", "todo"] }, t) as Node;
  const bars = walk(node).filter((n) => own(n, "h").some(([h]) => h === 4));
  expect(bars.map((n) => own(n, "bg")[0][0])).toEqual(["t.doneB3", "t.blocked", "t.foreground14"]);
});

test("a log line is time, who, what in its color and the note, in the given font", () => {
  const node = logLine("l", { time: "14:12", who: "nuoh", what: "merged", color: "t.done", note: "#412", font: "Mono" }, t) as Node;
  expect(texts(node)).toEqual(["14:12", "nuoh", "merged", "#412"]);
  expect(own(node, "font_family")).toEqual([["Mono"]]);
  expect(own(node.kids[2] as Node, "text_color")).toEqual([["t.done"]]);
});

test("a task card lights its line when hovered and turns it accent while its task is open", () => {
  const line = (options: Record<string, unknown>) => own(taskCard("c", { code: "T-1", title: "a", ...options }, t) as Node, "border_color")[0][0];
  expect(line({})).toBe("t.foreground0F");
  expect(line({ hovered: true })).toBe("t.foreground1F");
  expect(line({ open: true })).toBe("t.accent");
  expect(own(taskCard("c", { code: "T-1", title: "a", hovered: true }, t) as Node, "bg")).toEqual([["t.selected"]]);
});

test("a column head and a meta mark keep the design system's sizes", () => {
  const head = columnHead({ color: "t.working", label: "In progress", count: 2 }, t) as Node;
  expect(own(head, "h")).toEqual([[40]]);
  expect(texts(head)).toEqual(["In progress", "2"]);
  const mark = meta({ icon: "calendar", text: "Today", color: "t.working" }, t) as Node;
  expect(own(mark.kids[0] as Node, "size")).toEqual([[11]]);
  expect(own(mark.kids[1] as Node, "text_color")).toEqual([["t.working"]]);
});
