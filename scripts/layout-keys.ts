import { existsSync, readFileSync } from "node:fs";
import type { KeyCommand } from "../recipes/recipe";

export type Binding = string | KeyCommand;
export type KeyTable = Record<string, Record<string, Binding>>;

export function readKeys(path: string): KeyTable {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

export function deriveSection(global: Record<string, Binding>, replacements: Record<string, string>): Record<string, Binding> {
  const section: Record<string, Binding> = {};
  for (const [key, action] of Object.entries(global)) {
    const replacement = typeof action === "string" ? replacements[action] : undefined;
    if (replacement) section[key] = replacement;
  }
  return section;
}

export function withSections(table: KeyTable, sections: KeyTable): KeyTable {
  return { ...table, ...sections };
}

export function withoutSections(table: KeyTable, names: string[]): KeyTable {
  return Object.fromEntries(Object.entries(table).filter(([name]) => !names.includes(name)));
}

export function keysText(table: KeyTable): string {
  return `${JSON.stringify(table, null, 2)}\n`;
}
