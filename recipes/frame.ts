import { WORKSPACE } from "./rail";
import { type Copy, exact, findNode, type LayoutNode, pattern, type Recipe, RecipeError } from "./recipe";

export const GAP = 8;
export const BAND_PX = 46;
export const MACHINE_PX = 160;
export const TRAFFIC_LIGHTS = [18, 24];
export const GRADIENT = { gradient: ["#181818", "#0D0D0D"], angle: 180 };
export const CARD_LINE = "#FFFFFF12";
export const FOCUS_LINE = "#FFC799B3";
export const HIDDEN_LINE = "#00000000";
export const RAIL_RADIUS = 16;
export const PANE_RADIUS = 14;
export const GONE = ["brand", "sidebar-footer", "status"];
const UNUSED_COPIES = ["workspace-chrome", "workspace-status"];

const BAR = ".px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)";
const TAB_SIZE = ".h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)";
const TAB_LOOK = ".border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome)";
const PANEL_BUTTON = "h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)";
const PANEL_LABEL = ".child(svg(icon).size(14)).child(label);";
const BUTTON_FILL = /\.bg\(on \? t\.selected : t\.chrome\)/g;

const topbar = (role: string): LayoutNode => ({ mod: "topbar", props: { role } });

function parentOf(node: LayoutNode, id: string): LayoutNode | null {
  for (const child of (node.children as LayoutNode[] | undefined) ?? []) {
    if (child.id === id) return node;
    const found = parentOf(child, id);
    if (found) return found;
  }
  return null;
}

function replaceNode(root: LayoutNode, id: string, next: LayoutNode | null): void {
  const parent = parentOf(root, id);
  if (!parent) throw new RecipeError(`layout node ${id} not found`);
  const children = parent.children as LayoutNode[];
  const at = children.findIndex((child) => child.id === id);
  if (next) children.splice(at, 1, next);
  else children.splice(at, 1);
}

function frameRail(layout: LayoutNode): void {
  const rail = findNode(layout, "rail");
  const card: LayoutNode = { ...rail, background: "surface", border: { width: 1, color: CARD_LINE }, radius: RAIL_RADIUS, shadow: "md" };
  delete card.size;
  const lights = { id: "lights", type: "block", size: { px: BAND_PX }, window_drag: true, content: topbar("lights") };
  replaceNode(layout, "rail", { id: "rail-column", type: "column", size: rail.size, resizable: false, gap: GAP, children: [lights, card] });
}

function frameSidebar(layout: LayoutNode): void {
  const sidebar = findNode(layout, "sidebar");
  const lists = findNode(sidebar, "sidebar-lists");
  if ("background" in sidebar) {
    lists.background = sidebar.background;
    delete sidebar.background;
  }
  sidebar.gap = GAP;
  (sidebar.children as LayoutNode[]).unshift({ id: "space-title", type: "block", size: { px: BAND_PX }, window_drag: true, content: topbar("title") });
}

function frameWork(layout: LayoutNode): void {
  const work = findNode(layout, "work");
  work.gap = GAP;
  const tabs = { ...findNode(work, "tabs") };
  delete tabs.size;
  replaceNode(layout, "tabs", {
    id: "work-top",
    type: "row",
    size: { px: BAND_PX },
    resizable: false,
    window_drag: true,
    children: [tabs, { id: "machine", type: "block", size: { px: MACHINE_PX }, window_drag: true, content: topbar("machine") }],
  });
  delete findNode(work, "work-body").padding;
}

function framePanes(layout: LayoutNode): void {
  const content = findNode(layout, "main").content as LayoutNode | undefined;
  const pane = content?.pane as LayoutNode | undefined;
  if (!pane) throw new RecipeError("layout node main has no pane frame");
  Object.assign(pane, { radius: PANE_RADIUS, border: { width: 1, color: CARD_LINE }, focus: { width: 1, color: FOCUS_LINE } });
}

function frameTabs(tabs: Copy): void {
  exact(tabs, BAR, ".px(10).gap(3).items_center()");
  exact(tabs, TAB_SIZE, ".h(32).px(12).gap(8).rounded(9).items_center().flex_none().text_size(13)");
  exact(tabs, TAB_LOOK, ".border(1).when(c.active, el => el.border_color(t.border).bg(t.raised))");
  exact(tabs, PANEL_BUTTON, "h_flex().id(`panel-${id}`).h(28).px(7).gap(5).flex_none().items_center().rounded(8).tooltip(label)");
  exact(tabs, PANEL_LABEL, ".child(svg(icon).size(14));");
  pattern([tabs], BUTTON_FILL, ".when(on, el => el.bg(t.selected))", 1);
}

export const nuohFrame: Recipe = {
  name: "nuoh-frame",
  mods: [
    { name: "topbar", from: "repo" },
    { name: "tabs", from: "mods" },
  ],
  apply({ copies, layout }) {
    for (const id of GONE) replaceNode(layout, id, null);
    delete layout.divider;
    Object.assign(layout, { background: GRADIENT, padding: GAP, gap: GAP, traffic_lights: TRAFFIC_LIGHTS });
    Object.assign(findNode(layout, WORKSPACE), { gap: GAP, divider: { width: 1, color: HIDDEN_LINE, hover: "accent" } });
    frameRail(layout);
    frameSidebar(layout);
    frameWork(layout);
    framePanes(layout);
    frameTabs(copies.tabs as Copy);
    for (const name of UNUSED_COPIES) delete copies[name];
  },
};
