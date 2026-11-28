import { afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decide, type Dirs, executeRun, type Io, loadRun, resumeRun, retryRun, saveRun, startRun, summaries } from "../scripts/workflow-run";
import { makeHomes, removeTempDirs, repo, run as runScript, tempDir } from "./helpers";

afterEach(removeTempDirs);

type Fake = {
  address: string;
  state: string;
  turn: number;
  status: string | null;
  reported: boolean;
  labels: Record<string, string>;
  argv: string[];
  child: boolean;
  messages: string[];
  screen: string;
  later: (() => void) | null;
};
type Behave = (message: string, file: string | null, terminal: Fake, world: World) => "busy" | void;
type World = ReturnType<typeof makeWorld>;

const FILE = /(?:answer to|answer in) (\/\S+?)[:.]?(?:\s|$)/;

function makeWorld(folder: string) {
  return {
    clock: 1_000_000,
    next: 1,
    terminals: new Map<string, Fake>(),
    agents: {} as Record<string, Behave>,
    commands: {} as Record<string, { exit: number; output: string }[]>,
    spawned: [] as { argv: string[]; cwd: string }[],
    lines: [] as string[],
    printed: [] as string[],
    reports: [] as string[],
    acts: [] as { name: string; args: unknown }[],
    spaces: [{ id: "s1", name: "app", folder, machine: null as string | null }],
    self: "t0" as string | null,
    unready: new Set<string>(),
    onReport: {} as Record<string, () => void>,
    onSleep: null as null | (() => void),
    working: 0,
    maxWorking: 0,
  };
}

function fakeIo(world: World): Io {
  return {
    now: () => world.clock,
    async sleep(ms) {
      world.clock += ms;
      world.onSleep?.();
    },
    print: (text) => world.printed.push(text),
    report(status) {
      world.reports.push(status);
      world.onReport[status]?.();
    },
    async get(address) {
      const terminal = world.terminals.get(address);
      return terminal ? { ...terminal } : null;
    },
    async start({ argv, labels, child }) {
      const address = `t${world.next++}`;
      const unready = world.unready.has(argv[0]);
      world.terminals.set(address, { address, state: "live", turn: 0, status: unready ? null : "idle", reported: !unready, labels, argv, child, messages: [], screen: "", later: null });
      return address;
    },
    async send(address, text) {
      const terminal = world.terminals.get(address);
      if (!terminal) throw new Error(`no terminal ${address}`);
      terminal.messages.push(text);
      const busy = world.agents[terminal.argv[0]]?.(text, FILE.exec(text)?.[1] ?? null, terminal, world);
      terminal.turn += 1;
      terminal.status = busy === "busy" ? "working" : "idle";
    },
    async waitTurn(address) {
      world.clock += 1000;
      const terminal = world.terminals.get(address);
      const later = terminal?.later;
      if (terminal && later) {
        terminal.later = null;
        later();
      }
      world.onSleep?.();
    },
    waitChildren: async () => true,
    async screen(address) {
      return world.terminals.get(address)?.screen ?? "";
    },
    async spawn(argv, cwd) {
      world.spawned.push({ argv, cwd });
      return world.commands[argv.join(" ")]?.shift() ?? { exit: 0, output: "" };
    },
    async act(name, args) {
      world.acts.push({ name, args });
      return {};
    },
    spaces: async () => world.spaces,
    input: () => world.lines.shift() ?? null,
    enter: async () => {},
    self: () => world.self,
    runner: (id, runs) => ["bun", "workflow.ts", "exec", id, "--runs", runs],
  };
}

function setup(workflows: Record<string, unknown> = {}) {
  const root = tempDir();
  const dirs: Dirs = { workflows: join(root, "workflows"), runs: join(root, "runs") };
  const folder = join(root, "app");
  mkdirSync(dirs.workflows, { recursive: true });
  mkdirSync(folder, { recursive: true });
  for (const [name, value] of Object.entries(workflows)) writeFileSync(join(dirs.workflows, `${name}.json`), JSON.stringify(value));
  const world = makeWorld(folder);
  world.terminals.set("t0", { address: "t0", state: "live", turn: 0, status: "working", reported: true, labels: { "herdr.space": "s1" }, argv: ["claude"], child: false, messages: [], screen: "", later: null });
  return { root, dirs, folder, world, io: fakeIo(world) };
}

const writes =
  (...answers: string[]): Behave =>
  (_message, file) => {
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    if (file && answer !== "") writeFileSync(file, answer as string);
  };

const slow =
  (answer: string): Behave =>
  (_message, file, terminal, world) => {
    world.working += 1;
    world.maxWorking = Math.max(world.maxWorking, world.working);
    terminal.later = () => {
      world.working -= 1;
      if (file) writeFileSync(file, answer);
      terminal.status = "idle";
    };
    return "busy";
  };

const steps = (run: { steps: { id: string; status: string }[] }) => run.steps.map((record) => `${record.id}:${record.status}`);
const start = { id: "start", start: {} };
const edge = (from: string, to: string, extra = {}) => ({ from, to, ...extra });
const graph = (nodes: unknown[], edges: unknown[], extra = {}) => ({ title: "Flow", nodes: [start, ...nodes], edges, ...extra });
const EXAMPLE = JSON.parse(readFileSync(join(repo, "tests/fixtures/workflows/implement-review.json"), "utf8"));

async function startAndRun(context: ReturnType<typeof setup>, name: string, inputs: Record<string, string> = {}, options = {}) {
  const run = await startRun(context.io, context.dirs, name, inputs, options);
  context.world.self = "t-runner";
  return executeRun(context.io, context.dirs, run.id);
}

describe("starting a run", () => {
  test("makes a run folder and starts its runner in a new tab of the caller's space", async () => {
    const context = setup({ flow: EXAMPLE });
    const run = await startRun(context.io, context.dirs, "flow", { task: "Fix login" });
    expect(run).toMatchObject({ id: "flow-1", space: "s1", folder: context.folder, status: "starting", epoch: {}, loops: {}, steps: [] });
    const runner = context.world.terminals.get("t1")!;
    expect(runner.argv).toEqual(["bun", "workflow.ts", "exec", "flow-1", "--runs", context.dirs.runs]);
    expect(runner.labels).toEqual({ "herdr.space": "s1", "herdr.tab": run.tab!, "nuoh.workflow": "flow-1" });
    expect((await startRun(context.io, context.dirs, "flow", { task: "Again" })).id).toBe("flow-2");
  });

  test("refuses missing inputs, unknown and remote spaces, a caller outside Herdr and an invalid file", async () => {
    const context = setup({ flow: EXAMPLE, bad: { nodes: [start, { id: "a", run: [] }], edges: [] } });
    await expect(startRun(context.io, context.dirs, "flow", {})).rejects.toThrow('input "task" is required');
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" }, { space: "s9" })).rejects.toThrow("no space s9");
    context.world.spaces.push({ id: "s2", name: "vps-app", folder: "/srv", machine: "vps" });
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" }, { space: "s2" })).rejects.toThrow("space vps-app is on vps");
    await expect(startRun(context.io, context.dirs, "bad", {}, { space: "s1" })).rejects.toThrow('bad: step "a": run must be a list');
    context.world.self = null;
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" })).rejects.toThrow("pass --space <id>");
  });
});

describe("running a graph", () => {
  test("implement, test, review, fix and back, then the gate and the PR", async () => {
    const context = setup({ flow: EXAMPLE });
    const { world } = context;
    world.agents.claude = writes("Implemented.", "Fixed.", "PR opened.");
    world.agents.codex = writes('{"blocking": 2, "summary": "Two bugs"}', '{"blocking": 0, "summary": "Clean"}');
    world.commands["bun test"] = [{ exit: 1, output: "1 fail" }, { exit: 0, output: "all pass" }];
    world.onReport.blocked = () => decide(context.dirs, "flow-1", "approve", world.clock);
    const run = await startAndRun(context, "flow", { task: "Fix login" });

    expect(run.status).toBe("done");
    expect(steps(run)).toEqual([
      "start:done",
      "implement:done",
      "test:done",
      "review:done",
      "clean:done",
      "ship:skipped",
      "fix:done",
      "test:done",
      "review:done",
      "clean:done",
      "ship:done",
      "fix:skipped",
      "pr:done",
    ]);
    expect(run.loops).toEqual({ "fix->test": 1 });
    expect(run.steps.find((record) => record.id === "clean")).toMatchObject({ output: "no", fields: { branch: "no" } });

    const claude = [...world.terminals.values()].filter((terminal) => terminal.argv[0] === "claude" && terminal.address !== "t0");
    expect(claude).toHaveLength(1);
    expect(claude[0].messages).toHaveLength(3);
    expect(claude[0].messages[0]).toStartWith('Workflow "Implement, review, fix", step "implement".\n\nFix login\n\n');
    expect(claude[0].messages[1]).toContain("Fix what the review found:\nTwo bugs");
    expect(claude[0].labels).toEqual({ "herdr.space": "s1", "herdr.tab": run.tab!, "nuoh.workflow": "flow-1:implement" });
    const reviewers = [...world.terminals.values()].filter((terminal) => terminal.argv[0] === "codex");
    expect(reviewers).toHaveLength(2);
    expect(reviewers[0].messages[0]).toContain("--- input from test ---\n1 fail");
    expect(reviewers[1].messages[0]).toContain("--- input from test ---\nall pass");
    expect(world.reports.filter((status) => status !== "working")).toEqual(["blocked", "done"]);
    expect(world.acts[0]).toEqual({ name: "tab.rename", args: { id: run.tab, name: "⚙ flow #1" } });
    expect(loadRun(context.dirs, "flow-1")).toMatchObject({ status: "done", runner: "t-runner" });
  });

  test("steps that don't wait on each other run at the same time, at most four", async () => {
    const names = ["a", "b", "c", "d", "e", "f"];
    const context = setup({ wide: graph([...names.map((id) => ({ id, agent: ["claude"], task: `Do ${id}` })), { id: "join", run: ["echo", "{{a.output}}{{f.output}}"] }], [...names.map((id) => edge("start", id)), ...names.map((id) => edge(id, "join"))]) });
    context.world.agents.claude = slow("ok");
    const run = await startAndRun(context, "wide");
    expect(run.status).toBe("done");
    expect(context.world.maxWorking).toBe(4);
    expect(steps(run).at(-1)).toBe("join:done");
    expect(context.world.spawned).toEqual([{ argv: ["echo", "okok"], cwd: context.folder }]);
  });

  test("a branch not taken skips its steps, and a join runs with the input it has", async () => {
    const context = setup({
      branch: graph(
        [{ id: "pick", condition: "{{input.mode}} = fast" }, { id: "fast", run: ["fast"] }, { id: "slow", run: ["slow"] }, { id: "after-slow", run: ["after"] }, { id: "join", run: ["join", "[{{fast.output}}]"] }],
        [edge("start", "pick"), edge("pick", "fast", { branch: "yes" }), edge("pick", "slow", { branch: "no" }), edge("slow", "after-slow"), edge("fast", "join"), edge("after-slow", "join")],
        { inputs: { mode: { default: "fast" } } },
      ),
    });
    context.world.commands.fast = [{ exit: 0, output: "F" }];
    const run = await startAndRun(context, "branch");
    expect(steps(run)).toEqual(["start:done", "pick:done", "fast:done", "slow:skipped", "after-slow:skipped", "join:done"]);
    expect(context.world.spawned.map((call) => call.argv.join(" "))).toEqual(["fast", "join [F]"]);
  });

  test("a loop that keeps being needed fails once it has gone back max times", async () => {
    const context = setup({ flow: { ...EXAMPLE, edges: EXAMPLE.edges.map((one: any) => (one.max ? { ...one, max: 2 } : one)) } });
    context.world.agents.claude = writes("Done.");
    context.world.agents.codex = writes('{"blocking": 1, "summary": "Still broken"}');
    const run = await startAndRun(context, "flow", { task: "x" });
    expect(run.status).toBe("failed");
    expect(run.error).toBe("fix is still needed after going back to test 2 times");
    expect(steps(run).filter((step) => step.startsWith("fix"))).toEqual(["fix:done", "fix:done"]);
    expect(context.world.reports.at(-1)).toBe("error");
  });

  test("a loop out of a condition fails on the pass it would exceed", async () => {
    const context = setup({ again: graph([{ id: "t", run: ["try"], allowFail: true }, { id: "ok", condition: "{{t.exit}} = 0" }], [edge("start", "t"), edge("t", "ok"), edge("ok", "t", { branch: "no", max: 1 })]) });
    context.world.commands.try = [{ exit: 1, output: "" }, { exit: 1, output: "" }];
    const run = await startAndRun(context, "again");
    expect(run.error).toBe("ok is still needed after going back to t 1 times");
    expect(steps(run)).toEqual(["start:done", "t:done", "ok:done", "t:done", "ok:done"]);
  });

  test("a command that fails stops the run unless allowFail", async () => {
    const context = setup({ build: graph([{ id: "build", run: ["make", "{{run.id}}"] }, { id: "after", run: ["true"] }], [edge("start", "build"), edge("build", "after")]) });
    context.world.commands["make build-1"] = [{ exit: 2, output: "boom\n" }];
    const run = await startAndRun(context, "build");
    expect(run).toMatchObject({ status: "failed", error: "build: make build-1 exited with 2" });
    expect(steps(run)).toEqual(["start:done", "build:failed"]);
  });
});

describe("agent answers", () => {
  const ONE = graph([{ id: "ask", agent: ["claude"], task: "Go" }], [edge("start", "ask")]);

  test("an agent that writes no answer is asked once more; one that never answers fails with its screen", async () => {
    const context = setup({ one: ONE });
    context.world.agents.claude = writes("", "Here.");
    expect((await startAndRun(context, "one")).steps.at(-1)).toMatchObject({ status: "done", output: "Here." });
    const other = setup({ one: ONE });
    other.world.agents.claude = (_message, _file, terminal) => {
      terminal.screen = "I could not do it.";
    };
    expect((await startAndRun(other, "one")).error).toBe("ask: ask wrote no usable answer\nI could not do it.");
  });

  test("an invalid typed answer gets the problem back once", async () => {
    const context = setup({ typed: graph([{ id: "ask", agent: ["claude"], task: "Go", answer: { score: "number" } }], [edge("start", "ask")]) });
    context.world.agents.claude = writes('{"score": "high"}', '{"score": 7}');
    const run = await startAndRun(context, "typed");
    expect(run.steps.at(-1)?.fields).toEqual({ score: 7 });
  });

  test("a trust prompt, a program that never gets ready, a timeout and an exit each fail the step", async () => {
    const trust = setup({ one: ONE });
    trust.world.unready.add("claude");
    trust.world.onSleep = () => {
      for (const terminal of trust.world.terminals.values()) if (terminal.child) terminal.screen = "Do you trust the files in this folder?";
    };
    expect((await startAndRun(trust, "one")).error).toBe(`ask: the agent in t2 asks whether to trust ${trust.folder}: answer it there, then retry`);
    const never = setup({ one: ONE });
    never.world.unready.add("claude");
    expect((await startAndRun(never, "one")).error).toBe("ask: the agent in t2 never reported ready: agent steps are for agents");
    const late = setup({ slow: graph([{ id: "ask", agent: ["claude"], task: "Go", timeout: 30 }], [edge("start", "ask")]) });
    late.world.agents.claude = () => "busy";
    expect((await startAndRun(late, "slow")).error).toBe("ask: timed out after 30s");
    const gone = setup({ one: ONE });
    gone.world.agents.claude = (_message, _file, terminal) => {
      terminal.state = "finished";
    };
    expect((await startAndRun(gone, "one")).error).toBe("ask: the agent in t2 exited");
  });

  test("a continue step waits while its agent works for another step", async () => {
    const context = setup({
      share: graph([{ id: "a", agent: ["claude"], task: "A" }, { id: "b", continue: "a", task: "B" }, { id: "c", continue: "a", task: "C" }], [edge("start", "a"), edge("a", "b"), edge("a", "c")]),
    });
    context.world.agents.claude = slow("ok");
    const run = await startAndRun(context, "share");
    expect(run.status).toBe("done");
    expect(context.world.maxWorking).toBe(1);
    expect(context.world.terminals.get("t2")!.messages).toHaveLength(3);
  });
});

describe("gates and stopping", () => {
  const GATE = graph([{ id: "ask", approve: "Ship?" }, { id: "after", run: ["true"] }], [edge("start", "ask"), edge("ask", "after")]);

  test("rejecting from the runner's pane stops the run; approving goes on, also through hc's envelope", async () => {
    const context = setup({ gate: GATE });
    context.world.onReport.blocked = () => context.world.lines.push("r");
    const run = await startAndRun(context, "gate");
    expect(run).toMatchObject({ status: "stopped", error: "rejected at the gate" });
    expect(steps(run)).toEqual(["start:done", "ask:stopped"]);
    const other = setup({ gate: GATE });
    other.world.onReport.blocked = () => other.world.lines.push('<hc from="t9">A</hc>');
    expect(steps(await startAndRun(other, "gate"))).toEqual(["start:done", "ask:done", "after:done"]);
  });

  test("with two gates waiting, an answer names its step", async () => {
    const context = setup({ two: graph([{ id: "g1", approve: "One?" }, { id: "g2", approve: "Two?" }], [edge("start", "g1"), edge("start", "g2")]) });
    let asked = false;
    context.world.onSleep = () => {
      if (asked) return;
      const run = loadRun(context.dirs, "two-1");
      if (run.steps.filter((record) => record.status === "approval").length < 2) return;
      asked = true;
      expect(() => decide(context.dirs, "two-1", "approve", 0)).toThrow("run two-1 waits at g1 and g2: pass --node");
      decide(context.dirs, "two-1", "approve", 0, "g1");
      context.world.lines.push("a", "a g2");
    };
    const run = await startAndRun(context, "two");
    expect(run.status).toBe("done");
    expect(context.world.printed).toContain('  Several steps wait: type a or r with the step, as in "a g1".');
  });

  test("s in the runner's pane stops a run while an agent works", async () => {
    const context = setup({ one: graph([{ id: "ask", agent: ["claude"], task: "Go" }], [edge("start", "ask")]) });
    context.world.agents.claude = () => "busy";
    context.world.onSleep = () => context.world.lines.push("s");
    const run = await startAndRun(context, "one");
    expect(run.status).toBe("stopped");
    expect(steps(run)).toEqual(["start:done", "ask:stopped"]);
  });

  test("approve needs a gate; stop needs a run going", async () => {
    const context = setup({ gate: GATE });
    await startRun(context.io, context.dirs, "gate", {});
    expect(() => decide(context.dirs, "gate-1", "approve", 0)).toThrow("run gate-1 waits for no approval");
    decide(context.dirs, "gate-1", "stop", 0);
    context.world.self = "t-runner";
    expect((await executeRun(context.io, context.dirs, "gate-1")).status).toBe("stopped");
    expect(() => decide(context.dirs, "gate-1", "stop", 0)).toThrow("run gate-1 is already stopped");
  });
});

describe("retry, run from a step, one step alone, resume", () => {
  const CHAIN = graph([{ id: "a", run: ["echo", "one"] }, { id: "b", run: ["check"] }, { id: "c", run: ["echo", "{{a.output}}"] }], [edge("start", "a"), edge("a", "b"), edge("b", "c")]);

  test("retry starts a new run from the failed step and keeps what came before", async () => {
    const context = setup({ flow: CHAIN });
    context.world.commands["echo one"] = [{ exit: 0, output: "one" }];
    context.world.commands.check = [{ exit: 1, output: "no" }, { exit: 0, output: "yes" }];
    const first = await startAndRun(context, "flow");
    expect(first.status).toBe("failed");
    context.world.self = "t0";
    const second = await retryRun(context.io, context.dirs, first.id);
    expect(second.steps.map((record) => [record.id, record.reused])).toEqual([
      ["start", true],
      ["a", true],
    ]);
    context.world.self = "t-runner-2";
    const done = await executeRun(context.io, context.dirs, second.id);
    expect(steps(done)).toEqual(["start:done", "a:done", "b:done", "c:done"]);
    expect(context.world.spawned.map((call) => call.argv.join(" "))).toEqual(["echo one", "check", "check", "echo one"]);
  });

  test("run from a step reruns what changed before it", async () => {
    const context = setup({ flow: CHAIN });
    context.world.commands["echo one"] = [{ exit: 0, output: "one" }];
    context.world.commands.check = [{ exit: 0, output: "ok" }, { exit: 0, output: "ok" }];
    await startAndRun(context, "flow");
    const changed = structuredClone(CHAIN);
    changed.nodes[1].run = ["echo", "two"];
    writeFileSync(join(context.dirs.workflows, "flow.json"), JSON.stringify(changed));
    context.world.self = "t0";
    const again = await startAndRun(context, "flow", {}, { from: "c" });
    expect(again.steps.map((record) => `${record.id}:${record.reused ? "reused" : record.status}`)).toEqual(["start:reused", "a:done", "b:done", "c:done"]);
  });

  test("one step alone uses the newest results before it, and refuses without them", async () => {
    const context = setup({ flow: CHAIN });
    context.world.self = "t0";
    await expect(startRun(context.io, context.dirs, "flow", {}, { only: "c" })).rejects.toThrow("c needs a fresh result from b first");
    context.world.commands.check = [{ exit: 0, output: "ok" }];
    await startAndRun(context, "flow");
    context.world.self = "t0";
    const alone = await startAndRun(context, "flow", {}, { only: "b" });
    expect(alone.only).toBe("b");
    expect(alone.steps.filter((record) => !record.reused).map((record) => `${record.id}:${record.status}`)).toEqual(["b:done"]);
  });

  test("resume waits again on an agent still working, without sending twice", async () => {
    const context = setup({ one: graph([{ id: "ask", agent: ["claude"], task: "Go" }], [edge("start", "ask")]) });
    const run = await startRun(context.io, context.dirs, "one", {});
    const file = join(run.dir, "ask-1.md");
    context.world.terminals.set("t7", { address: "t7", state: "live", turn: 1, status: "working", reported: true, labels: {}, argv: ["claude"], child: true, messages: ["Go"], screen: "", later: null });
    saveRun(context.dirs, { ...run, status: "running", runner: "t-dead", steps: [{ id: "start", attempt: 1, epoch: 0, status: "done", started: 1 }, { id: "ask", attempt: 1, epoch: 0, status: "running", started: 1, terminal: "t7", sent: true, turn: 0, file }] });
    expect((await summaries(context.io, context.dirs))[0].status).toBe("interrupted");
    await resumeRun(context.io, context.dirs, run.id);
    context.world.onSleep = () => {
      writeFileSync(file, "Finished.");
      context.world.terminals.get("t7")!.status = "idle";
    };
    context.world.self = "t-runner";
    const done = await executeRun(context.io, context.dirs, run.id);
    expect(done.steps.at(-1)).toMatchObject({ id: "ask", status: "done", output: "Finished." });
    expect(context.world.terminals.get("t7")!.messages).toEqual(["Go"]);
  });

  test("resume runs a step again when its agent is gone, and waits again at a gate", async () => {
    const context = setup({ two: graph([{ id: "ask", agent: ["claude"], task: "Go" }, { id: "ship", approve: "Ship?" }], [edge("start", "ask"), edge("start", "ship")]) });
    context.world.agents.claude = writes("Again.");
    const run = await startRun(context.io, context.dirs, "two", {});
    saveRun(context.dirs, {
      ...run,
      status: "approval",
      steps: [
        { id: "start", attempt: 1, epoch: 0, status: "done", started: 1 },
        { id: "ask", attempt: 1, epoch: 0, status: "running", started: 1, terminal: "t99", sent: true, turn: 0 },
        { id: "ship", attempt: 1, epoch: 0, status: "approval", started: 1 },
      ],
    });
    context.world.onReport.blocked = () => decide(context.dirs, run.id, "approve", 0);
    context.world.self = "t-runner";
    const done = await executeRun(context.io, context.dirs, run.id);
    expect(done.status).toBe("done");
    expect(steps(done)).toEqual(["start:done", "ask:interrupted", "ship:done", "ask:done"]);
  });

  test("resume refuses a run whose runner is alive or that is over", async () => {
    const context = setup({ gate: graph([{ id: "ask", approve: "Ship?" }], [edge("start", "ask")]) });
    const run = await startRun(context.io, context.dirs, "gate", {});
    saveRun(context.dirs, { ...run, status: "approval", runner: "t1" });
    await expect(resumeRun(context.io, context.dirs, run.id)).rejects.toThrow("run gate-1 is still going in t1");
    saveRun(context.dirs, { ...run, status: "done" });
    await expect(resumeRun(context.io, context.dirs, run.id)).rejects.toThrow("run gate-1 is already done");
  });
});

describe("the command line", () => {
  function homes() {
    const made = makeHomes();
    const workflows = join(made.env.XDG_CONFIG_HOME, "vjr-herdr/workflows");
    mkdirSync(workflows, { recursive: true });
    for (const name of ["implement-review.json", "broken.json"]) copyFileSync(join(repo, "tests/fixtures/workflows", name), join(workflows, name));
    return { ...made, workflows, runs: join(made.env.XDG_STATE_HOME, "vjr-herdr/workflows") };
  }

  test("check, ls, format and paths", () => {
    const made = homes();
    const all = runScript(repo, "workflow.ts", ["check"], made.env);
    expect(all.code).toBe(1);
    expect(all.stdout).toContain('broken: step "fix": continue must name a step that comes before it');
    expect(all.stdout).toContain("implement-review: ok");
    expect(runScript(repo, "workflow.ts", ["ls"], made.env).stdout).toContain("implement-review  Implement, review, fix · 8 steps");
    expect(runScript(repo, "workflow.ts", ["format"], made.env).stdout).toContain('{ "from": "fix", "to": "test", "max": 3 }');
    const paths = JSON.parse(runScript(repo, "workflow.ts", ["paths"], made.env).stdout);
    expect(paths).toEqual({ workflows: made.workflows, runs: made.runs, script: join(repo, "scripts/workflow.ts") });
    expect(existsSync(paths.runs)).toBe(true);
  });

  test("approve writes the decision with its step; mistakes exit 1 with a message", () => {
    const made = homes();
    const dir = join(made.runs, "implement-review-1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "run.json"), JSON.stringify({ id: "implement-review-1", workflow: "implement-review", number: 1, dir, status: "approval", epoch: {}, steps: [{ id: "ship", status: "approval", epoch: 0 }], created: 1 }));
    expect(runScript(repo, "workflow.ts", ["approve", "implement-review-1", "--node", "ship"], made.env)).toMatchObject({ code: 0, stdout: "approve sent to implement-review-1\n" });
    expect(JSON.parse(readFileSync(join(dir, "decision.json"), "utf8"))).toMatchObject({ action: "approve", node: "ship" });
    expect(runScript(repo, "workflow.ts", ["show", "nope-1"], made.env)).toMatchObject({ code: 1, stderr: "workflow: no run nope-1\n" });
    expect(runScript(repo, "workflow.ts", ["run", "implement-review", "--input", "oops"], made.env)).toMatchObject({ code: 1, stderr: "workflow: --input takes key=value, not oops\n" });
  });
});
