export const VIEWS = "views";
export const WORKSPACE = "workspace";

const URGENCY = ["blocked", "done", "working"];
const MAC_KEYS = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };

export function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function viewsOf(props) {
  const given = Array.isArray(props?.views) ? props.views : [];
  return given.filter((view) => view && typeof view.id === "string" && view.id !== "").map((view) => ({ id: view.id, label: view.label ?? view.id, icon: view.icon ?? "layers", key: view.key ?? null }));
}

export function shownView(root, views) {
  const stack = findNode(root, VIEWS);
  return stack?.active ?? stack?.children?.[0]?.id ?? views[0]?.id ?? null;
}

export function badgeOf(agents) {
  const statuses = new Set((agents ?? []).map((agent) => agent.status));
  return URGENCY.find((status) => statuses.has(status)) ?? null;
}

export function focusOf(focused) {
  if (!focused?.pane) return null;
  return { space: focused.space ?? null, tab: focused.tab ?? null, pane: focused.pane };
}

const sameFocus = (a, b) => a.space === b.space && a.tab === b.tab && a.pane === b.pane;

export function followFocus(last, now, { shown, paneIds }) {
  if (!now) return { last, back: false };
  if (!last || sameFocus(last, now)) return { last: now, back: false };
  const lastGone = !paneIds.includes(last.pane);
  return { last: now, back: shown !== WORKSPACE && !lastGone };
}

export function keyLabel(key, platform) {
  if (!key) return null;
  const parts = key.split("-");
  let last = parts.pop();
  if (last === "") {
    parts.pop();
    last = "-";
  }
  last = last.toUpperCase();
  if (platform === "macos") return `${parts.map((part) => MAC_KEYS[part] ?? part).join("")}${last}`;
  return [...parts.map((part) => part[0].toUpperCase() + part.slice(1)), last].join("+");
}

export function hint(label, key, platform) {
  const shown = keyLabel(key, platform);
  return shown ? `${label}  ${shown}` : label;
}

export function keyFor(bindings, actions) {
  for (const action of actions) {
    const found = (bindings ?? []).find((binding) => binding.action === action);
    if (found) return found.keys;
  }
  return null;
}
