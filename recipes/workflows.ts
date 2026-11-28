import { BAND_PX, GAP } from "./frame";
import { VIEWS, WORKSPACE } from "./rail";
import { findNode, type LayoutNode, type Recipe, RecipeError } from "./recipe";

export const WORKFLOWS = "workflows";

export const workflowsView: Recipe = {
  name: "workflows-view",
  mods: [{ name: WORKFLOWS, from: "repo" }],
  apply({ layout, repo, bun }) {
    if (!repo || !bun) throw new RecipeError("the workflows view needs the repo and bun's path");
    const view = (role: string) => ({ mod: WORKFLOWS, props: { role, repo, bun } });
    const stack = findNode(layout, VIEWS).children as LayoutNode[];
    stack.splice(stack.findIndex((child) => child.id === WORKSPACE) + 1, 0, {
      id: WORKFLOWS,
      type: "column",
      gap: GAP,
      resizable: false,
      children: [
        { id: "workflows-bar", type: "block", size: { px: BAND_PX }, window_drag: true, content: view("bar") },
        { id: "workflows-body", type: "block", content: view("body") },
      ],
    });
    const views = (findNode(layout, "rail").content as { props: { views: { id: string }[] } }).props.views;
    views.splice(views.findIndex((entry) => entry.id === WORKSPACE) + 1, 0, { id: WORKFLOWS, label: "Workflows", icon: "route" });
  },
};
