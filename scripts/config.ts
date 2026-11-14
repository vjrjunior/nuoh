import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Editor, Recipe } from "../recipes/recipe";
import { localConfigPath } from "./paths";

export type Extra = { path: string; options: Record<string, unknown> };
export type LocalConfig = { extras: Extra[]; editor?: Editor };
export type Loaded = { recipes: Recipe[]; icons: string[] };

function expand(path: string): string {
  return resolve(path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path);
}

function extraOf(entry: unknown, file: string): Extra {
  const given = typeof entry === "string" ? { path: entry } : entry;
  if (!given || typeof given !== "object" || typeof (given as Extra).path !== "string" || !(given as Extra).path) {
    throw new Error(`${file}: each of extras is a folder path or { "path": "...", "options": {} }`);
  }
  const options = (given as Extra).options;
  if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) throw new Error(`${file}: an extra's options is an object`);
  return { path: expand((given as Extra).path), options: options ?? {} };
}

function editorOf(given: unknown, file: string): Editor | undefined {
  if (given === undefined || given === null) return undefined;
  const editor = given as Editor;
  const valid = typeof editor === "object" && typeof editor.name === "string" && editor.name !== "" && Array.isArray(editor.argv) && editor.argv.length > 0 && editor.argv.every((word) => typeof word === "string" && word !== "");
  if (!valid) throw new Error(`${file}: editor is { "name": "Zed", "argv": ["zed"] }`);
  return { name: editor.name, argv: [...editor.argv] };
}

export function readLocalConfig(file = localConfigPath()): LocalConfig {
  if (!existsSync(file)) return { extras: [] };
  let data: { extras?: unknown; editor?: unknown };
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${file}: expected an object`);
  if (data.extras !== undefined && !Array.isArray(data.extras)) throw new Error(`${file}: extras is a list`);
  return { extras: ((data.extras as unknown[] | undefined) ?? []).map((entry) => extraOf(entry, file)), editor: editorOf(data.editor, file) };
}

export function loadExtras(extras: Extra[]): Loaded {
  const recipes: Recipe[] = [];
  const icons: string[] = [];
  for (const extra of extras) {
    const entry = join(extra.path, "recipes/index.ts");
    if (!existsSync(entry)) throw new Error(`extra ${extra.path}: recipes/index.ts not found`);
    let found: unknown;
    try {
      found = require(entry).recipes;
    } catch (error) {
      throw new Error(`extra ${extra.path}: ${(error as Error).message}`);
    }
    if (!Array.isArray(found) || found.some((recipe) => !recipe || typeof recipe.name !== "string" || !Array.isArray(recipe.mods) || typeof recipe.apply !== "function")) {
      throw new Error(`extra ${extra.path}: recipes/index.ts must export recipes, a list of { name, mods, apply }`);
    }
    for (const recipe of found as Recipe[]) {
      recipes.push({ ...recipe, options: extra.options, mods: recipe.mods.map((mod) => (mod.from === "repo" ? { ...mod, root: mod.root ?? extra.path } : mod)) });
    }
    const folder = join(extra.path, "kit/icons");
    if (existsSync(folder) && statSync(folder).isDirectory()) icons.push(folder);
  }
  return { recipes, icons };
}
