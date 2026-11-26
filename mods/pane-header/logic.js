import { cleanTitle } from "../../lib/agent-title.js";

export const NARROW_BELOW = 320;

export function paneTitle(pane) {
  if (pane?.name) return pane.name;
  const live = cleanTitle(pane?.title);
  if (live && live !== pane?.terminal) return live;
  return pane?.program?.name || "shell";
}

export function folderLabel(cwd, home) {
  if (!cwd) return "";
  if (!home) return cwd;
  if (cwd === home) return "~";
  return cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
}

export function showsZoom(pane, all) {
  if (pane?.zoomed) return true;
  return (all ?? []).filter((other) => other.tab === pane?.tab).length > 1;
}

export function isNarrow(width, zoom) {
  if (width == null) return false;
  return width / (zoom || 1) < NARROW_BELOW;
}
