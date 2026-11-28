import { describe, expect, test } from "bun:test";
import {
  ago,
  authorPrompt,
  chooseAgent,
  duration,
  editPrompt,
  groupRuns,
  inputsOf,
  liveRuns,
  missingInputs,
  RUN_POPUP,
  runActions,
  runArgs,
  runLine,
  runPopupHeight,
  runStatus,
  STARTING_MS,
  agentLabel,
  edgeState,
  itemOf,
  nodeMeta,
  pillOf,
  resultOf,
  switcherHeight,
  viewsOf,
} from "../mods/workflows/logic.js";
import { graphOf } from "../lib/workflow.js";

const WORKFLOW = {
  title: "Flow",
  inputs: { task: { label: "Task", required: true }, branch: { default: "main" } },
  nodes: [
    { id: "start", start: {} },
    { id: "implement", agent: ["/usr/local/bin/claude", "--model", "opus"], task: "Do {{input.task}}" },
    { id: "test", run: ["bun", "test"] },
    { id: "review", agent: ["codex"], task: "Review", answer: { blocking: "number" } },
    { id: "check", condition: "{{review.blocking}} > 0" },
    { id: "fix", continue: "implement", task: "Fix it" },
    { id: "ship", approve: "Ship {{input.task}}?", show: "{{review.blocking}} left" },
  ],
  edges: [
    { from: "start", to: "implement" },
    { from: "implement", to: "test" },
    { from: "test", to: "review" },
    { from: "review", to: "check" },
    { from: "check", to: "fix", branch: "yes" },
    { from: "check", to: "ship", branch: "no" },
    { from: "fix", to: "test", max: 3 },
  ],
};

const run = (over: Record<string, unknown> = {}) => ({
  id: "flow-2",
  workflow: "flow",
  number: 2,
  inputs: { task: "login" },
  status: "approval",
  created: 1_000_000,
  epoch: { test: 1, review: 1, check: 1, fix: 1, ship: 1 },
  steps: [
    { id: "start", status: "done", epoch: 0 },
    { id: "implement", status: "done", output: "Did it", terminal: "t5", epoch: 0 },
    { id: "test", status: "done", output: "1 fail", exit: 1, epoch: 0 },
    { id: "review", status: "done", output: "{}", fields: { blocking: 1 }, epoch: 0 },
    { id: "check", status: "done", output: "yes", epoch: 0 },
    { id: "ship", status: "skipped", epoch: 0 },
    { id: "fix", status: "done", output: "Fixed", epoch: 0 },
    { id: "test", status: "done", output: "pass", exit: 0, epoch: 1 },
    { id: "review", status: "done", output: "{}", fields: { blocking: 0 }, epoch: 1 },
    { id: "check", status: "done", output: "no", epoch: 1 },
    { id: "fix", status: "skipped", epoch: 1 },
    { id: "ship", status: "approval", epoch: 1 },
  ],
  ...over,
});

describe("runs", () => {
  test("group by workflow, newest first, ignoring folders that are not runs", () => {
    expect(groupRuns(["flow-2", "flow-10", "other-1", "junk", "flow-x"])).toEqual({
      flow: [
        { id: "flow-10", number: 10 },
        { id: "flow-2", number: 2 },
      ],
      other: [{ id: "other-1", number: 1 }],
    });
  });

  test("a run is live while its runner's terminal is", () => {
    const live = liveRuns([{ labels: { "nuoh.workflow": "flow-2" } }, { labels: { "nuoh.workflow": "flow-2:implement" } }, { labels: { "nuoh.workflow": "flow-1" }, state: "finished" }, { labels: {} }]);
    expect([...live]).toEqual(["flow-2"]);
    expect(runStatus(run(), live, 0)).toBe("approval");
    expect(runStatus(run({ id: "flow-3" }), live, 0)).toBe("interrupted");
    expect(runStatus(run({ status: "done" }), new Set(), 0)).toBe("done");
    expect(runStatus(run({ status: "starting" }), new Set(), 1_000_000 + STARTING_MS - 1)).toBe("starting");
    expect(runStatus(run({ status: "starting" }), new Set(), 1_000_000 + STARTING_MS)).toBe("interrupted");
    expect(runStatus(null, live, 0)).toBeNull();
  });

  test("each status offers its actions", () => {
    expect(runActions("approval")).toEqual(["stop"]);
    expect(runActions("running")).toEqual(["stop"]);
    expect(runActions("interrupted")).toEqual(["resume", "stop"]);
    expect(runActions("failed")).toEqual(["retry"]);
    expect(runActions("stopped")).toEqual(["retry"]);
    expect(runActions("done")).toEqual([]);
  });

  test("the line says when it started and, once over, how long it took", () => {
    const now = 1_000_000 + 5 * 60_000;
    expect(runLine(run(), "approval", now)).toBe("5m ago");
    expect(runLine(run({ status: "done", ended: 1_000_000 + 125_000 }), "done", now)).toBe("5m ago · 2m");
    expect(ago(1_000, 1_000 + 30_000)).toBe("just now");
    expect(ago(0, 5)).toBe("");
    expect(ago(1, 1 + 3 * 3600_000)).toBe("3h ago");
    expect(ago(1, 1 + 50 * 3600_000)).toBe("2d ago");
    expect(duration(0, 45_000)).toBe("");
    expect(duration(1, 45_001)).toBe("45s");
    expect(duration(1, 1 + 3725_000)).toBe("1h 2m");
  });
});

describe("nodes on the canvas", () => {
  const node = (id: string) => WORKFLOW.nodes.find((one) => one.id === id)!;

  test("without a run, every node is idle and nothing has a result", () => {
    const views = viewsOf(WORKFLOW, null, null);
    expect(Object.values(views).map((view) => view.state)).toEqual(Array(7).fill("idle"));
    expect(resultOf(node("implement"), views.implement)).toBeNull();
    expect(edgeState(graphOf(WORKFLOW), null, WORKFLOW.edges[0], null)).toBe("idle");
  });

  test("with a run, each node shows its latest pass: done, skipped, or waiting at the gate", () => {
    const views = viewsOf(WORKFLOW, run(), "approval");
    expect(Object.fromEntries(Object.entries(views).map(([id, view]) => [id, view.state]))).toEqual({
      start: "done",
      implement: "done",
      test: "done",
      review: "done",
      check: "done",
      fix: "skipped",
      ship: "waiting",
    });
    expect(nodeMeta(run(), "test", views.test, 0)).toBe("2×");
    expect(nodeMeta(run(), "ship", views.ship, 0)).toBe("Needs you");
    expect(nodeMeta(run(), "fix", views.fix, 0)).toBe("skipped");
    expect(resultOf(node("test"), views.test)).toEqual({ text: "pass" });
    expect(resultOf(node("review"), views.review)).toEqual({ fields: { blocking: 0 } });
    expect(resultOf(node("ship"), views.ship)).toBeNull();
    expect(resultOf(node("check"), views.check)).toBeNull();
  });

  test("a connection is done once its source is, faded on the branch not taken, running into a busy node", () => {
    const graph = graphOf(WORKFLOW);
    const edge = (from: string, to: string) => graph.edges.find((one) => one.from === from && one.to === to)!;
    expect(edgeState(graph, run(), edge("start", "implement"), "approval")).toBe("done");
    expect(edgeState(graph, run(), edge("check", "fix"), "approval")).toBe("faded");
    expect(edgeState(graph, run(), edge("check", "ship"), "approval")).toBe("running");
  });

  test("a failed node shows its error; a cut-off one says so", () => {
    const failed = run({ status: "failed", epoch: {}, steps: [{ id: "implement", status: "failed", error: "no answer", started: 1, ended: 46_001 }] });
    const failedViews = viewsOf(WORKFLOW, failed, "failed");
    expect(failedViews.implement.state).toBe("failed");
    expect(resultOf(node("implement"), failedViews.implement)).toEqual({ text: "no answer", tone: "blocked" });
    expect(nodeMeta(failed, "implement", failedViews.implement, 0)).toBe("46s");
    const cut = run({ status: "running", epoch: {}, steps: [{ id: "implement", status: "running", terminal: "t5", started: 1 }] });
    const cutViews = viewsOf(WORKFLOW, cut, "interrupted");
    expect(cutViews.implement).toMatchObject({ state: "failed", cut: true });
    expect(nodeMeta(cut, "implement", cutViews.implement, 0)).toBe("cut off");
    const running = viewsOf(WORKFLOW, cut, "running").implement;
    expect(running.state).toBe("running");
    expect(resultOf(node("implement"), running)).toEqual({ text: "Working", tone: "working" });
  });

  test("a node where a stopped run ended says so", () => {
    const stopped = run({ status: "stopped", error: "rejected at the gate", epoch: {}, steps: [{ id: "ship", status: "stopped" }] });
    const views = viewsOf(WORKFLOW, stopped, "stopped");
    expect(views.ship.state).toBe("idle");
    expect(nodeMeta(stopped, "ship", views.ship, 0)).toBe("stopped");
  });

  test("the band's pill says where the run is", () => {
    expect(pillOf(run(), "approval")).toEqual({ status: "waiting", at: "Waiting at ship", step: "ship" });
    expect(pillOf(run({ status: "done", ended: 1_000_000 + 125_000 }), "done")).toMatchObject({ status: "done", at: "in 2m" });
    const failed = run({ status: "failed", steps: [{ id: "implement", status: "failed" }] });
    expect(pillOf(failed, "failed")).toEqual({ status: "failed", at: "at implement", step: "implement" });
    expect(pillOf(null, null)).toBeNull();
  });

  test("an agent node names its program and model; a same-agent node, whose it continues", () => {
    const agents = [{ name: "Claude Code", run: ["claude"], installed: true }];
    expect(agentLabel(node("implement"), WORKFLOW, agents)).toMatchObject({ name: "Claude Code", model: "opus" });
    expect(agentLabel(node("fix"), WORKFLOW, agents).name).toBe("Claude Code · implement");
    expect(agentLabel(node("review"), WORKFLOW, agents)).toMatchObject({ name: "Codex", model: null, program: null });
  });

  test("a file is drawn while its graph can be, even with problems", () => {
    expect(itemOf("bad", "{").workflow).toBeNull();
    expect(itemOf("bad", "{").problems[0]).toContain("not valid JSON");
    expect(itemOf("old", JSON.stringify({ steps: [] })).workflow).toBeNull();
    const broken = itemOf("b", JSON.stringify({ nodes: [{ id: "start", start: {} }, { id: "a", run: [] }] }));
    expect(broken.workflow?.edges).toEqual([]);
    expect(broken.problems).toContain('step "a": run must be a list like ["bun", "test"]');
    const good = itemOf("flow", JSON.stringify(WORKFLOW));
    expect(good.problems).toEqual([]);
    expect(good.text).toBe(JSON.stringify(WORKFLOW));
  });

  test("the switcher is as tall as its rows, up to eight", () => {
    expect(switcherHeight(9)).toBe(switcherHeight(8));
    expect(switcherHeight(2) - switcherHeight(1)).toBe(44);
  });
});

describe("running from the view", () => {
  test("inputs come from the workflow, with defaults, and the required ones must be filled", () => {
    const inputs = inputsOf(WORKFLOW);
    expect(inputs).toEqual([
      { name: "task", label: "Task", required: true, value: "" },
      { name: "branch", label: "branch", required: false, value: "main" },
    ]);
    expect(missingInputs(inputs, { task: " ", branch: "main" })).toEqual(["task"]);
    expect(runArgs("flow", inputs, { task: "Fix login", branch: "" }, "s1")).toEqual(["run", "flow", "--input", "task=Fix login", "--space", "s1", "--json"]);
    expect(inputsOf({ nodes: [] })).toEqual([]);
  });

  test("the popup's height follows the inputs and spaces, up to six spaces", () => {
    expect(runPopupHeight(2, 3) - runPopupHeight(1, 3)).toBe(RUN_POPUP.input);
    expect(runPopupHeight(0, 9)).toBe(runPopupHeight(0, 6));
    expect(runPopupHeight(0, 0)).toBe(runPopupHeight(0, 1));
  });

  test("an agent writes or changes a workflow from the format and checks it", () => {
    const author = authorPrompt({ bun: "/b/bun", repo: "/r", workflows: "/w" });
    expect(author).toContain("`/b/bun /r/scripts/workflow.ts format`");
    expect(author).toContain("ask me what the workflow should do");
    expect(author).toContain("/w/<name>.json");
    expect(author).toContain("`/b/bun /r/scripts/workflow.ts check <name>`");
    const edit = editPrompt({ bun: "/b/bun", repo: "/r", workflows: "/w", name: "flow" });
    expect(edit).toContain("/w/flow.json");
    expect(edit).toContain("check flow`");
  });

  test("the agent is the first one installed", () => {
    expect(chooseAgent([{ installed: false, run: ["codex"] }, { installed: true, run: ["claude"] }, { installed: true, run: ["pi"] }])).toEqual({ installed: true, run: ["claude"] });
    expect(chooseAgent([{ installed: true, run: [] }])).toBeNull();
    expect(chooseAgent(undefined)).toBeNull();
  });
});
