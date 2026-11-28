import { beforeEach, expect, test } from "bun:test";
import { byKey, calls, herdr, type Node, svgs, texts, walk } from "./app-mocks";

const { ICONS } = await import("../kit/kit.js");
const { default: Kit } = await import("../mods/kit/main.js");

beforeEach(() => {
  herdr.theme = () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) });
});

function render() {
  const kit = new Kit();
  kit.init();
  return kit.render({ notify() {} }) as Node;
}

test("the gallery shows every section", () => {
  const root = render();
  for (const id of ["buttons", "icon-buttons", "segments", "tags", "links", "chips", "status-chips", "pills", "program-icons", "avatars", "inputs", "card-headers", "view-parts", "lines", "timeline", "checks", "lanes", "release", "empty", "last-click", "profile", "stats", "rows", "log", "board", "menu-items", "workflows-canvas", "dots", "steps", "icons"]) {
    expect(byKey(root, `kit-${id}`)).toBeDefined();
  }
});

test("the gallery draws every icon with its name", () => {
  const section = byKey(render(), "kit-icons");
  const drawn = svgs(section);
  for (const name of ICONS) {
    expect(drawn).toContain(`mods/kit/icons/${name}.svg`);
    expect(texts(section)).toContain(name);
  }
  expect(drawn).toHaveLength(ICONS.length);
});

test("the gallery shows each step state", () => {
  const section = byKey(render(), "kit-steps");
  const borders = walk(section).flatMap((n) => calls(n, "border_color"));
  expect(borders).toEqual(["t.accent", "t.blocked", "t.input"]);
  expect(svgs(section)).toEqual(["mods/kit/icons/check-heavy.svg", "mods/kit/icons/exclamation.svg"]);
});

test("the gallery shows the buttons and chips the mods use", () => {
  const root = render();
  const colorOf = (id: string) => walk(byKey(root, id)).flatMap((n) => calls(n, "text_color"));
  expect(texts(byKey(root, "kit-b-named"))).toContain("GitHub");
  expect(colorOf("kit-b-named")).toContain("t.muted");
  for (const variant of ["primary", "secondary", "tinted", "ghost", "danger"]) expect(byKey(root, `kit-b-${variant}`)).toBeDefined();
  for (const size of ["sm", "md", "lg"]) expect(byKey(root, `kit-b-${size}`)).toBeDefined();
  expect(svgs(byKey(root, "kit-b-pass"))).toEqual(["mods/kit/icons/check.svg"]);
  expect(colorOf("kit-b-pass")).toContain("t.done");
  expect(svgs(byKey(root, "kit-b-fail"))).toEqual(["mods/kit/icons/x.svg"]);
  expect(colorOf("kit-b-fail")).toContain("t.blocked");
  expect(texts(byKey(root, "kit-chips"))).toEqual(expect.arrayContaining(["blocked", "working", "done", "neutral"]));
});

test("the gallery shows menu items with an icon, a color dot, a check, a line under one and a selected one", () => {
  const section = byKey(render(), "kit-menu-items");
  expect(texts(section)).toEqual(expect.arrayContaining(["New folder…", "Clients", "Remove from folder", "Selected", "Work", "the team's flow"]));
  expect(svgs(section)).toEqual(expect.arrayContaining(["mods/kit/icons/plus.svg", "mods/kit/icons/check.svg"]));
});

test("the gallery shows a focused search input, a quiet one and a dashed start field", () => {
  const section = byKey(render(), "kit-inputs");
  const borders = walk(section).flatMap((n) => calls(n, "border_color"));
  expect(borders).toEqual(["t.accentB3", "t.foreground14", "t.foreground24"]);
  expect(svgs(section)).toEqual(["mods/kit/icons/search.svg", "mods/kit/icons/plus.svg"]);
});

test("the gallery shows the status chips and both card headers the nuoh sidebar uses", () => {
  const root = render();
  expect(texts(byKey(root, "kit-status-chips"))).toEqual(["STATUS CHIPS", "Needs you", "Working", "Done"]);
  const headers = byKey(root, "kit-card-headers");
  expect(texts(byKey(headers, "kit-ch-actions"))).toEqual(["Spaces", "9"]);
  expect(texts(byKey(headers, "kit-ch-chip"))).toEqual(["Agents", "4", "1 needs you"]);
  expect(svgs(headers)).toEqual([
    "mods/kit/icons/layers.svg",
    "mods/kit/icons/folder-plus.svg",
    "mods/kit/icons/plus.svg",
    "mods/kit/icons/bot.svg",
    "mods/kit/icons/list-filter.svg",
  ]);
});

test("the gallery shows the view parts the nuoh views draw their bands and cards with", () => {
  const root = render();
  const pills = byKey(root, "kit-pills");
  expect(texts(byKey(pills, "kit-pill-status"))).toEqual(["Read 2m ago"]);
  expect(texts(byKey(pills, "kit-pill-square"))).toEqual([]);
  expect(texts(byKey(pills, "kit-pill-picker"))).toEqual(["This computer"]);
  const section = byKey(root, "kit-view-parts");
  expect(byKey(section, "kit-view-card")).toBeDefined();
  expect(svgs(section)).toEqual(expect.arrayContaining(["mods/kit/icons/layers.svg", "mods/kit/icons/command.svg"]));
});

test("the gallery shows the canvas's nodes in each state, its ports, bars and run pills", () => {
  const section = byKey(render(), "kit-workflows-canvas");
  for (const id of ["kit-node-idle", "kit-node-selected", "kit-node-running", "kit-node-done", "kit-node-failed", "kit-node-command", "kit-node-condition", "kit-node-approval", "kit-node-start", "kit-node-skipped", "kit-port-under", "kit-toolbar", "kit-canvas-bar", "kit-zoom-bar", "kit-minimap", "kit-add-node", "kit-run-waiting"]) {
    expect(byKey(section, id)).toBeDefined();
  }
  expect(texts(section)).toContain("up to 3×");
});
