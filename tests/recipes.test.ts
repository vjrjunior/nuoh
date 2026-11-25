import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEFT_ROUNDED, variantWith } from "../recipes/variants";
import { generateVariant } from "../scripts/generate-layout";
import { modsIn, removeTempDirs, repo, tempDir } from "./helpers";
import { makeHerdrHome, SHIPPED_MODS } from "./herdr-home";

afterEach(removeTempDirs);

function generate(square: boolean, overrides: Record<string, string> = {}) {
  const home = tempDir();
  makeHerdrHome(home, overrides);
  return generateVariant(variantWith([], square), { home, version: "0.1.10", repo, bun: "/bin/bun" });
}

const generateRound = (overrides?: Record<string, string>) => generate(false, overrides);
const generateSquare = (overrides?: Record<string, string>) => generate(true, overrides);
const allJs = (generated: ReturnType<typeof generate>) =>
  Object.values(generated.mods)
    .flatMap((files) => Object.entries(files).filter(([name]) => name.endsWith(".js")).map(([, text]) => text))
    .join("\n");
const meta = (generated: ReturnType<typeof generate>, mod: string) => JSON.parse(generated.mods[`vjr-${mod}`]?.["mod.json"] ?? "{}");

function findNode(node: unknown, id: string): Record<string, any> | null {
  if (node === null || typeof node !== "object") return null;
  const fields = node as Record<string, any>;
  if (fields.id === id) return fields;
  for (const child of fields.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

const graphChild = (generated: ReturnType<typeof generate>) => findNode(JSON.parse(generated.layoutText), "panel-body")?.children.at(-1);

describe("looks", () => {
  test("both looks are the same layout with the same mod names", () => {
    expect(generateRound().layout).toBe("vjr-desk");
    expect(generateSquare().layout).toBe("vjr-desk");
    for (const mod of Object.keys(generateRound().mods)) expect(Object.keys(generateSquare().mods)).toContain(mod);
  });

  test("with round corners it copies twelve mods", () => {
    expect(Object.keys(generateRound().mods).sort()).toEqual(["vjr-comeback", "vjr-files", "vjr-kit", "vjr-markdown", "vjr-menu", "vjr-move-tab", "vjr-palette", "vjr-settings", "vjr-spaces-tree", "vjr-tabs", "vjr-workspace-chrome", "vjr-workspace-status"]);
  });

  test("with square corners it copies twenty-one mods", () => {
    expect(Object.keys(generateSquare().mods)).toHaveLength(21);
  });

  test("round corners keep the shipped mods elsewhere", () => {
    const mods = modsIn(JSON.parse(generateRound().layoutText));
    expect(mods).toContain("vjr-spaces-tree");
    expect(mods).not.toContain("spaces");
    expect(mods).toContain("agents");
    expect(mods).toContain("vjr-tabs");
  });

  test("the prompt, confirm, toast and peek stay on the shipped mods", () => {
    expect(LEFT_ROUNDED).toEqual(["prompt", "confirm", "toast", "peek", "win98", "terminals-bar", "terminals-pane"]);
  });
});

describe("list-vjr-theme", () => {
  test("the palette shows keys from its own layout section", () => {
    expect(generateRound().mods["vjr-palette"]?.["main.js"]).toContain('if (section !== "global" && section !== "layout:vjr-desk") continue;');
    expect(generateSquare().mods["vjr-palette"]?.["main.js"]).toContain('if (section !== "global" && section !== "layout:vjr-desk") continue;');
  });

  test("the status bar opens the copied palette", () => {
    expect(generateRound().mods["vjr-workspace-status"]?.["main.js"]).toContain('run("mod.open", { name: "vjr-palette" })');
  });

  test("the copied palette opens where the original does", () => {
    expect(JSON.parse(generateRound().mods["vjr-palette"]?.["mod.json"] ?? "{}").overlay).toEqual({
      kind: "popup",
      at: "top",
      offset: 60,
      width: 620,
      height: 410,
    });
  });

  test("the palette key opens the copy", () => {
    expect(generateRound().replacements["app.palette"]).toBe("mod.open:vjr-palette");
  });

  test("a palette that changed fails the recipe", () => {
    expect(() => generateRound({ "frame/palette/main.js": "changed" })).toThrow(/recipe list-vjr-theme:/);
  });
});

describe("git-graph-panel", () => {
  test("both looks show a Graph button", () => {
    const tabs = "vjr-tabs";
    for (const generated of [generateRound(), generateSquare()]) {
      expect(generated.mods[tabs]?.["main.js"]).toContain('panelButton("graph", "Graph", "mods/git-graph/icons/graph.svg")');
      expect(generated.mods[tabs]?.["main.js"]).toContain('[...(shared("workspace.panels") ?? ["files", "changes"]), "graph"]');
    }
  });

  test("the Graph button comes right after Changes", () => {
    expect(generateRound().mods["vjr-tabs"]?.["main.js"]).toContain(
      'panelButton("changes", "Changes", "mods/changes/changes.svg")))\n      .child(panelButton("graph"',
    );
  });

  test("with round corners the panel opens the original git-graph", () => {
    expect(graphChild(generateRound())).toEqual({ id: "graph", type: "block", content: { mod: "git-graph" } });
  });

  test("with square corners the panel opens the square git-graph", () => {
    expect(graphChild(generateSquare()).content.mod).toBe("vjr-git-graph");
  });

  test("a layout without panel-body fails the recipe", () => {
    expect(() => generateRound({ "layouts/main.json": '{ "id": "root", "children": [] }' })).toThrow(/recipe git-graph-panel:/);
  });

  test("a tab bar that changed fails the recipe", () => {
    expect(() => generateRound({ "mods/tabs/main.js": "changed" })).toThrow(/recipe git-graph-panel:/);
  });
});

describe("kit", () => {
  test("both looks install the kit", () => {
    expect(Object.keys(generateRound().mods)).toContain("vjr-kit");
    expect(Object.keys(generateSquare().mods)).toContain("vjr-kit");
  });

  test("with square corners the kit has only square corners", () => {
    const mods = generateSquare().mods;
    const files = [mods["vjr-kit"]?.["main.js"] ?? "", ...Object.entries(mods).filter(([name]) => name.startsWith("vjr-")).map(([, f]) => f["kit.js"] ?? "")];
    const rounded = files.flatMap((text) => text.match(/\.rounded(_[a-z]+)?\([^()]*\)/g) ?? []);
    expect(rounded.length).toBeGreaterThan(0);
    for (const call of rounded) expect(call).toMatch(/\.rounded(_[a-z]+)?\(0\)/);
  });
});

describe("look", () => {
  const settingsOf = (generated: ReturnType<typeof generate>) => generated.mods["vjr-settings"]?.["main.js"] ?? "";
  const overlayOf = (generated: ReturnType<typeof generate>) => JSON.parse(generated.mods["vjr-settings"]?.["mod.json"] ?? "{}").overlay;

  test("Settings shows Square corners under the layout picker, only in this layout", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      const settings = settingsOf(generated);
      expect(settings).toContain('.child(this.layoutPicker(t, cx))\n      .when(shared("layout") === "vjr-desk", (el) => el.child(this.row(t, "Square corners",');
      expect(settings).toContain('this.toggle(t, "st-square", shared("vjr.square") === true, () => setShared("vjr.square", !(shared("vjr.square") === true)))');
      expect(settings).toContain(" shared, setShared, appHome,");
    }
  });

  test("the copy opens as Herdr's dialog with round corners, and draws its own frame with square ones", () => {
    expect(overlayOf(generateRound())).toEqual({ kind: "dialog", width: 880, height: 620 });
    expect(overlayOf(generateSquare())).toEqual({ kind: "dialog", width: 880, height: 620, frame: "none" });
    expect(settingsOf(generateRound())).toContain('.id("settings").rounded(8)');
  });

  test("the sidebar, the palette and the key open the copy in both looks", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      expect(generated.mods["vjr-workspace-chrome"]?.["main.js"]).toContain('run("mod.open", { name: "vjr-settings" })');
      expect(generated.mods["vjr-palette"]?.["main.js"]).toContain('["mod.open", { name: "vjr-settings" }, "App", "Settings"');
      expect(generated.replacements["app.settings"]).toBe("mod.open:vjr-settings");
    }
    expect(JSON.parse(generateRound().layoutText).children[0].children[0].content.mod).toBe("vjr-workspace-chrome");
  });

  test("the layout tells vjr-sync which look it was built with", () => {
    const sync = (generated: ReturnType<typeof generate>) => JSON.parse(generated.layoutText).floating.find((block: { id: string }) => block.id === "vjr-sync").content.props;
    expect(sync(generateRound()).square).toBe(false);
    expect(sync(generateSquare()).square).toBe(true);
  });

  test("a Settings that changed fails the recipe", () => {
    expect(() => generateRound({ "frame/settings/main.js": "changed" })).toThrow(/recipe look:/);
  });
});

describe("square", () => {
  test("leaves no rounded corner", () => {
    expect(allJs(generateSquare())).not.toMatch(/\.rounded(_[a-z]+)?\((?!0\))/);
  });

  test("turns rounded_full into rounded(0)", () => {
    expect(allJs(generateSquare())).not.toContain("rounded_full");
  });

  test("keeps the side of a one-sided corner", () => {
    expect(generateSquare().mods["vjr-agents"]?.["main.js"]).toContain(".rounded_bl(0)");
  });

  test("swaps the round status glyphs", () => {
    const text = allJs(generateSquare());
    expect(text).not.toMatch(/[●○]/);
    expect(text).toContain("■");
    expect(text).toContain("□");
  });

  test("drops the frame of popups with a copy", () => {
    expect(generateSquare().mods["vjr-tabs"]?.["main.js"]).toContain('mod: "vjr-menu", kind: "popup", frame: "none"');
  });

  test("keeps the frame of the shipped prompt", () => {
    expect(generateSquare().mods["vjr-palette"]?.["main.js"]).toContain('openOverlay({ mod: "prompt", kind: "dialog", width: 380');
  });

  test("borders every popup root", () => {
    const square = generateSquare();
    for (const mod of ["menu", "new-menu", "picker", "machine-add", "help", "palette", "agents"]) {
      expect(square.mods[`vjr-${mod}`]?.["main.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
    }
    expect(square.mods["vjr-git-graph"]?.["menu.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
    expect(square.mods["vjr-git-graph"]?.["dialog.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
    expect(square.mods["vjr-git-graph"]?.["settings.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
    expect(square.mods["vjr-settings"]?.["main.js"]).toContain('.id("settings").bg(t.popover).border_1().border_color(t.border)');
  });

  test("the frameless settings paints its own background, which Herdr's frame drew", () => {
    const settings = generateSquare().mods["vjr-settings"]?.["main.js"] ?? "";
    expect(meta(generateSquare(), "settings").overlay.frame).toBe("none");
    expect(settings).toMatch(/\.id\("settings"\)\.bg\(t\.popover\)/);
  });

  test("git-graph never asks GitHub for a new release", () => {
    expect(readFileSync(join(repo, "mods/git-graph/update.js"), "utf8")).toContain("const CHECK = false;");
  });

  test("the square git-graph keeps its icons at the original path", () => {
    expect(generateSquare().mods["vjr-git-graph"]?.["menu.js"]).toContain("mods/git-graph/icons/");
  });

  test("the square git-graph opens its own menu and dialogs", () => {
    const square = generateSquare();
    expect(square.mods["vjr-git-graph"]?.["graph.js"]).toContain('mod: "vjr-git-graph", kind: "popup", frame: "none"');
    expect(square.mods["vjr-git-graph"]?.["act.js"]).toContain('mod: "vjr-git-graph", kind: "dialog", frame: "none"');
  });

  test("sizes the copied dialogs", () => {
    const square = generateSquare();
    expect(meta(square, "settings").overlay).toEqual({ kind: "dialog", width: 880, height: 620, frame: "none" });
    expect(meta(square, "help").overlay).toEqual({ kind: "dialog", width: 520, height: 0.7, frame: "none" });
    expect(meta(square, "palette").overlay).toEqual({ kind: "popup", at: "top", offset: 60, width: 620, height: 410, frame: "none" });
  });

  test("keeps what the picker, machine-add and menu overlays already had", () => {
    const square = generateSquare();
    expect(meta(square, "picker").overlay).toEqual({ kind: "popup", at: "top", offset: 40, width: 640, height: 0.8, frame: "none" });
    expect(meta(square, "machine-add").overlay).toEqual({ kind: "dialog", width: 560, frame: "none" });
    expect(meta(square, "menu").overlay).toEqual({ frame: "none" });
  });

  test("hides app.help from the generic commands", () => {
    expect(generateSquare().mods["vjr-palette"]?.["main.js"]).toContain('"app.palette", "app.help", "app.hide",');
  });

  test("the palette opens the copied settings, help and picker", () => {
    const palette = generateSquare().mods["vjr-palette"]?.["main.js"];
    expect(palette).toContain('["mod.open", { name: "vjr-settings" }, "App", "Settings"');
    expect(palette).toContain('["mod.open", { name: "vjr-help" }, "App", "Keys"');
    expect(palette).toContain('["mod.open", { name: "vjr-picker" }, "Tab"');
  });

  test("the context menu opens the copied help", () => {
    expect(generateSquare().mods["vjr-menu"]?.["main.js"]).toContain('if (it[1] === "app.help") run("mod.open", { name: "vjr-help" });');
  });

  test("a context menu that changed still generates", () => {
    const menu = [
      'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";',
      'export default class Mod { render() {',
      '        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),',
      '        ["Close", "tab.close", { id: tg.id }],',
      '    const icon = command === "worktree" ? "git-branch" : "terminal";',
      'function menuIcon(command, args) {',
      'function shortcut(name, args) {',
      '        ["Close", "space.close", { id: tg.id }],',
      "    closeOverlay(props()?.overlay);",
      '  const name = command.endsWith(".close") ? "x" : "terminal";',
      '    if (it[1] === "worktree") tree();',
      '    return v_flex().bg(t.popover).rounded(7); } }',
    ].join("\n");
    expect(() => generateSquare({ "mods/menu/main.js": menu })).not.toThrow();
  });

  test("opens the copied settings from the sidebar", () => {
    expect(generateSquare().mods["vjr-workspace-chrome"]?.["main.js"]).toContain('run("mod.open", { name: "vjr-settings" })');
  });

  test("settings opens the copied Add machine", () => {
    expect(generateSquare().mods["vjr-settings"]?.["main.js"]).toContain('{ name: "vjr-machine-add" }');
  });

  test("zeroes the pane radius and sets the terminal menu", () => {
    const layout = JSON.parse(generateSquare().layoutText);
    expect(findNode(layout, "main")?.content.pane.radius).toBe(0);
    expect(layout.terminal_menu).toBe("vjr-menu");
  });

  test("keeps the pane radius with round corners", () => {
    expect(findNode(JSON.parse(generateRound().layoutText), "main")?.content.pane.radius).toBe(10);
  });

  test("replaces the four key actions", () => {
    expect(generateSquare().replacements).toEqual({
      "app.palette": "mod.open:vjr-palette",
      "app.settings": "mod.open:vjr-settings",
      "app.help": "mod.open:vjr-help",
      "mod.open:picker": "mod.open:vjr-picker",
    });
  });

  test("a home with no rounded corners fails the recipe, whatever git-graph has", () => {
    const home = tempDir();
    makeHerdrHome(home);
    for (const folder of [...SHIPPED_MODS.map((mod) => `mods/${mod}`), "frame/palette", "frame/settings"]) {
      for (const file of readdirSync(join(home, folder)).filter((name) => name.endsWith(".js"))) {
        const path = join(home, folder, file);
        writeFileSync(path, readFileSync(path, "utf8").replace(/\.rounded(_[a-z]+)?\([^()]*\)/g, ""));
      }
    }
    expect(() => generateVariant(variantWith([], true), { home, version: "0.1.10", repo, bun: "/bin/bun" })).toThrow(/recipe square:/);
  });

  test("a home without status glyphs still generates", () => {
    expect(() =>
      generateSquare({
        "mods/picker/main.js": 'export default class Mod { render() { return v_flex().bg(t.popover).rounded(9).child("·"); } }',
      }),
    ).not.toThrow();
  });
});

describe("spaces-tree", () => {
  test("both looks show the tree in the spaces block", () => {
    expect(findNode(JSON.parse(generateRound().layoutText), "spaces")?.content.mod).toBe("vjr-spaces-tree");
    expect(findNode(JSON.parse(generateSquare().layoutText), "spaces")?.content.mod).toBe("vjr-spaces-tree");
  });

  test("the copy brings its pure logic along", () => {
    expect(generateRound().mods["vjr-spaces-tree"]?.["tree.js"]).toContain("export function buildTree");
  });

  test("no shipped spaces copy is left with square corners", () => {
    expect(generateSquare().mods["vjr-spaces"]).toBeUndefined();
  });

  test("the square copy has no rounded corner left", () => {
    const files = Object.entries(generateSquare().mods["vjr-spaces-tree"] ?? {}).filter(([name]) => name.endsWith(".js"));
    expect(files.map(([name]) => name)).toEqual(expect.arrayContaining(["main.js", "rows.js", "rail.js", "actions.js"]));
    for (const [, text] of files) expect(text).not.toMatch(/\.rounded(_[a-z]+)?\((?!0\))/);
  });

  test("the rounded copy keeps its corners", () => {
    expect(generateRound().mods["vjr-spaces-tree"]?.["rows.js"]).toMatch(/\.rounded\(8\)/);
  });

  test("both looks put Pin to top or Unpin, then Move to folder…, in the space menu, before Close", () => {
    const copy = "vjr-menu";
    for (const generated of [generateRound(), generateSquare()]) {
      const menu = generated.mods[copy]?.["main.js"] ?? "";
      expect(menu).toContain(
        '        ...(p.folder ? [p.folder.pinned ? ["Unpin", "spaces-unpin", p.folder] : ["Pin to top", "spaces-pin", p.folder], ["Move to folder…", "spaces-folder", p.folder]] : []),\n        ["Close", "space.close", { id: tg.id }],',
      );
      expect(menu).toContain(
        '  if (command === "spaces-pin") return "mods/workspace-chrome/pin.svg";\n  if (command === "spaces-unpin") return "mods/workspace-chrome/pin-off.svg";\n  if (command === "spaces-folder") return "mods/workspace-chrome/folder.svg";\n  const name = command.endsWith(".close")',
      );
    }
  });

  test("both looks make Pin to top and Unpin write the pins the tree worked out", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      const menu = generated.mods["vjr-menu"]?.["main.js"] ?? "";
      expect(menu).toContain('import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, setShared } from "herdr";');
      expect(menu).toContain('    closeOverlay(props()?.overlay);\n    if (it[1] === "spaces-pin" || it[1] === "spaces-unpin") return setShared("spaces.pinned", it[2].pins);\n');
    }
  });

  test("the menu opens the layout's own folders popup, frameless with square corners", () => {
    expect(generateRound().mods["vjr-menu"]?.["main.js"]).toContain(
      '    if (it[1] === "spaces-pin" || it[1] === "spaces-unpin") return setShared("spaces.pinned", it[2].pins);\n    if (it[1] === "spaces-folder") return openOverlay({ mod: "vjr-spaces-tree", kind: "popup", width: 240, height: it[2].height, props: { ...it[2], role: "folders" } });',
    );
    expect(generateSquare().mods["vjr-menu"]?.["main.js"]).toContain('openOverlay({ mod: "vjr-spaces-tree", kind: "popup", frame: "none", width: 240,');
  });

  test("the tree opens its own folder popups, frameless and bordered with square corners", () => {
    const round = generateRound().mods["vjr-spaces-tree"] ?? {};
    expect(round["actions.js"]).toContain('openOverlay({ mod: "vjr-spaces-tree", kind: "popup", width: FOLDER_MENU.width');
    expect(round["popups.js"]).toContain('openOverlay({ mod: "vjr-spaces-tree", kind: "dialog", width: NAME_DIALOG.width');
    const square = generateSquare().mods["vjr-spaces-tree"] ?? {};
    expect(square["actions.js"]).toContain('openOverlay({ mod: "vjr-spaces-tree", kind: "popup", frame: "none",');
    expect(square["popups.js"]).toContain('openOverlay({ mod: "vjr-spaces-tree", kind: "dialog", frame: "none",');
    expect(square["popups.js"]?.split(".bg(t.popover).border_1().border_color(t.border)")).toHaveLength(4);
    expect(square["popups.js"]).not.toMatch(/\.rounded(_[a-z]+)?\((?!0\))/);
  });

  test("a menu without the space case fails the recipe", () => {
    expect(() => generateRound({ "mods/menu/main.js": "export default class Mod { render() { return div(); } }" })).toThrow(/recipe spaces-tree/);
  });

  test("a menu whose imports changed fails the recipe", () => {
    const home = tempDir();
    makeHerdrHome(home);
    const menu = readFileSync(join(home, "mods/menu/main.js"), "utf8");
    const anchor = 'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";';
    expect(menu).toContain(anchor);
    expect(() => generateRound({ "mods/menu/main.js": menu.replace(anchor, "") })).toThrow(/recipe spaces-tree:/);
  });
});

describe("comeback", () => {
  test("both looks float the comeback copy", () => {
    const copy = "vjr-comeback";
    for (const generated of [generateRound(), generateSquare()]) {
      const floating = JSON.parse(generated.layoutText).floating;
      expect(floating).toContainEqual({ id: "comeback", content: { mod: copy }, edge: "left", align: "end" });
      expect(floating.at(-1).id).toBe("vjr-sync");
      expect(generated.mods[copy]?.["logic.js"]).toContain("export function planPass");
    }
  });
});

describe("markdown viewer", () => {
  test("both looks install the viewer without placing it", () => {
    const copy = "vjr-markdown";
    for (const generated of [generateRound(), generateSquare()]) {
      expect(Object.keys(generated.mods[copy] ?? {}).sort()).toEqual(["kit.js", "logic.js", "main.js", "mod.json", "open-markdown.js", "picker.js"]);
      expect(modsIn(JSON.parse(generated.layoutText))).not.toContain(copy);
    }
  });

  test("the square copy squares the viewer's buttons", () => {
    expect(generateRound().mods["vjr-markdown"]?.["kit.js"]).toContain(".rounded(RADIUS.control)");
    const squared = generateSquare().mods["vjr-markdown"]?.["kit.js"] ?? "";
    expect(squared).toContain(".rounded(0)");
    expect(squared).not.toContain(".rounded(RADIUS");
  });
});

describe("markdown picker", () => {
  test("both looks put Open Markdown… on a terminal's menu, before Close pane", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      expect(generated.mods["vjr-menu"]?.["main.js"]).toContain(
        '        ...(term ? [["Open Markdown…", "markdown-picker", { terminal: term.address, pane: tg.pane }]] : []),\n        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),',
      );
    }
  });

  test("both looks right-click a terminal into the layout's own menu", () => {
    expect(JSON.parse(generateRound().layoutText).terminal_menu).toBe("vjr-menu");
    expect(JSON.parse(generateSquare().layoutText).terminal_menu).toBe("vjr-menu");
  });

  test("the item opens the layout's own picker, frameless with square corners", () => {
    expect(generateRound().mods["vjr-menu"]?.["main.js"]).toContain(
      'if (it[1] === "markdown-picker") openOverlay({ mod: "vjr-markdown", kind: "popup", width: 560, height: 420, props: it[2] });\n    else if (it[1] === "move-tab")',
    );
    expect(generateSquare().mods["vjr-menu"]?.["main.js"]).toContain('if (it[1] === "markdown-picker") openOverlay({ mod: "vjr-markdown", kind: "popup", frame: "none", width: 560, height: 420');
  });

  test("the item has a file icon and shows the picker's key", () => {
    const menu = generateRound().mods["vjr-menu"]?.["main.js"] ?? "";
    expect(menu).toContain('const MARKDOWN_PICKER = { name: "vjr-markdown" };');
    expect(menu).toContain('function menuIcon(command, args) {\n  if (command === "markdown-picker") return "mods/workspace-chrome/file-text.svg";');
    expect(menu).toContain('  if (name === "markdown-picker") return keys().find((b) => b.action === `mod.open:${MARKDOWN_PICKER.name}`)?.keys ?? "";');
  });

  test("cmd-shift-o opens the picker in both looks", () => {
    expect(generateRound().keys["cmd-shift-o"]).toBe("mod.open:vjr-markdown");
    expect(generateSquare().keys["cmd-shift-o"]).toBe("mod.open:vjr-markdown");
  });

  test("the key opens the picker at the top, frameless and bordered with square corners", () => {
    expect(meta(generateRound(), "markdown").overlay).toEqual({ kind: "popup", at: "top", offset: 40, width: 560, height: 420 });
    expect(meta(generateSquare(), "markdown").overlay).toEqual({ kind: "popup", at: "top", offset: 40, width: 560, height: 420, frame: "none" });
    expect(generateSquare().mods["vjr-markdown"]?.["picker.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
    expect(generateRound().mods["vjr-markdown"]?.["picker.js"]).not.toContain(".border_1().border_color(t.border)");
  });

  test("opening a file names the layout's own viewer", () => {
    expect(generateRound().mods["vjr-markdown"]?.["open-markdown.js"]).toContain('export const MARKDOWN = { name: "vjr-markdown" };');
  });

  test("a menu without Close pane fails the recipe", () => {
    const withoutPane = [
      'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";',
      '        ["Close", "space.close", { id: tg.id }],',
      "    closeOverlay(props()?.overlay);",
      '  const name = command.endsWith(".close") ? "x" : "terminal";',
      "",
    ].join("\n");
    expect(() => generateRound({ "mods/menu/main.js": withoutPane })).toThrow(/recipe markdown/);
  });
});

describe("files", () => {
  test("both looks show our Files in the panel", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      expect(findNode(JSON.parse(generated.layoutText), "files")?.content).toEqual({ mod: "vjr-files" });
      const names = Object.keys(generated.mods["vjr-files"] ?? {}).filter((name) => !name.startsWith("icons/"));
      expect(names.sort()).toEqual(["actions.js", "file-icons.js", "icon-rules.js", "kit.js", "logic.js", "main.js", "menu.js", "mod.json", "open-markdown.js"]);
    }
  });

  test("both looks install the type icons unchanged, where the panel reads them", () => {
    const source = join(import.meta.dir, "../mods/files/icons");
    const svgs = readdirSync(source).filter((name) => name.endsWith(".svg"));
    for (const generated of [generateRound(), generateSquare()]) {
      const files = generated.mods["vjr-files"] ?? {};
      const icons = Object.keys(files).filter((name) => name.startsWith("icons/"));
      expect(icons.sort()).toEqual(svgs.map((name) => `icons/${name}`).sort());
      for (const name of svgs) expect(files[`icons/${name}`]).toBe(readFileSync(join(source, name), "utf8"));
      expect(files["logic.js"]).toContain('export const PACK = { name: "vjr-files" };');
    }
  });

  test("no copy of Herdr's Files is made in either look", () => {
    for (const generated of [generateRound(), generateSquare()]) {
      expect(generated.mods["vjr-files"]?.["main.js"]).toContain("export default class Files extends View");
      expect(generated.mods["vjr-files"]?.["main.js"]).not.toContain("div().rounded(10)");
    }
  });

  test("the panel keeps its corners with round corners and loses them with square ones", () => {
    expect(generateRound().mods["vjr-files"]?.["main.js"]).toContain(".rounded(RADIUS.panel)");
    const square = generateSquare().mods["vjr-files"] ?? {};
    expect(square["main.js"]).not.toMatch(/\.rounded\((?!0\))/);
    expect(square["kit.js"]).not.toMatch(/\.rounded\((?!0\))/);
  });

  test("the row menu is a frameless, bordered popup with square corners", () => {
    expect(generateRound().mods["vjr-files"]?.["main.js"]).toContain('openOverlay({ mod: "vjr-files", kind: "popup", width: MENU_WIDTH');
    expect(generateSquare().mods["vjr-files"]?.["main.js"]).toContain('openOverlay({ mod: "vjr-files", kind: "popup", frame: "none", width: MENU_WIDTH');
    expect(generateSquare().mods["vjr-files"]?.["menu.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
  });

  test("a Markdown file opens the layout's own viewer", () => {
    expect(generateRound().mods["vjr-files"]?.["open-markdown.js"]).toContain('export const MARKDOWN = { name: "vjr-markdown" };');
  });

  test("a layout without a files block fails the recipe", () => {
    const home = tempDir();
    makeHerdrHome(home);
    const layout = JSON.parse(readFileSync(join(home, "layouts/main.json"), "utf8"));
    const body = findNode(layout, "panel-body") as Record<string, any>;
    body.children = body.children.filter((child: { id: string }) => child.id !== "files");
    expect(() => generateRound({ "layouts/main.json": JSON.stringify(layout) })).toThrow(/recipe files: layout node files not found/);
  });
});

describe("move-tab", () => {
  test("both looks put Move to… in the tab menu", () => {
    const copy = "vjr-menu";
    for (const generated of [generateRound(), generateSquare()]) {
      const menu = generated.mods[copy]?.["main.js"] ?? "";
      expect(menu).toContain('["Move to…", "move-tab", { tab: tg.id, space: tg.space }],\n        ["Close", "tab.close", { id: tg.id }],');
      expect(menu).toContain('command === "worktree" || command === "move-tab" ? "git-branch"');
    }
  });

  test("the menu opens the layout's own popup", () => {
    expect(generateRound().mods["vjr-menu"]?.["main.js"]).toContain('if (it[1] === "move-tab") openOverlay({ mod: "vjr-move-tab", kind: "popup", width: 300, height: 320, props: it[2] });\n    else if (it[1] === "worktree")');
    expect(generateSquare().mods["vjr-menu"]?.["main.js"]).toContain('if (it[1] === "move-tab") openOverlay({ mod: "vjr-move-tab", kind: "popup", frame: "none", width: 300, height: 320, props: it[2] });');
  });

  test("both looks float the worker", () => {
    const copy = "vjr-move-tab";
    for (const generated of [generateRound(), generateSquare()]) {
      expect(JSON.parse(generated.layoutText).floating).toContainEqual({ id: "move-tab", content: { mod: copy, props: { role: "worker" } }, edge: "left", align: "end" });
    }
  });

  test("both looks install the script that schedules a move", () => {
    const script = readFileSync(join(import.meta.dir, "../mods/move-tab/schedule.sh"), "utf8");
    expect(generateRound().mods["vjr-move-tab"]?.["schedule.sh"]).toBe(script);
    expect(generateSquare().mods["vjr-move-tab"]?.["schedule.sh"]).toBe(script);
  });

  test("the square popup has a border", () => {
    expect(generateSquare().mods["vjr-move-tab"]?.["main.js"]).toContain(".bg(t.popover).border_1().border_color(t.border)");
  });

  test("cmd-shift-m opens the layout's own popup in both looks", () => {
    expect(generateRound().keys["cmd-shift-m"]).toBe("mod.open:vjr-move-tab");
    expect(generateSquare().keys["cmd-shift-m"]).toBe("mod.open:vjr-move-tab");
  });

  test("the menu shows the key bound to the layout's own popup", () => {
    const menu = "vjr-menu";
    const popup = "vjr-move-tab";
    for (const generated of [generateRound(), generateSquare()]) {
      const text = generated.mods[menu]?.["main.js"] ?? "";
      expect(text).toContain(`const MOVE_TAB = { name: "${popup}" };\n\nfunction menuIcon(command, args) {`);
      expect(text).toContain('function shortcut(name, args) {\n  if (name === "move-tab") return keys().find((b) => b.action === `mod.open:${MOVE_TAB.name}`)?.keys ?? "";\n');
    }
  });

  test("the key opens the popup at the menu's size, frameless with square corners", () => {
    expect(JSON.parse(generateRound().mods["vjr-move-tab"]?.["mod.json"] ?? "{}").overlay).toEqual({ kind: "popup", width: 300, height: 320 });
    expect(meta(generateSquare(), "move-tab").overlay).toEqual({ kind: "popup", width: 300, height: 320, frame: "none" });
  });

  test("a menu that changed fails the recipe", () => {
    const onlyFolders = [
      'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";',
      '        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),',
      '        ["Close", "space.close", { id: tg.id }],',
      "    closeOverlay(props()?.overlay);",
      '  const name = command.endsWith(".close") ? "x" : "terminal";',
      "function menuIcon(command, args) {",
      "function shortcut(name, args) {",
      '    if (it[1] === "worktree") tree();',
      "",
    ].join("\n");
    expect(() => generateRound({ "mods/menu/main.js": onlyFolders })).toThrow(/recipe move-tab/);
  });

  test("the tab bar starts a drag in both looks", () => {
    const tabs = "vjr-tabs";
    for (const generated of [generateRound(), generateSquare()]) {
      const text = generated.mods[tabs]?.["main.js"] ?? "";
      expect(text).toContain('import { spaces, panes, run, openOverlay, theme, window, shared, layout, settings, setShared } from "herdr";');
      expect(text).toContain(
        '.on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; this.from = e.position; setShared("move-tab.drag", { tab: c.id, space: space.id, at: Date.now() });',
      );
      expect(text).toContain('.on_mouse_up("left", () => { this.pressed = null; if (shared("move-tab.drag")) setShared("move-tab.drag", null); })');
    }
  });

  test("the tab bar marks a drag once the pointer moves 4 px, fades the dragged tab and outlines the tab it would land on", () => {
    const tabs = "vjr-tabs";
    for (const generated of [generateRound(), generateSquare()]) {
      const text = generated.mods[tabs]?.["main.js"] ?? "";
      expect(text).toContain(
        '.on_mouse_move((e) => { const drag = shared("move-tab.drag"); if (this.pressed === null || !drag || drag.moving || !this.from) return; ' +
          'if (Math.hypot(e.position.x - this.from.x, e.position.y - this.from.y) > 4) setShared("move-tab.drag", { ...drag, moving: true }); })',
      );
      expect(text).toContain('.when(shared("move-tab.drag")?.moving === true && shared("move-tab.drag")?.tab === c.id, (el) => el.opacity(0.45))');
      expect(text).toContain('.when(shared("move-tab.drag")?.moving === true && shared("move-tab.drag")?.tab !== c.id && this.target === i, (el) => el.border_color(t.accent))');
      expect(text).toContain('.on_hover((on, cx) => { if (on) this.target = i; else if (this.target === i) this.target = null; if (shared("move-tab.drag")?.moving) cx.notify(); })');
      expect(text).toContain('.when(shared("move-tab.drag")?.tab != null && this.pressed !== null, (el) => el.cursor_grabbing())');
      const look = text.indexOf(".when(shared(\"move-tab.drag\")?.moving === true && shared(\"move-tab.drag\")?.tab === c.id");
      expect(look).toBeGreaterThan(-1);
      expect(look).toBeLessThan(text.indexOf("this.pressed = i; this.from = e.position;"));
    }
  });

  test("a tab reorders only while the bar's own drag is set", () => {
    const tabs = "vjr-tabs";
    for (const generated of [generateRound(), generateSquare()]) {
      const text = generated.mods[tabs]?.["main.js"] ?? "";
      expect(text).toContain('const from = shared("move-tab.drag") ? this.pressed : null; this.pressed = null;');
      expect(text).not.toContain("const from = this.pressed;");
    }
  });

  test("a tab bar that changed fails the move-tab recipe", () => {
    const home = tempDir();
    makeHerdrHome(home);
    const tabs = readFileSync(join(home, "mods/tabs/main.js"), "utf8");
    for (const anchor of [
      'import { spaces, panes, run, openOverlay, theme, window, shared, layout, settings } from "herdr";',
      '.on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i;',
      '.on_mouse_up("left", () => { this.pressed = null; })',
      "const from = this.pressed; this.pressed = null;",
    ]) {
      expect(tabs).toContain(anchor);
      expect(() => generateRound({ "mods/tabs/main.js": tabs.replace(anchor, "") })).toThrow(/recipe move-tab:/);
    }
  });
});
