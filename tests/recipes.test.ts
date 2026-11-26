import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEFT_ROUNDED, nuohVariant, variantWith } from "../recipes/variants";
import { generateVariant } from "../scripts/generate-layout";
import { editFile, modsIn, removeTempDirs, repo, tempDir } from "./helpers";
import { makeHerdrHome, SHIPPED_MODS } from "./herdr-home";

afterEach(removeTempDirs);

function generate(square: boolean, overrides: Record<string, string> = {}) {
  const home = tempDir();
  makeHerdrHome(home, overrides);
  return generateVariant(variantWith([], square), { home, version: "0.1.10", repo, bun: "/bin/bun" });
}

function generateNuoh(overrides: Record<string, string> = {}) {
  const home = tempDir();
  makeHerdrHome(home, overrides);
  return generateVariant(nuohVariant([]), { home, version: "0.1.10", repo, bun: "/bin/bun" });
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

  test("nuoh's Settings has no Square corners, and opens as the same dialog", () => {
    const settings = generateNuoh().mods["nuoh-settings"] ?? {};
    expect(settings["main.js"]).not.toContain("Square corners");
    expect(settings["main.js"]).not.toContain("setShared");
    expect(JSON.parse(settings["mod.json"] ?? "{}").overlay).toEqual({ kind: "dialog", width: 880, height: 620 });
  });
});

describe("nuoh", () => {
  const nuohLayout = () => JSON.parse(generateNuoh().layoutText);
  const nuohTabs = () => generateNuoh().mods["nuoh-tabs"]?.["main.js"] ?? "";
  const ids = (node: Record<string, any> | null) => (node?.children ?? []).map((child: { id: string }) => child.id);

  test("is its own layout with its own copies, named nuoh-", () => {
    const generated = generateNuoh();
    expect(generated.layout).toBe("nuoh");
    expect(Object.keys(generated.mods).sort()).toEqual([
      "nuoh-agent-list",
      "nuoh-comeback",
      "nuoh-files",
      "nuoh-kit",
      "nuoh-markdown",
      "nuoh-menu",
      "nuoh-move-tab",
      "nuoh-palette",
      "nuoh-rail",
      "nuoh-settings",
      "nuoh-spaces-tree",
      "nuoh-tabs",
      "nuoh-topbar",
    ]);
    expect(modsIn(nuohLayout()).filter((mod) => mod.startsWith("vjr-"))).toEqual(["vjr-sync"]);
  });

  test("the window sits on a gradient, its blocks 8 px apart and 8 px from the edges, with no lines between them", () => {
    const root = nuohLayout();
    expect(ids(root)).toEqual(["rail-column", "views"]);
    expect(root.background).toEqual({ gradient: ["#181818", "#0D0D0D"], angle: 180 });
    expect(root.padding).toBe(8);
    expect(root.gap).toBe(8);
    expect(root.resizable).toBe(false);
    expect(root.divider).toBeUndefined();
  });

  test("the rail column keeps a 46 px band for the traffic lights over the rail, a 54 px card", () => {
    const column = findNode(nuohLayout(), "rail-column");
    expect(column).toMatchObject({ type: "column", size: { px: 54 }, resizable: false, gap: 8 });
    expect(ids(column)).toEqual(["lights", "rail"]);
    const [lights, rail] = column?.children ?? [];
    expect(lights).toEqual({ id: "lights", type: "block", size: { px: 46 }, window_drag: true, content: { mod: "nuoh-topbar", props: { role: "lights" } } });
    expect(rail).toEqual({
      id: "rail",
      type: "block",
      background: "surface",
      border: { width: 1, color: "#FFFFFF12" },
      radius: 16,
      shadow: "md",
      content: { mod: "nuoh-rail", props: { views: [{ id: "workspace", label: "Workspace", icon: "terminal", key: "ctrl-cmd-1" }] } },
    });
  });

  test("the views stack fills the rest and starts on the Workspace", () => {
    const views = findNode(nuohLayout(), "views");
    expect(views?.type).toBe("stack");
    expect(views?.active).toBe("workspace");
    expect(ids(views)).toEqual(["workspace"]);
  });

  test("the fields only the root reads stay on the root, with the traffic lights centered in the band", () => {
    const root = nuohLayout();
    expect(root.titlebar).toBe("none");
    expect(root.traffic_lights).toEqual([18, 24]);
    expect(root.terminal_menu).toBe("nuoh-menu");
    expect(root.theme).toEqual({ light: "paper", dark: "vjr" });
    expect(root.preview).toBe("layouts/nuoh.svg");
    expect(root.floating.map((block: { id: string }) => block.id)).toEqual(["comeback", "move-tab", "vjr-sync"]);
    expect(root.floating.at(-1).content.props.square).toBeNull();
  });

  test("the Workspace puts the sidebar and the work 8 px apart, with a line between them only on hover", () => {
    const workspace = findNode(nuohLayout(), "workspace");
    expect(workspace?.type).toBe("row");
    expect(workspace?.gap).toBe(8);
    expect(workspace?.divider).toEqual({ width: 1, color: "#00000000", hover: "accent" });
    expect(ids(workspace)).toEqual(["sidebar", "work"]);
    expect(findNode(workspace, "spaces")?.content.mod).toBe("nuoh-spaces-tree");
    expect(findNode(workspace, "files")?.content.mod).toBe("nuoh-files");
  });

  test("the sidebar opens with the space's title over two cards on the gradient, with no square fill behind them", () => {
    const sidebar = findNode(nuohLayout(), "sidebar");
    expect(ids(sidebar)).toEqual(["space-title", "sidebar-lists"]);
    expect(sidebar?.background).toBeUndefined();
    expect(sidebar?.gap).toBe(8);
    expect(findNode(sidebar, "space-title")).toEqual({ id: "space-title", type: "block", size: { px: 46 }, window_drag: true, content: { mod: "nuoh-topbar", props: { role: "title" } } });
    const lists = findNode(sidebar, "sidebar-lists");
    expect(lists?.background).toBeUndefined();
    expect(lists?.gap).toBe(8);
    expect(lists?.divider).toEqual({ width: 1, color: "#00000000", hover: "accent" });
    expect(lists?.resizable).toBeUndefined();
    expect(ids(lists)).toEqual(["spaces", "agents"]);
  });

  test("Spaces and Agents are cards like the rail, with the tree in its card look and our own Agents list", () => {
    const lists = findNode(nuohLayout(), "sidebar-lists");
    const card = { background: "surface", border: { width: 1, color: "#FFFFFF12" }, radius: 14, shadow: "md" };
    expect(findNode(lists, "spaces")).toEqual({ id: "spaces", type: "block", ...card, content: { mod: "nuoh-spaces-tree", props: { card: true } } });
    expect(findNode(lists, "agents")).toEqual({ id: "agents", type: "block", ...card, content: { mod: "nuoh-agent-list" } });
    expect(modsIn(nuohLayout())).not.toContain("agents");
  });

  test("the Agents list opens its sort menu as its own popup, and reaches the kit and the space colors", () => {
    const list = generateNuoh().mods["nuoh-agent-list"] ?? {};
    expect(list["main.js"]).toContain('openOverlay({ mod: "nuoh-agent-list", kind: "popup"');
    expect(list["main.js"]).toContain('from "./kit.js"');
    expect(list["kit.js"]).toContain('{ name: "nuoh-kit" }');
    expect(Object.keys(list).sort()).toEqual(["kit.js", "logic.js", "main.js", "mod.json", "space-colors.js"]);
  });

  test("a window without the sidebar's lists fails the cards recipe", () => {
    for (const id of ["spaces", "agents"]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "layouts/main.json"), `"id": "${id}"`, `"id": "${id}-renamed"`);
      expect(() => generateVariant(nuohVariant([]), { home, version: "0.1.10", repo, bun: "/bin/bun" })).toThrow(/layout node (spaces|agents) not found/);
    }
  });

  test("the work column opens with the tabs and the machine pill, and its body has no padding", () => {
    const work = findNode(nuohLayout(), "work");
    expect(work?.gap).toBe(8);
    expect(ids(work)).toEqual(["work-top", "work-body"]);
    const top = findNode(work, "work-top");
    expect(top).toMatchObject({ type: "row", size: { px: 46 }, resizable: false, window_drag: true });
    expect(ids(top)).toEqual(["tabs", "machine"]);
    expect(findNode(top, "tabs")).toEqual({ id: "tabs", type: "block", window_drag: true, content: { mod: "nuoh-tabs" } });
    expect(findNode(top, "machine")).toEqual({ id: "machine", type: "block", size: { px: 160 }, window_drag: true, content: { mod: "nuoh-topbar", props: { role: "machine" } } });
    expect(findNode(work, "work-body")?.padding).toBeUndefined();
    expect(findNode(work, "work-body")?.gap).toBe(8);
  });

  test("the Herdr block, the sidebar's footer and the status bar are gone, and so are their mods", () => {
    const root = nuohLayout();
    for (const id of ["brand", "sidebar-footer", "status"]) expect(findNode(root, id)).toBeNull();
    expect(modsIn(root)).not.toContain("nuoh-workspace-chrome");
    expect(modsIn(root)).not.toContain("nuoh-workspace-status");
  });

  test("panes are cards with 14 px corners and a peach line as wide as the resting one", () => {
    const pane = findNode(nuohLayout(), "main")?.content.pane;
    expect(pane.radius).toBe(14);
    expect(pane.border).toEqual({ width: 1, color: "#FFFFFF12" });
    expect(pane.focus).toEqual({ width: 1, color: "#FFC799B3" });
    expect(pane.header).toEqual({ content: { mod: "pane" }, height: 30 });
  });

  test("ctrl-cmd-1 selects the Workspace", () => {
    expect(generateNuoh().keys["ctrl-cmd-1"]).toEqual({ command: "layout.select", args: { stack: "views", child: "workspace" } });
  });

  test("the tab bar draws on the window's gradient, with no room kept for the traffic lights", () => {
    const tabs = nuohTabs();
    expect(tabs).toContain("h_flex().size_full().min_w(0).px(10).gap(3).items_center().rounded(7)");
    expect(tabs).not.toContain(".pl(lightsPadding)");
    expect(tabs).not.toContain(".border_b(1)");
  });

  test("tabs are 32 px pills, and only the active one has a fill and a line", () => {
    const tabs = nuohTabs();
    expect(tabs).toContain(".h(32).px(12).gap(8).rounded(9).items_center().flex_none().text_size(13)");
    expect(tabs).toContain(".border(1).when(c.active, el => el.border_color(t.border).bg(t.raised))");
    expect(tabs).not.toContain("t.chrome");
  });

  test("panel buttons show only their icon and name themselves in a tooltip", () => {
    const tabs = nuohTabs();
    expect(tabs).toContain("h_flex().id(`panel-${id}`).h(28).px(7).gap(5).flex_none().items_center().rounded(8).tooltip(label)");
    expect(tabs).toContain(".child(svg(icon).size(14));");
    expect(tabs).not.toContain(".child(label)");
    expect(tabs).toContain(".when(on, el => el.bg(t.selected))");
  });

  test("an extra's button filled like a panel button loses the chrome fill too", () => {
    const toggle = {
      name: "toggle",
      mods: [{ name: "tabs", from: "mods" as const }],
      apply({ copies }: { copies: Record<string, { files: Record<string, string> }> }) {
        const tabs = copies.tabs as { files: Record<string, string> };
        tabs.files["main.js"] = (tabs.files["main.js"] ?? "").replace(".child(div().size(6).rounded(3))", '.child(h_flex().id("toggle").bg(on ? t.selected : t.chrome))');
      },
    };
    const home = tempDir();
    makeHerdrHome(home);
    const tabs = generateVariant(nuohVariant([toggle]), { home, version: "0.1.10", repo, bun: "/bin/bun" }).mods["nuoh-tabs"]?.["main.js"] ?? "";
    expect(tabs).toContain('.child(h_flex().id("toggle").when(on, el => el.bg(t.selected)))');
  });

  test("vjr-desk keeps its Herdr block, footer, status bar and tab bar", () => {
    const generated = generateRound();
    const root = JSON.parse(generated.layoutText);
    for (const id of ["brand", "sidebar-footer", "status", "tabs"]) expect(findNode(root, id)).not.toBeNull();
    expect(findNode(root, "work-body")?.padding).toBe(8);
    expect(findNode(root, "main")?.content.pane.radius).toBe(10);
    expect(root.background).toBeUndefined();
    expect(generated.mods["vjr-workspace-chrome"]?.["main.js"]).toContain("el.pl(76)");
    expect(generated.mods["vjr-tabs"]?.["main.js"]).toContain(".pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1)");
    expect(generated.mods["vjr-tabs"]?.["main.js"]).toContain(".child(svg(icon).size(14)).child(label);");
    expect(generated.mods["vjr-rail"]).toBeUndefined();
    expect(generated.mods["vjr-topbar"]).toBeUndefined();
    for (const id of ["views", "rail-column", "space-title", "work-top"]) expect(findNode(root, id)).toBeNull();
  });

  test("the rail and the top bar open nuoh's own palette and Settings, and Herdr's Add machine", () => {
    const generated = generateNuoh();
    const rail = generated.mods["nuoh-rail"]?.["main.js"] ?? "";
    expect(rail).toContain('const PALETTE = { name: "nuoh-palette" };');
    expect(rail).toContain('const SETTINGS = { name: "nuoh-settings" };');
    expect(generated.mods["nuoh-rail"]?.["kit.js"]).toContain('{ name: "nuoh-kit" }');
    expect(generated.mods["nuoh-topbar"]?.["main.js"]).toContain('const MACHINE_ADD = { name: "machine-add" };');
  });

  test("the top bar carries its own copies of the kit and the space colors", () => {
    const topbar = generateNuoh().mods["nuoh-topbar"] ?? {};
    expect(topbar["main.js"]).toContain('from "./kit.js"');
    expect(topbar["main.js"]).toContain('from "./space-colors.js"');
    expect(topbar["space-colors.js"]).toContain("export function paint");
    expect(JSON.parse(topbar["mod.json"] ?? "{}").place).toBe("none");
  });

  test("the kit carries the rail's and the top bar's icons", () => {
    const kit = generateNuoh().mods["nuoh-kit"] ?? {};
    for (const name of ["search", "panel-left", "monitor", "server", "git-branch", "chevron-down"]) expect(kit[`icons/${name}.svg`]).toContain("<svg");
  });

  test("a tab bar that changed fails the frame recipe", () => {
    for (const from of [
      ".pl(lightsPadding).gap(3).items_center().bg(t.chrome)",
      ".h(29).px(10).gap(7)",
      ".border_color(c.active ? t.border : t.chrome)",
      ".h(26).px(8).gap(5).flex_none().items_center().rounded(6)",
      ".child(svg(icon).size(14)).child(label)",
      ".bg(on ? t.selected : t.chrome)",
    ]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "mods/tabs/main.js"), from, "");
      expect(() => generateVariant(nuohVariant([]), { home, version: "0.1.10", repo, bun: "/bin/bun" })).toThrow(/recipe nuoh-frame:/);
    }
  });

  test("a window without the blocks the frame moves or removes fails the frame recipe", () => {
    for (const id of ["brand", "sidebar-footer", "status", "sidebar-lists", "tabs", "work-body"]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "layouts/main.json"), `"id": "${id}"`, `"id": "${id}-renamed"`);
      expect(() => generateVariant(nuohVariant([]), { home, version: "0.1.10", repo, bun: "/bin/bun" })).toThrow(`recipe nuoh-frame: layout node ${id} not found`);
    }
  });

  test("an extra that adds a view gets the next key, a tile on the rail and runs before the keys are made", () => {
    const board = {
      name: "board-view",
      mods: [],
      apply({ layout }: { layout: Record<string, any> }) {
        findNode(layout, "views")?.children.push({ id: "board", type: "block", content: { mod: "files" } });
        findNode(layout, "rail")?.content.props.views.push({ id: "board", label: "Board", icon: "square-kanban" });
      },
    };
    const home = tempDir();
    makeHerdrHome(home);
    const generated = generateVariant(nuohVariant([board]), { home, version: "0.1.10", repo, bun: "/bin/bun" });
    const layout = JSON.parse(generated.layoutText);
    expect(findNode(layout, "rail")?.content.props.views.map((view: { id: string; key: string }) => [view.id, view.key])).toEqual([
      ["workspace", "ctrl-cmd-1"],
      ["board", "ctrl-cmd-2"],
    ]);
    expect(generated.keys["ctrl-cmd-2"]).toEqual({ command: "layout.select", args: { stack: "views", child: "board" } });
    expect(findNode(layout, "board")?.content.mod).toBe("nuoh-files");
  });

  test("a rail view the views stack does not have fails the build", () => {
    const stray = {
      name: "stray-view",
      mods: [],
      apply({ layout }: { layout: Record<string, any> }) {
        findNode(layout, "rail")?.content.props.views.push({ id: "missing", label: "Missing", icon: "x" });
      },
    };
    const home = tempDir();
    makeHerdrHome(home);
    expect(() => generateVariant(nuohVariant([stray]), { home, version: "0.1.10", repo, bun: "/bin/bun" })).toThrow("recipe rail-keys: the rail shows missing, which views does not have");
  });

  test("an extra can't take the rail's, the frame's or the cards' names", () => {
    const named = (name: string) => ({ name, mods: [], apply() {} });
    expect(() => nuohVariant([named("rail")])).toThrow(/rail, which is taken/);
    expect(() => nuohVariant([named("rail-keys")])).toThrow(/rail-keys, which is taken/);
    expect(() => nuohVariant([named("nuoh-frame")])).toThrow(/nuoh-frame, which is taken/);
    expect(() => nuohVariant([named("nuoh-cards")])).toThrow(/nuoh-cards, which is taken/);
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
