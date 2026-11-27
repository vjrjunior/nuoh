export const SIDEBAR = "sidebar";
export const NARROW_BELOW = 160;

export function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function sidebarPx(root) {
  return findNode(root, SIDEBAR)?.size?.px ?? null;
}

export function isNarrow(root) {
  return (sidebarPx(root) ?? Infinity) < NARROW_BELOW;
}
