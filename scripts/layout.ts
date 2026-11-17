import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Variant } from "../recipes/recipe";
import { LEFT_ROUNDED, REPLACED, variantWith } from "../recipes/variants";
import { loadExtras, readLocalConfig } from "./config";
import { type Generated, generateVariant } from "./generate-layout";
import { deriveSection, type KeyTable, keysText, readKeys, withoutSections, withSections } from "./layout-keys";
import { herdrAppHome, stateDir } from "./paths";

export type ApplyResult = "applied" | "unchanged" | "busy";
export type LayoutRecord = { version: string; mods: string[]; kept: string[]; files: string[]; sections: string[]; square: boolean };
export type ApplyOptions = { herdrVersion?: string; square?: boolean };

const root = join(import.meta.dir, "..");
const REPO_MODS = ["vjr-sync", "git-graph"];
const APP_WRITTEN = ["gpui-kit.d.ts", "jsconfig.json"];
const EMPTY_RECORD: LayoutRecord = { version: "", mods: [], kept: [], files: [], sections: [], square: false };
const RELOAD_MS = 1500;
const STATUS_TIMEOUT_MS = 3000;
const CHECK_TIMEOUT_MS = 60000;

function recordPath(): string {
  return join(stateDir(), "layout.json");
}

function lockPath(): string {
  return join(stateDir(), "layout.lock");
}

function lockHolderAlive(): boolean {
  const pid = Number(readFileSync(lockPath(), "utf8"));
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function takeLock(): boolean {
  try {
    const lock = openSync(lockPath(), "wx");
    writeSync(lock, String(process.pid));
    closeSync(lock);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (lockHolderAlive()) return false;
  rmSync(lockPath(), { force: true });
  return takeLock();
}

function restoreLeftover(home: string, folder: string): void {
  for (const mod of readdirSync(folder)) {
    if (!existsSync(join(home, "mods", mod))) move(join(folder, mod), join(home, "mods", mod));
  }
}

function removeLeftovers(home: string): void {
  for (const name of readdirSync(stateDir())) {
    if (!/^(build|previous)-\d+$/.test(name)) continue;
    const folder = join(stateDir(), name);
    if (name.startsWith("previous-")) restoreLeftover(home, folder);
    rmSync(folder, { recursive: true, force: true });
  }
}

function readRecord(): LayoutRecord {
  if (!existsSync(recordPath())) return EMPTY_RECORD;
  const { version, mods, kept, files, sections, square } = { ...EMPTY_RECORD, ...JSON.parse(readFileSync(recordPath(), "utf8")) };
  return { version, mods, kept, files, sections, square: square === true };
}

function writeRecord(record: LayoutRecord): void {
  writeThrough(join(stateDir(), "record.tmp"), recordPath(), `${JSON.stringify(record, null, 2)}\n`);
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function listFiles(folder: string, ignored: string[], prefix = ""): string[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => !ignored.includes(entry.name))
    .flatMap((entry) => (entry.isDirectory() ? listFiles(join(folder, entry.name), ignored, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]))
    .sort();
}

function sameFolder(a: string, b: string, ignored: string[]): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  const files = listFiles(a, ignored);
  if (files.join("\n") !== listFiles(b, ignored).join("\n")) return false;
  return files.every((file) => readFileSync(join(a, file)).equals(readFileSync(join(b, file))));
}

function move(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

function writeThrough(temp: string, path: string, text: string): void {
  writeFileSync(temp, text);
  move(temp, path);
}

function installedVersion(): string {
  const result = Bun.spawnSync(["herdr-app", "--version"], { timeout: STATUS_TIMEOUT_MS });
  const version = result.stdout.toString().trim().split(/\s+/).at(-1);
  if (!result.success || !version) throw new Error("could not read the version from herdr-app --version");
  return version;
}

function writeBuild(build: string, generated: Generated): void {
  for (const [mod, files] of Object.entries(generated.mods)) {
    mkdirSync(join(build, mod), { recursive: true });
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(build, mod, file)), { recursive: true });
      writeFileSync(join(build, mod, file), text);
    }
  }
  const notAppWritten = (source: string) => !APP_WRITTEN.includes(basename(source));
  for (const mod of REPO_MODS) cpSync(join(root, "mods", mod), join(build, mod), { recursive: true, filter: notAppWritten });
}

function adoptedGitGraph(home: string, record: LayoutRecord, build: string): boolean {
  const installed = join(home, "mods/git-graph");
  if (!existsSync(installed) || record.mods.includes("git-graph")) return false;
  if (sameFolder(installed, join(build, "git-graph"), [...APP_WRITTEN, "LICENSE"])) return true;
  if (!record.kept.includes("git-graph")) return false;
  console.warn(`${installed} differs from this repo; leaving it as it is`);
  return true;
}

function refuseForeign(paths: string[], recorded: string[], home: string): void {
  for (const path of paths) {
    if (existsSync(join(home, path)) && !recorded.includes(path)) throw new Error(`${join(home, path)} already exists and was not created by this repo`);
  }
}

function keySections(table: KeyTable, generated: Generated): KeyTable {
  return { [`layout:${generated.layout}`]: { ...deriveSection(table.global ?? {}, generated.replacements), ...generated.keys } };
}

const CHECK_ONE = 'out=$(herdr-app check "$1/$2" 2>&1) || printf "%s\\t%s\\n" "$2" "$(printf "%s" "$out" | tr "\\n" " " | cut -c1-400)"';
const CHECKS_AT_ONCE = 8;

function checkMods(build: string, mods: string[]): void {
  if (mods.length === 0) return;
  const result = Bun.spawnSync(["xargs", "-P", String(CHECKS_AT_ONCE), "-n", "1", "sh", "-c", CHECK_ONE, "sh", build], {
    stdin: Buffer.from(`${mods.join("\n")}\n`),
    timeout: CHECK_TIMEOUT_MS,
  });
  if (!result.success) throw new Error("herdr-app check did not finish");
  const failed = new Map(result.stdout.toString().split("\n").filter(Boolean).map((line) => line.split("\t") as [string, string]));
  const first = mods.find((mod) => failed.has(mod));
  if (first) throw new Error(`${first} failed herdr-app check: ${(failed.get(first) ?? "").trim()}`);
}

function windowStatus(): { layout?: unknown; errors?: unknown } | null {
  const result = Bun.spawnSync(["herdr-app", "status"], { timeout: STATUS_TIMEOUT_MS });
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout.toString());
  } catch {
    console.warn("could not read herdr-app status; continuing without its errors");
    return null;
  }
}

function windowErrors(): string[] | null {
  const errors = windowStatus()?.errors;
  if (!Array.isArray(errors)) return null;
  return errors.map((error) => (typeof error === "string" ? error : JSON.stringify(error)));
}

function restoreMods(home: string, previous: string, installed: string[]): void {
  for (const mod of installed) rmSync(join(home, "mods", mod), { recursive: true, force: true });
  if (!existsSync(previous)) return;
  for (const mod of readdirSync(previous)) move(join(previous, mod), join(home, "mods", mod));
}

function refuseNewErrors(before: string[] | null): void {
  if (before === null) return;
  Bun.sleepSync(RELOAD_MS);
  const added = (windowErrors() ?? []).filter((error) => !before.includes(error));
  if (added.length > 0) throw new Error(`herdr-app reported errors after the swap: ${added.join("; ")}`);
}

function warnUncovered(home: string, variant: Variant): void {
  const path = join(home, "installed.json");
  if (!existsSync(path)) return;
  const covered = variant.recipes.flatMap((recipe) => recipe.mods.map((mod) => mod.name));
  for (const name of Object.keys(JSON.parse(readFileSync(path, "utf8")))) {
    if (name.startsWith("layout:") || covered.includes(name) || LEFT_ROUNDED.includes(name) || REPLACED.includes(name)) continue;
    const main = join(home, "mods", name, "main.js");
    if (existsSync(main) && readFileSync(main, "utf8").includes(".rounded")) console.warn(`mods/${name} has rounded corners that no recipe covers`);
  }
}

function applyAll(options: ApplyOptions): ApplyResult {
  const home = herdrAppHome();
  const state = stateDir();
  if (!existsSync(join(home, "themes/vjr.json"))) throw new Error("the vjr theme is not installed: run bun run install-theme first");
  const keysPath = join(home, "keys.json");
  const table = readKeys(keysPath);
  const version = options.herdrVersion ?? installedVersion();
  const record = readRecord();
  const config = readLocalConfig();
  const extras = loadExtras(config.extras);
  const square = options.square ?? record.square;
  const variant = variantWith(extras.recipes, square);
  const generated = generateVariant(variant, { home, version, repo: root, bun: process.execPath, editor: config.editor, icons: extras.icons });
  const build = join(state, `build-${process.pid}`);
  const previous = join(state, `previous-${process.pid}`);
  mkdirSync(build, { recursive: true });

  try {
    writeBuild(build, generated);
    const kept = adoptedGitGraph(home, record, build) ? ["git-graph"] : [];
    const mods = readdirSync(build).filter((mod) => !kept.includes(mod));
    const files: Record<string, string> = {
      [`layouts/${generated.layout}.json`]: generated.layoutText,
      [`layouts/${generated.layout}.svg`]: readFileSync(join(root, "layouts", `${generated.layout}.svg`), "utf8"),
    };
    refuseForeign(mods.map((mod) => `mods/${mod}`), record.mods.map((mod) => `mods/${mod}`), home);
    refuseForeign(Object.keys(files), record.files, home);

    const sections = keySections(table, generated);
    const keys = keysText(withSections(table, sections));
    const changedMods = mods.filter((mod) => !sameFolder(join(build, mod), join(home, "mods", mod), APP_WRITTEN));
    const staleMods = record.mods.filter((mod) => !mods.includes(mod));
    const changedFiles = Object.keys(files).filter((path) => !existsSync(join(home, path)) || readFileSync(join(home, path), "utf8") !== files[path]);
    const keysChanged = !existsSync(keysPath) || readFileSync(keysPath, "utf8") !== keys;
    if (changedMods.length + staleMods.length + changedFiles.length === 0 && !keysChanged && record.square === square && existsSync(recordPath())) return "unchanged";

    checkMods(build, changedMods);

    const before = windowErrors();
    const hadRecord = existsSync(recordPath());
    writeRecord({
      version: record.version,
      mods: union(record.mods, mods),
      kept,
      files: union(record.files, Object.keys(files)),
      sections: union(record.sections, Object.keys(sections)),
      square: record.square,
    });
    mkdirSync(previous, { recursive: true });
    const installed: string[] = [];
    try {
      for (const mod of changedMods) {
        if (existsSync(join(home, "mods", mod))) move(join(home, "mods", mod), join(previous, mod));
      }
      for (const mod of changedMods) {
        move(join(build, mod), join(home, "mods", mod));
        installed.push(mod);
      }
      if (changedMods.length > 0) refuseNewErrors(before);
    } catch (error) {
      restoreMods(home, previous, installed);
      if (hadRecord) writeRecord(record);
      else rmSync(recordPath(), { force: true });
      throw error;
    }

    if (keysChanged) writeThrough(join(state, "keys.tmp"), keysPath, keys);
    const ordered = [...changedFiles].sort((a, b) => Number(a.endsWith(".json")) - Number(b.endsWith(".json")));
    for (const path of ordered) writeThrough(join(state, "file.tmp"), join(home, path), files[path] as string);
    if (staleMods.length > 0) {
      if (before !== null) Bun.sleepSync(RELOAD_MS);
      for (const mod of staleMods) rmSync(join(home, "mods", mod), { recursive: true, force: true });
    }
    writeRecord({ version, mods, kept, files: Object.keys(files), sections: Object.keys(sections), square });
    if (square) warnUncovered(home, variant);
    return "applied";
  } finally {
    rmSync(build, { recursive: true, force: true });
    rmSync(previous, { recursive: true, force: true });
  }
}

function writeLog(line: string): void {
  appendFileSync(join(stateDir(), "layout.log"), `${new Date().toISOString()} ${line.replace(/\s+/g, " ")}\n`);
}

export function apply(options: ApplyOptions = {}): ApplyResult {
  mkdirSync(stateDir(), { recursive: true });
  if (!takeLock()) return "busy";
  const started = Date.now();
  try {
    removeLeftovers(herdrAppHome());
    const result = applyAll(options);
    writeLog(`${options.herdrVersion ?? "cli"} ${result} ${Date.now() - started}ms`);
    return result;
  } catch (error) {
    writeLog(`${options.herdrVersion ?? "cli"} failed: ${(error as Error).message}`);
    throw error;
  } finally {
    rmSync(lockPath(), { force: true });
  }
}

function leaveOurLayout(record: LayoutRecord): void {
  if (!Bun.which("herdr-app")) return;
  const shown = windowStatus()?.layout;
  if (record.files.includes(`layouts/${shown}.json`)) Bun.spawnSync(["herdr-app", "do", "layout.switch", JSON.stringify({ name: "main" })]);
}

export function uninstall(): void {
  if (!existsSync(recordPath())) return;
  const home = herdrAppHome();
  const keysPath = join(home, "keys.json");
  const record = readRecord();
  const table = withoutSections(readKeys(keysPath), record.sections);
  leaveOurLayout(record);
  for (const mod of record.mods) rmSync(join(home, "mods", mod), { recursive: true, force: true });
  for (const file of record.files) rmSync(join(home, file), { force: true });
  writeFileSync(keysPath, keysText(table));
  rmSync(recordPath(), { force: true });
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function squareFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value !== "on" && value !== "off") throw new Error("--square takes on or off");
  return value === "on";
}

if (import.meta.main) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "apply") console.log(apply({ herdrVersion: flag(args, "--herdr-version"), square: squareFlag(flag(args, "--square")) }));
    else if (command === "uninstall") uninstall();
    else throw new Error("usage: layout.ts apply [--herdr-version X] [--square on|off] | uninstall");
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    process.exit(1);
  }
}
