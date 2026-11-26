import { CARD_LINE, GAP, HIDDEN_LINE, PANE_RADIUS } from "./frame";
import { findNode, type LayoutNode, type Recipe } from "./recipe";

const CARD = { background: "surface", border: { width: 1, color: CARD_LINE }, radius: PANE_RADIUS, shadow: "md" };

export const nuohCards: Recipe = {
  name: "nuoh-cards",
  mods: [{ name: "agent-list", from: "repo" }],
  apply({ layout }) {
    const lists = findNode(layout, "sidebar-lists");
    delete lists.background;
    Object.assign(lists, { gap: GAP, divider: { width: 1, color: HIDDEN_LINE, hover: "accent" } });
    const spaces = findNode(lists, "spaces");
    const content = spaces.content as LayoutNode;
    Object.assign(spaces, CARD, { content: { ...content, props: { ...(content.props as LayoutNode | undefined), card: true } } });
    Object.assign(findNode(lists, "agents"), CARD, { content: { mod: "agent-list" } });
  },
};
