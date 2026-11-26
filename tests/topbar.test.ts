import { describe, expect, test } from "bun:test";
import { avatarLook, paint, spaceColor } from "../lib/space-colors.js";
import { branchOf, foldSidebar, isNarrow, machineOf, roleOf, shownSpace } from "../mods/topbar/logic.js";

const t = new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }) as Record<string, string>;
const withSidebar = (px?: number) => ({ id: "root", children: [{ id: "views", children: [{ id: "sidebar", size: px == null ? undefined : { px } }] }] });
const space = (over = {}) => ({ id: "s1", name: "nuoh", active: true, machine: null, branch: "main", tabs: [{ id: "t1" }, { id: "t2" }], ...over });

describe("roles", () => {
  test("title and machine draw, anything else is the empty band under the traffic lights", () => {
    expect(roleOf({ role: "title" })).toBe("title");
    expect(roleOf({ role: "machine" })).toBe("machine");
    expect(roleOf({ role: "lights" })).toBe("lights");
    expect(roleOf({ role: "other" })).toBe("lights");
    expect(roleOf(null)).toBe("lights");
  });
});

describe("folding the sidebar", () => {
  test("goes by the sidebar's width: under 160 px it is folded", () => {
    expect(isNarrow(withSidebar(44))).toBe(true);
    expect(isNarrow(withSidebar(159))).toBe(true);
    expect(isNarrow(withSidebar(160))).toBe(false);
    expect(isNarrow(withSidebar())).toBe(false);
  });

  test("an open sidebar folds to 44 px and keeps its width to come back to", () => {
    expect(foldSidebar(withSidebar(300), 268)).toEqual({ save: 300, collapsed: true, px: 44 });
  });

  test("a folded sidebar opens to the width it had, or 268 px", () => {
    expect(foldSidebar(withSidebar(44), 300)).toEqual({ save: null, collapsed: false, px: 300 });
    expect(foldSidebar(withSidebar(44), undefined)).toEqual({ save: null, collapsed: false, px: 268 });
  });
});

describe("the title", () => {
  test("follows the shown space", () => {
    expect(shownSpace([space({ id: "a", active: false }), space({ id: "b" })])?.id).toBe("b");
    expect(shownSpace([])).toBeNull();
    expect(shownSpace(undefined)).toBeNull();
  });

  test("the branch is the focused pane's when it is in the shown space", () => {
    const panes = [{ pane: "p1", tab: "t2", branch: "feat/x" }];
    expect(branchOf(space(), { pane: "p1" }, panes)).toBe("feat/x");
  });

  test("else the space's own branch", () => {
    expect(branchOf(space(), { pane: "p9" }, [{ pane: "p9", tab: "other", branch: "feat/y" }])).toBe("main");
    expect(branchOf(space(), { pane: "p1" }, [{ pane: "p1", tab: "t1", branch: null }])).toBe("main");
    expect(branchOf(space(), null, [])).toBe("main");
  });

  test("no branch outside git, and none without a space", () => {
    expect(branchOf(space({ branch: null }), null, [])).toBeNull();
    expect(branchOf(null, { pane: "p1" }, [{ pane: "p1", tab: "t1", branch: "main" }])).toBeNull();
  });
});

describe("the machine", () => {
  test("this computer shows a monitor", () => {
    expect(machineOf(space())).toEqual({ label: "This computer", icon: "monitor" });
    expect(machineOf(null)).toEqual({ label: "This computer", icon: "monitor" });
  });

  test("another machine shows its name and a server", () => {
    expect(machineOf(space({ machine: "vps" }))).toEqual({ label: "vps", icon: "server" });
  });
});

describe("space colors", () => {
  test("the six avatar colors are fixed, and other names come from the theme", () => {
    expect(paint("ansi6", t)).toBe("#22a99a");
    expect(paint("ansi1", t)).toBe("#d9649a");
    expect(paint("#123456", t)).toBe("#123456");
    expect(paint("accent", t)).toBe("t.accent");
  });

  test("a space is painted with the color the Spaces tree gave it, else the first one", () => {
    expect(spaceColor({ id: "s1" }, { s1: "ansi4" }, t)).toBe("#5b8def");
    expect(spaceColor({ id: "s2" }, { s1: "ansi4" }, t)).toBe("#22a99a");
    expect(spaceColor({ id: "s2" }, undefined, t)).toBe("#22a99a");
    expect(spaceColor(null, {}, t)).toBe("t.dim");
  });

  test("an avatar's letter is white on the space's color", () => {
    expect(avatarLook({ id: "s1" }, { s1: "ansi3" }, t)).toEqual({ fill: "#e3814f", letter: "#ffffff" });
  });
});
