import { findNode, type LayoutNode, type Recipe, RecipeError } from "./recipe";

const RAIL_PX = 54;
export const VIEWS = "views";
export const WORKSPACE = "workspace";
const MOVED_TO_WORKSPACE = ["children", "divider", "gap", "padding", "resizable"];
const MAX_VIEW_KEYS = 9;

type RailView = { id: string; label: string; icon: string; key?: string };

function railViews(layout: LayoutNode): RailView[] {
  const content = findNode(layout, "rail").content as LayoutNode;
  return (content.props as { views: RailView[] }).views;
}

export const rail: Recipe = {
  name: "rail",
  mods: [{ name: "rail", from: "repo" }],
  apply({ layout, keys }) {
    keys["cmd-shift-j"] = { mod: "rail", command: "waiting" };
    const workspace: LayoutNode = { id: WORKSPACE, type: layout.type };
    for (const field of MOVED_TO_WORKSPACE) {
      if (field in layout) {
        workspace[field] = layout[field];
        delete layout[field];
      }
    }
    Object.assign(layout, {
      type: "row",
      resizable: false,
      children: [
        {
          id: "rail",
          type: "block",
          size: { px: RAIL_PX },
          content: { mod: "rail", props: { views: [{ id: WORKSPACE, label: "Workspace", icon: "terminal" }] } },
        },
        { id: VIEWS, type: "stack", active: WORKSPACE, children: [workspace] },
      ],
    });
  },
};

export const railKeys: Recipe = {
  name: "rail-keys",
  mods: [],
  apply({ layout, keys }) {
    const views = railViews(layout);
    const children = ((findNode(layout, VIEWS).children as LayoutNode[] | undefined) ?? []).map((child) => child.id);
    if (views.length > MAX_VIEW_KEYS) throw new RecipeError(`the rail has ${views.length} views, and keys go up to ${MAX_VIEW_KEYS}`);
    views.forEach((view, index) => {
      if (!children.includes(view.id)) throw new RecipeError(`the rail shows ${view.id}, which ${VIEWS} does not have`);
      view.key = `ctrl-cmd-${index + 1}`;
      keys[view.key] = { command: "layout.select", args: { stack: VIEWS, child: view.id } };
    });
  },
};
