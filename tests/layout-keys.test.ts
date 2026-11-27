import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveSection, keysText, readKeys, withoutSections, withSections } from "../scripts/layout-keys";
import { removeTempDirs, tempDir } from "./helpers";

afterEach(removeTempDirs);

describe("deriveSection", () => {
  test("derives every global key bound to a replaced action", () => {
    expect(deriveSection({ "cmd-/": "app.help", "cmd-shift-/": "app.help", "cmd-t": "tab.new" }, { "app.help": "mod.open:nuoh-help" })).toEqual({
      "cmd-/": "mod.open:nuoh-help",
      "cmd-shift-/": "mod.open:nuoh-help",
    });
  });

  test("follows a custom shortcut", () => {
    expect(deriveSection({ "ctrl-k": "app.palette" }, { "app.palette": "mod.open:nuoh-palette" })).toEqual({ "ctrl-k": "mod.open:nuoh-palette" });
  });

  test("a command bound in global is left to global", () => {
    expect(deriveSection({ "ctrl-1": { command: "layout.select", args: { stack: "views", child: "a" } } }, { "app.help": "mod.open:nuoh-help" })).toEqual({});
  });

  test("an action with no key adds nothing", () => {
    expect(deriveSection({ "cmd-t": "tab.new" }, { "app.help": "mod.open:nuoh-help" })).toEqual({});
  });
});

describe("sections", () => {
  test("keeps other sections and keys", () => {
    const table = { global: { "cmd-t": "tab.new" }, "layout:other": { a: "b" } };
    expect(withSections(table, { "layout:retired": { c: "d" } })).toEqual({ ...table, "layout:retired": { c: "d" } });
  });

  test("replaces a section it wrote before", () => {
    expect(withSections({ "layout:retired": { old: "x" } }, { "layout:retired": { c: "d" } })).toEqual({ "layout:retired": { c: "d" } });
  });

  test("removes only the named sections", () => {
    expect(withoutSections({ global: {}, "layout:retired": {} }, ["layout:retired"])).toEqual({ global: {} });
  });
});

describe("the file", () => {
  test("keeps escape sequences through a rewrite", () => {
    expect(keysText({ terminal: { "alt-left": "send:\u001bb" } })).toContain("\\u001b");
  });

  test("reads what it wrote", () => {
    const path = join(tempDir(), "keys.json");
    const table = { terminal: { "alt-left": "send:\u001bb" } };
    writeFileSync(path, keysText(table));
    expect(readKeys(path)).toEqual(table);
  });

  test("treats a missing file as empty", () => {
    expect(readKeys(join(tempDir(), "keys.json"))).toEqual({});
  });

  test("throws on invalid JSON", () => {
    const path = join(tempDir(), "keys.json");
    writeFileSync(path, "{");
    expect(() => readKeys(path)).toThrow(/keys\.json/);
  });
});
