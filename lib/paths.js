export const MARKDOWN_FILE = /\.(md|markdown|mdx)$/i;

export function nameOf(path) {
  return String(path).replace(/\/+$/, "").split("/").pop() || String(path);
}

export function folderOf(path) {
  const trimmed = String(path).replace(/\/+$/, "");
  const cut = trimmed.lastIndexOf("/");
  return cut > 0 ? trimmed.slice(0, cut) : cut === 0 ? "/" : "";
}

export function shortFolder(path, home) {
  if (home && path === home) return "~";
  if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}
