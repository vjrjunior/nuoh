import { base, checkoutOf, placeOf } from "../../lib/checkouts.js";
import { LOADS_CODE, OPTIONS, SESSION, isShell, keepOptions, quote, resumeCommand } from "../../lib/claude.js";

export const ALLOWED = { ...OPTIONS, ...LOADS_CODE };
export const keepArgs = (argv, cwd) => keepOptions(argv, ALLOWED, cwd);

export const REASONS = {
  working: (where) => `Claude is working in ${where}. Move it when the turn ends.`,
  blocked: (where) => `Claude is waiting for you in ${where}.`,
  draft: (where, text) => `There's unsent text in Claude's prompt in ${where}: "${text.length > 40 ? `${text.slice(0, 40)}…` : text}". Send or clear it, then move.`,
  busy: (program, where) => `${program} is running in ${where}.`,
  subagents: (where) => `Claude has sub-agents running in ${where}.`,
  subagent: (where) => `Claude in ${where} is another agent's sub-agent.`,
  session: (where) => `Couldn't find Claude's conversation in ${where}.`,
  remote: () => "Tabs on other machines can't move yet.",
  repo: () => "This tab isn't in a git repo.",
  target: () => "That checkout is gone.",
  same: () => "The tab is already there.",
  gone: () => "The tab is gone.",
  running: () => "Another move is running.",
  ended: (where) => `Claude isn't running in ${where} anymore.`,
  changed: (where) => `The conversation in ${where} changed after the move was scheduled.`,
  unreadable: () => "The scheduled move couldn't be read.",
  stale: () => "The scheduled move waited 4 hours, so it was dropped.",
  unlabeled: () => "The scheduled move couldn't be cleared, so nothing moved.",
};

export const LABEL = "vjr.move-to";
export const CUT = "move-tab.cut";
export const CUT_TTL = 24 * 60 * 60 * 1000;
export const REFUSED = "Can't move this tab";
export const SCHEDULE_TTL = 4 * 60 * 60 * 1000;
export const SETTLE = 2000;
const READY = ["idle", "done"];

export function matchingFolder(cwd, fromRoot, toRoot) {
  const from = fromRoot.replace(/\/+$/, "");
  const to = toRoot.replace(/\/+$/, "");
  if (typeof cwd !== "string") return to;
  const path = cwd.replace(/\/+$/, "");
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : to;
}

export function atShell(info) {
  const front = info?.foreground;
  if (!front) return true;
  return front.pid === info.pid && isShell(front.argv?.[0]);
}

export function isClaude(info) {
  const front = info?.foreground;
  if (front && base(front.argv?.[0] ?? "") === "claude") return true;
  return info?.status?.app === "claude-code" && !atShell(info);
}

const RULE = /^\s*─{8,}/;
const PROMPT = /^(\s*)❯/;

export function promptBox(screen) {
  const lines = String(screen ?? "").split("\n");
  const row = lines.findLastIndex((line, index) => index > 0 && PROMPT.test(line) && RULE.test(lines[index - 1]));
  if (row < 0) return null;
  const close = lines.findIndex((line, index) => index > row && RULE.test(line));
  const input = lines.slice(row, close < 0 ? lines.length : close);
  const text = [input[0].replace(PROMPT, ""), ...input.slice(1)].map((line) => line.trim()).filter(Boolean).join(" ");
  return { row, column: PROMPT.exec(input[0])[1].length + 2, lines: input.length, text, height: lines.length };
}

export function isDraft(box, cursor) {
  if (!box || box.text === "" || !cursor) return false;
  const atStart = cursor.col === box.column;
  if (cursor.row < box.height) return !(atStart && cursor.row === box.row);
  return !(atStart && box.lines === 1);
}

export function movedNote({ from, fromBranch, to, toBranch }) {
  const branch = (name) => (name ? `branch ${name}` : "detached HEAD");
  return `This session moved from ${from} (${branch(fromBranch)}) to ${to} (${branch(toBranch)}). Work in ${to} from now on; files under ${from} belong to another checkout.`;
}

export function projectFolder(cwd) {
  return typeof cwd === "string" && cwd !== "" ? cwd.replace(/[^A-Za-z0-9]/g, "-") : null;
}

export function freshArgv({ args, prompt }) {
  return typeof prompt === "string" && prompt !== "" ? ["claude", prompt, ...args] : ["claude", ...args];
}

export function freshCommand(note) {
  const folder = quote(note.cwd);
  if (folder === null) return null;
  return [`cd ${folder} && claude`, ...note.args.map(quote)].join(" ");
}

export function resumeArgv({ session, args, note, prompt }) {
  if (typeof session !== "string" || !SESSION.test(session)) return null;
  const argv = ["claude", "--resume", session, ...args, ...(note ? ["--append-system-prompt", note] : [])];
  return typeof prompt === "string" && prompt !== "" ? [...argv, prompt] : argv;
}

export function byHand(claudes, space) {
  const commands = claudes.map((claude) =>
    claude.fresh ? (freshCommand({ cwd: claude.cwd, args: claude.args }) ?? "claude") : (resumeCommand({ cwd: claude.cwd, session: claude.session, args: claude.args }) ?? `claude --resume ${claude.session}`),
  );
  const [first] = claudes;
  const how = claudes.every((claude) => claude.fresh) ? "To start Claude again by hand" : "To resume Claude by hand";
  const argv = first.fresh ? freshArgv({ args: first.args, prompt: null }) : resumeArgv({ session: first.session, args: first.args, note: null });
  return { text: `${how}: ${commands.join("; ")}`, action: { name: "tab.new", args: { space, folder: first.cwd, argv } } };
}

export function cutRecord({ id, at, home, place, claudes }) {
  return { id, at, home, place, claudes: claudes.map(({ session, cwd, args, fresh, address, pid }) => ({ session, cwd, args, fresh, address, pid })) };
}

export function cutNotice(cut, terminals, now, unended = new Set()) {
  if (!cut || typeof cut !== "object" || !Number.isFinite(cut.at) || now - cut.at > CUT_TTL || !Array.isArray(cut.claudes)) return null;
  const left = cut.claudes.filter(
    (claude) =>
      claude &&
      typeof claude.cwd === "string" &&
      Array.isArray(claude.args) &&
      !unended.has(claude.session) &&
      (claude.fresh === true || (typeof claude.session === "string" && SESSION.test(claude.session) && !terminals.some((terminal) => runsSession(terminal, claude.session)))),
  );
  if (left.length === 0) return null;
  const where = typeof cut.place === "string" ? ` to ${cut.place}` : "";
  const { text, action } = byHand(left, cut.home);
  return { title: "A move was cut off", body: `The move${where} stopped after Claude ended. ${text}`, level: "error", action };
}

export function spaceName(branch) {
  if (typeof branch !== "string" || branch === "") return null;
  const tail = branch.includes("--") ? branch.slice(branch.lastIndexOf("--") + 2) : branch.slice(branch.lastIndexOf("/") + 1);
  const words = (text) => text.replace(/[-_]+/g, " ").trim();
  const ticket = /^([a-z]+-\d+)(?:[-_](.+))?$/i.exec(tail);
  if (!ticket) return words(tail) || branch;
  const id = ticket[1].toUpperCase();
  return ticket[2] ? `${id} · ${words(ticket[2])}` : id;
}

export function parseSchedule(text) {
  if (typeof text !== "string" || text === "") return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.v !== 1 || typeof data.to !== "string" || !data.to.startsWith("/")) return null;
  if (typeof data.session !== "string" || !SESSION.test(data.session) || !Number.isFinite(data.at)) return null;
  const prompt = data.prompt ?? null;
  if (prompt !== null && (typeof prompt !== "string" || prompt.startsWith("-"))) return null;
  const to = data.to.length > 1 ? data.to.replace(/\/+$/, "") : data.to;
  return { to, session: data.session, prompt: prompt === "" ? null : prompt, at: data.at };
}

export function scheduleStep({ schedule, status, since, now }) {
  if (!schedule) return { drop: REASONS.unreadable() };
  if (now - schedule.at > SCHEDULE_TTL) return { drop: REASONS.stale() };
  if (!READY.includes(status)) return { wait: null };
  if (since === null || since === undefined) return { wait: SETTLE };
  return now - since >= SETTLE ? { go: true } : { wait: SETTLE - (now - since) };
}

function resumes(terminal, session, lists) {
  if (terminal?.state !== "live" || typeof session !== "string" || !SESSION.test(session)) return false;
  const resume = new RegExp(`(^|\\s)--resume\\s+${session}(\\s|$)`);
  return lists.some((argv) => Array.isArray(argv) && resume.test(argv.join(" ")));
}

export function runsSession(terminal, session) {
  return resumes(terminal, session, [terminal?.argv, terminal?.foreground?.argv]);
}

export function frontRunsSession(terminal, session) {
  return resumes(terminal, session, [terminal?.foreground?.argv]);
}

export function tabTree(stdout, tab) {
  try {
    const spaces = JSON.parse(stdout)?.result?.value?.spaces;
    if (!Array.isArray(spaces)) return null;
    for (const space of spaces) {
      const found = (space?.tabs ?? []).find((candidate) => candidate?.id === tab);
      if (found) return found.root ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function leaves(node) {
  if (!node) return [];
  if (node.type === "block") return [node];
  return (node.children ?? []).flatMap(leaves);
}

export function splitSteps(node) {
  const steps = [{ leaf: 0, from: null, direction: null }];
  const walk = (current, start) => {
    if (current.type === "block") return;
    const direction = current.type === "column" ? "down" : "right";
    const children = current.children ?? [];
    const firsts = [];
    let offset = start;
    for (const child of children) {
      firsts.push(offset);
      offset += leaves(child).length;
    }
    for (let i = 1; i < children.length; i++) steps.push({ leaf: firsts[i], from: firsts[i - 1], direction });
    children.forEach((child, i) => walk(child, firsts[i]));
  };
  walk(node, 0);
  return steps;
}

export function targetsFor({ checkouts, spaces, panes, from }) {
  const main = [];
  const open = [];
  const idle = [];
  for (const checkout of checkouts) {
    const here = spaces.filter((space) => {
      const place = placeOf(space, panes);
      return place !== null && checkoutOf(place, checkouts) === checkout;
    });
    const detail = checkout.main ? "main checkout" : checkout.branch;
    const rows = here
      .filter((space) => space.id !== from.space)
      .map((space) => ({ key: space.id, path: checkout.path, label: space.name, detail: `${detail ?? base(checkout.path)} · open`, space: space.id }));
    if (checkout.main) main.push(...rows);
    else open.push(...rows);
    if (here.length === 0) {
      const row = {
        key: checkout.path,
        path: checkout.path,
        label: checkout.main ? base(checkout.path) : (checkout.branch ?? base(checkout.path)),
        detail: detail ?? base(checkout.path),
        space: null,
      };
      if (checkout.main) main.push(row);
      else idle.push(row);
    }
  }
  idle.sort((a, b) => a.label.localeCompare(b.label));
  return [...main, ...open, ...idle];
}
