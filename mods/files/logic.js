export const PER_FOLDER = 500;
export const TOTAL = 5000;
export const MATCHES = 200;
export const PREVIEW_CHARS = 400000;

const IGNORED_MARK = ":ignored:";
const MARKDOWN = /\.(md|markdown|mdx)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|heic|tiff?)$/i;
const DOCUMENT = /\.(pdf|docx?|xlsx?|pptx?|key|numbers|pages|zip|tar|gz|tgz|dmg|mp3|mp4|mov|wav)$/i;
const LANGUAGES = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", jsonc: "json", toml: "yaml", yml: "yaml", svelte: "html", vue: "html", htm: "html", sh: "bash", zsh: "bash" };
const SEVERITY = { added: 1, deleted: 2, modified: 3, conflict: 4 };
const LETTER = { added: "A", deleted: "D", modified: "M", conflict: "C" };

export const LIST =
  'cd "$1" 2>/dev/null || exit 1; for f in .[!.]* ..?* *; do ' +
  '{ [ -e "$f" ] || [ -L "$f" ]; } || continue; [ "$f" = .git ] && continue; ' +
  'if [ -d "$f" ]; then printf "d\\0%s\\0" "$f"; else printf "f\\0%s\\0" "$f"; fi; done; :';

export const GIT_STATE =
  'top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0; cd "$top" || exit 0; printf "%s\\0" "$top"; ' +
  "git --no-optional-locks -c core.fsmonitor=false status --porcelain=v1 -z --no-renames --untracked-files=all 2>/dev/null; " +
  `printf "${IGNORED_MARK}\\0"; ` +
  "git --no-optional-locks ls-files --others --ignored --exclude-standard --directory -z 2>/dev/null; :";

export const ALL_FILES =
  'top=$(git rev-parse --show-toplevel 2>/dev/null); if [ -n "$top" ]; then cd "$top" || exit 1; printf "%s\\n" "$top"; ' +
  "git --no-optional-locks ls-files --cached --others --exclude-standard; " +
  'else pwd; find . -maxdepth 6 -type f -not -path "*/.git/*" -not -path "*/node_modules/*" 2>/dev/null | sed "s#^\\./##" | head -n 20000; fi';

export function nameOf(path) {
  return String(path).replace(/\/+$/, "").split("/").pop() || String(path);
}

export function folderOf(path) {
  const trimmed = String(path).replace(/\/+$/, "");
  const cut = trimmed.lastIndexOf("/");
  return cut > 0 ? trimmed.slice(0, cut) : cut === 0 ? "/" : "";
}

export function join(root, relative) {
  return relative ? `${root.replace(/\/+$/, "")}/${relative}` : root;
}

export function relativeTo(path, root) {
  if (path === root) return "";
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null;
}

export function shortFolder(path, home) {
  if (home && path === home) return "~";
  if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export function parseEntries(stdout) {
  const fields = String(stdout ?? "").split("\0");
  const entries = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    if (fields[index + 1]) entries.push({ name: fields[index + 1], dir: fields[index] === "d" });
  }
  return entries.sort((a, b) => Number(b.dir) - Number(a.dir) || byName(a.name, b.name));
}

function kindOfStatus(xy) {
  if (xy === "??") return "added";
  if (xy.includes("U") || xy === "AA" || xy === "DD") return "conflict";
  if (xy.includes("D")) return "deleted";
  if (xy.includes("A")) return "added";
  return "modified";
}

export function parseGitState(stdout) {
  const fields = String(stdout ?? "").split("\0");
  const top = fields[0] || null;
  const marks = new Map();
  const ignored = new Set();
  let inIgnored = false;
  for (const field of fields.slice(1)) {
    if (!field) continue;
    if (field === IGNORED_MARK) {
      inIgnored = true;
      continue;
    }
    if (inIgnored) ignored.add(field.replace(/\/+$/, ""));
    else if (field.length > 3) marks.set(field.slice(3), kindOfStatus(field.slice(0, 2)));
  }
  return { top, marks, ignored, folders: rollUp(marks) };
}

export function rollUp(marks) {
  const folders = new Map();
  for (const [path, kind] of marks) {
    let folder = folderOf(path);
    while (folder && folder !== "/") {
      const current = folders.get(folder);
      if (!current || SEVERITY[kind] > SEVERITY[current]) folders.set(folder, kind);
      folder = folderOf(folder);
    }
  }
  return folders;
}

export function statusOf(relative, dir, git) {
  if (!git) return null;
  return (dir ? git.folders.get(relative) : git.marks.get(relative)) ?? null;
}

export function letterOf(kind) {
  return LETTER[kind] ?? "";
}

export function isIgnored(relative, git) {
  if (!git || git.ignored.size === 0) return false;
  let path = relative;
  while (path) {
    if (git.ignored.has(path)) return true;
    path = folderOf(path);
  }
  return false;
}

export function kindOfFile(name) {
  if (MARKDOWN.test(name)) return "markdown";
  if (IMAGE.test(name)) return "image";
  if (DOCUMENT.test(name)) return "document";
  return "text";
}

export function iconOf(name, dir, open) {
  if (dir) return open ? "folder-open" : "folder";
  const kind = kindOfFile(name);
  if (kind === "markdown") return "file-text";
  if (kind === "image") return "image";
  return "file";
}

export function languageOf(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "text";
  const extension = name.slice(dot + 1).toLowerCase();
  return LANGUAGES[extension] ?? extension;
}

export function previewText(text) {
  if (text.includes("\0")) return null;
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}\n… (file truncated)` : text;
}

export function treeRows(entries, open) {
  const rows = [];
  let limited = false;
  const walk = (folder, depth) => {
    for (const entry of entries.get(folder) ?? []) {
      if (rows.length >= TOTAL) {
        limited = true;
        return;
      }
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      const isOpen = entry.dir && open.has(path);
      rows.push({ path, name: entry.name, dir: entry.dir, depth, open: isOpen });
      if (isOpen) walk(path, depth + 1);
    }
  };
  walk("", 0);
  return { rows, limited };
}

export function changedRows(git) {
  if (!git) return [];
  const children = new Map();
  const add = (folder, entry) => {
    const list = children.get(folder) ?? [];
    if (!list.some((item) => item.name === entry.name)) list.push(entry);
    children.set(folder, list);
  };
  for (const path of git.marks.keys()) {
    add(folderOf(path), { name: nameOf(path), dir: false });
    let folder = folderOf(path);
    while (folder && folder !== "/") {
      add(folderOf(folder), { name: nameOf(folder), dir: true });
      folder = folderOf(folder);
    }
  }
  for (const list of children.values()) list.sort((a, b) => Number(b.dir) - Number(a.dir) || byName(a.name, b.name));
  return treeRows(children, new Set(git.folders.keys())).rows;
}

export function parseAllFiles(stdout) {
  const [root, ...rest] = String(stdout ?? "").split("\n");
  return { root: root || null, files: rest.filter(Boolean) };
}

export function matches(files, query, limit = MATCHES) {
  const words = String(query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const ranked = [];
  for (const path of files) {
    const lower = path.toLowerCase();
    if (!words.every((word) => lower.includes(word))) continue;
    const name = nameOf(lower);
    const first = words[0];
    const rank = name.startsWith(first) ? 0 : name.includes(first) ? 1 : 2;
    ranked.push({ path, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.path.length - b.path.length || byName(a.path, b.path));
  return ranked.slice(0, limit).map(({ path }) => path);
}

export function clampEntries(entries, used) {
  const room = Math.max(0, Math.min(PER_FOLDER, TOTAL - used));
  return { kept: entries.slice(0, room), limited: entries.length > room };
}

export function menuItems({ dir, markdown, editor }) {
  const items = [];
  if (markdown) items.push({ id: "open", label: "Open beside", icon: "file-text" });
  items.push({ id: "editor", label: editor ? `Open in ${editor}` : "Open with default app", icon: "external-link" });
  if (dir) items.push({ id: "terminal", label: "New terminal here", icon: "terminal" });
  items.push({ id: "reveal", label: "Reveal in Finder", icon: "folder-open" });
  items.push({ id: "copy", label: "Copy path", icon: "copy" });
  items.push({ id: "copy-relative", label: "Copy relative path", icon: "copy" });
  return items;
}
