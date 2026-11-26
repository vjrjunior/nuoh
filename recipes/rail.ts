import { type Copy, exact, findNode, type LayoutNode, type Recipe, RecipeError } from "./recipe";

export const RAIL_PX = 68;
export const VIEWS = "views";
export const WORKSPACE = "workspace";
const TRAFFIC_LIGHTS = [14, 16];
const MOVED_TO_WORKSPACE = ["children", "divider", "gap", "padding", "resizable"];
const MAX_VIEW_KEYS = 9;

const LIGHTS_ROOM = ".when(window()?.platform === \"macos\" && !window()?.fullscreen && !collapsed, el => el.pl(76))";
const FOLDED_WIDTH = 'window()?.platform === "macos" ? 76 : 44';
const TOGGLE_ON_MAC =
  '.when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), toggleSidebar)));';
const TOGGLE = '.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), toggleSidebar));';
const TABS_LIGHTS = "- (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))";

export type RailView = { id: string; label: string; icon: string; key?: string };

export function railViews(layout: LayoutNode): RailView[] {
  const content = findNode(layout, "rail").content as LayoutNode;
  return (content.props as { views: RailView[] }).views;
}

export const rail: Recipe = {
  name: "rail",
  mods: [
    { name: "rail", from: "repo" },
    { name: "workspace-chrome", from: "mods" },
    { name: "tabs", from: "mods" },
  ],
  apply({ copies, layout }) {
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
      divider: { width: 1, color: "border" },
      traffic_lights: TRAFFIC_LIGHTS,
      children: [
        {
          id: "rail",
          type: "block",
          size: { px: RAIL_PX },
          background: "chrome",
          window_drag: true,
          content: { mod: "rail", props: { views: [{ id: WORKSPACE, label: "Workspace", icon: "terminal" }] } },
        },
        { id: VIEWS, type: "stack", active: WORKSPACE, children: [workspace] },
      ],
    });

    const chrome = copies["workspace-chrome"] as Copy;
    exact(chrome, LIGHTS_ROOM, "");
    exact(chrome, FOLDED_WIDTH, "44");
    exact(chrome, TOGGLE_ON_MAC, TOGGLE);
    exact(copies.tabs as Copy, TABS_LIGHTS, '- (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0) - (find(root, "rail")?.size?.px ?? 0))');
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
