import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./helpers";

const { folderLabel, isNarrow, paneTitle, showsZoom } = await import("../mods/pane-header/logic.js");

const claude = { name: "Claude Code", key: "claude" };

describe("paneTitle", () => {
  test("is the pane's name when someone named it", () => {
    expect(paneTitle({ name: "reviewer", title: "✳ Fix login", terminal: "t1", program: claude })).toBe("reviewer");
  });

  test("is the terminal's title without the glyph an agent puts before it", () => {
    expect(paneTitle({ name: null, title: "✳ Fix login", terminal: "t1", program: claude })).toBe("Fix login");
  });

  test("is the program's name when the title is the terminal's address or empty", () => {
    expect(paneTitle({ name: null, title: "t1", terminal: "t1", program: claude })).toBe("Claude Code");
    expect(paneTitle({ name: null, title: "⠋ ", terminal: "t1", program: claude })).toBe("Claude Code");
  });

  test("is shell when nothing else names it", () => {
    expect(paneTitle({ name: null, title: "", terminal: "t1", program: { name: "" } })).toBe("shell");
    expect(paneTitle({ name: null, title: "", terminal: null })).toBe("shell");
  });
});

describe("folderLabel", () => {
  test("writes the home folder as ~", () => {
    expect(folderLabel("/Users/me", "/Users/me")).toBe("~");
    expect(folderLabel("/Users/me/code/app", "/Users/me")).toBe("~/code/app");
  });

  test("keeps a folder outside home, and one whose name only starts like home", () => {
    expect(folderLabel("/opt/app", "/Users/me")).toBe("/opt/app");
    expect(folderLabel("/Users/meg/app", "/Users/me")).toBe("/Users/meg/app");
  });

  test("is empty without a folder", () => {
    expect(folderLabel(null, "/Users/me")).toBe("");
    expect(folderLabel("/opt/app", null)).toBe("/opt/app");
  });
});

describe("showsZoom", () => {
  const one = { pane: "p1", tab: "a", zoomed: false };
  const two = { pane: "p2", tab: "a", zoomed: false };
  const elsewhere = { pane: "p3", tab: "b", zoomed: false };

  test("shows when the pane's tab has another pane", () => {
    expect(showsZoom(one, [one, two, elsewhere])).toBe(true);
  });

  test("hides when the pane is alone in its tab", () => {
    expect(showsZoom(one, [one, elsewhere])).toBe(false);
  });

  test("shows on a zoomed pane, to undo the zoom", () => {
    const zoomed = { ...one, zoomed: true };
    expect(showsZoom(zoomed, [zoomed])).toBe(true);
  });
});

describe("isNarrow", () => {
  test("is narrow under 320 px at the person's zoom", () => {
    expect(isNarrow(319, 1)).toBe(true);
    expect(isNarrow(320, 1)).toBe(false);
    expect(isNarrow(600, 2)).toBe(true);
    expect(isNarrow(300, undefined)).toBe(true);
  });

  test("is not narrow before the first layout", () => {
    expect(isNarrow(null, 1)).toBe(false);
  });
});

test("logic.js imports nothing from the app", () => {
  const imports = [...readFileSync(join(repo, "mods/pane-header/logic.js"), "utf8").matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  expect(imports).toEqual(["../../lib/agent-title.js"]);
});
