import { type Copy, exact, findNode, type LayoutNode, type ModSource, pattern, type Recipe } from "./recipe";

const POPOVER = ".bg(t.popover)";
const BORDER = ".border_1().border_color(t.border)";
const POPUP_ROOTS: Record<string, number> = {
  menu: 1,
  "new-menu": 1,
  picker: 1,
  worktree: 2,
  "machine-add": 1,
  help: 1,
  palette: 1,
  agents: 1,
  "git-graph": 4,
};
const FRAMELESS = ["picker", "machine-add", "menu", "palette"];

function squareCorner(_match: string, side?: string): string {
  return side === "_full" ? ".rounded(0)" : `.rounded${side ?? ""}(0)`;
}

const GRAPH_RADIUS = ".rounded(paneFrame(layout())?.radius ?? 0)";
const GIT_GRAPH: ModSource = { name: "git-graph", from: "repo" };

export function squareFor(recipes: Recipe[]): Recipe {
  const own = new Map<string, ModSource>([[GIT_GRAPH.name, GIT_GRAPH]]);
  for (const source of recipes.flatMap((recipe) => recipe.mods)) {
    if (source.from === "repo" && !own.has(source.name)) own.set(source.name, source);
  }
  const popupRoots = { ...POPUP_ROOTS };
  const frameless = [...FRAMELESS];
  for (const recipe of recipes) {
    Object.assign(popupRoots, recipe.square?.popupRoots ?? {});
    frameless.push(...(recipe.square?.frameless ?? []));
  }
  const ownMods = [...own.keys()];
  return {
    name: "square",
    mods: [
      ...["workspace-chrome", "agents", "files", "changes", "pane", "menu", "new-menu", "picker", "worktree", "machine-add", "help"].map(
        (name) => ({ name, from: "mods" as const }),
      ),
      { name: "settings", from: "frame" },
      ...own.values(),
    ],
    apply({ copies, layout, replacements }) {
      const all = Object.values(copies);
      const corners = /\.rounded(_[a-z]+)?\([^()]*\)/g;
      const copy = (name: string) => copies[name] as Copy;

      pattern(
        all.filter((mod) => !ownMods.includes(mod.name)),
        corners,
        squareCorner,
        1,
      );
      pattern(ownMods.map(copy), corners, squareCorner);
      exact(copy(GIT_GRAPH.name), GRAPH_RADIUS, ".rounded(0)");
      pattern(all, /●/g, "■");
      pattern(all, /○/g, "□");
      pattern(all, /openOverlay\(\{ mod: "([a-z-]+)", kind: "(?:popup|dialog)",/g, (whole, name) =>
        Object.hasOwn(copies, name as string) ? `${whole} frame: "none",` : whole,
      );

      for (const [name, count] of Object.entries(popupRoots)) exact(copy(name), POPOVER, `${POPOVER}${BORDER}`, count);
      exact(copy("settings"), '.id("settings")', `.id("settings")${POPOVER}${BORDER}`);

      exact(copy("workspace-chrome"), 'run("app.settings")', 'run("mod.open", { name: "settings" })');
      exact(copy("palette"), '["app.settings", {}, "App", "Settings"', '["mod.open", { name: "settings" }, "App", "Settings"');
      exact(copy("palette"), '["app.help", {}, "App", "Keys"', '["mod.open", { name: "help" }, "App", "Keys"');
      exact(copy("palette"), '  "app.palette", "app.hide",', '  "app.palette", "app.help", "app.hide",');
      pattern([copy("menu")], /else run\(it\[1\], it\[2\]\);/g, 'else if (it[1] === "app.help") run("mod.open", { name: "help" });\n    else run(it[1], it[2]);');

      for (const name of frameless) copy(name).meta.overlay = { ...(copy(name).meta.overlay as object | undefined), frame: "none" };
      copy("help").meta.overlay = { kind: "dialog", width: 520, height: 0.7, frame: "none" };
      copy("settings").meta.overlay = { kind: "dialog", width: 880, height: 620, frame: "none" };

      const content = findNode(layout, "main").content as LayoutNode;
      (content.pane as LayoutNode).radius = 0;
      layout.terminal_menu = "menu";

      replacements["app.settings"] = "settings";
      replacements["app.help"] = "help";
      replacements["mod.open:picker"] = "picker";
    },
  };
}
