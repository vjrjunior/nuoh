import * as fs from "fs/promises";
import { exec, home, notify, panes, readTextFile, setShared, spaces, terminals } from "herdr";
import { parseSession } from "../../lib/claude.js";
import { CUT, LABEL, projectFolder, tabTree } from "./logic.js";

const DOC_GET = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "doc.get", params: { name: "herdr-app" } });

async function output(command, args, options) {
  try {
    const result = await exec(command, args, options);
    return result.code === 0 ? result.stdout : null;
  } catch {
    return null;
  }
}

function parse(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function appIo(cx) {
  return {
    spaces: () => spaces(),
    panes: () => panes(),
    terminals: () => terminals(),
    async get(address) {
      const text = await output("hc", ["get", address, "--json"]);
      if (text === null) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },
    async session(pid) {
      try {
        return parseSession(await readTextFile(`${home()}/.claude/sessions/${pid}.json`));
      } catch {
        return null;
      }
    },
    async transcript(session, cwd) {
      const root = `${home()}/.claude/projects`;
      const file = `${session}.jsonl`;
      try {
        const own = projectFolder(cwd);
        if (own && (await fs.exists(`${root}/${own}/${file}`))) return true;
        for (const project of await fs.readdir(root)) {
          if (await fs.exists(`${root}/${project}/${file}`)) return true;
        }
        return false;
      } catch {
        return true;
      }
    },
    async screen(address) {
      const text = await output("hc", ["read", address, "--json"]);
      return text === null ? null : (parse(text)?.text ?? null);
    },
    async cursor(address) {
      const at = (args) => exec("herdr-app", ["do", ...args, JSON.stringify({ terminal: address })]).catch(() => null);
      await at(["terminal.clear_selection"]);
      const asked = await exec("herdr-app", ["do", "terminal.select", JSON.stringify({ terminal: address, at: "cursor" })]).catch(() => null);
      try {
        if (asked?.code !== 0) return null;
        for (let waited = 0; waited <= 1000; waited += 50) {
          const selection = terminals().find((terminal) => terminal.address === address)?.selection;
          const { start, end } = selection ?? {};
          if (start && end && start.row === end.row && start.col === end.col) return { row: start.row, col: start.col };
          await cx.sleep(50);
        }
        return null;
      } finally {
        await at(["terminal.clear_selection"]);
      }
    },
    worktrees: (folder) => output("git", ["worktree", "list", "--porcelain"], { cwd: folder }),
    async tree(tab) {
      const text = await output("sh", ["-c", 'printf "%s\\n" "$1" | hc connect', "sh", DOC_GET]);
      return text === null ? null : tabTree(text, tab);
    },
    async exists(folder) {
      return (await exec("test", ["-d", folder])).code === 0;
    },
    async alive(pid) {
      return (await exec("ps", ["-p", String(pid)])).code === 0;
    },
    async signal(pid) {
      await exec("kill", ["-TERM", String(pid)]);
    },
    async unlabel(address) {
      return (await output("hc", ["label", address, `${LABEL}=`])) !== null;
    },
    async act(name, args) {
      const result = await exec("herdr-app", ["do", name, JSON.stringify(args)]);
      const text = (result.stdout ?? "").trim();
      const parsed = text ? parse(text) : {};
      if (result.code !== 0) throw new Error(parsed?.error ?? ((result.stderr ?? "").trim() || `${name} failed`));
      if (!parsed) throw new Error(`herdr-app do ${name} printed something unexpected`);
      return parsed;
    },
    sleep: (ms) => cx.sleep(ms),
    now: () => Date.now(),
    notify: (notice) => notify(notice),
    cut: (record) => setShared(CUT, record),
  };
}
