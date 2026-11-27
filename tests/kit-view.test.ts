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
  for (const id of ["buttons", "icon-buttons", "links", "chips", "status-chips", "pill", "program-icons", "avatars", "inputs", "card-headers", "view-parts", "lines", "popup-rows", "dots", "steps", "icons"]) {
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
  expect(svgs(byKey(root, "kit-b-pass"))).toEqual(["mods/kit/icons/check.svg"]);
  expect(colorOf("kit-b-pass")).toContain("t.done");
  expect(svgs(byKey(root, "kit-b-fail"))).toEqual(["mods/kit/icons/x.svg"]);
  expect(colorOf("kit-b-fail")).toContain("t.blocked");
  const chips = svgs(byKey(root, "kit-chips"));
  expect(chips).toContain("mods/kit/icons/exclamation.svg");
  expect(chips).not.toContain("mods/kit/icons/x.svg");
});

test("the gallery shows popup rows with an icon, a color dot, a check and a selected one", () => {
  const section = byKey(render(), "kit-popup-rows");
  expect(texts(section)).toEqual(expect.arrayContaining(["New folder…", "Clients", "Remove from folder", "Selected"]));
  expect(svgs(section)).toEqual(expect.arrayContaining(["mods/kit/icons/plus.svg", "mods/kit/icons/check.svg"]));
});

test("the gallery shows an input with the accent border and a quiet one with the input border", () => {
  const section = byKey(render(), "kit-inputs");
  const borders = walk(section).flatMap((n) => calls(n, "border_color"));
  expect(borders).toEqual(["t.accent", "t.input"]);
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
  const section = byKey(render(), "kit-view-parts");
  expect(texts(byKey(section, "kit-bp-label"))).toEqual(["Read 2m ago"]);
  expect(texts(byKey(section, "kit-bp-square"))).toEqual([]);
  expect(byKey(section, "kit-view-card")).toBeDefined();
  expect(svgs(section)).toEqual(expect.arrayContaining(["mods/kit/icons/layers.svg", "mods/kit/icons/rotate-cw.svg", "mods/kit/icons/settings.svg"]));
});
