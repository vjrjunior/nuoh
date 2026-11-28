import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  activeIn,
  agentMessage,
  agentRoot,
  agentTerminal,
  ancestors,
  cap,
  checkWorkflow,
  current,
  evaluate,
  fill,
  graphOf,
  loopsExhausted,
  loopsTaken,
  nodeInputs,
  OUTPUT_CAP,
  parseExpression,
  parseWorkflow,
  reach,
  readAnswer,
  readyNodes,
  resolveInputs,
  retryMessage,
  reuseFor,
  runSummary,
  scopeOf,
  staleNodes,
  takeLoop,
  templateRefs,
  warnings,
} from "../lib/workflow.js";
import { repo } from "./helpers";

const fixture = (name: string) => readFileSync(join(repo, "tests/fixtures/workflows", name), "utf8");
const EXAMPLE = JSON.parse(fixture("implement-review.json"));
const start = { id: "start", start: {} };
const agent = (id: string, extra = {}) => ({ id, agent: ["claude"], task: "Do it", ...extra });
const flow = (nodes: unknown[], edges: unknown[] = [], extra = {}) => ({ nodes: [start, ...nodes], edges, ...extra });
const problems = (value: unknown) => checkWorkflow(value).join("\n");
const record = (id: string, status: string, extra = {}) => ({ id, status, attempt: 1, epoch: 0, started: 0, ...extra });

describe("checkWorkflow", () => {
  test("the implement-review example is valid", () => {
    expect(parseWorkflow(fixture("implement-review.json"))).toMatchObject({ ok: true });
  });

  test("the broken example names each problem", () => {
    expect(parseWorkflow(fixture("broken.json")).problems).toEqual([
      'step "fix": continue must name a step that comes before it',
      'step "fix": {{review.summary}}: step "review" doesn\'t come before this one',
      'step "review": answer field "blocking" must be text, number, boolean or a|b|c, with ? when optional',
      'clean → fix: a connection out of a condition needs branch "yes" or "no"',
      "clean → fix goes back: give it max, how many times it may go back",
    ]);
  });

  test("a file in the first format is turned away with a pointer to the new one", () => {
    expect(checkWorkflow({ steps: [] })).toEqual(["this is the first format, with steps: workflows now have nodes and edges (run workflow format)"]);
  });

  test("needs nodes and exactly one start", () => {
    expect(checkWorkflow({ nodes: [] })).toEqual(["nodes must be a list with at least a start"]);
    expect(problems({ nodes: [agent("a")] })).toContain("add a start step: the run begins there");
    expect(problems({ nodes: [start, { id: "again", start: {} }] })).toContain("a workflow has one start step");
    expect(problems(flow([agent("a")], [{ from: "a", to: "start" }]))).toContain("a → start: nothing connects into start");
  });

  test("refuses unknown fields and checks places and sizes", () => {
    const text = problems(flow([agent("a", { model: "opus", at: [1], size: [300, "x"] })], [{ from: "start", to: "a", label: "x" }], { name: "x" }));
    expect(text).toContain('unknown field "name"');
    expect(text).toContain('step "a": a agent step has no field "model"');
    expect(text).toContain('step "a": at must be [x, y]');
    expect(text).toContain('step "a": size must be [width, height]');
    expect(text).toContain('connection 1: unknown field "label"');
    expect(checkWorkflow(flow([agent("a", { at: [10, 20], size: [300, 180] })], [{ from: "start", to: "a" }]))).toEqual([]);
  });

  test("each step has one kind and a usable, unique id", () => {
    const text = problems(flow([{ id: "a", agent: ["claude"], run: ["ls"], task: "x" }, { id: "1x", run: ["ls"] }, { id: "run", run: ["ls"] }, { id: "b", run: ["ls"] }, { id: "b", run: ["ls"] }]));
    expect(text).toContain('step "a": give exactly one of start, agent, continue, run, approve, condition');
    expect(text).toContain('step "1x": id must start with a letter');
    expect(text).toContain('step "run": "run" is taken');
    expect(text).toContain('step "b": another step has this id');
  });

  test("the kinds' own fields are checked", () => {
    const text = problems(flow([{ id: "a", agent: "claude", task: "" }, { id: "b", run: [] }, { id: "c", approve: " " }, { id: "d", condition: "> 2" }, { id: "e", start: true }]));
    expect(text).toContain('step "a": agent must be a list like ["claude"]');
    expect(text).toContain('step "a": task must be text');
    expect(text).toContain('step "b": run must be a list like ["bun", "test"]');
    expect(text).toContain('step "c": approve must be the question');
    expect(text).toContain('step "d": condition: expected a value');
    expect(text).toContain('step "e": start must be {}');
  });

  test("templates point at inputs, run fields and steps that come before", () => {
    const text = problems(
      flow(
        [
          agent("a", { task: "{{input.task}} {{input.nope}} {{run.dir}} {{run.nope}}", answer: { score: "number" } }),
          { id: "t", run: ["echo", "{{a.score}} {{a.exit}} {{a.missing}} {{later.output}}"] },
          agent("later", { task: "{{t.exit}} {{side.output}} {{nothing.output}} {{a.b.c}}" }),
          agent("side"),
        ],
        [
          { from: "start", to: "a" },
          { from: "a", to: "t" },
          { from: "t", to: "later" },
          { from: "start", to: "side" },
        ],
        { inputs: { task: { required: true } } },
      ),
    );
    expect(text).toContain('{{input.nope}}: there is no input "nope"');
    expect(text).toContain("{{run.nope}}: run has id, dir, folder, space, workflow, number");
    expect(text).toContain("{{a.exit}}: only a run step has exit");
    expect(text).toContain('{{a.missing}}: step "a" answers no field "missing"');
    expect(text).toContain('{{later.output}}: step "later" doesn\'t come before this one');
    expect(text).toContain('{{side.output}}: step "side" doesn\'t come before this one');
    expect(text).toContain('{{nothing.output}}: there is no step "nothing"');
    expect(text).toContain("{{a.b.c}} is not a known value");
    expect(text).not.toContain("{{input.task}}");
    expect(text).not.toContain("{{t.exit}}");
  });

  test("continue names an agent step before it", () => {
    const text = problems(flow([{ id: "t", run: ["ls"] }, { id: "a", continue: "t", task: "x" }, { id: "b", continue: "zzz", task: "x" }], [{ from: "start", to: "t" }, { from: "t", to: "a" }]));
    expect(text).toContain('step "a": continue must name an agent step');
    expect(text).toContain('step "b": continue names no step "zzz"');
  });

  test("connections: branches only and always out of a condition, no duplicates", () => {
    const text = problems(
      flow(
        [agent("a"), { id: "c", condition: "{{a.output}} set" }, agent("b")],
        [
          { from: "start", to: "a", branch: "yes" },
          { from: "a", to: "c" },
          { from: "c", to: "b", branch: "maybe" },
          { from: "c", to: "b", branch: "maybe" },
          { from: "x", to: "a" },
        ],
      ),
    );
    expect(text).toContain("start → a: only a condition's connections have a branch");
    expect(text).toContain('c → b: a connection out of a condition needs branch "yes" or "no"');
    expect(text).toContain("c → b: this connection is there twice");
    expect(text).toContain('connection 5: there is no step "x"');
  });

  test("a connection that goes back needs max, and only such a one may have it", () => {
    const text = problems(flow([agent("a"), agent("b")], [{ from: "start", to: "a", max: 2 }, { from: "a", to: "b" }, { from: "b", to: "a" }]));
    expect(text).toContain("start → a: max only goes on a connection that goes back");
    expect(text).toContain("b → a goes back: give it max");
    expect(checkWorkflow(flow([agent("a")], [{ from: "start", to: "a" }, { from: "a", to: "a", max: 2 }]))).toEqual([]);
  });

  test("answer fields take the four types", () => {
    expect(checkWorkflow(flow([agent("a", { answer: { a: "text", b: "number?", c: "boolean", d: "low|high?" } })], [{ from: "start", to: "a" }]))).toEqual([]);
    expect(problems(flow([agent("a", { answer: { output: "text" } })]))).toContain('answer field "output" is not a usable name');
  });
});

describe("warnings", () => {
  test("name agents that act without asking and steps start never reaches", () => {
    expect(warnings(flow([agent("a", { agent: ["claude", "--dangerously-skip-permissions"] }), agent("lost")], [{ from: "start", to: "a" }]))).toEqual([
      'step "a" runs its agent with --dangerously-skip-permissions: it acts without asking',
      'step "lost" is not connected from start: it never runs',
    ]);
  });
});

describe("the graph", () => {
  const graph = graphOf(EXAMPLE);

  test("orders the steps and finds the loop", () => {
    expect(graph.order).toEqual(["start", "implement", "test", "review", "clean", "ship", "fix", "pr"]);
    expect([...graph.loops].map((index: number) => `${graph.edges[index].from}->${graph.edges[index].to}`)).toEqual(["fix->test"]);
    expect(graph.forwardIn.get("test").map((edge: any) => edge.from)).toEqual(["implement"]);
    expect(graph.loopIn.get("test").map((edge: any) => edge.from)).toEqual(["fix"]);
  });

  test("ancestors, what a step reaches and the agent a continue talks to", () => {
    expect([...ancestors(graph, "fix")].sort()).toEqual(["clean", "implement", "review", "start", "test"]);
    expect([...reach(graph, "test")].sort()).toEqual(["clean", "fix", "pr", "review", "ship", "test"]);
    expect(agentRoot(graph, "pr")).toBe("implement");
    expect(agentRoot(graph, "test")).toBeNull();
  });
});

describe("running the graph", () => {
  const graph = graphOf(EXAMPLE);
  const run = (steps: any[], extra = {}) => ({ id: "flow-1", inputs: { task: "x" }, epoch: {}, loops: {}, steps, ...extra });

  test("a step is ready once every step before it is through", () => {
    expect(readyNodes(graph, run([]))).toEqual(["start"]);
    expect(readyNodes(graph, run([record("start", "done"), record("implement", "running")]))).toEqual([]);
    expect(readyNodes(graph, run([record("start", "done"), record("implement", "done")]))).toEqual(["test"]);
  });

  test("a condition opens one branch; the other's step has no active input", () => {
    const state = run([record("start", "done"), record("implement", "done"), record("test", "done"), record("review", "done"), record("clean", "done", { output: "no" })]);
    expect(readyNodes(graph, state)).toEqual(["ship", "fix"]);
    expect(activeIn(graph, state, "ship")).toEqual([]);
    expect(activeIn(graph, state, "fix").map((edge: any) => edge.from)).toEqual(["clean"]);
  });

  test("taking a loop counts it and runs everything after its target again", () => {
    const state: any = run([record("start", "done"), record("implement", "done"), record("test", "done"), record("review", "done"), record("clean", "done", { output: "no" }), record("ship", "skipped"), record("fix", "done")]);
    const [loop] = loopsTaken(graph, state, "fix");
    expect(loop).toMatchObject({ from: "fix", to: "test", max: 3 });
    takeLoop(graph, state, loop);
    expect(state.loops).toEqual({ "fix->test": 1 });
    expect(state.epoch).toEqual({ test: 1, review: 1, clean: 1, ship: 1, fix: 1, pr: 1 });
    expect(current(state, "test")).toBeNull();
    expect(current(state, "implement")?.status).toBe("done");
    expect(readyNodes(graph, state)).toEqual(["test"]);
    state.loops = { "fix->test": 3 };
    expect(loopsExhausted(graph, state, "fix").map((edge: any) => edge.to)).toEqual(["test"]);
  });

  test("an agent gets the answers of the agent and command steps that connect into it", () => {
    const state = run([record("start", "done", { output: "task: x" }), record("implement", "done", { output: "Did it" }), record("test", "done", { output: "1 fail", exit: 1 })]);
    expect(nodeInputs(graph, state, "review")).toEqual([{ id: "test", output: "1 fail" }]);
    expect(nodeInputs(graph, state, "implement")).toEqual([]);
    const looped = run([...state.steps, record("fix", "done", { output: "Fixed" })]);
    expect(nodeInputs(graph, looped, "test")).toEqual([
      { id: "implement", output: "Did it" },
      { id: "fix", output: "Fixed" },
    ]);
  });

  test("a continue step talks to the terminal its agent first had", () => {
    const state = run([record("implement", "done", { terminal: "t1" }), record("fix", "done", { terminal: "t1" })]);
    expect(agentTerminal(state, EXAMPLE, "pr")).toBe("t1");
    expect(agentTerminal(run([]), EXAMPLE, "pr")).toBeNull();
  });

  test("the summary says where a run waits", () => {
    const state = run([record("start", "done"), record("ship", "approval"), record("pr", "running")], { status: "approval", definition: EXAMPLE, workflow: "flow", number: 1 });
    expect(runSummary(state)).toMatchObject({ status: "approval", step: "ship", steps: ["ship", "pr"], title: "Implement, review, fix" });
  });
});

describe("reusing results", () => {
  const previous = {
    definition: EXAMPLE,
    steps: [record("start", "done"), record("implement", "done", { output: "Did it" }), record("test", "done"), record("review", "failed"), record("clean", "skipped")],
  };

  test("a step is stale when it or its connections in changed, and so is what comes after it", () => {
    const changed = structuredClone(EXAMPLE);
    changed.nodes.find((node: any) => node.id === "test").run = ["bun", "test", "--bail"];
    changed.nodes.find((node: any) => node.id === "implement").at = [999, 999];
    expect([...staleNodes(EXAMPLE, changed)].sort()).toEqual(["clean", "fix", "pr", "review", "ship", "test"]);
    expect([...staleNodes(EXAMPLE, EXAMPLE)]).toEqual([]);
  });

  test("run from a step keeps the fresh results before it; start is always settled again", () => {
    const { steps, problems: found } = reuseFor(previous, EXAMPLE, { from: "review" });
    expect(found).toEqual([]);
    expect(steps.map((step: any) => [step.id, step.reused, step.epoch])).toEqual([
      ["implement", true, 0],
      ["test", true, 0],
    ]);
  });

  test("one step alone needs a fresh result from each step before it except start", () => {
    expect(reuseFor(previous, EXAMPLE, { only: "review" }).problems).toEqual([]);
    expect(reuseFor(previous, EXAMPLE, { only: "clean" }).problems).toEqual(["clean needs a fresh result from review first: run the workflow, or run from review"]);
    expect(reuseFor(previous, EXAMPLE, { from: "nope" }).problems).toEqual(['Implement, review, fix has no step "nope"']);
    expect(reuseFor(null, EXAMPLE, { only: "implement" })).toEqual({ steps: [], problems: [] });
  });

  test("a run of one step settles start first, then that step", () => {
    const graph = graphOf(EXAMPLE);
    const run = { only: "implement", epoch: {}, steps: [] as any[] };
    expect(readyNodes(graph, run)).toEqual(["start"]);
    run.steps.push(record("start", "done"));
    expect(readyNodes(graph, run)).toEqual(["implement"]);
  });
});

describe("expressions and templates", () => {
  const scope = {
    input: { task: "Fix login" },
    run: { id: "flow-3", dir: "/runs/flow-3", folder: "/r/app", space: "s1", workflow: "flow", number: 3 },
    steps: { review: { output: "{}", fields: { blocking: 2, summary: "Two bugs", level: "high", note: null, ok: false } }, test: { output: "1 fail", exit: 1, fields: {} }, empty: { output: "", fields: {} } },
  };

  test("compare numbers, text and booleans; and binds tighter than or", () => {
    expect(evaluate("{{review.blocking}} > 0", scope)).toBe(true);
    expect(evaluate("{{review.level}} = HIGH", scope)).toBe(true);
    expect(evaluate("{{review.ok}} = false", scope)).toBe(true);
    expect(evaluate("{{test.output}} contains FAIL", scope)).toBe(true);
    expect(evaluate("{{review.note}} unset", scope)).toBe(true);
    expect(evaluate("{{empty.output}}", scope)).toBe(false);
    expect(evaluate("{{test.exit}} = 0 and {{review.blocking}} > 0 or {{review.level}} = high", scope)).toBe(true);
    expect(() => parseExpression("{{a.b}} > 1 1")).toThrow('unexpected "1"');
  });

  test("templates fill values and leave missing ones empty", () => {
    expect(templateRefs("{{ input.task }} and {{review.summary}}")).toEqual(["input.task", "review.summary"]);
    expect(fill("{{input.task}} #{{run.number}}: {{review.blocking}} {{nope.output}}|", scope)).toBe("Fix login #3: 2 |");
  });

  test("scope takes each step's latest done or skipped record", () => {
    const value = scopeOf({ id: "r", inputs: {}, steps: [record("test", "done", { output: "fail" }), record("test", "done", { output: "pass" }), record("fix", "skipped")] });
    expect(value.steps.test.output).toBe("pass");
    expect(value.steps.fix).toEqual({ output: "", fields: {} });
  });
});

describe("answers and inputs", () => {
  const answer = { blocking: "number", summary: "text", level: "low|high", ok: "boolean", note: "text?" };

  test("reads a JSON object, fenced or with text around it, and says what is wrong", () => {
    expect(readAnswer('```json\n{"blocking": "2", "summary": "Two", "level": "HIGH", "ok": "false"}\n```', answer)).toEqual({ ok: true, fields: { blocking: 2, summary: "Two", level: "high", ok: false, note: null } });
    expect(readAnswer("nothing", answer)).toEqual({ ok: false, error: "it holds no JSON object" });
    expect(readAnswer('{"summary": "x", "level": "low", "ok": true}', answer)).toEqual({ ok: false, error: "blocking is missing" });
  });

  test("the message carries the task, the inputs and where to answer", () => {
    expect(agentMessage({ title: "Flow", step: "review", task: " Review it ", file: "/r/review-1.json", answer: { blocking: "number" }, inputs: [{ id: "test", output: "1 fail\n" }] })).toBe(
      'Workflow "Flow", step "review".\n\nReview it\n\n--- input from test ---\n1 fail\n\nWhen you finish, write your answer to /r/review-1.json as one JSON object with these fields: blocking (number). Put nothing else in that file.',
    );
    expect(retryMessage({ file: "/r/a-1.md" })).toBe("The workflow found no answer in /r/a-1.md. Write your answer there now.");
    expect(cap("x".repeat(OUTPUT_CAP + 1))).toEndWith(`[cut at ${OUTPUT_CAP} characters]`);
  });

  test("inputs get defaults and refuse missing and unknown ones", () => {
    const workflow = { inputs: { task: { required: true }, branch: { default: "main" } } };
    expect(resolveInputs(workflow, { task: "x" })).toEqual({ inputs: { task: "x", branch: "main" }, problems: [] });
    expect(resolveInputs(workflow, { other: "y" }).problems).toEqual(['the workflow has no input "other"', 'input "task" is required']);
  });
});
