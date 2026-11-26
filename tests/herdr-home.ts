import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const script = (body: string) => `import { View } from "gpui-kit";\nexport default class Mod extends View {\n  render() {\n${body}\n  }\n}\n`;

const LAYOUT = {
  id: "root",
  type: "row",
  titlebar: "none",
  divider: { width: 1, color: "border" },
  children: [
    {
      id: "sidebar",
      type: "column",
      background: "chrome",
      children: [
        { id: "brand", type: "block", content: { mod: "workspace-chrome" } },
        {
          id: "sidebar-lists",
          type: "column",
          children: [
            { id: "spaces", type: "block", content: { mod: "spaces" } },
            { id: "agents", type: "block", content: { mod: "agents" } },
          ],
        },
        { id: "sidebar-footer", type: "block", content: { mod: "workspace-chrome", props: { footer: true } } },
      ],
    },
    {
      id: "work",
      type: "column",
      children: [
        { id: "tabs", type: "block", size: { px: 42 }, window_drag: true, content: { mod: "tabs" } },
        {
          id: "work-body",
          type: "row",
          padding: 8,
          gap: 8,
          children: [
            {
              id: "main",
              type: "block",
              content: { tab: "active", pane: { radius: 10, header: { content: { mod: "pane" }, height: 30 } } },
            },
            {
              id: "panel",
              type: "column",
              hidden: true,
              children: [
                {
                  id: "panel-body",
                  type: "stack",
                  active: "files",
                  children: [
                    { id: "files", type: "block", content: { mod: "files" } },
                    { id: "changes", type: "block", content: { mod: "changes" } },
                  ],
                },
              ],
            },
          ],
        },
        { id: "status", type: "block", content: { mod: "workspace-status" } },
      ],
    },
  ],
};

const SOURCES: Record<string, string> = {
  "mods/tabs/main.js": `import { View } from "gpui-kit";
import { spaces, panes, run, openOverlay, theme, window, shared, layout, settings } from "herdr";
export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  render() {
    const t = theme();
    this.syncPanel(space, panel, body, enabled);
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    const context = () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab" } });
    const add = () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 });
    const space = spaces().find(p => p.active);
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    const lightsPadding = w?.platform === "macos" && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const item = (c, i) => h_flex().id(\`tab-\${c.id}\`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); });
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(\`panel-\${id}\`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .on_click(() => run("layout.show", { id: "panel" })).child(svg(icon).size(14)).child(label);
    };
    const release = (c, i) => { const from = this.pressed; this.pressed = null; if (from !== null && from !== i) run("tab.move", { id: c.id }); };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border).rounded(7)
      .on_mouse_up("left", () => { this.pressed = null; })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().track_scroll(this.scroll).children([]))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .child(div().size(6).rounded(3))
      .when(w?.buttons, el => el.child(button("close-window", "x", () => run("window.close"))));
  }
}
`,
  "mods/workspace-chrome/main.js": script(`    const fold = () => run("layout.resize", { id: "sidebar", px: window()?.platform === "macos" ? 76 : 44 });
    return div().rounded(6)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .child(row("machine", () => run("mod.open", { name: "machine-add" })))
      .child(row("search", () => run("mod.open", { name: "picker" })))
      .child(row("settings", () => run("app.settings")))
      .child(div().size(6).rounded_full())
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), toggleSidebar)));`),
  "mods/spaces/main.js": script(`    const open = () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: {} });
    return div().rounded(8).child(status === "done" ? "●" : "·");`),
  "mods/agents/main.js": script(`    const sort = () => openOverlay({ mod: "agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } });
    return v_flex().bg(t.popover).rounded(8).child(div().rounded_bl(6));`),
  "mods/files/main.js": script("    return div().rounded(10);"),
  "mods/changes/main.js": script("    return div().rounded(10);"),
  "mods/workspace-status/main.js": script(`    return div().rounded(3).on_click(() => run("app.palette"));`),
  "mods/pane/main.js": script("    return div().rounded(4);"),
  "mods/menu/main.js": 'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";\n' + script(`    const tree = () => openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: {} });
    const items = [
        ["Split right", "pane.split", { direction: "right", pane: tg.pane }],
        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),
        ["Close", "tab.close", { id: tg.id }],
        ["Close", "space.close", { id: tg.id }],
    ];
  const name = command.endsWith(".close") ? "x" : "terminal";
    const icon = command === "worktree" ? "git-branch" : "terminal";
    closeOverlay(props()?.overlay);
    function menuIcon(command, args) {
      return icon;
    }
    function shortcut(name, args) {
      return "";
    }
    if (it[1] === "worktree") tree();
    else run(it[1], it[2]);
    return v_flex().bg(t.popover).rounded(7);`),
  "mods/new-menu/main.js": script(`    const tree = () => openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: {} });
    return v_flex().bg(t.popover).rounded(7);`),
  "mods/picker/main.js": script(`    return v_flex().bg(t.popover).rounded(9).child(st === "idle" ? "○" : st ? "●" : "·");`),
  "mods/worktree/main.js": script(`    if (open) return v_flex().bg(t.popover).rounded(6);
    return v_flex().bg(t.popover).rounded(7);`),
  "mods/machine-add/main.js": script(`    return v_flex().bg(t.popover).rounded(8);`),
  "mods/help/main.js": script(`    return v_flex().bg(t.popover).rounded(9);`),
  "frame/palette/main.js": script(`    const placeholder = "Type a command…";
    const named = [
      ["mod.open", { name: "picker" }, "Tab", "Go to space or tab…", "switch"],
      ["app.settings", {}, "App", "Settings", "preferences"],
      ["app.help", {}, "App", "Keys", "keybindings"],
    ];
    const hidden = new Set([
      "app.palette", "app.hide", "app.show_all",
    ]);
    for (const { name, light } of themes()) list.push({ name: "app.theme", args: { name } });
    for (const { section, keys, action } of bound) {
      if (section !== "global") continue;
      if (action === want) return keys;
    }
    const clone = () => openOverlay({ mod: "prompt", kind: "dialog", width: 380, props: {} });
    return v_flex().bg(t.popover).rounded(9);`),
  "frame/settings/main.js": `import { View } from "gpui-kit";
import { layouts, shared, appHome, props } from "herdr";
export default class Mod extends View {
  render() {
    const add = () => run("mod.open", { name: "machine-add" });
    const look = v_flex()
      .child(this.layoutPicker(t, cx))
      .child(this.heading(t, "Theme"));
    return h_flex().id("settings").rounded(8).bg(t.popover);
  }
}
`,
  "frame/settings/release-notes.js": "export const notes = () => div().rounded(4);\n",
};

const META: Record<string, Record<string, unknown>> = {
  picker: { place: "none", title: "Picker", overlay: { kind: "popup", at: "top", offset: 40, width: 640, height: 0.8 } },
  "machine-add": { place: "none", title: "Add a machine", overlay: { kind: "dialog", width: 560 } },
};

const FOLDERS = [...new Set(Object.keys(SOURCES).map(dirname))];

export const SHIPPED_MODS = FOLDERS.filter((folder) => folder.startsWith("mods/")).map((folder) => folder.slice("mods/".length));

function write(home: string, path: string, text: string): void {
  mkdirSync(dirname(join(home, path)), { recursive: true });
  writeFileSync(join(home, path), text);
}

export function makeHerdrHome(home: string, overrides: Record<string, string> = {}): void {
  write(home, "layouts/main.json", `${JSON.stringify(LAYOUT, null, 2)}\n`);
  for (const [path, text] of Object.entries(SOURCES)) write(home, path, text);
  for (const folder of FOLDERS) {
    const name = folder.split("/").at(-1) as string;
    write(home, `${folder}/mod.json`, `${JSON.stringify(META[name] ?? { place: "none" })}\n`);
    write(home, `${folder}/gpui-kit.d.ts`, "declare const kit: unknown;\n");
    write(home, `${folder}/jsconfig.json`, "{}\n");
  }
  write(home, "mods/tabs/win-close.svg", "<svg/>\n");
  write(home, "themes/vjr.json", "{}\n");
  write(
    home,
    "keys.json",
    `${JSON.stringify(
      {
        global: {
          "cmd-t": "tab.new",
          "cmd-p": "mod.open:picker",
          "cmd-shift-p": "app.palette",
          "cmd-,": "app.settings",
          "cmd-/": "app.help",
          "cmd-shift-/": "app.help",
        },
        terminal: { "alt-left": "send:\u001bb" },
      },
      null,
      2,
    )}\n`,
  );
  const installed = Object.fromEntries(SHIPPED_MODS.map((name) => [name, { "main.js": "hash" }]));
  write(home, "installed.json", `${JSON.stringify({ ...installed, "layout:main": { "main.json": "hash" } })}\n`);
  for (const [path, text] of Object.entries(overrides)) write(home, path, text);
}
