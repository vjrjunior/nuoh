import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Recipe } from "../recipes/recipe";
import { generate as generateLayout } from "../scripts/generate-layout";
import { editFile, modsIn, removeTempDirs, repo, tempDir } from "./helpers";
import { makeHerdrHome } from "./herdr-home";

afterEach(removeTempDirs);

function generateIn(home: string, extras: Recipe[] = []) {
  return generateLayout(extras, { home, version: "0.1.10", repo, bun: "/bin/bun" });
}

function generate(overrides: Record<string, string> = {}) {
  const home = tempDir();
  makeHerdrHome(home, overrides);
  return generateIn(home);
}

const meta = (generated: ReturnType<typeof generate>, mod: string) => JSON.parse(generated.mods[`nuoh-${mod}`]?.["mod.json"] ?? "{}");

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

describe("palette", () => {
  test("the palette shows keys from its own layout section", () => {
    expect(generate().mods["nuoh-palette"]?.["main.js"]).toContain('if (section !== "global" && section !== "layout:nuoh") continue;');
  });

  test("the copied palette opens where the original does", () => {
    expect(JSON.parse(generate().mods["nuoh-palette"]?.["mod.json"] ?? "{}").overlay).toEqual({
      kind: "popup",
      at: "top",
      offset: 60,
      width: 620,
      height: 410,
    });
  });

  test("the palette key opens the copy", () => {
    expect(generate().replacements["app.palette"]).toBe("mod.open:nuoh-palette");
  });

  test("a palette that changed fails the recipe", () => {
    expect(() => generate({ "frame/palette/main.js": "changed" })).toThrow(/recipe palette:/);
  });
});

describe("git-graph-panel", () => {
  test("shows a Graph button", () => {
    const tabs = "nuoh-tabs";
    const generated = generate();
    expect(generated.mods[tabs]?.["main.js"]).toContain('panelButton("graph", "Graph", "mods/nuoh-git-graph/icons/graph.svg")');
    expect(generated.mods[tabs]?.["main.js"]).toContain('[...(shared("workspace.panels") ?? ["files", "changes"]), "graph"]');
  });

  test("the Graph draws its icons from its own copy, which carries the license", () => {
    const graph = generate().mods["nuoh-git-graph"] ?? {};
    expect(graph["menu.js"]).toContain("`mods/nuoh-git-graph/icons/${name}.svg`");
    expect(graph["icons/graph.svg"]).toContain("<svg");
    expect(graph.LICENSE).toBe(readFileSync(join(repo, "mods/git-graph/LICENSE"), "utf8"));
  });

  test("git-graph never asks GitHub for a new release", () => {
    expect(readFileSync(join(repo, "mods/git-graph/update.js"), "utf8")).toContain("const CHECK = false;");
  });

  test("the Graph button comes right after Changes", () => {
    expect(generate().mods["nuoh-tabs"]?.["main.js"]).toContain(
      'panelButton("changes", "Changes", "mods/changes/changes.svg")))\n      .child(panelButton("graph"',
    );
  });

  test("a layout without panel-body fails the recipe", () => {
    expect(() => generate({ "layouts/main.json": '{ "id": "root", "children": [] }' })).toThrow(/recipe git-graph-panel:/);
  });

  test("a tab bar that changed fails the recipe", () => {
    expect(() => generate({ "mods/tabs/main.js": "changed" })).toThrow(/recipe git-graph-panel:/);
  });
});

describe("kit", () => {
  test("installs the kit", () => {
    expect(Object.keys(generate().mods)).toContain("nuoh-kit");
  });
});

describe("nuoh", () => {
  const nuohLayout = () => JSON.parse(generate().layoutText);
  const nuohTabs = () => generate().mods["nuoh-tabs"]?.["main.js"] ?? "";
  const ids = (node: Record<string, any> | null) => (node?.children ?? []).map((child: { id: string }) => child.id);

  test("has its own copies, named nuoh-", () => {
    const generated = generate();
    expect(Object.keys(generated.mods).sort()).toEqual([
      "nuoh-agent-list",
      "nuoh-comeback",
      "nuoh-files",
      "nuoh-git-graph",
      "nuoh-kit",
      "nuoh-markdown",
      "nuoh-menu",
      "nuoh-move-tab",
      "nuoh-palette",
      "nuoh-pane-header",
      "nuoh-rail",
      "nuoh-spaces-tree",
      "nuoh-sync",
      "nuoh-tabs",
      "nuoh-topbar",
    ]);
    expect(modsIn(nuohLayout()).filter((mod) => mod.startsWith("vjr-"))).toEqual([]);
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
    expect(root.floating.map((block: { id: string }) => block.id)).toEqual(["comeback", "move-tab", "sync"]);
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

  test("the sidebar opens with the space's title over two cards on the gradient, with no fill behind them", () => {
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

  test("Spaces and Agents are cards like the rail, with the tree and our own Agents list", () => {
    const lists = findNode(nuohLayout(), "sidebar-lists");
    const card = { background: "surface", border: { width: 1, color: "#FFFFFF12" }, radius: 14, shadow: "md" };
    expect(findNode(lists, "spaces")).toEqual({ id: "spaces", type: "block", ...card, content: { mod: "nuoh-spaces-tree" } });
    expect(findNode(lists, "agents")).toEqual({ id: "agents", type: "block", ...card, content: { mod: "nuoh-agent-list" } });
    expect(modsIn(nuohLayout())).not.toContain("agents");
  });

  test("the Agents list opens its sort menu as its own popup, and reaches the kit and the space colors", () => {
    const list = generate().mods["nuoh-agent-list"] ?? {};
    expect(list["main.js"]).toContain('openOverlay({ mod: "nuoh-agent-list", kind: "popup"');
    expect(list["main.js"]).toContain('from "./kit.js"');
    expect(list["kit.js"]).toContain('{ name: "nuoh-kit" }');
    expect(Object.keys(list).sort()).toEqual(["agent-title.js", "kit.js", "layout-tree.js", "logic.js", "main.js", "mod.json", "space-colors.js"]);
  });

  test("a window without the sidebar's lists fails the cards recipe", () => {
    for (const id of ["spaces", "agents"]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "layouts/main.json"), `"id": "${id}"`, `"id": "${id}-renamed"`);
      expect(() => generateIn(home)).toThrow(/layout node (spaces|agents) not found/);
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

  test("panes are surface cards with 14 px corners, a shadow, a peach line as wide as the resting one, and a veil on the others", () => {
    const pane = findNode(nuohLayout(), "main")?.content.pane;
    expect(pane.radius).toBe(14);
    expect(pane.border).toEqual({ width: 1, color: "#FFFFFF12" });
    expect(pane.focus).toEqual({ width: 1, color: "#FFC799B3" });
    expect(pane.background).toBe("surface");
    expect(pane.shadow).toBe("md");
    expect(pane.veil).toBe(0.4);
  });

  test("each pane opens with our own 42 px header, which carries the kit and the title cleaner", () => {
    const generated = generate();
    const pane = findNode(JSON.parse(generated.layoutText), "main")?.content.pane;
    expect(pane.header).toEqual({ content: { mod: "nuoh-pane-header" }, height: 42, position: "top", reveal: "always" });
    const header = generated.mods["nuoh-pane-header"] ?? {};
    expect(Object.keys(header).sort()).toEqual(["agent-title.js", "kit.js", "logic.js", "main.js", "mod.json"]);
    expect(header["logic.js"]).toContain('from "./agent-title.js"');
    expect(header["kit.js"]).toContain('{ name: "nuoh-kit" }');
    expect(JSON.parse(header["mod.json"] ?? "{}").place).toBe("none");
  });

  test("the panels and any block an extra puts beside the panes are cards that hold the panel 6 px in", () => {
    const panelExtra = {
      name: "side-panel",
      mods: [],
      apply({ layout }: { layout: Record<string, any> }) {
        findNode(layout, "work-body")?.children.push({ id: "side", type: "block", hidden: true, size: { px: 380 }, content: { mod: "files" } });
      },
    };
    const home = tempDir();
    makeHerdrHome(home);
    const layout = JSON.parse(generateIn(home, [panelExtra]).layoutText);
    const card = { background: "surface", border: { width: 1, color: "#FFFFFF12" }, radius: 14, shadow: "md", padding: 6 };
    expect(findNode(layout, "panel")).toMatchObject({ type: "column", hidden: true, ...card });
    expect(findNode(layout, "side")).toMatchObject({ type: "block", hidden: true, size: { px: 380 }, ...card });
    expect(findNode(layout, "main")?.background).toBeUndefined();
    expect(findNode(layout, "main")?.padding).toBeUndefined();
  });

  test("the Graph is nuoh's own copy, its box a 10 px well like Files and Changes", () => {
    const generated = generate();
    expect(graphChild(generated)).toEqual({ id: "graph", type: "block", content: { mod: "nuoh-git-graph" } });
    const graph = generated.mods["nuoh-git-graph"]?.["graph.js"] ?? "";
    expect(graph).toContain('v_flex().id("git-graph").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border)');
    expect(graph).not.toContain("paneFrame(layout())?.radius");
    expect(graph).toContain('openOverlay({ mod: "nuoh-git-graph", kind: "popup"');
  });

  test("the + sits right after the last tab, and the panel buttons sit in a group at the right", () => {
    const tabs = nuohTabs();
    expect(tabs).toContain('h_flex().id("tab-scroll").flex_initial().min_w(0)');
    expect(tabs).toContain(".overflow_x_scroll().track_scroll(this.scroll)");
    expect(tabs).not.toContain('id("tab-scroll").flex_1()');
    expect(tabs).not.toContain("overflow_x_scrollbar");
    const group = '.child(h_flex().id("panel-group").flex_none().gap(2).p(3).items_center().rounded(11).bg(t.surface).border_1().border_color(t.foreground + "12")';
    const order = [
      'h_flex().id("tab-scroll")',
      '.child(button("tab-new", "+"',
      ".child(div().flex_1())",
      group,
      'panelButton("files"',
      'panelButton("changes"',
      'panelButton("graph"',
      ")\n      .when(w?.buttons,",
    ].map((text) => tabs.indexOf(text));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("an extra's button between the + and the window buttons lands in the group", () => {
    const toggle = {
      name: "toggle",
      mods: [{ name: "tabs", from: "mods" as const }],
      apply({ copies }: { copies: Record<string, { files: Record<string, string> }> }) {
        const tabs = copies.tabs as { files: Record<string, string> };
        tabs.files["main.js"] = (tabs.files["main.js"] ?? "").replace('.when(enabled.includes("files")', '.child(h_flex().id("toggle"))\n      .when(enabled.includes("files")');
      },
    };
    const home = tempDir();
    makeHerdrHome(home);
    const tabs = generateIn(home, [toggle]).mods["nuoh-tabs"]?.["main.js"] ?? "";
    const group = tabs.indexOf('id("panel-group")');
    expect(group).toBeGreaterThan(0);
    expect(tabs.indexOf('id("toggle")')).toBeGreaterThan(group);
    expect(tabs.indexOf('id("toggle")')).toBeLessThan(tabs.indexOf('panelButton("files"'));
  });

  test("a tab bar that changed fails the cards recipe", () => {
    for (const from of ['.id("tab-scroll").flex_1()', ".overflow_x_scrollbar().track_scroll(this.scroll)", '.child(button("tab-new", "+"', ".when(w?.buttons,"]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "mods/tabs/main.js"), from, "");
      expect(() => generateIn(home)).toThrow(/recipe nuoh-cards: tabs:/);
    }
  });

  test("ctrl-cmd-1 selects the Workspace", () => {
    expect(generate().keys["ctrl-cmd-1"]).toEqual({ command: "layout.select", args: { stack: "views", child: "workspace" } });
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
    const tabs = generateIn(home, [toggle]).mods["nuoh-tabs"]?.["main.js"] ?? "";
    expect(tabs).toContain('.child(h_flex().id("toggle").when(on, el => el.bg(t.selected)))');
  });

  test("the rail opens nuoh's own palette, and the top bar Herdr's Add machine", () => {
    const generated = generate();
    const rail = generated.mods["nuoh-rail"]?.["main.js"] ?? "";
    expect(rail).toContain('const PALETTE = { name: "nuoh-palette" };');
    expect(generated.mods["nuoh-rail"]?.["kit.js"]).toContain('{ name: "nuoh-kit" }');
    expect(generated.mods["nuoh-topbar"]?.["main.js"]).toContain('const MACHINE_ADD = { name: "machine-add" };');
  });

  test("the top bar carries its own copies of the kit and the space colors", () => {
    const topbar = generate().mods["nuoh-topbar"] ?? {};
    expect(topbar["main.js"]).toContain('from "./kit.js"');
    expect(topbar["main.js"]).toContain('from "./space-colors.js"');
    expect(topbar["space-colors.js"]).toContain("export function paint");
    expect(JSON.parse(topbar["mod.json"] ?? "{}").place).toBe("none");
  });

  test("the kit carries the rail's and the top bar's icons", () => {
    const kit = generate().mods["nuoh-kit"] ?? {};
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
      expect(() => generateIn(home)).toThrow(/recipe nuoh-frame:/);
    }
  });

  test("a window without the blocks the frame moves or removes fails the frame recipe", () => {
    for (const id of ["brand", "sidebar-footer", "status", "sidebar-lists", "tabs", "work-body"]) {
      const home = tempDir();
      makeHerdrHome(home);
      editFile(join(home, "layouts/main.json"), `"id": "${id}"`, `"id": "${id}-renamed"`);
      expect(() => generateIn(home)).toThrow(`recipe nuoh-frame: layout node ${id} not found`);
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
    const generated = generateIn(home, [board]);
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
    expect(() => generateIn(home, [stray])).toThrow("recipe rail-keys: the rail shows missing, which views does not have");
  });
});

describe("spaces-tree", () => {
  test("shows the tree in the spaces block", () => {
    expect(findNode(JSON.parse(generate().layoutText), "spaces")?.content.mod).toBe("nuoh-spaces-tree");
  });

  test("the copy brings its pure logic along", () => {
    expect(generate().mods["nuoh-spaces-tree"]?.["tree.js"]).toContain("export function buildTree");
  });

  test("puts Pin to top or Unpin, then Move to folder…, in the space menu, before Close", () => {
    const copy = "nuoh-menu";
    const generated = generate();
    const menu = generated.mods[copy]?.["main.js"] ?? "";
    expect(menu).toContain(
      '        ...(p.folder ? [p.folder.pinned ? ["Unpin", "spaces-unpin", p.folder] : ["Pin to top", "spaces-pin", p.folder], ["Move to folder…", "spaces-folder", p.folder]] : []),\n        ["Close", "space.close", { id: tg.id }],',
    );
    expect(menu).toContain(
      '  if (command === "spaces-pin") return "mods/workspace-chrome/pin.svg";\n  if (command === "spaces-unpin") return "mods/workspace-chrome/pin-off.svg";\n  if (command === "spaces-folder") return "mods/workspace-chrome/folder.svg";\n  const name = command.endsWith(".close")',
    );
  });

  test("makes Pin to top and Unpin write the pins the tree worked out", () => {
    const generated = generate();
    const menu = generated.mods["nuoh-menu"]?.["main.js"] ?? "";
    expect(menu).toContain('import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, setShared } from "herdr";');
    expect(menu).toContain('    closeOverlay(props()?.overlay);\n    if (it[1] === "spaces-pin" || it[1] === "spaces-unpin") return setShared("spaces.pinned", it[2].pins);\n');
  });

  test("the menu opens the layout's own folders popup", () => {
    expect(generate().mods["nuoh-menu"]?.["main.js"]).toContain(
      '    if (it[1] === "spaces-pin" || it[1] === "spaces-unpin") return setShared("spaces.pinned", it[2].pins);\n    if (it[1] === "spaces-folder") return openOverlay({ mod: "nuoh-spaces-tree", kind: "popup", width: 240, height: it[2].height, props: { ...it[2], role: "folders" } });',
    );
  });

  test("the tree opens its own folder popups", () => {
    const round = generate().mods["nuoh-spaces-tree"] ?? {};
    expect(round["actions.js"]).toContain('openOverlay({ mod: "nuoh-spaces-tree", kind: "popup", width: FOLDER_MENU.width');
    expect(round["popups.js"]).toContain('openOverlay({ mod: "nuoh-spaces-tree", kind: "dialog", width: NAME_DIALOG.width');
  });

  test("a menu without the space case fails the recipe", () => {
    expect(() => generate({ "mods/menu/main.js": "export default class Mod { render() { return div(); } }" })).toThrow(/recipe spaces-tree/);
  });

  test("a menu whose imports changed fails the recipe", () => {
    const home = tempDir();
    makeHerdrHome(home);
    const menu = readFileSync(join(home, "mods/menu/main.js"), "utf8");
    const anchor = 'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";';
    expect(menu).toContain(anchor);
    expect(() => generate({ "mods/menu/main.js": menu.replace(anchor, "") })).toThrow(/recipe spaces-tree:/);
  });
});

describe("comeback", () => {
  test("floats the comeback copy", () => {
    const copy = "nuoh-comeback";
    const generated = generate();
    const floating = JSON.parse(generated.layoutText).floating;
    expect(floating).toContainEqual({ id: "comeback", content: { mod: copy }, edge: "left", align: "end" });
    expect(floating.at(-1).id).toBe("sync");
    expect(generated.mods[copy]?.["logic.js"]).toContain("export function planPass");
  });
});

describe("markdown viewer", () => {
  test("installs the viewer without placing it", () => {
    const copy = "nuoh-markdown";
    const generated = generate();
    expect(Object.keys(generated.mods[copy] ?? {}).sort()).toEqual(["kit.js", "logic.js", "main.js", "mod.json", "open-markdown.js", "paths.js", "picker.js"]);
    expect(modsIn(JSON.parse(generated.layoutText))).not.toContain(copy);
  });
});

describe("markdown picker", () => {
  test("puts Open Markdown… on a terminal's menu, before Close pane", () => {
    const generated = generate();
    expect(generated.mods["nuoh-menu"]?.["main.js"]).toContain(
      '        ...(term ? [["Open Markdown…", "markdown-picker", { terminal: term.address, pane: tg.pane }]] : []),\n        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),',
    );
  });

  test("right-clicks a terminal into the layout's own menu", () => {
    expect(JSON.parse(generate().layoutText).terminal_menu).toBe("nuoh-menu");
  });

  test("the item opens the layout's own picker", () => {
    expect(generate().mods["nuoh-menu"]?.["main.js"]).toContain(
      'if (it[1] === "markdown-picker") openOverlay({ mod: "nuoh-markdown", kind: "popup", width: 560, height: 420, props: it[2] });\n    else if (it[1] === "move-tab")',
    );
  });

  test("the item has a file icon and shows the picker's key", () => {
    const menu = generate().mods["nuoh-menu"]?.["main.js"] ?? "";
    expect(menu).toContain('const MARKDOWN_PICKER = { name: "nuoh-markdown" };');
    expect(menu).toContain('function menuIcon(command, args) {\n  if (command === "markdown-picker") return "mods/workspace-chrome/file-text.svg";');
    expect(menu).toContain('  if (name === "markdown-picker") return keys().find((b) => b.action === `mod.open:${MARKDOWN_PICKER.name}`)?.keys ?? "";');
  });

  test("cmd-shift-o opens the picker", () => {
    expect(generate().keys["cmd-shift-o"]).toBe("mod.open:nuoh-markdown");
  });

  test("the key opens the picker at the top", () => {
    expect(meta(generate(), "markdown").overlay).toEqual({ kind: "popup", at: "top", offset: 40, width: 560, height: 420 });
    expect(generate().mods["nuoh-markdown"]?.["picker.js"]).not.toContain(".border_1().border_color(t.border)");
  });

  test("opening a file names the layout's own viewer", () => {
    expect(generate().mods["nuoh-markdown"]?.["open-markdown.js"]).toContain('export const MARKDOWN = { name: "nuoh-markdown" };');
  });

  test("a menu without Close pane fails the recipe", () => {
    const withoutPane = [
      'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";',
      '        ["Close", "space.close", { id: tg.id }],',
      "    closeOverlay(props()?.overlay);",
      '  const name = command.endsWith(".close") ? "x" : "terminal";',
      "",
    ].join("\n");
    expect(() => generate({ "mods/menu/main.js": withoutPane })).toThrow(/recipe markdown/);
  });
});

describe("files", () => {
  test("shows our Files in the panel", () => {
    const generated = generate();
    expect(findNode(JSON.parse(generated.layoutText), "files")?.content).toEqual({ mod: "nuoh-files" });
    const names = Object.keys(generated.mods["nuoh-files"] ?? {}).filter((name) => !name.startsWith("icons/"));
    expect(names.sort()).toEqual(["actions.js", "file-icons.js", "icon-rules.js", "kit.js", "logic.js", "main.js", "menu.js", "mod.json", "open-markdown.js", "paths.js"]);
  });

  test("installs the type icons unchanged, where the panel reads them", () => {
    const source = join(import.meta.dir, "../mods/files/icons");
    const svgs = readdirSync(source).filter((name) => name.endsWith(".svg"));
    const generated = generate();
    const files = generated.mods["nuoh-files"] ?? {};
    const icons = Object.keys(files).filter((name) => name.startsWith("icons/"));
    expect(icons.sort()).toEqual(svgs.map((name) => `icons/${name}`).sort());
    for (const name of svgs) expect(files[`icons/${name}`]).toBe(readFileSync(join(source, name), "utf8"));
    expect(files["logic.js"]).toContain('export const PACK = { name: "nuoh-files" };');
  });

  test("no copy of Herdr's Files is made", () => {
    const generated = generate();
    expect(generated.mods["nuoh-files"]?.["main.js"]).toContain("export default class Files extends View");
    expect(generated.mods["nuoh-files"]?.["main.js"]).not.toContain("div().rounded(10)");
  });

  test("the row menu is the panel's own popup", () => {
    expect(generate().mods["nuoh-files"]?.["main.js"]).toContain('openOverlay({ mod: "nuoh-files", kind: "popup", width: MENU_WIDTH');
  });

  test("a Markdown file opens the layout's own viewer", () => {
    expect(generate().mods["nuoh-files"]?.["open-markdown.js"]).toContain('export const MARKDOWN = { name: "nuoh-markdown" };');
  });

  test("a layout without a files block fails the recipe", () => {
    const home = tempDir();
    makeHerdrHome(home);
    const layout = JSON.parse(readFileSync(join(home, "layouts/main.json"), "utf8"));
    const body = findNode(layout, "panel-body") as Record<string, any>;
    body.children = body.children.filter((child: { id: string }) => child.id !== "files");
    expect(() => generate({ "layouts/main.json": JSON.stringify(layout) })).toThrow(/recipe files: layout node files not found/);
  });
});

describe("move-tab", () => {
  test("puts Move to… in the tab menu", () => {
    const copy = "nuoh-menu";
    const generated = generate();
    const menu = generated.mods[copy]?.["main.js"] ?? "";
    expect(menu).toContain('["Move to…", "move-tab", { tab: tg.id, space: tg.space }],\n        ["Close", "tab.close", { id: tg.id }],');
    expect(menu).toContain('command === "worktree" || command === "move-tab" ? "git-branch"');
  });

  test("the menu opens the layout's own popup", () => {
    expect(generate().mods["nuoh-menu"]?.["main.js"]).toContain('if (it[1] === "move-tab") openOverlay({ mod: "nuoh-move-tab", kind: "popup", width: 300, height: 320, props: it[2] });\n    else if (it[1] === "worktree")');
  });

  test("floats the worker", () => {
    const copy = "nuoh-move-tab";
    const generated = generate();
    expect(JSON.parse(generated.layoutText).floating).toContainEqual({ id: "move-tab", content: { mod: copy, props: { role: "worker" } }, edge: "left", align: "end" });
  });

  test("installs the script that schedules a move", () => {
    const script = readFileSync(join(import.meta.dir, "../mods/move-tab/schedule.sh"), "utf8");
    expect(generate().mods["nuoh-move-tab"]?.["schedule.sh"]).toBe(script);
  });

  test("cmd-shift-m opens the layout's own popup", () => {
    expect(generate().keys["cmd-shift-m"]).toBe("mod.open:nuoh-move-tab");
  });

  test("the menu shows the key bound to the layout's own popup", () => {
    const menu = "nuoh-menu";
    const popup = "nuoh-move-tab";
    const generated = generate();
    const text = generated.mods[menu]?.["main.js"] ?? "";
    expect(text).toContain(`const MOVE_TAB = { name: "${popup}" };\n\nfunction menuIcon(command, args) {`);
    expect(text).toContain('function shortcut(name, args) {\n  if (name === "move-tab") return keys().find((b) => b.action === `mod.open:${MOVE_TAB.name}`)?.keys ?? "";\n');
  });

  test("the key opens the popup at the menu's size", () => {
    expect(JSON.parse(generate().mods["nuoh-move-tab"]?.["mod.json"] ?? "{}").overlay).toEqual({ kind: "popup", width: 300, height: 320 });
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
    expect(() => generate({ "mods/menu/main.js": onlyFolders })).toThrow(/recipe move-tab/);
  });

  test("the tab bar starts a drag", () => {
    const tabs = "nuoh-tabs";
    const generated = generate();
    const text = generated.mods[tabs]?.["main.js"] ?? "";
    expect(text).toContain('import { spaces, panes, run, openOverlay, theme, window, shared, layout, settings, setShared } from "herdr";');
    expect(text).toContain(
      '.on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; this.from = e.position; setShared("move-tab.drag", { tab: c.id, space: space.id, at: Date.now() });',
    );
    expect(text).toContain('.on_mouse_up("left", () => { this.pressed = null; if (shared("move-tab.drag")) setShared("move-tab.drag", null); })');
  });

  test("the tab bar marks a drag once the pointer moves 4 px, fades the dragged tab and outlines the tab it would land on", () => {
    const tabs = "nuoh-tabs";
    const generated = generate();
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
  });

  test("a tab reorders only while the bar's own drag is set", () => {
    const tabs = "nuoh-tabs";
    const generated = generate();
    const text = generated.mods[tabs]?.["main.js"] ?? "";
    expect(text).toContain('const from = shared("move-tab.drag") ? this.pressed : null; this.pressed = null;');
    expect(text).not.toContain("const from = this.pressed;");
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
      expect(() => generate({ "mods/tabs/main.js": tabs.replace(anchor, "") })).toThrow(/recipe move-tab:/);
    }
  });
});
