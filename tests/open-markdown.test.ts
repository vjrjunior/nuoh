import { beforeEach, describe, expect, test } from "bun:test";
import { herdr } from "./app-mocks";

const { openMarkdown, viewerIn } = await import("../lib/open-markdown.js");

type Pane = { pane: string; tab: string; mod?: string; zoomed?: boolean };

let list: Pane[];
let tab: string | null;
let ran: [string, unknown][];
let shared: Record<string, any>;

beforeEach(() => {
  list = [
    { pane: "p1", tab: "t1" },
    { pane: "p2", tab: "t2" },
  ];
  tab = "t1";
  ran = [];
  shared = {};
  Object.assign(herdr, {
    panes: () => list,
    focused: () => (tab ? { tab, pane: "p1" } : null),
    run: (name: string, args?: unknown) => ran.push([name, args]),
    setShared: (key: string, value: unknown) => {
      shared[key] = value;
    },
  });
});

describe("opening a Markdown file", () => {
  test("without a viewer in the tab it splits the given pane to the right", () => {
    expect(openMarkdown("/w/a.md", { pane: "p1" })).toBe("split");
    expect(ran).toEqual([["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: "/w/a.md" } }]]);
  });

  test("without a pane it splits the focused one", () => {
    openMarkdown("/w/a.md");
    expect(ran).toEqual([["pane.split", { direction: "right", mod: "markdown", props: { file: "/w/a.md" } }]]);
  });

  test("a viewer already in the shown tab takes the file", () => {
    list.push({ pane: "p3", tab: "t1", mod: "markdown" });
    expect(openMarkdown("/w/b.md", { pane: "p1" })).toBe("shown");
    expect(ran).toEqual([["markdown.show", undefined]]);
    expect(shared["markdown.request"]).toMatchObject({ file: "/w/b.md", tab: "t1" });
  });

  test("each request is told apart from the one before", () => {
    list.push({ pane: "p3", tab: "t1", mod: "markdown" });
    openMarkdown("/w/b.md");
    const first = shared["markdown.request"].at;
    openMarkdown("/w/b.md");
    expect(shared["markdown.request"].at).not.toBe(first);
  });

  test("a viewer in another tab is left alone", () => {
    list.push({ pane: "p3", tab: "t2", mod: "markdown" });
    expect(openMarkdown("/w/b.md", { pane: "p1" })).toBe("split");
  });

  test("a viewer hidden behind a zoomed pane is left alone", () => {
    list[0].zoomed = true;
    list.push({ pane: "p3", tab: "t1", mod: "markdown" });
    expect(viewerIn("t1", list)).toBeNull();
    list[0].zoomed = false;
    list[2].zoomed = true;
    expect(viewerIn("t1", list)?.pane).toBe("p3");
  });
});
