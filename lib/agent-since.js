export const KEEP_DAYS = 30;
const DAY = 86400000;

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
