import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  agentMessage,
  agentTerminal,
  cap,
  evaluate,
  FINAL,
  fill,
  isWorkflowName,
  latest,
  nextIndex,
  parseWorkflow,
  readAnswer,
  resolveInputs,
  retryMessage,
  reuseBefore,
  runSummary,
  scopeOf,
  stepKind,
  timesRun,
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

type Record_ = {
  id: string;
  attempt: number;
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
  at: number | null;
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
const APPROVE_LINES = ["a", "approve"];
const REJECT_LINES = ["r", "reject"];

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
      const parsed = loadWorkflow(dirs, name);
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

export function decide(dirs: Dirs, id: string, action: "approve" | "reject" | "stop", now: number): void {
  const run = loadRun(dirs, id);
  if (FINAL.includes(run.status)) throw new Error(`run ${id} is already ${run.status}`);
  if (action !== "stop" && run.status !== "approval") throw new Error(`run ${id} waits for no approval`);
  writeFileSync(decisionFile(dirs, id), `${JSON.stringify({ action, at: now })}\n`);
}

function takeDecision(dirs: Dirs, id: string): string | null {
  const file = decisionFile(dirs, id);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")).action ?? null;
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

export async function startRun(io: Io, dirs: Dirs, name: string, given: Record<string, string>, space?: string): Promise<Run> {
  const parsed = loadWorkflow(dirs, name);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.problems.join("; ")}`);
  const { inputs, problems } = resolveInputs(parsed.workflow, given);
  if (problems.length) throw new Error(problems.join("; "));
  const where = await whereToRun(io, space);
  const made = makeRunDir(dirs, name);
  const run: Run = {
    id: made.id,
    workflow: name,
    number: made.number,
    dir: made.dir,
    definition: parsed.workflow,
    inputs,
    space: where.id,
    folder: where.folder,
    tab: newTab(),
    runner: null,
    status: "starting",
    at: 0,
    steps: [],
    created: io.now(),
  };
  saveRun(dirs, run);
  await launch(io, dirs, run);
  return run;
}

export async function retryRun(io: Io, dirs: Dirs, id: string, from?: string): Promise<Run> {
  const previous = loadRun(dirs, id);
  if (!FINAL.includes(previous.status) && (await runnerAlive(io, previous))) throw new Error(`run ${id} is still going: stop it first`);
  const parsed = loadWorkflow(dirs, previous.workflow);
  if (!parsed.ok) throw new Error(`${previous.workflow}: ${parsed.problems.join("; ")}`);
  const failed = previous.steps.findLast((record) => ["failed", "stopped", "interrupted", "running", "approval"].includes(record.status));
  const start = from ?? failed?.id ?? previous.definition.steps[previous.at ?? 0]?.id;
  if (!start) throw new Error(`run ${id} has no step to start from: pass --from <step>`);
  const reused = reuseBefore(previous, parsed.workflow, start);
  if (!reused) throw new Error(`${previous.workflow} has no step "${start}"`);
  const made = makeRunDir(dirs, previous.workflow);
  const run: Run = {
    ...previous,
    id: made.id,
    number: made.number,
    dir: made.dir,
    definition: parsed.workflow,
    tab: newTab(),
    runner: null,
    status: "starting",
    at: reused.index,
    steps: reused.steps,
    created: io.now(),
    ended: undefined,
    error: undefined,
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

  constructor(
    private io: Io,
    private dirs: Dirs,
    id: string,
  ) {
    this.run = loadRun(dirs, id);
  }

  private save(): void {
    saveRun(this.dirs, this.run);
  }

  private log(text: string): void {
    this.io.print(text);
  }

  private get steps(): any[] {
    return this.run.definition.steps;
  }

  private now(): number {
    return this.io.now();
  }

  private pollStop(): void {
    const decision = takeDecision(this.dirs, this.run.id);
    const line = typed(this.io.input());
    if (decision === "stop" || (line && STOP_LINES.includes(line))) throw new Stopped("stopped");
  }

  private async live(address: string): Promise<boolean> {
    return (await this.io.get(address))?.state === "live";
  }

  private async canResume(kind: string | null, record: Record_): Promise<boolean> {
    if (kind === "approve") return true;
    if (kind === "run") return false;
    return Boolean(record.sent && record.terminal && (await this.live(record.terminal)));
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

  private attempts(id: string): number {
    return this.run.steps.filter((record) => record.id === id && !record.reused).length;
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
      while (run.at !== null && run.at < this.steps.length) {
        this.pollStop();
        const index = run.at;
        const step = this.steps[index];
        const kind = stepKind(step);
        const pending = latest(run, step.id);
        const resumed = Boolean(pending && ["running", "approval"].includes(pending.status));
        let record: Record_ | null = resumed ? pending : null;
        if (record && !(await this.canResume(kind, record))) {
          record.status = "interrupted";
          record.ended = this.now();
          this.log(`  ${step.id} was cut off; running it again`);
          record = null;
        }
        if (!resumed) {
          if (step.when && !evaluate(step.when, scopeOf(run))) {
            run.steps.push({ id: step.id, attempt: this.attempts(step.id) + 1, status: "skipped", started: this.now(), ended: this.now() });
            this.log(`- ${step.id}: skipped`);
            run.at = nextIndex(run.definition, index, { status: "skipped" });
            this.save();
            continue;
          }
          if (step.goto && timesRun(run, step.id) >= step.max) throw new Error(`${step.id} is still needed after ${step.max} passes`);
        }
        if (!record) {
          record = { id: step.id, attempt: this.attempts(step.id) + 1, status: "running", started: this.now() };
          run.steps.push(record);
        }
        this.save();
        this.log(`> ${step.id} (${index + 1}/${this.steps.length})`);
        try {
          if (kind === "run") await this.command(step, record);
          else if (kind === "approve") await this.approval(step, record);
          else await this.agent(step, index, record);
        } catch (error) {
          record.ended = this.now();
          record.status = error instanceof Stopped ? "stopped" : "failed";
          if (!(error instanceof Stopped)) record.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
        record.ended = this.now();
        record.status = "done";
        this.log(`  ${step.id}: done`);
        run.at = nextIndex(run.definition, index, record);
        this.save();
      }
      return this.finish("done");
    } catch (error) {
      if (error instanceof Stopped) return this.finish("stopped", error.message === "rejected" ? "rejected at the gate" : "stopped");
      return this.finish("failed", error instanceof Error ? error.message : String(error));
    }
  }

  private async finish(status: "done" | "failed" | "stopped", error?: string): Promise<Run> {
    const run = this.run;
    run.status = status;
    run.ended = this.now();
    if (error) run.error = error;
    run.at = null;
    this.save();
    this.io.report(status === "done" ? "done" : status === "failed" ? "error" : "idle");
    this.log(status === "done" ? "Workflow done." : status === "failed" ? `Workflow failed: ${error}` : `Workflow ${error}.`);
    this.log("Press Enter to close.");
    await this.io.enter();
    return run;
  }

  private file(step: any, record: Record_, extension: string): string {
    return join(this.run.dir, `${step.id}-${record.attempt}.${extension}`);
  }

  private cwd(step: any): string {
    return expandHome(step.cwd ? fill(step.cwd, scopeOf(this.run)) : this.run.folder);
  }

  private async command(step: any, record: Record_): Promise<void> {
    const scope = scopeOf(this.run);
    const argv = step.run.map((part: string) => fill(part, scope));
    this.io.report("working");
    this.log(`  $ ${argv.join(" ")}`);
    const result = await this.io.spawn(argv, this.cwd(step), step.timeout ? step.timeout * 1000 : null);
    const file = this.file(step, record, "log");
    writeFileSync(file, result.output);
    record.file = file;
    record.output = cap(result.output);
    record.exit = result.exit;
    if (result.exit !== 0 && !step.allowFail) throw new Error(`${argv.join(" ")} exited with ${result.exit}`);
  }

  private async approval(step: any, record: Record_): Promise<void> {
    const scope = scopeOf(this.run);
    record.status = "approval";
    this.run.status = "approval";
    this.save();
    this.io.report("blocked");
    this.log(`  ${fill(step.approve, scope)}`);
    if (step.show) this.log(fill(step.show, scope));
    this.log("  Type a to approve or r to reject, then Enter.");
    for (;;) {
      const decision = takeDecision(this.dirs, this.run.id);
      const line = typed(this.io.input());
      if (decision === "stop" || (line && STOP_LINES.includes(line))) throw new Stopped("stopped");
      if (decision === "reject" || (line && REJECT_LINES.includes(line))) throw new Stopped("rejected");
      if (decision === "approve" || (line && APPROVE_LINES.includes(line))) break;
      await this.io.sleep(POLL_MS);
    }
    record.output = "approved";
    this.run.status = "running";
    this.save();
    this.io.report("working");
  }

  private async agent(step: any, index: number, record: Record_): Promise<void> {
    const run = this.run;
    const scope = scopeOf(run);
    this.io.report("working");
    const limit = step.timeout ? { at: this.now() + step.timeout * 1000, seconds: step.timeout } : null;
    if (!record.sent) {
      let terminal: string | null;
      if (step.continue) {
        terminal = agentTerminal(run, run.definition, step.continue);
        if (!terminal || !(await this.live(terminal))) throw new Error(`the agent of ${step.continue} is gone`);
      } else {
        terminal = await this.io.start({
          argv: step.agent,
          cwd: this.cwd(step),
          labels: { "herdr.space": run.space, ...(run.tab ? { "herdr.tab": run.tab } : {}), "nuoh.workflow": `${run.id}:${step.id}` },
          child: true,
        });
        record.terminal = terminal;
        this.save();
        this.log(`  ${step.agent.join(" ")} in ${terminal}`);
        await this.ready(terminal);
      }
      record.terminal = terminal;
      record.file = this.file(step, record, step.answer ? "json" : "md");
      rmSync(record.file, { force: true });
      record.turn = (await this.io.get(terminal))?.turn ?? 0;
      const message = agentMessage({ title: run.definition.title ?? run.workflow, step: step.id, index, total: this.steps.length, task: fill(step.task, scope), file: record.file, answer: step.answer });
      await this.io.send(terminal, message);
      record.sent = true;
      this.save();
    }
    const terminal = record.terminal as string;
    const file = record.file as string;
    await this.settle(terminal, record.turn ?? 0, limit);
    let answer = this.answer(step, file);
    if (!answer.ok) {
      this.log(`  ${step.id}: ${answer.error ?? "no answer yet"}; asking once more`);
      const turn = (await this.io.get(terminal))?.turn ?? 0;
      await this.io.send(terminal, retryMessage({ file, answer: step.answer, error: answer.error }));
      await this.settle(terminal, turn, limit);
      answer = this.answer(step, file);
    }
    if (!answer.ok) {
      const tail = (await this.io.screen(terminal, 40)).trim();
      throw new Error(`${step.id} wrote no usable answer${answer.error ? ` (${answer.error})` : ""}${tail ? `\n${tail}` : ""}`);
    }
    record.output = cap(answer.text);
    if (answer.fields) record.fields = answer.fields;
  }

  private answer(step: any, file: string): { ok: boolean; text: string; fields?: Record<string, unknown>; error?: string } {
    if (!existsSync(file)) return { ok: false, text: "" };
    const text = readFileSync(file, "utf8");
    if (!step.answer) return text.trim() ? { ok: true, text } : { ok: false, text };
    const read = readAnswer(text, step.answer);
    return read.ok ? { ok: true, text, fields: read.fields } : { ok: false, text, error: read.error };
  }

  private async ready(terminal: string): Promise<void> {
    const since = this.now();
    let looked = -Infinity;
    for (;;) {
      this.pollStop();
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
      this.pollStop();
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
