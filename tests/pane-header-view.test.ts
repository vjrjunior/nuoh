import { beforeEach, describe, expect, test } from "bun:test";
import { byKey, calls, click, herdr, makeCx, type Node, svgs, texts, walk } from "./app-mocks";

const { default: PaneHeader } = await import("../mods/pane-header/main.js");

type Pane = Record<string, unknown>;

let paneList: Pane[] = [];
let shown = "p1";
let zoom = 1;
let runs: [string, unknown][] = [];

const claude = { key: "claude", name: "Claude Code", icon: "icons/claude.svg", tint: true, agent: true, shell: false };

beforeEach(() => {
  paneList = [
    { pane: "p1", terminal: "t1", tab: "a", title: "✳ Fix login", name: null, cwd: "/Users/me/code/app", status: "working", program: claude, focused: true, zoomed: false },
    { pane: "p2", terminal: "t2", tab: "a", title: "zsh", name: null, cwd: "/Users/me", status: null, program: { key: "shell", name: "zsh", icon: null, tint: false }, focused: false, zoomed: false },
  ];
  shown = "p1";
  zoom = 1;
  runs = [];
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }),
    props: () => ({ pane: shown, terminal: "t1" }),
    panes: () => paneList,
    home: () => "/Users/me",
    settings: () => ({ zoom }),
    run: (name: string, args: unknown) => runs.push([name, args]),
  });
});

function header() {
  const view = new PaneHeader();
  view.init();
  return view;
}

function hover(view: InstanceType<typeof PaneHeader>) {
  const root = view.render() as Node;
  root.handlers.hover?.[0]?.(true, makeCx());
  return view.render() as Node;
}

function resize(view: InstanceType<typeof PaneHeader>, width: number) {
  const root = view.render() as Node;
  const handler = calls(root, "on_size_change")[0] as (size: { width: number; height: number }, cx: unknown) => void;
  handler({ width, height: 42 }, makeCx());
  return view.render() as Node;
}

describe("the header", () => {
  test("shows the program's tile, the cleaned title, the status chip and the folder", () => {
    const root = header().render() as Node;
    expect(texts(root)).toEqual(["Fix login", "Working", "~/code/app"]);
    const tile = root.kids[0] as Node;
    expect(calls(tile, "size")).toEqual([24]);
    expect(calls(tile, "rounded")).toEqual([7]);
    expect(calls(tile, "bg")).toEqual(["t.foreground0D"]);
    const glyph = tile.kids[0] as Node;
    expect(calls(glyph, "svg")).toEqual(["icons/claude.svg"]);
    expect(calls(glyph, "text_color")).toEqual(["t.muted"]);
  });

  test("the title is 13 px medium, in the foreground color while the pane has focus", () => {
    const title = walk(header().render() as Node).find((n) => n.texts.includes("Fix login")) as Node;
    expect(calls(title, "text_size")).toEqual([13]);
    expect(calls(title, "font_medium")).toHaveLength(1);
    expect(calls(title, "text_color")).toEqual(["t.foreground"]);
  });

  test("an unfocused pane's title is muted, and an idle one shows no chip", () => {
    shown = "p2";
    const root = header().render() as Node;
    expect(texts(root)).toEqual(["zsh", "~"]);
    const title = walk(root).find((n) => n.texts.includes("zsh")) as Node;
    expect(calls(title, "text_color")).toEqual(["t.muted"]);
  });

  test("a program without an icon gets the kit's terminal icon", () => {
    shown = "p2";
    const tile = (header().render() as Node).kids[0] as Node;
    expect(calls(tile.kids[0] as Node, "svg")).toEqual(["mods/kit/icons/terminal.svg"]);
  });

  test("a program with a picture shows it in its own colors", () => {
    paneList[0] = { ...paneList[0], program: { ...claude, tint: false } };
    const glyph = ((header().render() as Node).kids[0] as Node).kids[0] as Node;
    expect(calls(glyph, "image")).toEqual(["icons/claude.svg"]);
    expect(calls(glyph, "text_color")).toEqual([]);
  });

  test("the folder leaves a header narrower than 320 px, at the person's zoom", () => {
    const view = header();
    expect(texts(resize(view, 319))).toEqual(["Fix login", "Working"]);
    expect(texts(resize(view, 400))).toEqual(["Fix login", "Working", "~/code/app"]);
    zoom = 2;
    expect(texts(resize(view, 600))).toEqual(["Fix login", "Working"]);
  });

  test("a pane that is gone draws an empty header", () => {
    shown = "p9";
    const root = header().render() as Node;
    expect(root.kids).toHaveLength(0);
    expect(root.texts).toHaveLength(0);
  });
});

describe("the buttons", () => {
  test("show only while the pointer is over the header", () => {
    const view = header();
    expect(() => byKey(view.render() as Node, "close-p1")).toThrow("no element close-p1");
    const root = hover(view);
    const keys = walk(root).map((n) => n.key).filter((key) => key?.endsWith("-p1"));
    expect(keys).toEqual(["split-right-p1", "split-down-p1", "zoom-p1", "close-p1"]);
  });

  test("each runs its command on its own pane and keeps the click from the header", () => {
    const root = hover(header());
    const expected: [string, string, unknown][] = [
      ["split-right-p1", "pane.split", { direction: "right", pane: "p1" }],
      ["split-down-p1", "pane.split", { direction: "down", pane: "p1" }],
      ["zoom-p1", "pane.zoom", { pane: "p1" }],
      ["close-p1", "pane.close", { pane: "p1" }],
    ];
    for (const [key, command, args] of expected) {
      runs = [];
      const button = byKey(root, key);
      const event = makeCx();
      click(button, event);
      expect(event.stopped).toBe(1);
      expect(runs).toEqual([[command, args]]);
      const press = makeCx();
      button.handlers["down:left"]?.[0]?.({}, press);
      expect(press.stopped).toBe(1);
    }
  });

  test("are ghost buttons with their icons and tooltips", () => {
    const root = hover(header());
    const icons = ["split-right-p1", "split-down-p1", "zoom-p1", "close-p1"].map((key) => svgs(byKey(root, key))[0]);
    expect(icons).toEqual(["mods/kit/icons/columns-2.svg", "mods/kit/icons/rows-2.svg", "mods/kit/icons/maximize-2.svg", "mods/kit/icons/x.svg"]);
    const tooltips = ["split-right-p1", "split-down-p1", "zoom-p1", "close-p1"].map((key) => calls(byKey(root, key), "tooltip")[0]);
    expect(tooltips).toEqual(["Split right", "Split down", "Zoom", "Close pane"]);
    expect(calls(byKey(root, "close-p1"), "border_1")).toHaveLength(0);
  });

  test("a pane alone in its tab has no zoom button", () => {
    paneList = [paneList[0] as Pane];
    const root = hover(header());
    expect(() => byKey(root, "zoom-p1")).toThrow("no element zoom-p1");
    expect(byKey(root, "close-p1")).toBeDefined();
  });

  test("a zoomed pane offers to undo the zoom", () => {
    paneList = [{ ...(paneList[0] as Pane), zoomed: true }];
    const zoomButton = byKey(hover(header()), "zoom-p1");
    expect(calls(zoomButton, "tooltip")).toEqual(["Unzoom"]);
    expect(svgs(zoomButton)).toEqual(["mods/kit/icons/minimize-2.svg"]);
  });

  test("leaving the header hides them again", () => {
    const view = header();
    const root = hover(view);
    root.handlers.hover?.[0]?.(false, makeCx());
    expect(() => byKey(view.render() as Node, "close-p1")).toThrow("no element close-p1");
  });
});

test("a click on the header focuses its pane", () => {
  const root = header().render() as Node;
  click(root, makeCx());
  expect(runs).toEqual([["pane.focus", { pane: "p1" }]]);
});
