import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Node, walk } from "./app-mocks";

const { ICONS, avatar, barPill, button, cardHeader, chip, iconButton, iconPath, popupRow, programIcon, statusChip, stepNode, toneColor, viewCard, viewTile } = await import("../kit/kit.js");

const repo = join(import.meta.dir, "..");
const t = new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }) as any;

const calls = (node: Node, name: string) => walk(node).flatMap((n) => n.calls.filter(([c]) => c === name).map(([, args]) => args));
const svgs = (node: Node) => calls(node, "svg").map(([path]) => path);
const own = (node: Node, name: string) => node.calls.filter(([c]) => c === name).map(([, args]) => args);

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

test("an icon button has its tooltip and a colored icon", () => {
  const node = iconButton("b", { icon: "github", tooltip: "GitHub", color: "t.accent", onClick() {} }, t);
  expect(calls(node, "tooltip")).toContainEqual(["GitHub"]);
  expect(svgs(node)).toEqual(["mods/kit/icons/github.svg"]);
  expect(calls(node, "text_color")).toContainEqual(["t.accent"]);
});

test("a solid button uses the accent, an outline button the input border", () => {
  const solid = button("s", { label: "Go", variant: "solid", onClick() {} }, t);
  expect(own(solid, "bg")).toContainEqual(["t.accent"]);
  const outline = button("o", { label: "Go", onClick() {} }, t);
  expect(own(outline, "border_color")).toContainEqual(["t.input"]);
});

test("a disabled button still reports its click", () => {
  let clicks = 0;
  const node = button("d", { label: "Next", disabled: true, onClick: () => clicks++ }, t);
  expect(own(node, "bg")).toContainEqual(["t.raised"]);
  node.handlers.click[0]({}, {});
  expect(clicks).toBe(1);
});

test("a chip draws its mark before the text", () => {
  const node = chip("passed", { mark: "check", color: "t.done" }, t);
  expect(svgs(node)).toEqual(["mods/kit/icons/check.svg"]);
  expect(node.texts).toEqual(["passed"]);
  expect(node.kids).toHaveLength(1);
});

test("a button's icon takes iconColor while the label keeps the text color", () => {
  const node = button("b", { label: "GitHub", icon: "github", iconColor: "t.muted", onClick() {} }, t);
  const iconNode = node.kids.find((k) => k.calls.some(([c]) => c === "svg")) as Node;
  expect(own(iconNode, "text_color")).toEqual([["t.muted"]]);
  expect(own(node, "text_color")).toEqual([["t.foreground"]]);
  const plain = button("b", { label: "GitHub", icon: "github", onClick() {} }, t);
  const plainIcon = plain.kids.find((k) => k.calls.some(([c]) => c === "svg")) as Node;
  expect(own(plainIcon, "text_color")).toEqual([["t.foreground"]]);
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

test("a button's text size follows its height", () => {
  const size = (height?: number) => own(button("b", { label: "Go", height, onClick() {} }, t), "text_size");
  expect(size(32)).toEqual([[12]]);
  expect(size(28)).toEqual([[11.5]]);
  expect(size()).toEqual([[11]]);
});

test("a button's hint stays at the small text size whatever the height", () => {
  const hint = (height?: number) => own(button("b", { label: "Go", hint: "ctrl-k", height, onClick() {} }, t).kids.at(-1) as Node, "text_size");
  expect(hint(32)).toEqual([[11]]);
  expect(hint()).toEqual([[11]]);
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

test("a popup row has its icon, label and detail, and runs its click", () => {
  let clicks = 0;
  const node = popupRow("r", { icon: "plus", label: "New folder…", detail: "cmd-n", onClick: () => clicks++ }, t);
  expect(svgs(node)).toEqual(["mods/kit/icons/plus.svg"]);
  expect(walk(node).flatMap((n) => n.texts)).toEqual(["New folder…", "cmd-n"]);
  expect(own(node, "bg")).toEqual([]);
  node.handlers.click[0]({}, {});
  expect(clicks).toBe(1);
});

test("a popup row shows its choice as a selected background or an accent check", () => {
  expect(own(popupRow("s", { icon: "x", label: "Here", selected: true, onClick() {} }, t), "bg")).toContainEqual(["t.selected"]);
  const checked = popupRow("c", { dot: "t.ansi4", label: "Clients", check: true, onClick() {} }, t);
  expect(svgs(checked)).toEqual(["mods/kit/icons/check.svg"]);
  expect(calls(checked, "text_color")).toContainEqual(["t.accent"]);
  expect(calls(checked, "bg")).toContainEqual(["t.ansi4"]);
});

test("a popup row in a color tints its label and icon", () => {
  const node = popupRow("d", { icon: "x", label: "Delete", color: "t.blocked", onClick() {} }, t);
  expect(own(node, "text_color")).toContainEqual(["t.blocked"]);
  expect(calls(node, "text_color").filter(([color]) => color === "t.muted")).toEqual([]);
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

test("a bar pill is 34 px high on the surface, keeps its press from the window drag and runs its click", () => {
  const order: string[] = [];
  const node = barPill("sync", { icon: "rotate-cw", label: "Read 2m ago", tooltip: "Read again", onClick: () => order.push("click") }, t) as Node;
  expect(node.key).toBe("sync");
  expect(own(node, "h")).toEqual([[34]]);
  expect(own(node, "px")).toEqual([[10]]);
  expect(own(node, "w")).toEqual([]);
  expect(own(node, "rounded")).toEqual([[10]]);
  expect(own(node, "bg")).toEqual([["t.surface"]]);
  expect(own(node, "border_color")).toEqual([["t.foreground12"]]);
  expect(own(node, "tooltip")).toEqual([["Read again"]]);
  expect(walk(node).flatMap((n) => n.texts)).toEqual(["Read 2m ago"]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[13]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.muted"]]);
  node.handlers["down:left"][0]({}, { stop_propagation: () => order.push("stop") });
  node.handlers.click[0]({}, {});
  expect(order).toEqual(["stop", "click"]);
});

test("a bar pill without a label is a 34 px square with a 14 px icon", () => {
  const node = barPill("gear", { icon: "settings", onClick() {} }, t) as Node;
  expect(own(node, "w")).toEqual([[34]]);
  expect(own(node, "px")).toEqual([]);
  expect(own(node, "tooltip")).toEqual([]);
  expect(node.texts).toEqual([]);
  expect(own(node.kids[0] as Node, "size")).toEqual([[14]]);
});

test("a bar pill can spin its icon and color it", () => {
  const node = barPill("sync", { icon: "rotate-cw", label: "Reading…", spin: true, color: "t.blocked", onClick() {} }, t) as Node;
  expect(own(node.kids[0] as Node, "spin")).toEqual([[900]]);
  expect(own(node.kids[0] as Node, "text_color")).toEqual([["t.blocked"]]);
  expect(own(barPill("still", { icon: "rotate-cw", label: "Read", onClick() {} }, t).kids[0] as Node, "spin")).toEqual([]);
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
