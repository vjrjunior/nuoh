import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { bareKey, iconFor, openIcon, RULE_PARTS } from "../mods/files/icon-rules.js";

export const PACKAGE = "material-icon-theme";
export const VERSION = "5.40.0";
export const LICENSE_FILE = "LICENSE-material-icon-theme";

const FILES_MOD = join(import.meta.dir, "../mods/files");

type Names = Record<string, string>;
type Tables = { fileNames?: Names; fileExtensions?: Names; folderNames?: Names; folderNamesExpanded?: Names };

export type Manifest = Tables & {
  iconDefinitions: Record<string, { iconPath: string }>;
  file: string;
  folder: string;
  folderExpanded: string;
  light?: Tables;
};

export type IconTable = {
  version: string;
  file: string;
  folder: string;
  fileNames: Names;
  fileExtensions: Names;
  folderNames: Names;
  light: { fileNames: Names; fileExtensions: Names; folderNames: Names };
};

function lowered(names: Names = {}, where: string): Names {
  const result: Names = {};
  for (const [key, icon] of Object.entries(names)) {
    const lower = key.toLowerCase();
    if (Object.hasOwn(result, lower) && result[lower] !== icon) throw new Error(`${where}: ${key} clashes with another spelling of it`);
    result[lower] = icon;
  }
  return sorted(result);
}

function sorted(names: Names): Names {
  return Object.fromEntries(Object.entries(names).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function withoutSpellings(folders: Names): Names {
  const kept: Names = {};
  for (const [key, icon] of Object.entries(folders)) {
    const bare = bareKey(key);
    if (bare === key || folders[bare] !== icon) kept[key] = icon;
  }
  return kept;
}

function checkOpen(closed: Names = {}, expanded: Names = {}, where: string): void {
  for (const [key, icon] of Object.entries(closed)) {
    if (expanded[key] !== openIcon(icon)) throw new Error(`${where}: ${key} opens as ${expanded[key]}, not ${openIcon(icon)}`);
  }
}

function checkRules(table: IconTable): void {
  for (const names of [table.fileNames, table.folderNames, table.light.fileNames, table.light.folderNames]) {
    for (const key of Object.keys(names)) {
      if (key.split("/").length > RULE_PARTS) throw new Error(`${key} has more than ${RULE_PARTS} parts`);
    }
  }
}

function restore(table: IconTable, original: Names, light: boolean): void {
  const kept = light ? table.light.folderNames : table.folderNames;
  for (const [key, icon] of Object.entries(original)) {
    if (iconFor(table, key, { dir: true, light }) !== icon) kept[key] = icon;
  }
}

function checkFiles(table: IconTable, original: Names, light: boolean): void {
  for (const [key, icon] of Object.entries(original)) {
    if (iconFor(table, key, { light }) !== icon) throw new Error(`${key} resolves to ${iconFor(table, key, { light })}, not ${icon}`);
  }
}

export function iconTable(manifest: Manifest, version: string): IconTable {
  if (manifest.folderExpanded !== openIcon(manifest.folder)) throw new Error(`the folder opens as ${manifest.folderExpanded}`);
  checkOpen(manifest.folderNames, manifest.folderNamesExpanded, "folderNames");
  checkOpen(manifest.light?.folderNames, manifest.light?.folderNamesExpanded, "light folderNames");
  const folders = lowered(manifest.folderNames, "folderNames");
  const lightFolders = lowered(manifest.light?.folderNames, "light folderNames");
  const table: IconTable = {
    version,
    file: manifest.file,
    folder: manifest.folder,
    fileNames: lowered(manifest.fileNames, "fileNames"),
    fileExtensions: lowered(manifest.fileExtensions, "fileExtensions"),
    folderNames: withoutSpellings(folders),
    light: {
      fileNames: lowered(manifest.light?.fileNames, "light fileNames"),
      fileExtensions: lowered(manifest.light?.fileExtensions, "light fileExtensions"),
      folderNames: withoutSpellings(lightFolders),
    },
  };
  restore(table, folders, false);
  restore(table, lightFolders, true);
  table.folderNames = sorted(table.folderNames);
  table.light.folderNames = sorted(table.light.folderNames);
  checkRules(table);
  checkFiles(table, table.fileNames, false);
  checkFiles(table, table.light.fileNames, true);
  return table;
}

export function iconsOf(table: IconTable): string[] {
  const used = new Set([table.file, table.folder, openIcon(table.folder)]);
  for (const names of [table.fileNames, table.fileExtensions, table.light.fileNames, table.light.fileExtensions]) {
    for (const icon of Object.values(names)) used.add(icon);
  }
  for (const names of [table.folderNames, table.light.folderNames]) {
    for (const icon of Object.values(names)) {
      used.add(icon);
      used.add(openIcon(icon));
    }
  }
  return [...used].sort();
}

export function tableModule(table: IconTable): string {
  return `export default ${JSON.stringify(table, null, 1)};\n`;
}

export function writeIcons(packageDir: string, out: string): { table: IconTable; icons: string[] } {
  const meta = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  if (meta.name !== PACKAGE || meta.version !== VERSION) throw new Error(`expected ${PACKAGE} ${VERSION}, found ${meta.name} ${meta.version}`);
  const manifest: Manifest = JSON.parse(readFileSync(join(packageDir, "dist/material-icons.json"), "utf8"));
  const table = iconTable(manifest, VERSION);
  const icons = iconsOf(table);
  const sources = icons.map((icon) => {
    const definition = manifest.iconDefinitions[icon];
    if (!definition) throw new Error(`no icon definition for ${icon}`);
    const source = join(packageDir, "dist", definition.iconPath);
    if (!source.endsWith(".svg") || !existsSync(source)) throw new Error(`${icon}: ${definition.iconPath} is missing`);
    return source;
  });
  const folder = join(out, "icons");
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  icons.forEach((icon, index) => copyFileSync(sources[index] as string, join(folder, `${icon}.svg`)));
  copyFileSync(join(packageDir, "LICENSE"), join(folder, LICENSE_FILE));
  writeFileSync(join(out, "file-icons.js"), tableModule(table));
  return { table, icons };
}

function unpack(work: string): string {
  const pack = Bun.spawnSync(["npm", "pack", `${PACKAGE}@${VERSION}`, "--ignore-scripts", "--silent"], { cwd: work, stderr: "inherit" });
  if (pack.exitCode !== 0) throw new Error(`npm pack ${PACKAGE}@${VERSION} failed`);
  const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack wrote no tarball");
  const tar = Bun.spawnSync(["tar", "xzf", tarball], { cwd: work, stderr: "inherit" });
  if (tar.exitCode !== 0) throw new Error(`tar could not unpack ${tarball}`);
  return join(work, "package");
}

if (import.meta.main) {
  const given = process.argv[2];
  const work = given ? null : mkdtempSync(join(tmpdir(), "file-icons-"));
  try {
    const { icons } = writeIcons(given ?? unpack(work as string), FILES_MOD);
    console.log(`${icons.length} icons from ${PACKAGE} ${VERSION} in ${relative(process.cwd(), join(FILES_MOD, "icons"))}`);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }
}
