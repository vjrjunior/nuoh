export const RULE_PARTS = 2;

const LIGHT = "_light";

export function bareFolder(name) {
  const wrapped = /^__(.+)__$/.exec(name);
  if (wrapped) return wrapped[1];
  return /^[._-]./.test(name) ? name.slice(1) : name;
}

export function bareKey(key) {
  const cut = key.indexOf("/");
  return cut === -1 ? bareFolder(key) : `${bareFolder(key.slice(0, cut))}${key.slice(cut)}`;
}

export function openIcon(icon) {
  return icon.endsWith(LIGHT) ? `${icon.slice(0, -LIGHT.length)}-open${LIGHT}` : `${icon}-open`;
}

const own = (names, key) => (names && Object.hasOwn(names, key) ? names[key] : undefined);

export function iconFor(table, path, { dir = false, open = false, light = false } = {}) {
  const parts = String(path).toLowerCase().split("/").filter(Boolean);
  const name = parts.at(-1) ?? "";
  const kind = dir ? "folderNames" : "fileNames";
  const find = (names, key) => (light ? own(table.light?.[names], key) : undefined) ?? own(table[names], key);
  const named = (key) => find(kind, key) ?? (dir ? find(kind, bareKey(key)) : undefined);
  let icon;
  for (let from = Math.max(0, parts.length - RULE_PARTS); from < parts.length - 1 && !icon; from += 1) icon = named(parts.slice(from).join("/"));
  icon ??= named(name);
  for (let dot = name.indexOf("."); !dir && !icon && dot !== -1; dot = name.indexOf(".", dot + 1)) icon = find("fileExtensions", name.slice(dot + 1));
  icon ??= dir ? table.folder : table.file;
  return dir && open ? openIcon(icon) : icon;
}
