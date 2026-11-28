import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { byKey, click, find, flush, herdr, makeCx, texts } from "./app-mocks";
import { removeTempDirs, tempDir } from "./helpers";

const { default: Workflows } = await import("../mods/workflows/main.js");

const REPO = "/repo";
const BUN = "/bin/bun";
const FLOW = {
  title: "Flow",
  inputs: { task: { label: "Task", required: true } },
  nodes: [
    { id: "start", start: {} },
    { id: "implement", agent: ["claude"], task: "Do {{input.task}}" },
    { id: "ship", approve: "Ship {{input.task}}?" },
  ],
  edges: [
    { from: "start", to: "implement" },
    { from: "implement", to: "ship" },
  ],
};

let dirs = { workflows: "", runs: "" };
let execs: string[][] = [];
let answer: (args: string[]) => { code: number; stdout: string; stderr: string } = () => ({ code: 0, stdout: "{}", stderr: "" });
let terminalsNow: Record<string, unknown>[] = [];
let commands: { name: string; args: unknown }[] = [];
let overlays: Record<string, any>[] = [];
let closed: string[] = [];
let notices: Record<string, unknown>[] = [];

function writeWorkflow(name: string, value: unknown) {
  writeFileSync(join(dirs.workflows, `${name}.json`), typeof value === "string" ? value : JSON.stringify(value));
}

function writeRun(id: string, value: Record<string, unknown>) {
  mkdirSync(join(dirs.runs, id), { recursive: true });
  writeFileSync(join(dirs.runs, id, "run.json"), JSON.stringify({ id, workflow: "flow", number: Number(id.split("-").pop()), created: Date.now(), inputs: { task: "login" }, steps: [], ...value }));
}

beforeEach(() => {
  const root = tempDir();
  dirs = { workflows: join(root, "workflows"), runs: join(root, "runs") };
  mkdirSync(dirs.workflows, { recursive: true });
  mkdirSync(dirs.runs, { recursive: true });
  execs = [];
  commands = [];
  overlays = [];
  closed = [];
  notices = [];
  terminalsNow = [];
  answer = () => ({ code: 0, stdout: "{}", stderr: "" });
  herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `t.${prop}` : undefined) });
  herdr.checking = () => false;
  herdr.props = () => null;
  herdr.window = () => ({ visible: true });
  herdr.watchFolder = () => Object.assign(new Promise(() => {}), { cancel() {} });
  herdr.readTextFile = (async (path: string) => Bun.file(path).text()) as never;
  herdr.terminals = () => terminalsNow as never;
  herdr.spaces = () => [{ id: "s1", name: "app", machine: null }, { id: "s2", name: "vps", machine: "vps" }, { id: "s3", name: "api", machine: null }] as never;
  herdr.focused = () => ({ space: "s3" }) as never;
  herdr.run = ((name: string, args: unknown) => commands.push({ name, args })) as never;
  herdr.openOverlay = ((spec: Record<string, any>) => overlays.push(spec)) as never;
  herdr.closeOverlay = ((id: string) => closed.push(id)) as never;
  herdr.notify = ((notice: Record<string, unknown>) => notices.push(notice)) as never;
  herdr.knownAgents = (async () => [{ installed: false, run: ["codex"] }, { installed: true, run: ["claude"] }]) as never;
  herdr.exec = (async (command: string, args: string[]) => {
    expect(command).toBe(BUN);
    expect(args[0]).toBe(`${REPO}/scripts/workflow.ts`);
    const rest = args.slice(1);
    execs.push(rest);
    if (rest[0] === "paths") return { code: 0, stdout: JSON.stringify(dirs), stderr: "" };
    return answer(rest);
  }) as never;
});

afterEach(removeTempDirs);

async function open(role = "body", extra: Record<string, unknown> = {}) {
  const view = new Workflows();
  const cx = makeCx();
  view.init({ role, repo: REPO, bun: BUN, ...extra }, cx);
  await flush();
  return { view, cx, draw: () => view.render(cx) };
}

describe("the body", () => {
  test("without workflows it offers to write one with an agent", async () => {
    const { draw, cx } = await open();
    expect(texts(draw())).toContain("No workflows yet");
    click(byKey(draw(), "workflows-empty-new"), cx);
    await flush();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("tab.new");
    expect(commands[0].args).toMatchObject({ space: "s3", name: "New workflow", folder: dirs.workflows, argv: ["claude"] });
    expect((commands[0].args as { task: string }).task).toContain(`${BUN} ${REPO}/scripts/workflow.ts format`);
  });

  test("lists the workflows, the chosen one's steps and its runs, newest first", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "done", ended: Date.now() });
    writeRun("flow-2", { status: "running", at: 0, runner: "t9", steps: [{ id: "implement", status: "running", terminal: "t10" }] });
    terminalsNow = [{ address: "t9", labels: { "nuoh.workflow": "flow-2" } }, { address: "t10", labels: { "nuoh.workflow": "flow-2:implement" } }];
    const { draw } = await open();
    const all = texts(draw());
    expect(all).toContain("Flow");
    expect(all).toContain("3 steps · Running");
    expect(all).toContain("implement");
    expect(all).toContain("Do login");
    expect(all).toContain("#2 · Running");
    expect(all).toContain("#1 · Done");
    expect(find(draw(), (node) => node.key === "workflows-run-flow-2")).not.toBeNull();
    expect(texts(byKey(draw(), "workflows-runs-rows")).indexOf("#2 · Running")).toBeLessThan(texts(byKey(draw(), "workflows-runs-rows")).indexOf("#1 · Done"));
  });

  test("a run at its gate is approved or rejected from the step's card", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "approval", at: 1, runner: "t9", steps: [{ id: "implement", status: "done", output: "Did it" }, { id: "ship", status: "approval" }] });
    terminalsNow = [{ address: "t9", labels: { "nuoh.workflow": "flow-1" } }];
    const { draw, cx } = await open();
    expect(texts(draw())).toContain("Ship login?");
    click(byKey(draw(), "workflows-approve-ship"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["approve", "flow-1"]);
    click(byKey(draw(), "workflows-reject-ship"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["reject", "flow-1"]);
  });

  test("a run whose runner is gone reads Interrupted and can be resumed", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "running", at: 0, runner: "t9", steps: [{ id: "implement", status: "running" }] });
    const { draw, cx } = await open();
    expect(texts(draw())).toContain("#1 · Interrupted");
    expect(texts(draw())).toContain("Cut off");
    click(byKey(draw(), "workflows-resume"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["resume", "flow-1"]);
  });

  test("a run stopped by hand doesn't repeat its chip; one rejected says so", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "stopped", at: null, error: "stopped", steps: [] });
    const { draw, view } = await open();
    expect(texts(byKey(draw(), "workflows-steps")).filter((text) => text === "stopped")).toEqual([]);
    writeRun("flow-2", { status: "stopped", at: null, error: "rejected at the gate", steps: [] });
    await view.load();
    expect(texts(draw())).toContain("rejected at the gate");
  });

  test("a command that fails says why in a toast", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "failed", at: null, error: "implement wrote no usable answer", steps: [{ id: "implement", status: "failed", error: "implement wrote no usable answer" }] });
    answer = () => ({ code: 1, stdout: "", stderr: "workflow: flow has no step \"x\"\n" });
    const { draw, cx } = await open();
    expect(texts(draw())).toContain("implement wrote no usable answer");
    click(byKey(draw(), "workflows-retry"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["retry", "flow-1"]);
    expect(notices).toEqual([{ title: "Workflow", body: 'flow has no step "x"', level: "error" }]);
  });

  test("an invalid file shows its problems and offers an agent to fix it", async () => {
    writeWorkflow("broken", { nodes: [{ id: "start", start: {} }, { id: "a", run: [] }], edges: [] });
    const { draw, cx } = await open();
    expect(texts(draw())).toContain('step "a": run must be a list like ["bun", "test"]');
    click(byKey(draw(), "workflows-fix"), cx);
    await flush();
    expect(commands[0].args).toMatchObject({ name: "Edit broken" });
  });

  test("Run opens the run popup with the workflow's inputs and a height for this machine's spaces", async () => {
    writeWorkflow("flow", FLOW);
    const { draw } = await open();
    click(byKey(draw(), "workflows-run"));
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({ mod: "workflows", kind: "dialog", width: 440, props: { role: "run", workflow: "flow", title: "Flow", repo: REPO, bun: BUN, inputs: [{ name: "task", label: "Task", required: true, value: "" }] } });
    expect(overlays[0].height).toBeGreaterThan(200);
  });

  test("starts no work while Herdr checks it", async () => {
    herdr.checking = () => true;
    await open();
    expect(execs).toEqual([]);
  });
});

describe("the run popup", () => {
  const popup = () => open("run", { workflow: "flow", title: "Flow", overlay: "o1", inputs: [{ name: "task", label: "Task", required: true, value: "" }] });

  test("needs the required inputs, then runs in the chosen space and closes", async () => {
    const { view, draw, cx } = await popup();
    expect(texts(draw())).toContain("Run Flow");
    expect(texts(draw())).toContain("Task (required)");
    expect(texts(draw())).not.toContain("vps");
    click(byKey(draw(), "workflows-start"), cx);
    await flush();
    expect(execs).toEqual([]);
    view.states.task.set_value("Fix login");
    view.states.task.emit("change", cx);
    click(byKey(draw(), "workflows-space-s1"), cx);
    click(byKey(draw(), "workflows-start"), cx);
    await flush();
    expect(execs).toEqual([["run", "flow", "--input", "task=Fix login", "--space", "s1", "--json"]]);
    expect(closed).toEqual(["o1"]);
  });

  test("keeps the popup open with the reason when the run can't start", async () => {
    answer = () => ({ code: 1, stdout: "", stderr: "workflow: space app is on vps\n" });
    const { view, draw, cx } = await popup();
    view.states.task.set_value("x");
    view.states.task.emit("change", cx);
    click(byKey(draw(), "workflows-start"), cx);
    await flush();
    expect(closed).toEqual([]);
    expect(texts(draw())).toContain("space app is on vps");
  });
});

describe("the band", () => {
  test("counts the valid workflows and writes a new one with an agent", async () => {
    writeWorkflow("flow", FLOW);
    writeWorkflow("broken", "{");
    const { draw, cx } = await open("bar");
    expect(texts(draw())).toContain("1 workflow");
    click(byKey(draw(), "workflows-new"), cx);
    await flush();
    expect(commands[0]).toMatchObject({ name: "tab.new", args: { name: "New workflow" } });
  });
});
