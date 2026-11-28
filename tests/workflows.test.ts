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
  stepRows,
} from "../mods/workflows/logic.js";

const WORKFLOW = {
  title: "Flow",
  inputs: { task: { label: "Task", required: true }, branch: { default: "main" } },
  steps: [
    { id: "implement", agent: ["/usr/local/bin/claude", "--model", "opus"], task: "Do {{input.task}}" },
    { id: "test", run: ["bun", "test"] },
    { id: "review", agent: ["codex"], task: "Review", answer: { blocking: "number" } },
    { id: "fix", continue: "implement", when: "{{review.blocking}} > 0", task: "Fix it", goto: "test", max: 3 },
    { id: "ship", approve: "Ship {{input.task}}?", show: "{{review.blocking}} left" },
  ],
};

const run = (over: Record<string, unknown> = {}) => ({
  id: "flow-2",
  workflow: "flow",
  number: 2,
  inputs: { task: "login" },
  status: "approval",
  at: 4,
  created: 1_000_000,
  steps: [
    { id: "implement", status: "done", output: "Did it", terminal: "t5" },
    { id: "test", status: "done", output: "1 fail", exit: 1 },
    { id: "review", status: "done", output: "{}", fields: { blocking: 1 } },
    { id: "fix", status: "done", output: "Fixed" },
    { id: "test", status: "done", output: "pass", exit: 0 },
    { id: "review", status: "done", output: "{}", fields: { blocking: 0 } },
    { id: "fix", status: "skipped" },
    { id: "ship", status: "approval" },
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

describe("steps", () => {
  test("without a run, every step is to do and shows its own text", () => {
    const rows = stepRows(WORKFLOW, null, null);
    expect(rows.map((row) => [row.id, row.node, row.note])).toEqual([
      ["implement", "todo", null],
      ["test", "todo", null],
      ["review", "todo", null],
      ["fix", "todo", null],
      ["ship", "todo", null],
    ]);
    expect(rows[0]).toMatchObject({ icon: "bot", detail: "claude --model opus", task: "Do {{input.task}}" });
    expect(rows[1]).toMatchObject({ icon: "terminal", detail: "$ bun test" });
    expect(rows[3]).toMatchObject({ detail: "continues implement", condition: "{{review.blocking}} > 0", loop: "back to test, up to 3×" });
    expect(rows[4]).toMatchObject({ icon: "flag", detail: "Ship {{input.task}}?", task: "{{review.blocking}} left" });
  });

  test("with a run, each step shows its latest record, its passes and the run's values", () => {
    const rows = stepRows(WORKFLOW, run(), "approval");
    expect(rows.map((row) => [row.id, row.node, row.note])).toEqual([
      ["implement", "done", "Done"],
      ["test", "done", "Done · 2×"],
      ["review", "done", "Done · 2×"],
      ["fix", "todo", "Skipped · 2×"],
      ["ship", "current", "Needs you"],
    ]);
    expect(rows[0]).toMatchObject({ output: "Did it", terminal: "t5", task: "Do login" });
    expect(rows[2].fields).toEqual({ blocking: 0 });
    expect(rows[4]).toMatchObject({ waiting: true, detail: "Ship login?", task: "0 left" });
  });

  test("a failed step and a cut-off current step are marked bad", () => {
    const failed = run({ status: "failed", at: null, steps: [{ id: "implement", status: "failed", error: "no answer" }] });
    expect(stepRows(WORKFLOW, failed, "failed")[0]).toMatchObject({ node: "bad", note: "Failed", error: "no answer" });
    const cut = run({ status: "running", at: 0, steps: [{ id: "implement", status: "running", terminal: "t5" }] });
    expect(stepRows(WORKFLOW, cut, "interrupted")[0]).toMatchObject({ node: "bad", note: "Cut off", current: true });
    expect(stepRows(WORKFLOW, cut, "running")[0]).toMatchObject({ node: "current", note: "Running" });
  });

  test("long text is cut to its first lines", () => {
    const long = { steps: [{ id: "a", agent: ["claude"], task: "1\n2\n3\n4\n5" }] };
    expect(stepRows(long, null, null)[0].task).toBe("1\n2\n3\n…");
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
    expect(inputsOf({ steps: [] })).toEqual([]);
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
