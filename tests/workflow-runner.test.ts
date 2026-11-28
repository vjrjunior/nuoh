import { afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decide, type Dirs, executeRun, type Io, loadRun, resumeRun, retryRun, saveRun, startRun, summaries } from "../scripts/workflow-run";
import { makeHomes, removeTempDirs, repo, run, tempDir } from "./helpers";

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
};
type Behave = (message: string, file: string | null, terminal: Fake, world: World) => "busy" | void;
type World = ReturnType<typeof makeWorld>;

const FILE = /(?:answer to|answer in) (\/\S+?)[:.]?(?:\s|$)/;

function makeWorld(folder: string) {
  const world = {
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
    actFailures: 0,
  };
  return world;
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
      world.terminals.set(address, { address, state: "live", turn: 0, status: unready ? null : "idle", reported: !unready, labels, argv, child, messages: [], screen: "" });
      return address;
    },
    async send(address, text) {
      const terminal = world.terminals.get(address);
      if (!terminal) throw new Error(`no terminal ${address}`);
      terminal.messages.push(text);
      const behave = world.agents[terminal.argv[0]];
      const busy = behave?.(text, FILE.exec(text)?.[1] ?? null, terminal, world);
      terminal.turn += 1;
      terminal.status = busy === "busy" ? "working" : "idle";
    },
    async waitTurn() {
      world.clock += 10_000;
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
      if (world.actFailures > 0) {
        world.actFailures -= 1;
        throw new Error("herdr-app do tab.rename: no tab");
      }
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
  world.self = "t0";
  world.terminals.set("t0", { address: "t0", state: "live", turn: 0, status: "working", reported: true, labels: { "herdr.space": "s1" }, argv: ["claude"], child: false, messages: [], screen: "" });
  return { root, dirs, folder, world, io: fakeIo(world) };
}

const writes =
  (...answers: string[]): Behave =>
  (_message, file) => {
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    if (file && answer !== "") writeFileSync(file, answer as string);
  };

const steps = (run: { steps: { id: string; status: string }[] }) => run.steps.map((record) => `${record.id}:${record.status}`);

const REVIEW_FLOW = {
  title: "Flow",
  inputs: { task: { required: true } },
  steps: [
    { id: "implement", agent: ["claude"], task: "{{input.task}}" },
    { id: "test", run: ["bun", "test"], allowFail: true },
    { id: "review", agent: ["codex"], task: "Review. Tests:\n{{test.output}}", answer: { blocking: "number", summary: "text" } },
    { id: "fix", continue: "implement", when: "{{review.blocking}} > 0", task: "Fix: {{review.summary}}", goto: "test", max: 3 },
    { id: "ship", approve: "Open the PR?", show: "{{review.summary}}" },
    { id: "pr", continue: "implement", task: "Open a PR." },
  ],
};

async function startAndRun(context: ReturnType<typeof setup>, name: string, inputs: Record<string, string> = {}) {
  const run = await startRun(context.io, context.dirs, name, inputs);
  context.world.self = "t-runner";
  return executeRun(context.io, context.dirs, run.id);
}

describe("starting a run", () => {
  test("makes a run folder and starts its runner in a new tab of the caller's space", async () => {
    const context = setup({ flow: REVIEW_FLOW });
    const run = await startRun(context.io, context.dirs, "flow", { task: "Fix login" });
    expect(run.id).toBe("flow-1");
    expect(run.space).toBe("s1");
    expect(run.folder).toBe(context.folder);
    expect(run.tab).toMatch(/^tb[0-9a-f]{32}$/);
    const runner = context.world.terminals.get("t1")!;
    expect(runner.argv).toEqual(["bun", "workflow.ts", "exec", "flow-1", "--runs", context.dirs.runs]);
    expect(runner.labels).toEqual({ "herdr.space": "s1", "herdr.tab": run.tab!, "nuoh.workflow": "flow-1" });
    expect(runner.child).toBe(false);
    expect(loadRun(context.dirs, "flow-1").status).toBe("starting");
    expect((await startRun(context.io, context.dirs, "flow", { task: "Again" })).id).toBe("flow-2");
  });

  test("refuses missing inputs, unknown spaces, remote spaces and a caller outside Herdr", async () => {
    const context = setup({ flow: REVIEW_FLOW });
    await expect(startRun(context.io, context.dirs, "flow", {})).rejects.toThrow('input "task" is required');
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" }, "s9")).rejects.toThrow("no space s9");
    context.world.spaces.push({ id: "s2", name: "vps-app", folder: "/srv/app", machine: "vps" });
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" }, "s2")).rejects.toThrow("space vps-app is on vps");
    context.world.self = null;
    await expect(startRun(context.io, context.dirs, "flow", { task: "x" })).rejects.toThrow("pass --space <id>");
    await expect(startRun(context.io, context.dirs, "nope", {}, "s1")).rejects.toThrow("no workflow");
  });

  test("refuses an invalid workflow with its problems", async () => {
    const context = setup({ bad: { steps: [{ id: "a", run: [] }] } });
    await expect(startRun(context.io, context.dirs, "bad", {})).rejects.toThrow('bad: step "a": run must be a list');
  });
});

describe("running a chain", () => {
  test("runs in order, loops until the review passes, waits at the gate and finishes", async () => {
    const context = setup({ flow: REVIEW_FLOW });
    const { world } = context;
    world.agents.claude = writes("Implemented.", "Fixed.", "PR opened.");
    world.agents.codex = writes('{"blocking": 2, "summary": "Two bugs"}', '{"blocking": 0, "summary": "Clean"}');
    world.commands["bun test"] = [{ exit: 1, output: "1 fail" }, { exit: 0, output: "all pass" }];
    world.onReport.blocked = () => decide(context.dirs, "flow-1", "approve", world.clock);
    const run = await startAndRun(context, "flow", { task: "Fix login" });

    expect(run.status).toBe("done");
    expect(steps(run)).toEqual(["implement:done", "test:done", "review:done", "fix:done", "test:done", "review:done", "fix:skipped", "ship:done", "pr:done"]);
    expect(run.steps[2]).toMatchObject({ fields: { blocking: 2, summary: "Two bugs" }, attempt: 1 });
    expect(run.steps[5]).toMatchObject({ fields: { blocking: 0, summary: "Clean" }, attempt: 2 });
    expect(run.steps[1]).toMatchObject({ exit: 1, output: "1 fail" });
    expect(readFileSync(run.steps[1].file!, "utf8")).toBe("1 fail");

    const claude = [...world.terminals.values()].filter((terminal) => terminal.argv[0] === "claude" && terminal.address !== "t0");
    expect(claude).toHaveLength(1);
    expect(claude[0].messages).toHaveLength(3);
    expect(claude[0].messages[0]).toStartWith('Workflow "Flow", step "implement" (1 of 6).\n\nFix login\n\n');
    expect(claude[0].messages[1]).toContain("Fix: Two bugs");
    expect(claude[0].labels).toEqual({ "herdr.space": "s1", "herdr.tab": run.tab!, "nuoh.workflow": "flow-1:implement" });
    expect(claude[0].child).toBe(true);
    const reviewers = [...world.terminals.values()].filter((terminal) => terminal.argv[0] === "codex");
    expect(reviewers).toHaveLength(2);
    expect(reviewers[0].messages[0]).toContain("Tests:\n1 fail");
    expect(world.spawned[0]).toEqual({ argv: ["bun", "test"], cwd: context.folder });

    expect(world.reports.filter((status) => status !== "working")).toEqual(["blocked", "done"]);
    expect(world.acts[0]).toEqual({ name: "tab.rename", args: { id: run.tab, name: "⚙ flow #1" } });
    expect(world.printed).toContain("  Open the PR?");
    expect(world.printed).toContain("Clean");
    expect(loadRun(context.dirs, "flow-1")).toMatchObject({ status: "done", runner: "t-runner", at: null });
  });

  test("names its tab once Herdr has it, and gives up quietly after ten tries", async () => {
    const context = setup({ quick: { steps: [{ id: "a", run: ["true"] }] } });
    context.world.actFailures = 2;
    await startAndRun(context, "quick");
    expect(context.world.acts.map((act) => act.name)).toEqual(["tab.rename", "tab.rename", "tab.rename"]);
    const again = setup({ quick: { steps: [{ id: "a", run: ["true"] }] } });
    again.world.actFailures = 99;
    expect((await startAndRun(again, "quick")).status).toBe("done");
    expect(again.world.acts).toHaveLength(10);
  });

  test("a loop that never passes fails once the step has run max times", async () => {
    const context = setup({ flow: { ...REVIEW_FLOW, steps: REVIEW_FLOW.steps.map((step) => (step.id === "fix" ? { ...step, max: 2 } : step)) } });
    context.world.agents.claude = writes("Done.");
    context.world.agents.codex = writes('{"blocking": 1, "summary": "Still broken"}');
    const run = await startAndRun(context, "flow", { task: "x" });
    expect(run.status).toBe("failed");
    expect(run.error).toBe("fix is still needed after 2 passes");
    expect(steps(run).filter((step) => step.startsWith("fix"))).toEqual(["fix:done", "fix:done"]);
    expect(context.world.reports.at(-1)).toBe("error");
  });

  test("a command that fails stops the run unless allowFail", async () => {
    const context = setup({ build: { steps: [{ id: "build", run: ["make", "{{run.id}}"] }, { id: "after", run: ["true"] }] } });
    context.world.commands["make build-1"] = [{ exit: 2, output: "boom\n" }];
    const run = await startAndRun(context, "build");
    expect(run.status).toBe("failed");
    expect(run.error).toBe("make build-1 exited with 2");
    expect(steps(run)).toEqual(["build:failed"]);
    expect(run.steps[0].output).toBe("boom\n");
  });

  test("a step with a false when is skipped and its values are empty", async () => {
    const context = setup({ flow: { steps: [{ id: "a", run: ["echo"], when: "{{run.number}} > 5" }, { id: "b", run: ["echo", "[{{a.output}}]"] }] } });
    const run = await startAndRun(context, "flow");
    expect(steps(run)).toEqual(["a:skipped", "b:done"]);
    expect(context.world.spawned).toEqual([{ argv: ["echo", "[]"], cwd: context.folder }]);
  });
});

describe("agent answers", () => {
  const ONE = { steps: [{ id: "ask", agent: ["claude"], task: "Go" }] };
  const TYPED = { steps: [{ id: "ask", agent: ["claude"], task: "Go", answer: { score: "number" } }] };

  test("an agent that writes no answer is asked once more", async () => {
    const context = setup({ one: ONE });
    context.world.agents.claude = writes("", "Here.");
    const run = await startAndRun(context, "one");
    expect(run.status).toBe("done");
    expect(run.steps[0].output).toBe("Here.");
    const [terminal] = [...context.world.terminals.values()].filter((t) => t.child);
    expect(terminal.messages[1]).toBe(`The workflow found no answer in ${run.steps[0].file}. Write your answer there now.`);
  });

  test("an agent that never answers fails the step with the end of its screen", async () => {
    const context = setup({ one: ONE });
    context.world.agents.claude = (_message, _file, terminal) => {
      terminal.screen = "I could not do it.";
    };
    const run = await startAndRun(context, "one");
    expect(run.status).toBe("failed");
    expect(run.error).toBe("ask wrote no usable answer\nI could not do it.");
  });

  test("an invalid typed answer gets the problem back once", async () => {
    const context = setup({ typed: TYPED });
    context.world.agents.claude = writes('{"score": "high"}', '{"score": 7}');
    const run = await startAndRun(context, "typed");
    expect(run.steps[0].fields).toEqual({ score: 7 });
    const [terminal] = [...context.world.terminals.values()].filter((t) => t.child);
    expect(terminal.messages[1]).toBe(`Your answer in ${run.steps[0].file} cannot be used: score must be a number. Write it again as one JSON object with: score (number).`);
  });

  test("an agent asking to trust the folder fails the step with that reason", async () => {
    const context = setup({ one: ONE });
    context.world.unready.add("claude");
    context.world.onSleep = () => {
      for (const terminal of context.world.terminals.values()) if (terminal.child) terminal.screen = "Do you trust the files in this folder?";
    };
    const run = await startAndRun(context, "one");
    expect(run.error).toBe(`the agent in t2 asks whether to trust ${context.folder}: answer it there, then retry`);
  });

  test("a program that never reports ready fails after two minutes", async () => {
    const context = setup({ one: ONE });
    context.world.unready.add("claude");
    const run = await startAndRun(context, "one");
    expect(run.error).toBe("the agent in t2 never reported ready: agent steps are for agents");
  });

  test("a step that takes longer than its timeout fails and leaves the agent", async () => {
    const context = setup({ slow: { steps: [{ id: "ask", agent: ["claude"], task: "Go", timeout: 30 }] } });
    context.world.agents.claude = () => "busy";
    const run = await startAndRun(context, "slow");
    expect(run.error).toBe("timed out after 30s");
    expect(context.world.terminals.get("t2")?.state).toBe("live");
  });

  test("an agent that exits fails the step", async () => {
    const context = setup({ one: ONE });
    context.world.agents.claude = (_message, _file, terminal) => {
      terminal.state = "finished";
    };
    expect((await startAndRun(context, "one")).error).toBe("the agent in t2 exited");
  });

  test("continuing an agent whose terminal is gone fails", async () => {
    const context = setup({ two: { steps: [{ id: "a", agent: ["claude"], task: "Go" }, { id: "b", continue: "a", task: "More" }] } });
    context.world.agents.claude = (_message, file, terminal) => {
      if (file) writeFileSync(file, "ok");
      context.world.onReport.working = () => {
        terminal.state = "finished";
      };
    };
    const run = await startAndRun(context, "two");
    expect(run.error).toBe("the agent of a is gone");
  });
});

describe("the gate and stopping", () => {
  const GATE = { steps: [{ id: "ask", approve: "Ship?" }, { id: "after", run: ["true"] }] };

  test("rejecting from the runner's pane stops the run", async () => {
    const context = setup({ gate: GATE });
    context.world.onReport.blocked = () => context.world.lines.push("r");
    const run = await startAndRun(context, "gate");
    expect(run.status).toBe("stopped");
    expect(run.error).toBe("rejected at the gate");
    expect(steps(run)).toEqual(["ask:stopped"]);
    expect(context.world.reports.at(-1)).toBe("idle");
  });

  test("approving from the pane goes on, also when hc wraps the line", async () => {
    const context = setup({ gate: GATE });
    context.world.onReport.blocked = () => context.world.lines.push('<hc from="t9">A</hc>');
    expect(steps(await startAndRun(context, "gate"))).toEqual(["ask:done", "after:done"]);
  });

  test("approve and reject need a run at a gate; stop needs a run going", async () => {
    const context = setup({ gate: GATE });
    await startRun(context.io, context.dirs, "gate", {});
    expect(() => decide(context.dirs, "gate-1", "approve", 0)).toThrow("run gate-1 waits for no approval");
    decide(context.dirs, "gate-1", "stop", 0);
    context.world.self = "t-runner";
    const run = await executeRun(context.io, context.dirs, "gate-1");
    expect(run.status).toBe("stopped");
    expect(() => decide(context.dirs, "gate-1", "stop", 0)).toThrow("run gate-1 is already stopped");
  });

  test("s in the runner's pane stops a run while an agent works", async () => {
    const context = setup({ one: { steps: [{ id: "ask", agent: ["claude"], task: "Go" }] } });
    context.world.agents.claude = () => "busy";
    context.world.onSleep = () => context.world.lines.push("s");
    const run = await startAndRun(context, "one");
    expect(run.status).toBe("stopped");
    expect(steps(run)).toEqual(["ask:stopped"]);
  });
});

describe("retry and resume", () => {
  test("retry starts a new run from the failed step and keeps what came before", async () => {
    const context = setup({ flow: { steps: [{ id: "a", run: ["echo", "one"] }, { id: "b", run: ["check"] }, { id: "c", run: ["echo", "{{a.output}}"] }] } });
    context.world.commands["echo one"] = [{ exit: 0, output: "one" }];
    context.world.commands.check = [{ exit: 1, output: "no" }, { exit: 0, output: "yes" }];
    const first = await startAndRun(context, "flow");
    expect(first.status).toBe("failed");
    context.world.self = "t0";
    const second = await retryRun(context.io, context.dirs, first.id);
    expect(second).toMatchObject({ id: "flow-2", at: 1, status: "starting" });
    expect(second.steps).toEqual([expect.objectContaining({ id: "a", status: "done", reused: true })]);
    context.world.self = "t-runner-2";
    const done = await executeRun(context.io, context.dirs, second.id);
    expect(steps(done)).toEqual(["a:done", "b:done", "c:done"]);
    expect(context.world.spawned.map((call) => call.argv.join(" "))).toEqual(["echo one", "check", "check", "echo one"]);
    await expect(retryRun(context.io, context.dirs, first.id, "zzz")).rejects.toThrow('flow has no step "zzz"');
  });

  test("resume waits again on an agent that is still working, without sending twice", async () => {
    const context = setup({ one: { steps: [{ id: "ask", agent: ["claude"], task: "Go" }] } });
    const run = await startRun(context.io, context.dirs, "one", {});
    const file = join(run.dir, "ask-1.md");
    context.world.terminals.set("t7", { address: "t7", state: "live", turn: 1, status: "working", reported: true, labels: {}, argv: ["claude"], child: true, messages: ["Go"], screen: "" });
    saveRun(context.dirs, { ...run, status: "running", runner: "t-dead", steps: [{ id: "ask", attempt: 1, status: "running", started: 1, terminal: "t7", sent: true, turn: 0, file }] });
    await expect(resumeRun(context.io, context.dirs, run.id)).resolves.toMatchObject({ id: "one-1" });
    expect((await summaries(context.io, context.dirs))[0].status).toBe("interrupted");
    context.world.onSleep = () => {
      const terminal = context.world.terminals.get("t7")!;
      writeFileSync(file, "Finished.");
      terminal.status = "idle";
    };
    context.world.self = "t-runner";
    const done = await executeRun(context.io, context.dirs, run.id);
    expect(done.status).toBe("done");
    expect(done.steps[0].output).toBe("Finished.");
    expect(context.world.terminals.get("t7")!.messages).toEqual(["Go"]);
  });

  test("resume starts a step again when its agent is gone", async () => {
    const context = setup({ one: { steps: [{ id: "ask", agent: ["claude"], task: "Go" }] } });
    context.world.agents.claude = writes("Again.");
    const run = await startRun(context.io, context.dirs, "one", {});
    saveRun(context.dirs, { ...run, status: "running", steps: [{ id: "ask", attempt: 1, status: "running", started: 1, terminal: "t99", sent: true, turn: 0 }] });
    context.world.self = "t-runner";
    const done = await executeRun(context.io, context.dirs, run.id);
    expect(steps(done)).toEqual(["ask:interrupted", "ask:done"]);
    expect(done.steps[1]).toMatchObject({ attempt: 2, output: "Again." });
  });

  test("resume refuses a run whose runner is alive or that is over", async () => {
    const context = setup({ gate: { steps: [{ id: "ask", approve: "Ship?" }] } });
    const run = await startRun(context.io, context.dirs, "gate", {});
    saveRun(context.dirs, { ...run, status: "approval", runner: "t1" });
    await expect(resumeRun(context.io, context.dirs, run.id)).rejects.toThrow("run gate-1 is still going in t1");
    expect((await summaries(context.io, context.dirs))[0].status).toBe("approval");
    saveRun(context.dirs, { ...run, status: "done" });
    await expect(resumeRun(context.io, context.dirs, run.id)).rejects.toThrow("run gate-1 is already done");
    expect(existsSync(join(run.dir, "decision.json"))).toBe(false);
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

  test("check names each workflow's problems and fails when one is broken", () => {
    const made = homes();
    const all = run(repo, "workflow.ts", ["check"], made.env);
    expect(all.code).toBe(1);
    expect(all.stdout).toContain("broken: step \"fix\": continue must name an earlier step");
    expect(all.stdout).toContain("implement-review: ok");
    const one = run(repo, "workflow.ts", ["check", "implement-review"], made.env);
    expect(one).toMatchObject({ code: 0, stdout: "implement-review: ok\n" });
  });

  test("ls lists the workflows, as text or JSON", () => {
    const made = homes();
    expect(run(repo, "workflow.ts", ["ls"], made.env).stdout).toBe('broken  invalid: step "fix": continue must name an earlier step\nimplement-review  Implement, review, fix · 6 steps\n');
    const listed = JSON.parse(run(repo, "workflow.ts", ["ls", "--json"], made.env).stdout);
    expect(listed.map((item: any) => [item.name, item.problems.length])).toEqual([["broken", 4], ["implement-review", 0]]);
  });

  test("format teaches the file's place and shape", () => {
    const made = homes();
    const text = run(repo, "workflow.ts", ["format"], made.env).stdout;
    expect(text).toContain(`${made.workflows}/<name>.json`);
    expect(text).toContain('"answer": { "blocking": "number"');
    expect(text).toContain("workflow check <name>");
  });

  test("approve on a run that waits writes the decision; mistakes exit 1 with a message", () => {
    const made = homes();
    const dir = join(made.runs, "implement-review-1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "run.json"), JSON.stringify({ id: "implement-review-1", workflow: "implement-review", number: 1, dir, status: "approval", steps: [], created: 1 }));
    expect(run(repo, "workflow.ts", ["approve", "implement-review-1"], made.env)).toMatchObject({ code: 0, stdout: "approve sent to implement-review-1\n" });
    expect(JSON.parse(readFileSync(join(dir, "decision.json"), "utf8")).action).toBe("approve");
    expect(run(repo, "workflow.ts", ["show", "nope-1"], made.env)).toMatchObject({ code: 1, stderr: "workflow: no run nope-1\n" });
    expect(run(repo, "workflow.ts", ["run", "implement-review", "--input", "oops"], made.env)).toMatchObject({ code: 1, stderr: "workflow: --input takes key=value, not oops\n" });
    expect(run(repo, "workflow.ts", ["bogus"], made.env).code).toBe(1);
  });
});
