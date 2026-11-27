import { focused, panes, run, setShared } from "herdr";

export const MARKDOWN = { name: "markdown" };
export const REQUEST = "markdown.request";

export function viewerIn(tab, list) {
  const inTab = list.filter((pane) => pane.tab === tab);
  const viewer = inTab.find((pane) => pane.mod === MARKDOWN.name);
  if (!viewer) return null;
  return inTab.some((pane) => pane.zoomed && pane !== viewer) ? null : viewer;
}

export function openMarkdown(file, { pane } = {}) {
  const list = panes();
  const from = pane ? list.find((candidate) => candidate.pane === pane) : null;
  const tab = focused()?.tab ?? from?.tab ?? null;
  const viewer = tab && (!from || from.tab === tab) ? viewerIn(tab, list) : null;
  if (viewer) {
    setShared(REQUEST, { file, tab, at: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    run(`${MARKDOWN.name}.show`);
    return "shown";
  }
  run("pane.split", { direction: "right", ...(from ? { pane: from.pane } : {}), mod: MARKDOWN.name, props: { file } });
  return "split";
}
