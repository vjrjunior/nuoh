import { folderOf, MARKDOWN_FILE, nameOf, shortFolder } from "../../lib/paths.js";

const WEB = /^(https?:|mailto:)/i;
const MARKDOWN = /\.(md|markdown)$/i;
const FENCE = /^(---|\.\.\.)\s*$/;

export function stripFrontMatter(text) {
  const lines = String(text ?? "").split("\n");
  if (lines[0]?.replace(/\r$/, "") !== "---") return text;
  const end = lines.findIndex((line, index) => index > 0 && FENCE.test(line.replace(/\r$/, "")));
  if (end < 0) return text;
  return lines.slice(end + 1).join("\n");
}

function normalize(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

export function linkTarget(file, url) {
  const raw = String(url ?? "").trim();
  if (WEB.test(raw)) return { kind: "web", url: raw };
  let path = raw.replace(/^file:\/\//i, "").replace(/[#?].*$/, "");
  if (!path) return { kind: "none" };
  try {
    path = decodeURIComponent(path);
  } catch {}
  const full = normalize(path.startsWith("/") ? path : `${folderOf(file)}/${path}`);
  return MARKDOWN.test(full) ? { kind: "markdown", path: full } : { kind: "file", path: full };
}

const MENTION = /[^\s`'"<>()[\]{}|│⎿●✻*,;]+?\.(?:md|markdown|mdx)(?![\w-])/giu;
const SCHEME = /^[a-z][\w+.-]*:\/\//i;
const ENDED = /\.(?:md|markdown|mdx)\W*$/i;
const BARE = /^[\w.-]+\.(?:md|markdown|mdx)$/i;
const LISTED = 12;
const PER_NAME = 2;
const FOLDER_CHARS = 36;

function tokens(text) {
  const out = [];
  for (const [match] of String(text).matchAll(MENTION)) {
    let path = match;
    if (SCHEME.test(path)) {
      if (!/^file:\/\//i.test(path)) continue;
      path = path.replace(/^file:\/\//i, "");
    } else if (path.includes(":")) path = path.slice(path.lastIndexOf(":") + 1);
    path = path.replace(/^@/, "");
    try {
      path = decodeURIComponent(path);
    } catch {}
    if (path.length > 3) out.push(path);
  }
  return out;
}

export function mentions(text) {
  const lines = String(text ?? "").split("\n");
  const seen = new Set();
  const out = [];
  const add = (list) => {
    for (const path of list) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push(path);
    }
  };
  for (let index = lines.length - 1; index >= 0; index--) {
    const tail = lines[index].match(/\S+$/)?.[0];
    const head = lines[index + 1]?.match(/^\s*(\S+)/)?.[1];
    if (tail && head && !ENDED.test(tail)) add(tokens(tail + head));
    add(tokens(lines[index]).reverse());
  }
  return out;
}

export const EXISTING =
  'cd "$1" 2>/dev/null || cd /; shift; for p do a=$p; case $a in "~/"*) a="$HOME/${a#??}";; esac; ' +
  '[ -f "$a" ] && printf "%s\\0%s/%s\\0" "$p" "$(cd "$(dirname "$a")" && pwd)" "$(basename "$a")"; done; :';

export function parseExisting(stdout) {
  const fields = String(stdout ?? "").split("\0");
  const found = new Map();
  for (let index = 0; index + 1 < fields.length; index += 2) {
    if (fields[index]) found.set(fields[index], fields[index + 1]);
  }
  return found;
}

export function missingNames(candidates, found) {
  return [...new Set(candidates.filter((path) => !found.has(path) && BARE.test(path)))].slice(0, LISTED);
}

export const LOOKUP =
  'top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0; cd "$top" || exit 0; printf "%s\\n" "$top"; ' +
  'git ls-files --cached --others --exclude-standard | awk -F/ \'BEGIN { for (i = 1; i < ARGC; i++) want[ARGV[i]] = 1; ARGC = 1 } want[$NF] && seen[$NF]++ < ' +
  PER_NAME +
  "' \"$@\"";

export function parseLookup(stdout) {
  const [top, ...rest] = String(stdout ?? "").split("\n");
  const byName = new Map();
  if (!top) return byName;
  for (const relative of rest.filter(Boolean)) {
    const name = nameOf(relative);
    byName.set(name, [...(byName.get(name) ?? []), `${top}/${relative}`]);
  }
  return byName;
}

export function onScreen(candidates, found, byName) {
  const out = [];
  for (const path of candidates) {
    const hits = found.has(path) ? [found.get(path)] : (byName.get(path) ?? []);
    for (const hit of hits) if (!out.includes(hit)) out.push(hit);
  }
  return out;
}

export const REPO_MARKDOWN =
  'top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0; cd "$top" || exit 0; printf "%s\\n" "$top"; ' +
  "git ls-files --cached --others --exclude-standard -z -- '*.md' '*.markdown' '*.mdx' | xargs -0 ls -t -- 2>/dev/null | head -n 1000";

export function parseRepoMarkdown(stdout) {
  const [top, ...rest] = String(stdout ?? "").split("\n");
  if (!top) return { top: null, files: [] };
  return { top, files: rest.filter((relative) => MARKDOWN_FILE.test(relative)).map((relative) => `${top}/${relative}`) };
}

export function where(path, top, home) {
  const folder = folderOf(path);
  let shown;
  if (top && folder === top) shown = nameOf(top);
  else if (top && folder.startsWith(`${top}/`)) shown = folder.slice(top.length + 1);
  else shown = shortFolder(folder, home);
  if (shown.length <= FOLDER_CHARS) return shown;
  const parts = shown.split("/");
  let kept = parts.at(-1);
  for (let index = parts.length - 2; index >= 0 && `…/${parts[index]}/${kept}`.length <= FOLDER_CHARS; index--) kept = `${parts[index]}/${kept}`;
  return `…/${kept}`;
}

export function pickerRows(screen, repo, filter, { top, home, limit = 200 } = {}) {
  const query = String(filter ?? "").trim().toLowerCase();
  const fits = (path) => !query || (top && path.startsWith(`${top}/`) ? path.slice(top.length + 1) : shortFolder(path, home)).toLowerCase().includes(query);
  const byName = (a, b) => Number(!nameOf(a).toLowerCase().includes(query)) - Number(!nameOf(b).toLowerCase().includes(query));
  const row = (path) => ({ path, name: nameOf(path), where: where(path, top, home) });
  const shownScreen = screen.filter(fits);
  const taken = new Set(shownScreen);
  const shownRepo = repo.filter((path) => !taken.has(path) && fits(path));
  if (query) shownRepo.sort(byName);
  return { screen: shownScreen.map(row), repo: shownRepo.slice(0, limit).map(row) };
}
