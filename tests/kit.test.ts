import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { click, type Node, own, svgs, texts, walk } from "./app-mocks";

const { ICONS, avatar, button, cardHeader, chip, iconButton, iconPath, input, menuItem, paneTile, pill, programIcon, segment, statusChip, stepNode, tag, toneColor, viewCard, viewTile } = await import("../kit/kit.js");

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
