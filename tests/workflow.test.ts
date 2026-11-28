import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agentMessage,
  agentTerminal,
  cap,
  checkWorkflow,
  evaluate,
  fill,
  nextIndex,
  OUTPUT_CAP,
  parseExpression,
  parseWorkflow,
  readAnswer,
  resolveInputs,
  retryMessage,
  reuseBefore,
  scopeOf,
  templateRefs,
  timesRun,
  warnings,
} from "../lib/workflow.js";
import { repo } from "./helpers";

const fixture = (name: string) => readFileSync(join(repo, "tests/fixtures/workflows", name), "utf8");
const agent = (id: string, extra = {}) => ({ id, agent: ["claude"], task: "Do it", ...extra });
const flow = (steps: unknown[], extra = {}) => ({ steps, ...extra });
const problems = (value: unknown) => checkWorkflow(value).join("\n");

const scope = {
  input: { task: "Fix login" },
  run: { id: "flow-3", dir: "/runs/flow-3", folder: "/r/app", space: "s1", workflow: "flow", number: 3 },
  steps: {
    review: { output: "{...}", fields: { blocking: 2, summary: "Two bugs", level: "high", note: null, ok: false } },
    test: { output: "1 fail", exit: 1, fields: {} },
    empty: { output: "", fields: {} },
  },
};

describe("checkWorkflow", () => {
  test("the implement-review example is valid", () => {
    expect(parseWorkflow(fixture("implement-review.json"))).toMatchObject({ ok: true });
  });

  test("the broken example names each problem", () => {
    const result = parseWorkflow(fixture("broken.json"));
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'step "fix": continue must name an earlier step',
      'step "fix": {{review.summary}}: step "review" runs after this one',
      'step "fix": goto needs max, how many times the step may run',
      'step "review": answer field "blocking" must be text, number, boolean or a|b|c, with ? when optional',
    ]);
  });

  test("a file that is not JSON says so", () => {
    expect(parseWorkflow("{ steps: ").problems[0]).toStartWith("not valid JSON");
  });

  test("needs at least one step", () => {
    expect(checkWorkflow({ steps: [] })).toEqual(["steps must be a list with at least one step"]);
    expect(checkWorkflow([])).toEqual(["the file must hold one JSON object"]);
  });

  test("refuses unknown fields at the top, in an input and in a step", () => {
    const text = problems({ name: "x", inputs: { task: { label: "T", kind: "text" } }, steps: [agent("a", { model: "opus" })] });
    expect(text).toContain('unknown field "name"');
    expect(text).toContain('input "task": unknown field "kind"');
    expect(text).toContain('step "a": a agent step has no field "model"');
  });

  test("a step has exactly one kind and a usable, unique id", () => {
    const text = problems(flow([{ id: "a", agent: ["claude"], run: ["ls"], task: "x" }, { id: "1x", run: ["ls"] }, { id: "run", run: ["ls"] }, { id: "b", run: ["ls"] }, { id: "b", run: ["ls"] }]));
    expect(text).toContain('step "a": give exactly one of agent, continue, run, approve');
    expect(text).toContain('step "1x": id must start with a letter');
    expect(text).toContain('step "run": "run" is taken');
    expect(text).toContain('step "b": another step has this id');
  });

  test("an agent needs an argv and a task; a run needs an argv; an approve needs its question", () => {
    const text = problems(flow([{ id: "a", agent: "claude", task: "" }, { id: "b", run: [] }, { id: "c", approve: " " }]));
    expect(text).toContain('step "a": agent must be a list like ["claude"]');
    expect(text).toContain('step "a": task must be text');
    expect(text).toContain('step "b": run must be a list like ["bun", "test"]');
    expect(text).toContain('step "c": approve must be the question');
  });

  test("continue names an earlier agent step", () => {
    const text = problems(flow([{ id: "t", run: ["ls"] }, { id: "a", continue: "t", task: "x" }, { id: "b", continue: "zzz", task: "x" }]));
    expect(text).toContain('step "a": continue must name an agent step');
    expect(text).toContain('step "b": continue names no step "zzz"');
    expect(checkWorkflow(flow([agent("a"), { id: "b", continue: "a", task: "x" }, { id: "c", continue: "b", task: "y" }]))).toEqual([]);
  });

  test("templates must point at inputs, run fields and earlier steps' fields", () => {
    const text = problems(
      flow(
        [
          agent("a", { task: "{{input.task}} {{input.nope}} {{run.dir}} {{run.nope}}", answer: { score: "number" } }),
          { id: "t", run: ["echo", "{{a.score}} {{a.exit}} {{a.missing}} {{later.output}}"] },
          agent("later", { task: "{{t.exit}} {{t.output}} {{nothing.output}} {{a.b.c}}" }),
        ],
        { inputs: { task: { required: true } } },
      ),
    );
    expect(text).toContain('{{input.nope}}: there is no input "nope"');
    expect(text).toContain("{{run.nope}}: run has id, dir, folder, space, workflow, number");
    expect(text).toContain("{{a.exit}}: only a run step has exit");
    expect(text).toContain('{{a.missing}}: step "a" answers no field "missing"');
    expect(text).toContain('{{later.output}}: step "later" runs after this one');
    expect(text).toContain('{{nothing.output}}: there is no step "nothing"');
    expect(text).toContain("{{a.b.c}} is not a known value");
    expect(text).not.toContain("{{input.task}}");
    expect(text).not.toContain("{{a.score}}");
    expect(text).not.toContain("{{t.exit}}");
  });

  test("when must parse and point at earlier steps", () => {
    const text = problems(flow([agent("a", { when: "{{b.output}} set" }), agent("b", { when: "> 2" }), agent("c", { when: "{{a.output}} = = 2" })]));
    expect(text).toContain('step "a": when: {{b.output}}: step "b" runs after this one');
    expect(text).toContain('step "b": when: expected a value');
    expect(text).toContain('step "c": when: expected a value');
  });

  test("goto names this step or an earlier one and needs max; max needs goto", () => {
    const text = problems(flow([agent("a", { goto: "b", max: 2 }), agent("b", { max: 2 }), agent("c", { goto: "a", max: 0 })]));
    expect(text).toContain('step "a": goto must name this step or an earlier one');
    expect(text).toContain('step "b": max only goes with goto');
    expect(text).toContain('step "c": goto needs max');
    expect(checkWorkflow(flow([agent("a", { goto: "a", max: 3 })]))).toEqual([]);
  });

  test("answer fields take the four types and optional", () => {
    expect(checkWorkflow(flow([agent("a", { answer: { a: "text", b: "number?", c: "boolean", d: "low|high?" } })]))).toEqual([]);
    expect(problems(flow([agent("a", { answer: { output: "text", "2x": "text" } })]))).toContain('answer field "output" is not a usable name');
    expect(problems(flow([agent("a", { answer: {} })]))).toContain("answer must be an object of fields");
  });

  test("timeout, allowFail and cwd are checked", () => {
    const text = problems(flow([agent("a", { timeout: 0, cwd: "" }), { id: "t", run: ["ls"], allowFail: "yes" }]));
    expect(text).toContain("timeout must be seconds above 0");
    expect(text).toContain("cwd must be text");
    expect(text).toContain("allowFail must be true or false");
  });
});

describe("warnings", () => {
  test("names agents that run without asking", () => {
    expect(warnings(flow([agent("a", { agent: ["claude", "--dangerously-skip-permissions"] }), agent("b")]))).toEqual(['step "a" runs its agent with --dangerously-skip-permissions: it acts without asking']);
  });
});

describe("expressions", () => {
  test("compare numbers, text and booleans", () => {
    expect(evaluate("{{review.blocking}} > 0", scope)).toBe(true);
    expect(evaluate("{{review.blocking}} <= 1", scope)).toBe(false);
    expect(evaluate("{{review.blocking}} = 2", scope)).toBe(true);
    expect(evaluate("{{review.level}} = HIGH", scope)).toBe(true);
    expect(evaluate("{{review.level}} != high", scope)).toBe(false);
    expect(evaluate("{{review.ok}} = false", scope)).toBe(true);
    expect(evaluate('{{review.summary}} = "two bugs"', scope)).toBe(true);
    expect(evaluate("{{review.summary}} > 1", scope)).toBe(false);
  });

  test("contains, set and unset", () => {
    expect(evaluate("{{test.output}} contains FAIL", scope)).toBe(true);
    expect(evaluate("{{review.note}} unset", scope)).toBe(true);
    expect(evaluate("{{empty.output}} set", scope)).toBe(false);
    expect(evaluate("{{gone.output}} unset", scope)).toBe(true);
  });

  test("a value alone is true unless empty, 0 or false", () => {
    expect(evaluate("{{test.output}}", scope)).toBe(true);
    expect(evaluate("{{empty.output}}", scope)).toBe(false);
    expect(evaluate("{{review.ok}}", scope)).toBe(false);
    expect(evaluate("{{test.exit}}", scope)).toBe(true);
  });

  test("and binds tighter than or", () => {
    expect(evaluate("{{test.exit}} = 0 and {{review.blocking}} > 0 or {{review.level}} = high", scope)).toBe(true);
    expect(evaluate("{{test.exit}} = 0 and {{review.level}} = high", scope)).toBe(false);
  });

  test("bad conditions throw with what went wrong", () => {
    expect(() => parseExpression("")).toThrow("empty condition");
    expect(() => parseExpression("{{a.b}} > 1 1")).toThrow('unexpected "1"');
    expect(() => parseExpression("{{a.b}} {")).toThrow('cannot read "{"');
  });
});

describe("templates", () => {
  test("finds every reference", () => {
    expect(templateRefs("{{ input.task }} and {{review.summary}}")).toEqual(["input.task", "review.summary"]);
  });

  test("fills values and leaves missing ones empty", () => {
    expect(fill("{{input.task}} in {{run.folder}} #{{run.number}}: {{review.blocking}} {{nope.output}}|{{review.note}}", scope)).toBe("Fix login in /r/app #3: 2 |");
  });
});

describe("answers", () => {
  const answer = { blocking: "number", summary: "text", level: "low|high", ok: "boolean", note: "text?" };

  test("reads a JSON object, fenced or with text around it", () => {
    const fenced = 'Here it is:\n```json\n{"blocking": "2", "summary": "Two", "level": "HIGH", "ok": "false"}\n```';
    expect(readAnswer(fenced, answer)).toEqual({ ok: true, fields: { blocking: 2, summary: "Two", level: "high", ok: false, note: null } });
    expect(readAnswer('Result: {"blocking": 0, "summary": "None", "level": "low", "ok": true, "note": "fine"} done', answer).fields).toEqual({ blocking: 0, summary: "None", level: "low", ok: true, note: "fine" });
  });

  test("says what is wrong", () => {
    expect(readAnswer("nothing here", answer)).toEqual({ ok: false, error: "it holds no JSON object" });
    expect(readAnswer("{ broken }", answer).error).toStartWith("its JSON does not parse");
    expect(readAnswer('{"summary": "x", "level": "low", "ok": true}', answer)).toEqual({ ok: false, error: "blocking is missing" });
    expect(readAnswer('{"blocking": "many", "summary": "x", "level": "low", "ok": true}', answer).error).toBe("blocking must be a number");
    expect(readAnswer('{"blocking": 1, "summary": "x", "level": "mid", "ok": true}', answer).error).toBe("level must be one of low, high");
    expect(readAnswer('{"blocking": 1, "summary": "x", "level": "low", "ok": "maybe"}', answer).error).toBe("ok must be true or false");
  });

  test("the message tells the agent where and what to write", () => {
    const text = agentMessage({ title: "Flow", step: "review", index: 2, total: 6, task: "  Review it  ", file: "/runs/flow-1/review-1.json", answer: { blocking: "number", level: "low|high?" } });
    expect(text).toBe(
      'Workflow "Flow", step "review" (3 of 6).\n\nReview it\n\nWhen you finish, write your answer to /runs/flow-1/review-1.json as one JSON object with these fields: blocking (number); level (one of low, high, optional). Put nothing else in that file.',
    );
    expect(agentMessage({ title: "Flow", step: "a", index: 0, total: 1, task: "Go", file: "/r/a-1.md" })).toEndWith("write your answer to /r/a-1.md: what you did or found, in plain text or Markdown. The workflow reads only that file.");
  });

  test("the second request names the problem", () => {
    expect(retryMessage({ file: "/r/a-1.md" })).toBe("The workflow found no answer in /r/a-1.md. Write your answer there now.");
    expect(retryMessage({ file: "/r/b-1.json", answer: { n: "number" }, error: "n is missing" })).toBe("Your answer in /r/b-1.json cannot be used: n is missing. Write it again as one JSON object with: n (number).");
  });

  test("long output is cut", () => {
    expect(cap("x".repeat(OUTPUT_CAP + 5))).toEndWith(`[cut at ${OUTPUT_CAP} characters]`);
    expect(cap("short")).toBe("short");
  });
});

describe("inputs", () => {
  const workflow = { inputs: { task: { required: true }, branch: { default: "main" } }, steps: [] };

  test("fills defaults and refuses missing and unknown inputs", () => {
    expect(resolveInputs(workflow, { task: "x" })).toEqual({ inputs: { task: "x", branch: "main" }, problems: [] });
    expect(resolveInputs(workflow, { other: "y" }).problems).toEqual(['the workflow has no input "other"', 'input "task" is required']);
  });
});

describe("the run", () => {
  const workflow = flow([agent("implement"), { id: "test", run: ["bun", "test"] }, agent("review"), { id: "fix", continue: "implement", task: "x", goto: "test", max: 2 }, { id: "ship", approve: "Ship?" }]);
  const run = {
    id: "flow-1",
    inputs: { task: "x" },
    steps: [
      { id: "implement", status: "done", output: "did it", terminal: "t1" },
      { id: "test", status: "done", output: "fail", exit: 1 },
      { id: "review", status: "failed", error: "boom" },
      { id: "test", status: "done", output: "pass", exit: 0 },
      { id: "fix", status: "skipped" },
    ],
  };

  test("scope takes each step's latest done or skipped record", () => {
    const value = scopeOf(run);
    expect(value.steps.test).toEqual({ output: "pass", exit: 0, fields: {} });
    expect(value.steps.fix).toEqual({ output: "", fields: {} });
    expect(value.steps.review).toBeUndefined();
    expect(value.run.id).toBe("flow-1");
  });

  test("goto jumps back after a done step, not after a skipped one", () => {
    expect(nextIndex(workflow, 3, { status: "done" })).toBe(1);
    expect(nextIndex(workflow, 3, { status: "skipped" })).toBe(4);
    expect(nextIndex(workflow, 1, { status: "done" })).toBe(2);
    expect(timesRun(run, "test")).toBe(2);
  });

  test("a continue step talks to the terminal of the step it continues", () => {
    expect(agentTerminal(run, workflow, "fix")).toBe("t1");
    expect(agentTerminal(run, workflow, "review")).toBeNull();
  });

  test("a retry keeps the latest results before the step it starts from", () => {
    const reused = reuseBefore(run, workflow, "review");
    expect(reused?.index).toBe(2);
    expect(reused?.steps.map((record: any) => [record.id, record.output, record.reused])).toEqual([
      ["implement", "did it", true],
      ["test", "pass", true],
    ]);
    expect(reuseBefore(run, workflow, "nope")).toBeNull();
  });
});
