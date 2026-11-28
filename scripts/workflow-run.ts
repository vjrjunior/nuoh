import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  activeIn,
  agentMessage,
  agentRoot,
  agentTerminal,
  cap,
  current,
  epochOf,
  evaluate,
  FINAL,
  fill,
  graphOf,
  isWorkflowName,
  latest,
  loopKey,
  loopsExhausted,
  loopsTaken,
  MAX_PARALLEL,
  nodeInputs,
  nodeKind,
  parseWorkflow,
  readAnswer,
  readyNodes,
  resolveInputs,
  retryMessage,
  reuseFor,
  runSummary,
  scopeOf,
  takeLoop,
  waitingAt,
  warnings,
} from "../lib/workflow.js";

export type Dirs = { workflows: string; runs: string };
export type Status = "idle" | "working" | "blocked" | "done" | "error";
export type Terminal = { address: string; state: string; turn: number; reported: boolean; status: string | null; labels: Record<string, string>; argv: string[] };
export type Space = { id: string; name: string; folder: string; machine: string | null };

export type Io = {
  now(): number;
  sleep(ms: number): Promise<void>;
  print(text: string): void;
  report(status: Status): void;
  get(address: string): Promise<Terminal | null>;
  start(options: { argv: string[]; cwd: string; labels: Record<string, string>; child: boolean }): Promise<string>;
  send(address: string, text: string): Promise<void>;
  waitTurn(address: string): Promise<void>;
  waitChildren(address: string): Promise<boolean>;
  screen(address: string, lines: number): Promise<string>;
  spawn(argv: string[], cwd: string, timeoutMs: number | null): Promise<{ exit: number; output: string }>;
  act(name: string, args: Record<string, unknown>): Promise<unknown>;
  spaces(): Promise<Space[]>;
  input(): string | null;
  enter(): Promise<void>;
  self(): string | null;
  runner(id: string, runs: string): string[];
};

export type Record_ = {
  id: string;
  attempt: number;
  epoch: number;
  status: string;
  started: number;
  ended?: number;
  terminal?: string;
  turn?: number;
  sent?: boolean;
  output?: string;
  exit?: number;
  fields?: Record<string, unknown>;
  file?: string;
  error?: string;
  reused?: boolean;
};

export type Run = {
  id: string;
  workflow: string;
  number: number;
  dir: string;
  definition: any;
  inputs: Record<string, string>;
  space: string;
  folder: string;
  tab: string | null;
  runner: string | null;
  status: string;
  epoch: Record<string, number>;
  loops: Record<string, number>;
  only?: string;
  steps: Record_[];
  created: number;
  ended?: number;
  error?: string;
};

export const READY_MS = 120_000;
export const POLL_MS = 1000;
export const SCREEN_MS = 5000;
export const STARTING_MS = 30_000;
export const RENAME_TRIES = 10;
const TRUST = /trust (this|the files in this) folder|do you trust/i;
const STOP_LINES = ["s", "stop"];

class Stopped extends Error {}

export function typed(line: string | null): string | null {
  return line === null ? null : line.replace(/<\/?hc\b[^>]*>/g, "").trim().toLowerCase();
}

export function workflowFile(dirs: Dirs, name: string): string {
  return join(dirs.workflows, `${name}.json`);
}

export function loadWorkflow(dirs: Dirs, name: string) {
  if (!isWorkflowName(name)) return { ok: false, problems: [`"${name}" is not a workflow name`] };
  const file = workflowFile(dirs, name);
  if (!existsSync(file)) return { ok: false, problems: [`no workflow ${file}`] };
  return parseWorkflow(readFileSync(file, "utf8"));
}

export function listWorkflows(dirs: Dirs) {
  if (!existsSync(dirs.workflows)) return [];
  return readdirSync(dirs.workflows)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .filter(isWorkflowName)
    .sort()
    .map((name) => {
      const parsed: any = loadWorkflow(dirs, name);
      return parsed.ok
        ? { name, title: parsed.workflow.title ?? name, about: parsed.workflow.about ?? "", workflow: parsed.workflow, problems: [], warnings: warnings(parsed.workflow) }
        : { name, title: name, about: "", workflow: null, problems: parsed.problems, warnings: [] };
    });
}

export function runFile(dirs: Dirs, id: string): string {
  return join(dirs.runs, id, "run.json");
}

export function loadRun(dirs: Dirs, id: string): Run {
  if (!/^[a-z0-9][a-z0-9_-]*-\d+$/i.test(id)) throw new Error(`"${id}" is not a run id`);
  const file = runFile(dirs, id);
  if (!existsSync(file)) throw new Error(`no run ${id}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

export function saveRun(dirs: Dirs, run: Run): void {
  const file = runFile(dirs, run.id);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(run, null, 2)}\n`);
  renameSync(temp, file);
}

export function listRuns(dirs: Dirs, workflow?: string): Run[] {
  if (!existsSync(dirs.runs)) return [];
  return readdirSync(dirs.runs)
    .filter((id) => existsSync(runFile(dirs, id)))
    .flatMap((id) => {
      try {
        return [loadRun(dirs, id)];
      } catch {
        return [];
      }
    })
    .filter((run) => !workflow || run.workflow === workflow)
    .sort((a, b) => b.created - a.created || b.number - a.number);
}

function decisionFile(dirs: Dirs, id: string): string {
  return join(dirs.runs, id, "decision.json");
}

export function decide(dirs: Dirs, id: string, action: "approve" | "reject" | "stop", now: number, node?: string): void {
  const run = loadRun(dirs, id);
  if (FINAL.includes(run.status)) throw new Error(`run ${id} is already ${run.status}`);
  if (action !== "stop") {
    const gates = waitingAt(run).filter((entry) => entry.status === "approval").map((entry) => entry.id);
    if (gates.length === 0) throw new Error(`run ${id} waits for no approval`);
    if (node && !gates.includes(node)) throw new Error(`run ${id} doesn't wait at ${node}: it waits at ${gates.join(", ")}`);
    if (!node && gates.length > 1) throw new Error(`run ${id} waits at ${gates.join(" and ")}: pass --node`);
  }
  writeFileSync(decisionFile(dirs, id), `${JSON.stringify({ action, node: node ?? null, at: now })}\n`);
}

function takeDecision(dirs: Dirs, id: string): { action: string; node: string | null } | null {
  const file = decisionFile(dirs, id);
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return value?.action ? { action: value.action, node: value.node ?? null } : null;
  } catch {
    return null;
  } finally {
    rmSync(file, { force: true });
  }
}

function nextNumber(dirs: Dirs, name: string): number {
  if (!existsSync(dirs.runs)) return 1;
  const prefix = `${name}-`;
  const numbers = readdirSync(dirs.runs)
    .filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)))
    .map((id) => Number(id.slice(prefix.length)));
  return Math.max(0, ...numbers) + 1;
}

function makeRunDir(dirs: Dirs, name: string): { id: string; number: number; dir: string } {
  mkdirSync(dirs.runs, { recursive: true });
  for (let number = nextNumber(dirs, name); ; number += 1) {
    const id = `${name}-${number}`;
    const dir = join(dirs.runs, id);
    try {
      mkdirSync(dir);
      return { id, number, dir };
    } catch (error: any) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
}

function newTab(): string {
  return `tb${crypto.randomUUID().replaceAll("-", "")}`;
}

async function whereToRun(io: Io, space: string | undefined): Promise<Space> {
  let id = space;
  if (!id) {
    const self = io.self();
    const info = self ? await io.get(self) : null;
    id = info?.labels?.["herdr.space"];
    if (!id) throw new Error("this terminal is in no Herdr space: pass --space <id>");
  }
  const found = (await io.spaces()).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no space ${id}`);
  if (found.machine) throw new Error(`space ${found.name} is on ${found.machine}: workflows run on this computer only`);
  return found;
}

async function launch(io: Io, dirs: Dirs, run: Run): Promise<string> {
  return io.start({ argv: io.runner(run.id, dirs.runs), cwd: run.folder, labels: { "herdr.space": run.space, "herdr.tab": run.tab ?? newTab(), "nuoh.workflow": run.id }, child: false });
}

export type StartOptions = { space?: string; from?: string; only?: string; previous?: Run | null };

export async function startRun(io: Io, dirs: Dirs, name: string, given: Record<string, string>, options: StartOptions = {}): Promise<Run> {
  const parsed: any = loadWorkflow(dirs, name);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.problems.join("; ")}`);
  const workflow = parsed.workflow;
  const { from, only } = options;
  if (from && only) throw new Error("give --from or --only, not both");
  const previous = options.previous !== undefined ? options.previous : from || only ? (listRuns(dirs, name)[0] ?? null) : null;
  const { inputs, problems } = resolveInputs(workflow, previous && Object.keys(given).length === 0 ? previous.inputs : given);
  if (problems.length) throw new Error(problems.join("; "));
  const reused = from || only ? reuseFor(previous, workflow, { from, only }) : { steps: [], problems: [] };
  if (reused.problems.length) throw new Error(reused.problems.join("; "));
  const where = previous && !options.space ? { id: previous.space, folder: previous.folder } : await whereToRun(io, options.space);
  const made = makeRunDir(dirs, name);
  const run: Run = {
    id: made.id,
    workflow: name,
    number: made.number,
    dir: made.dir,
    definition: workflow,
    inputs,
    space: where.id,
    folder: where.folder,
    tab: newTab(),
    runner: null,
    status: "starting",
    epoch: {},
    loops: {},
    ...(only ? { only } : {}),
    steps: reused.steps as Record_[],
    created: io.now(),
  };
  saveRun(dirs, run);
  await launch(io, dirs, run);
  return run;
}

export async function runnerAlive(io: Io, run: Run): Promise<boolean> {
  if (!run.runner) return false;
  const info = await io.get(run.runner);
  return info?.state === "live" && info.labels?.["nuoh.workflow"] === run.id;
}

export async function retryRun(io: Io, dirs: Dirs, id: string, from?: string): Promise<Run> {
  const previous = loadRun(dirs, id);
  if (!FINAL.includes(previous.status) && (await runnerAlive(io, previous))) throw new Error(`run ${id} is still going: stop it first`);
  const broken = previous.steps.findLast((record) => ["failed", "stopped", "interrupted", "running", "approval"].includes(record.status));
  const start = from ?? broken?.id;
  if (!start) throw new Error(`run ${id} has no step to start from: pass --from <step>`);
  return startRun(io, dirs, previous.workflow, {}, { from: start, previous });
}

export async function resumeRun(io: Io, dirs: Dirs, id: string): Promise<Run> {
  const run = loadRun(dirs, id);
  if (FINAL.includes(run.status)) throw new Error(`run ${id} is already ${run.status}`);
  if (await runnerAlive(io, run)) throw new Error(`run ${id} is still going in ${run.runner}`);
  await launch(io, dirs, run);
  return run;
}

export async function summaries(io: Io, dirs: Dirs, workflow?: string) {
  const runs = listRuns(dirs, workflow);
  return Promise.all(
    runs.map(async (run) => {
      const summary = runSummary(run);
      const fresh = run.status === "starting" && io.now() - run.created < STARTING_MS;
      if (!FINAL.includes(run.status) && !fresh && !(await runnerAlive(io, run))) return { ...summary, status: "interrupted" };
      return summary;
    }),
  );
}

function expandHome(path: string): string {
  return path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

export class Runner {
  private run: Run;
  private graph: any;
  private tasks = new Map<string, Promise<void>>();
  private gates = new Map<string, (decision: string) => void>();
  private stopping: string | null = null;
  private failure: string | null = null;
  private closed = false;
  private shownStatus: string | null = null;

  constructor(
    private io: Io,
    private dirs: Dirs,
    id: string,
  ) {
    this.run = loadRun(dirs, id);
    this.run.epoch ??= {};
    this.run.loops ??= {};
    this.graph = graphOf(this.run.definition);
  }

  private save(): void {
    if (!this.closed) saveRun(this.dirs, this.run);
  }

  private log(text: string): void {
    this.io.print(text);
  }

  private now(): number {
    return this.io.now();
  }

  private async live(address: string): Promise<boolean> {
    return (await this.io.get(address))?.state === "live";
  }

  private attempts(id: string): number {
    return this.run.steps.filter((record) => record.id === id && !record.reused).length;
  }

  private record(id: string, status: string): Record_ {
    const record: Record_ = { id, attempt: this.attempts(id) + 1, epoch: epochOf(this.run, id), status, started: this.now() };
    this.run.steps.push(record);
    return record;
  }

  private async nameTab(tab: string, name: string): Promise<void> {
    for (let tries = 1; tries <= RENAME_TRIES; tries += 1) {
      try {
        await this.io.act("tab.rename", { id: tab, name });
        return;
      } catch {
        await this.io.sleep(POLL_MS / 2);
      }
    }
  }

  private status(): void {
    const waiting = this.gates.size > 0;
    const next = waiting ? "approval" : "running";
    if (this.run.status !== next) {
      this.run.status = next;
      this.save();
    }
    if (this.shownStatus !== next) {
      this.shownStatus = next;
      this.io.report(waiting ? "blocked" : "working");
    }
  }

  private poll(): void {
    const decision = takeDecision(this.dirs, this.run.id);
    const line = typed(this.io.input());
    const choices: { action: string; node: string | null }[] = [];
    if (decision) choices.push(decision);
    if (line) {
      const [word, node] = line.split(/\s+/);
      if (STOP_LINES.includes(word)) choices.push({ action: "stop", node: null });
      else if (["a", "approve"].includes(word)) choices.push({ action: "approve", node: node ?? null });
      else if (["r", "reject"].includes(word)) choices.push({ action: "reject", node: node ?? null });
    }
    for (const choice of choices) {
      if (choice.action === "stop") {
        this.stopping ??= "stopped";
        continue;
      }
      const gates = [...this.gates.keys()];
      const target = choice.node ?? (gates.length === 1 ? gates[0] : null);
      if (!target || !this.gates.has(target)) {
        this.log(gates.length > 1 ? `  Several steps wait: type a or r with the step, as in "a ${gates[0]}".` : "  Nothing waits for an answer.");
        continue;
      }
      this.gates.get(target)?.(choice.action);
    }
  }

  async execute(): Promise<Run> {
    const run = this.run;
    if (FINAL.includes(run.status)) return run;
    run.runner = this.io.self();
    if (run.status === "starting") run.status = "running";
    this.save();
    if (run.tab) await this.nameTab(run.tab, `⚙ ${run.workflow} #${run.number}`);
    this.log(`${run.definition.title ?? run.workflow} · run ${run.id}`);
    this.log("Type s and Enter to stop the run.");
    try {
      await this.reattach();
      for (;;) {
        this.poll();
        if (this.stopping) throw new Stopped(this.stopping);
        if (this.failure) throw new Error(this.failure);
        let changed = true;
        while (changed && !this.failure) {
          changed = false;
          for (const id of readyNodes(this.graph, run)) {
            if (this.tasks.has(id) || this.busyAgent(id)) continue;
            if (this.tasks.size >= MAX_PARALLEL) break;
            if (this.begin(id)) changed = true;
            if (this.failure) break;
          }
        }
        if (this.failure) throw new Error(this.failure);
        if (this.tasks.size === 0) break;
        this.status();
        await Promise.race([...this.tasks.values(), this.io.sleep(POLL_MS)]);
      }
      return this.finish("done");
    } catch (error) {
      if (error instanceof Stopped) return this.finish("stopped", error.message === "rejected" ? "rejected at the gate" : error.message);
      return this.finish("failed", error instanceof Error ? error.message : String(error));
    }
  }

  private busyAgent(id: string): boolean {
    const root = agentRoot(this.graph, id);
    return Boolean(root) && [...this.tasks.keys()].some((other) => other !== id && agentRoot(this.graph, other) === root);
  }

  private async reattach(): Promise<void> {
    for (const id of this.graph.order) {
      const record = current(this.run, id);
      if (!record || !["running", "approval"].includes(record.status)) continue;
      const node = this.graph.byId.get(id);
      const kind = nodeKind(node);
      const keep = kind === "approve" || (["agent", "continue"].includes(kind ?? "") && record.sent && record.terminal && (await this.live(record.terminal)));
      if (keep) {
        this.log(`  picking up ${id}`);
        this.track(id, record);
      } else {
        record.status = "interrupted";
        record.ended = this.now();
        this.log(`  ${id} was cut off; running it again`);
      }
    }
    this.save();
  }

  private begin(id: string): boolean {
    const node = this.graph.byId.get(id);
    const kind = nodeKind(node);
    const incoming = this.graph.forwardIn.get(id) ?? [];
    if (incoming.length && activeIn(this.graph, this.run, id).length === 0) {
      const record = this.record(id, "skipped");
      record.ended = this.now();
      this.log(`- ${id}: skipped`);
      this.save();
      return true;
    }
    const exhausted = loopsExhausted(this.graph, this.run, id);
    if (exhausted.length) {
      this.failure = `${id} is still needed after going back to ${exhausted[0].to} ${exhausted[0].max} times`;
      return false;
    }
    if (kind === "start") {
      const record = this.record(id, "done");
      record.output = Object.entries(this.run.inputs).map(([name, value]) => `${name}: ${value}`).join("\n");
      record.ended = this.now();
      this.log(`> ${id}`);
      this.save();
      this.afterDone(id);
      return true;
    }
    if (kind === "condition") {
      const record = this.record(id, "done");
      try {
        const yes = evaluate(node.condition, scopeOf(this.run));
        record.output = yes ? "yes" : "no";
        record.fields = { branch: record.output };
        record.ended = this.now();
        this.log(`> ${id}: ${record.output}`);
        this.save();
        this.afterDone(id);
      } catch (error) {
        record.status = "failed";
        record.error = error instanceof Error ? error.message : String(error);
        this.failure = `${id}: ${record.error}`;
      }
      return true;
    }
    const record = this.record(id, "running");
    this.save();
    this.log(`> ${id}`);
    this.track(id, record);
    return false;
  }

  private track(id: string, record: Record_): void {
    const node = this.graph.byId.get(id);
    const kind = nodeKind(node);
    const work = kind === "run" ? this.command(node, record) : kind === "approve" ? this.approval(node, record) : this.agent(node, record);
    const task = work
      .then(() => {
        if (this.closed) return;
        record.status = "done";
        record.ended = this.now();
        this.log(`  ${id}: done`);
        this.save();
        if ((record.epoch ?? 0) === epochOf(this.run, id)) this.afterDone(id);
      })
      .catch((error) => {
        if (this.closed) return;
        record.ended = this.now();
        if (error instanceof Stopped) {
          record.status = "stopped";
          this.stopping ??= error.message;
        } else {
          record.status = "failed";
          record.error = error instanceof Error ? error.message : String(error);
          this.failure ??= `${id}: ${record.error}`;
        }
        this.save();
      })
      .finally(() => {
        this.tasks.delete(id);
        this.gates.delete(id);
      });
    this.tasks.set(id, task);
  }

  private afterDone(id: string): void {
    if (this.run.only) return;
    for (const edge of loopsTaken(this.graph, this.run, id)) {
      const taken = this.run.loops[loopKey(edge)] ?? 0;
      if (taken >= edge.max) {
        this.failure ??= `${id} is still needed after going back to ${edge.to} ${edge.max} times`;
        return;
      }
      takeLoop(this.graph, this.run, edge);
      this.log(`  back to ${edge.to} (${taken + 1} of ${edge.max})`);
      this.save();
    }
  }

  private async finish(status: "done" | "failed" | "stopped", error?: string): Promise<Run> {
    const run = this.run;
    for (const record of run.steps) {
      if (["running", "approval"].includes(record.status) && (record.epoch ?? 0) === epochOf(run, record.id)) {
        record.status = "stopped";
        record.ended = this.now();
      }
    }
    run.status = status;
    run.ended = this.now();
    if (error) run.error = error;
    this.save();
    this.closed = true;
    this.io.report(status === "done" ? "done" : status === "failed" ? "error" : "idle");
    this.log(status === "done" ? "Workflow done." : status === "failed" ? `Workflow failed: ${error}` : `Workflow ${error}.`);
    this.log("Press Enter to close.");
    await this.io.enter();
    return run;
  }

  private file(node: any, record: Record_, extension: string): string {
    return join(this.run.dir, `${node.id}-${record.attempt}.${extension}`);
  }

  private cwd(node: any): string {
    return expandHome(node.cwd ? fill(node.cwd, scopeOf(this.run)) : this.run.folder);
  }

  private check(): void {
    if (this.stopping) throw new Stopped(this.stopping);
  }

  private async command(node: any, record: Record_): Promise<void> {
    const scope = scopeOf(this.run);
    const argv = node.run.map((part: string) => fill(part, scope));
    this.log(`  $ ${argv.join(" ")}`);
    const result = await this.io.spawn(argv, this.cwd(node), node.timeout ? node.timeout * 1000 : null);
    const file = this.file(node, record, "log");
    writeFileSync(file, result.output);
    record.file = file;
    record.output = cap(result.output);
    record.exit = result.exit;
    if (result.exit !== 0 && !node.allowFail) throw new Error(`${argv.join(" ")} exited with ${result.exit}`);
  }

  private async approval(node: any, record: Record_): Promise<void> {
    const scope = scopeOf(this.run);
    record.status = "approval";
    this.save();
    this.log(`  ${node.id}: ${fill(node.approve, scope)}`);
    if (node.show) this.log(fill(node.show, scope));
    this.log(this.gates.size ? `  Type a ${node.id} to approve or r ${node.id} to reject, then Enter.` : "  Type a to approve or r to reject, then Enter.");
    const answer = await new Promise<string>((resolve) => {
      this.gates.set(node.id, resolve);
      this.status();
    });
    this.gates.delete(node.id);
    if (answer === "reject") throw new Stopped("rejected");
    record.status = "running";
    record.output = "approved";
    this.status();
  }

  private async agent(node: any, record: Record_): Promise<void> {
    const run = this.run;
    const scope = scopeOf(run);
    const limit = node.timeout ? { at: this.now() + node.timeout * 1000, seconds: node.timeout } : null;
    if (!record.sent) {
      let terminal: string | null;
      if (node.continue) {
        terminal = agentTerminal(run, run.definition, node.continue);
        if (!terminal || !(await this.live(terminal))) throw new Error(`the agent of ${node.continue} is gone`);
      } else {
        terminal = await this.io.start({
          argv: node.agent,
          cwd: this.cwd(node),
          labels: { "herdr.space": run.space, ...(run.tab ? { "herdr.tab": run.tab } : {}), "nuoh.workflow": `${run.id}:${node.id}` },
          child: true,
        });
        record.terminal = terminal;
        this.save();
        this.log(`  ${node.agent.join(" ")} in ${terminal}`);
        await this.ready(terminal);
      }
      record.terminal = terminal;
      record.file = this.file(node, record, node.answer ? "json" : "md");
      rmSync(record.file, { force: true });
      record.turn = (await this.io.get(terminal))?.turn ?? 0;
      const message = agentMessage({ title: run.definition.title ?? run.workflow, step: node.id, task: fill(node.task, scope), file: record.file, answer: node.answer, inputs: nodeInputs(this.graph, run, node.id) });
      await this.io.send(terminal, message);
      record.sent = true;
      this.save();
    }
    const terminal = record.terminal as string;
    const file = record.file as string;
    await this.settle(terminal, record.turn ?? 0, limit);
    let answer = this.answer(node, file);
    if (!answer.ok) {
      this.log(`  ${node.id}: ${answer.error ?? "no answer yet"}; asking once more`);
      const turn = (await this.io.get(terminal))?.turn ?? 0;
      await this.io.send(terminal, retryMessage({ file, answer: node.answer, error: answer.error }));
      await this.settle(terminal, turn, limit);
      answer = this.answer(node, file);
    }
    if (!answer.ok) {
      const tail = (await this.io.screen(terminal, 40)).trim();
      throw new Error(`${node.id} wrote no usable answer${answer.error ? ` (${answer.error})` : ""}${tail ? `\n${tail}` : ""}`);
    }
    record.output = cap(answer.text);
    if (answer.fields) record.fields = answer.fields;
  }

  private answer(node: any, file: string): { ok: boolean; text: string; fields?: Record<string, unknown>; error?: string } {
    if (!existsSync(file)) return { ok: false, text: "" };
    const text = readFileSync(file, "utf8");
    if (!node.answer) return text.trim() ? { ok: true, text } : { ok: false, text };
    const read = readAnswer(text, node.answer);
    return read.ok ? { ok: true, text, fields: read.fields } : { ok: false, text, error: read.error };
  }

  private async ready(terminal: string): Promise<void> {
    const since = this.now();
    let looked = -Infinity;
    for (;;) {
      this.check();
      const info = await this.io.get(terminal);
      if (!info || info.state !== "live") throw new Error(`the agent in ${terminal} exited before it was ready\n${(await this.io.screen(terminal, 20)).trim()}`);
      if (info.reported && info.status === "idle") return;
      if (this.now() - looked >= SCREEN_MS) {
        looked = this.now();
        if (TRUST.test(await this.io.screen(terminal, 40))) throw new Error(`the agent in ${terminal} asks whether to trust ${this.run.folder}: answer it there, then retry`);
      }
      if (this.now() - since > READY_MS) throw new Error(`the agent in ${terminal} never reported ready: agent steps are for agents`);
      await this.io.sleep(POLL_MS);
    }
  }

  private async settle(terminal: string, before: number, limit: { at: number; seconds: number } | null): Promise<void> {
    let told = false;
    for (;;) {
      this.check();
      if (limit && this.now() > limit.at) throw new Error(`timed out after ${limit.seconds}s`);
      const info = await this.io.get(terminal);
      if (!info || info.state !== "live") throw new Error(`the agent in ${terminal} exited`);
      if (info.turn > before && (info.status === "idle" || info.status === "done")) {
        if (await this.io.waitChildren(terminal)) return;
        continue;
      }
      if (info.status === "blocked" && !told) this.log(`  the agent in ${terminal} waits for you`);
      told = info.status === "blocked";
      if (info.status === "working") await this.io.waitTurn(terminal);
      else await this.io.sleep(POLL_MS);
    }
  }
}

export async function executeRun(io: Io, dirs: Dirs, id: string): Promise<Run> {
  return new Runner(io, dirs, id).execute();
}

export { latest };
