import { base } from "./checkouts.js";

const SHELLS = ["zsh", "bash", "fish", "sh", "dash", "ksh"];
export const OPTIONS = {
  "--dangerously-skip-permissions": 0,
  "--allow-dangerously-skip-permissions": 0,
  "--permission-mode": 1,
  "--model": 1,
  "--fallback-model": 1,
  "--add-dir": "many",
  "--verbose": 0,
  "--agent": 1,
  "--effort": 1,
  "--name": 1,
  "--setting-sources": 1,
  "--allowedTools": "many",
  "--allowed-tools": "many",
  "--disallowedTools": "many",
  "--disallowed-tools": "many",
  "--strict-mcp-config": 0,
  "--chrome": 0,
  "--no-chrome": 0,
  "--ide": 0,
  "--brief": 0,
};
export const LOADS_CODE = {
  "--settings": 1,
  "--mcp-config": "many",
  "--plugin-dir": 1,
};
const PLAIN = /^[A-Za-z0-9_/.,:@%+=-]+$/;
const UNTYPABLE = /['\\\u0000-\u001f\u007f]/;
export const SESSION = /^[A-Za-z0-9-]+$/;
const PATHS = ["--add-dir", "--plugin-dir"];
const FILES = ["--mcp-config", "--settings"];

export function parseSession(text) {
  if (typeof text !== "string") return null;
  try {
    const data = JSON.parse(text);
    if (typeof data?.sessionId !== "string" || typeof data.cwd !== "string") return null;
    return { session: data.sessionId, cwd: data.cwd, procStart: typeof data.procStart === "string" ? data.procStart : undefined };
  } catch {
    return null;
  }
}

export function isShell(argv0) {
  return SHELLS.includes(base(argv0 ?? "").replace(/^-/, ""));
}

export function quote(value) {
  if (typeof value !== "string" || value === "") return null;
  if (PLAIN.test(value)) return value;
  if (UNTYPABLE.test(value)) return null;
  return `'${value}'`;
}

function resolvePath(value, cwd) {
  if (typeof cwd !== "string" || !cwd.startsWith("/") || value === "" || value.startsWith("/") || value.startsWith("~")) return value;
  const parts = [];
  for (const part of `${cwd}/${value}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function keptValue(flag, value, cwd) {
  if (PATHS.includes(flag) || (FILES.includes(flag) && !value.trim().startsWith("{"))) return resolvePath(value, cwd);
  return value;
}

export function keepOptions(argv, allowed, cwd) {
  const list = argv.slice(1);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let flag = list[i];
    let inline = null;
    if (flag.startsWith("--") && flag.includes("=")) {
      inline = flag.slice(flag.indexOf("=") + 1);
      flag = flag.slice(0, flag.indexOf("="));
    }
    if (!Object.hasOwn(allowed, flag)) continue;
    const arity = allowed[flag];
    const values = [];
    if (inline !== null) values.push(inline);
    else if (arity === 1 && i + 1 < list.length && !list[i + 1].startsWith("-")) values.push(list[++i]);
    else if (arity === "many") while (i + 1 < list.length && !list[i + 1].startsWith("-")) values.push(list[++i]);
    if (arity === 0 && values.length > 0) continue;
    if (arity !== 0 && values.length === 0) continue;
    const kept = values.map((value) => keptValue(flag, value, cwd));
    if (kept.some((value) => quote(value) === null)) continue;
    out.push(flag, ...kept);
  }
  return out;
}

export function resumeCommand(note) {
  const folder = quote(note.cwd);
  if (folder === null || !SESSION.test(note.session)) return null;
  return [`cd ${folder} && claude --resume ${note.session}`, ...note.args.map(quote)].join(" ");
}
