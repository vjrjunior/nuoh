import { CARD_LINE, GAP, HIDDEN_LINE, PANE_RADIUS } from "./frame";
import { GIT_GRAPH, GRAPH_RADIUS } from "./git-graph-panel";
import { type Copy, exact, findNode, type LayoutNode, type Recipe, RecipeError } from "./recipe";

const CARD = { background: "surface", border: { width: 1, color: CARD_LINE }, radius: PANE_RADIUS, shadow: "md" };
export const PANEL_INSET = 6;
export const WELL_RADIUS = 10;
export const VEIL = 0.4;
export const HEADER = { content: { mod: "pane-header" }, height: 42, position: "top", reveal: "always" };

const TAB_SCROLL = 'h_flex().id("tab-scroll").flex_1()';
const TAB_SCROLLBAR = ".overflow_x_scrollbar().track_scroll(this.scroll)";
const NEW_TAB = '.child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))';
const WINDOW_BUTTONS = ".when(w?.buttons,";
const PANEL_GROUP =
  '.child(div().flex_1())\n      .child(h_flex().id("panel-group").flex_none().gap(2).p(3).items_center().rounded(11).bg(t.surface).border_1().border_color(t.foreground + "12")';

function cardSidebar(layout: LayoutNode): void {
  const lists = findNode(layout, "sidebar-lists");
  delete lists.background;
  Object.assign(lists, { gap: GAP, divider: { width: 1, color: HIDDEN_LINE, hover: "accent" } });
  const spaces = findNode(lists, "spaces");
  const content = spaces.content as LayoutNode;
  Object.assign(spaces, CARD, { content: { ...content, props: { ...(content.props as LayoutNode | undefined), card: true } } });
  Object.assign(findNode(lists, "agents"), CARD, { content: { mod: "agent-list" } });
}

function cardPanes(layout: LayoutNode): void {
  const pane = (findNode(layout, "main").content as LayoutNode | undefined)?.pane as LayoutNode | undefined;
  if (!pane) throw new RecipeError("layout node main has no pane frame");
  Object.assign(pane, { background: "surface", shadow: "md", veil: VEIL, header: HEADER });
}

function cardPanels(layout: LayoutNode): void {
  const body = findNode(layout, "work-body");
  const children = (body.children as LayoutNode[] | undefined) ?? [];
  if (!children.some((child) => child.id === "main")) throw new RecipeError("layout node main is not in work-body");
  for (const child of children) if (child.id !== "main") Object.assign(child, CARD, { padding: PANEL_INSET });
}

function groupPanelButtons(tabs: Copy): void {
  exact(tabs, TAB_SCROLL, 'h_flex().id("tab-scroll").flex_initial()');
  exact(tabs, TAB_SCROLLBAR, ".overflow_x_scroll().track_scroll(this.scroll)");
  exact(tabs, NEW_TAB, `${NEW_TAB}\n      ${PANEL_GROUP}`);
  exact(tabs, WINDOW_BUTTONS, `)\n      ${WINDOW_BUTTONS}`);
}

export const nuohCards: Recipe = {
  name: "nuoh-cards",
  mods: [{ name: "agent-list", from: "repo" }, { name: "pane-header", from: "repo" }, { name: "tabs", from: "mods" }, GIT_GRAPH],
  apply({ copies, layout }) {
    cardSidebar(layout);
    cardPanes(layout);
    cardPanels(layout);
    groupPanelButtons(copies.tabs as Copy);
    exact(copies[GIT_GRAPH.name] as Copy, GRAPH_RADIUS, `.rounded(${WELL_RADIUS})`);
  },
};
