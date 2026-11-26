import { cleanTitle, tellingTitle } from "../../lib/agent-title.js";

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
export const SORTS = [
  { id: "priority", label: "Priority", icon: "list" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
export const SORT_KEY = "agents.sort";
export const NARROW_BELOW = 160;
export const KEEP_DAYS = 30;
const DAY = 86400000;

export function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function isNarrow(root) {
  return (findNode(root, "sidebar")?.size?.px ?? Infinity) < NARROW_BELOW;
}

export function sortOf(value) {
  return SORTS.find((sort) => sort.id === value) ?? SORTS[0];
}

const same = (a, b) => Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase();

function telling(text, agent) {
  if (!tellingTitle(text)) return false;
  if (text === agent.address || same(text, agent.program?.name) || same(text, agent.program?.key)) return false;
  return true;
}

export function agentTitle(agent, tab, crowded = false) {
  if (agent.pane_name) return agent.pane_name;
  if (!crowded && tab?.named && tab.name) return tab.name;
  const live = cleanTitle(agent.title);
  if (telling(live, agent)) return live;
  return agent.program?.name || tab?.name || agent.address;
}

export function machineOf(address) {
  const at = (address ?? "").indexOf("/");
  return at > 0 ? address.slice(0, at) : null;
}

export const settled = (status) => (status === "done" ? "idle" : status);

export function track(changed, list, now) {
  const next = { ...changed };
  let dirty = false;
  for (const agent of list) {
    const status = settled(agent.status);
    if (next[agent.address]?.s === status) continue;
    next[agent.address] = { s: status, at: now };
    dirty = true;
  }
  if (!dirty) return { changed, dirty: false };
  const listed = new Set(list.map((agent) => agent.address));
  for (const [address, stamp] of Object.entries(next)) {
    if (!listed.has(address) && now - stamp.at > KEEP_DAYS * DAY) delete next[address];
  }
  return { changed: next, dirty: true };
}

export function readChanged(text) {
  try {
    const value = JSON.parse(text ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function ago(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function kidStatus(kid, listed) {
  if (listed.has(kid.address)) return listed.get(kid.address);
  if (kid.status === "error") return "blocked";
  return settled(kid.status);
}

export function subTree(terminals, address, lead = []) {
  const kids = terminals.filter((kid) => kid.parent === address && kid.state === "live");
  return kids.flatMap((kid, index) => {
    const last = index === kids.length - 1;
    return [{ terminal: kid, lines: [...lead, last ? "└" : "├"] }, ...subTree(terminals, kid.address, [...lead, last ? "" : "│"])];
  });
}

export function mostUrgent(statuses) {
  return statuses.reduce((top, status) => ((RANK[status] ?? 0) > (RANK[top] ?? 0) ? status : top), null);
}

export function urgencyOf(agent, kids, listed) {
  const own = RANK[agent.status] ?? 0;
  return Math.max(own, ...kids.map((kid) => RANK[settled(kidStatus(kid.terminal, listed))] ?? 0));
}

export function arrange(agents, terminals, { sort, since, narrow = false }) {
  const listed = new Map(agents.map((agent) => [agent.address, agent.status]));
  const trees = new Map(agents.map((agent) => [agent.address, narrow ? [] : subTree(terminals, agent.address)]));
  const nested = new Set([...trees.values()].flat().map((kid) => kid.terminal.address));
  const shown = agents.filter((agent) => agent.pinned || !nested.has(agent.address));
  const urgency = new Map(shown.map((agent) => [agent.address, urgencyOf(agent, trees.get(agent.address), listed)]));
  const ordered =
    sortOf(sort).id === "priority"
      ? [...shown].sort((a, b) => urgency.get(b.address) - urgency.get(a.address) || since(b) - since(a) || b.seq - a.seq)
      : shown;
  const rows = [...ordered.filter((agent) => agent.pinned), ...ordered.filter((agent) => !agent.pinned)];
  return { rows, trees, listed, urgency };
}

export function needsYou(rows, urgency) {
  return rows.filter((agent) => urgency.get(agent.address) === RANK.blocked).length;
}

export function crowdedTabs(agents) {
  const count = new Map();
  for (const agent of agents) count.set(agent.tab, (count.get(agent.tab) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([tab]) => tab));
}
