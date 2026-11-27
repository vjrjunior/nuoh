import { isNarrow, sidebarPx } from "../../lib/layout-tree.js";

export const ROLES = ["lights", "title", "machine"];
export const FOLDED_PX = 44;
export const OPEN_PX = 268;
export const THIS_COMPUTER = "This computer";

export function roleOf(props) {
  return ROLES.includes(props?.role) ? props.role : "lights";
}

export function foldSidebar(root, saved) {
  if (isNarrow(root)) return { save: null, collapsed: false, px: saved ?? OPEN_PX };
  return { save: sidebarPx(root), collapsed: true, px: FOLDED_PX };
}

export function shownSpace(spaces) {
  return (spaces ?? []).find((space) => space.active) ?? null;
}

export function branchOf(space, focused, panes) {
  if (!space) return null;
  const tabs = new Set((space.tabs ?? []).map((tab) => tab.id));
  const pane = focused?.pane ? (panes ?? []).find((one) => one.pane === focused.pane) : null;
  if (pane && tabs.has(pane.tab) && pane.branch) return pane.branch;
  return space.branch ?? null;
}

export function machineOf(space) {
  const name = space?.machine ?? null;
  return { label: name ?? THIS_COMPUTER, icon: name ? "server" : "monitor" };
}
