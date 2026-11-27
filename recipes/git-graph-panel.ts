import { type Copy, exact, findNode, type LayoutNode, type ModSource, PREFIX, type Recipe } from "./recipe";

export const GIT_GRAPH: ModSource = { name: "git-graph", from: "repo" };
export const GRAPH_RADIUS = ".rounded(paneFrame(layout())?.radius ?? 0)";

const ICONS = "mods/git-graph/icons/";
const CHANGES_BUTTON = '.when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))';

export const gitGraphPanel: Recipe = {
  name: "git-graph-panel",
  mods: [{ name: "tabs", from: "mods" }, GIT_GRAPH],
  apply({ copies, layout }) {
    const tabs = copies.tabs as Copy;
    const icons = ICONS.replace("git-graph", `${PREFIX}git-graph`);
    exact(copies[GIT_GRAPH.name] as Copy, ICONS, icons);
    exact(
      tabs,
      'const enabled = shared("workspace.panels") ?? ["files", "changes"];',
      'const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "graph"];',
    );
    exact(tabs, CHANGES_BUTTON, `${CHANGES_BUTTON}\n      .child(panelButton("graph", "Graph", "${icons}graph.svg"))`);
    const panel = findNode(layout, "panel-body");
    (panel.children as LayoutNode[]).push({ id: "graph", type: "block", content: { mod: GIT_GRAPH.name } });
  },
};
