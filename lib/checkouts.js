export function base(path) {
  return path.replace(/\/+$/, "").split("/").pop() ?? "";
}

export function parseWorktrees(text) {
  const out = [];
  for (const block of (text ?? "").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
    if (!path || lines.some((line) => line === "bare" || line.startsWith("prunable"))) continue;
    const branch = lines.find((line) => line.startsWith("branch "))?.slice(7).replace(/^refs\/heads\//, "") ?? null;
    out.push({ path, branch, main: out.length === 0 });
  }
  return out;
}

export function checkoutOf(folder, checkouts) {
  let best = null;
  for (const checkout of checkouts) {
    const path = checkout.path.replace(/\/+$/, "");
    if ((folder === path || folder.startsWith(`${path}/`)) && (!best || path.length > best.path.length)) best = checkout;
  }
  return best;
}

export function placeOf(space, panes) {
  const tabs = new Set((space.tabs ?? []).map((tab) => tab.id));
  const pane = panes.find((candidate) => tabs.has(candidate.tab) && candidate.cwd);
  return pane?.cwd ?? space.folder ?? null;
}
