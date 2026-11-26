import { describe, expect, test } from "bun:test";
import { badgeOf, findNode, focusOf, followFocus, hint, keyFor, keyLabel, shownView, viewsOf } from "../mods/rail/logic.js";

const layoutWith = (views: Record<string, unknown>) => ({ id: "root", type: "row", children: [{ id: "rail", type: "block" }, { id: "views", type: "stack", ...views }] });

describe("views", () => {
  test("come from the props in order, with a label and an icon", () => {
    expect(
      viewsOf({
        views: [
          { id: "workspace", label: "Workspace", icon: "terminal", key: "ctrl-cmd-1" },
          { id: "board", label: "Board", icon: "square-kanban", key: "ctrl-cmd-2" },
        ],
      }),
    ).toEqual([
      { id: "workspace", label: "Workspace", icon: "terminal", key: "ctrl-cmd-1" },
      { id: "board", label: "Board", icon: "square-kanban", key: "ctrl-cmd-2" },
    ]);
  });

  test("a view without a label or an icon gets its id and a plain icon, and one without an id is left out", () => {
    expect(viewsOf({ views: [{ id: "brain" }, { label: "nothing" }, null] })).toEqual([{ id: "brain", label: "brain", icon: "layers", key: null }]);
  });

  test("no props means no views", () => {
    expect(viewsOf(null)).toEqual([]);
    expect(viewsOf({ views: "workspace" })).toEqual([]);
  });
});

describe("the shown view", () => {
  const views = viewsOf({ views: [{ id: "workspace" }, { id: "board" }] });

  test("is the views stack's active child", () => {
    expect(shownView(layoutWith({ active: "board", children: [{ id: "workspace" }, { id: "board" }] }), views)).toBe("board");
  });

  test("is the stack's first child when none is active", () => {
    expect(shownView(layoutWith({ children: [{ id: "workspace" }, { id: "board" }] }), views)).toBe("workspace");
  });

  test("is the first view when the layout has no views stack", () => {
    expect(shownView({ id: "root", children: [] }, views)).toBe("workspace");
    expect(shownView(null, [])).toBeNull();
  });

  test("findNode reaches a node at any depth", () => {
    expect(findNode(layoutWith({ children: [{ id: "workspace", children: [{ id: "sidebar" }] }] }), "sidebar")).toEqual({ id: "sidebar" });
    expect(findNode(layoutWith({}), "missing")).toBeNull();
  });
});

describe("the Workspace badge", () => {
  const agents = (...statuses: string[]) => statuses.map((status) => ({ status }));

  test("shows the most urgent agent: needs you, then done, then working", () => {
    expect(badgeOf(agents("working", "done", "blocked", "idle"))).toBe("blocked");
    expect(badgeOf(agents("working", "done", "idle"))).toBe("done");
    expect(badgeOf(agents("idle", "working"))).toBe("working");
  });

  test("shows nothing when every agent is idle, or there are none", () => {
    expect(badgeOf(agents("idle", "idle"))).toBeNull();
    expect(badgeOf([])).toBeNull();
    expect(badgeOf(null)).toBeNull();
  });
});

describe("back to the Workspace", () => {
  const at = (space: string, tab: string, pane: string) => ({ space, tab, pane });
  const panes = ["p1", "p2", "p3"];

  test("the first focus it sees is only remembered", () => {
    expect(followFocus(null, at("s1", "t1", "p1"), { shown: "board", paneIds: panes })).toEqual({ last: at("s1", "t1", "p1"), back: false });
  });

  test("a tab or a pane focused from outside while another view shows brings the Workspace back", () => {
    expect(followFocus(at("s1", "t1", "p1"), at("s1", "t2", "p2"), { shown: "board", paneIds: panes })).toEqual({ last: at("s1", "t2", "p2"), back: true });
    expect(followFocus(at("s1", "t1", "p1"), at("s1", "t1", "p2"), { shown: "board", paneIds: panes }).back).toBe(true);
    expect(followFocus(at("s1", "t1", "p1"), at("s2", "t3", "p3"), { shown: "board", paneIds: panes }).back).toBe(true);
  });

  test("the same focus changes nothing", () => {
    expect(followFocus(at("s1", "t1", "p1"), at("s1", "t1", "p1"), { shown: "board", paneIds: panes })).toEqual({ last: at("s1", "t1", "p1"), back: false });
  });

  test("a focus change while the Workspace shows only moves the memory", () => {
    expect(followFocus(at("s1", "t1", "p1"), at("s1", "t2", "p2"), { shown: "workspace", paneIds: panes })).toEqual({ last: at("s1", "t2", "p2"), back: false });
  });

  test("focus that moves because the focused pane closed stays put", () => {
    expect(followFocus(at("s1", "t1", "gone"), at("s1", "t1", "p2"), { shown: "board", paneIds: panes })).toEqual({ last: at("s1", "t1", "p2"), back: false });
  });

  test("no pane in focus is not a change", () => {
    expect(followFocus(at("s1", "t1", "p1"), null, { shown: "board", paneIds: panes })).toEqual({ last: at("s1", "t1", "p1"), back: false });
  });

  test("focusOf keeps the space, the tab and the pane, and nothing without a pane", () => {
    expect(focusOf({ space: "s1", tab: "t1", pane: "p1", terminal: "t9", agent: "t9", shown: "p1", cwd: "/x" })).toEqual(at("s1", "t1", "p1"));
    expect(focusOf({ space: "s1", tab: "t1", pane: null })).toBeNull();
    expect(focusOf(null)).toBeNull();
  });
});

describe("keys", () => {
  test("macOS shows the modifier symbols", () => {
    expect(keyLabel("ctrl-cmd-1", "macos")).toBe("⌃⌘1");
    expect(keyLabel("cmd-shift-p", "macos")).toBe("⌘⇧P");
    expect(keyLabel("cmd-,", "macos")).toBe("⌘,");
    expect(keyLabel("cmd--", "macos")).toBe("⌘-");
  });

  test("other systems spell the modifiers out", () => {
    expect(keyLabel("ctrl-cmd-2", "linux")).toBe("Ctrl+Cmd+2");
    expect(keyLabel(null, "linux")).toBeNull();
  });

  test("the hint is the label and its key, or the label alone", () => {
    expect(hint("Workspace", "ctrl-cmd-1", "macos")).toBe("Workspace  ⌃⌘1");
    expect(hint("Search", null, "macos")).toBe("Search");
  });

  test("keyFor takes the first action that has a key", () => {
    const bindings = [
      { section: "global", keys: "cmd-shift-p", action: "app.palette" },
      { section: "layout:nuoh", keys: "cmd-k", action: "mod.open:nuoh-palette" },
    ];
    expect(keyFor(bindings, ["mod.open:nuoh-palette", "app.palette"])).toBe("cmd-k");
    expect(keyFor(bindings, ["mod.open:other", "app.palette"])).toBe("cmd-shift-p");
    expect(keyFor(bindings, ["app.help"])).toBeNull();
  });
});
