import { describe, expect, test } from "bun:test";
import { checkWorkflow } from "../lib/workflow.js";
import {
  addNode,
  answerText,
  blank,
  connect,
  duplicateNode,
  fileName,
  HISTORY,
  history,
  joinArgs,
  LOOP_MAX,
  modelOf,
  moveNode,
  newId,
  parseAnswer,
  record,
  redo,
  removeNode,
  renameNode,
  serialize,
  setAgent,
  setField,
  setLoopMax,
  splitArgs,
  undo,
} from "../mods/workflows/editor.js";

const FLOW = {
  title: "Flow",
  nodes: [
    { id: "start", start: {}, at: [0, 0] },
    { id: "implement", agent: ["claude"], task: "Do it", at: [400, 0] },
    { id: "test", run: ["bun", "test"], at: [800, 0] },
    { id: "check", condition: "{{test.exit}} = 0", at: [1200, 0] },
    { id: "fix", continue: "implement", task: "Fix {{test.output}}", at: [1600, 200] },
  ],
  edges: [
    { from: "start", to: "implement" },
    { from: "implement", to: "test" },
    { from: "test", to: "check" },
    { from: "check", to: "fix", branch: "no" },
  ],
};

describe("connecting", () => {
  test("refuses what can't run, with the reason the canvas shows", () => {
    expect(connect(FLOW, "test", "test").error).toBe("A node cannot connect to itself");
    expect(connect(FLOW, "start", "implement").error).toBe("Already connected");
    expect(connect(FLOW, "test", "start").error).toBe("Nothing connects into start");
    expect(connect(FLOW, "check", "implement").error).toBe("Pick yes or no");
  });

  test("a connection back makes a loop with a max, one forward doesn't", () => {
    const back = connect(FLOW, "fix", "test");
    expect(back.loop).toBe(true);
    expect(back.workflow.edges.at(-1)).toEqual({ from: "fix", to: "test", max: LOOP_MAX });
    expect(checkWorkflow(back.workflow)).toEqual([]);
    const forward = connect(FLOW, "check", "implement", "yes");
    expect(forward.loop).toBe(true);
    const plain = connect(FLOW, "start", "test");
    expect(plain.loop).toBe(false);
    expect(plain.workflow.edges.at(-1)).toEqual({ from: "start", to: "test" });
    expect(setLoopMax(back.workflow, back.workflow.edges.length - 1, 5).edges.at(-1).max).toBe(5);
  });
});

describe("nodes", () => {
  test("a node added from an output is connected to it, snapped to 8px", () => {
    const made = addNode(FLOW, "approve", { x: 2003, y: 13 }, { from: "fix" });
    expect(made.id).toBe("approve");
    expect(made.workflow.nodes.at(-1)).toEqual({ id: "approve", approve: "Go on?", at: [2000, 16] });
    expect(made.workflow.edges.at(-1)).toEqual({ from: "fix", to: "approve" });
    const again = addNode(made.workflow, "approve", { x: 0, y: 0 });
    expect(again.id).toBe("approve-2");
    expect(newId(FLOW, "test")).toBe("test-2");
  });

  test("a same-agent step continues the nearest agent above it", () => {
    const made = addNode(FLOW, "continue", { x: 0, y: 0 }, { from: "check", branch: "yes" });
    expect(made.workflow.nodes.at(-1)).toMatchObject({ continue: "implement", task: "" });
    expect(made.workflow.edges.at(-1)).toEqual({ from: "check", to: "again", branch: "yes" });
    expect(addNode(FLOW, "condition", { x: 0, y: 0 }, { from: "test" }).workflow.nodes.at(-1).condition).toBe("{{test.output}} set");
  });

  test("moving snaps; deleting takes its connections; start stays", () => {
    expect(moveNode(FLOW, "test", { x: 803, y: -5 }).nodes[2].at).toEqual([800, -8]);
    const gone = removeNode(FLOW, "test");
    expect(gone.nodes.map((node) => node.id)).not.toContain("test");
    expect(gone.edges).toEqual([
      { from: "start", to: "implement" },
      { from: "check", to: "fix", branch: "no" },
    ]);
    expect(removeNode(FLOW, "start")).toBe(FLOW);
  });

  test("duplicating copies the step beside it with a new name", () => {
    const made = duplicateNode(FLOW, "implement");
    expect(made.id).toBe("implement-2");
    expect(made.workflow.nodes.at(-1)).toEqual({ id: "implement-2", agent: ["claude"], task: "Do it", at: [432, 32] });
    expect(duplicateNode(FLOW, "start").id).toBeNull();
  });

  test("renaming follows into connections, continues and templates", () => {
    const made = renameNode(FLOW, "test", "unit");
    expect(made.workflow.edges[1]).toEqual({ from: "implement", to: "unit" });
    expect(made.workflow.nodes.find((node) => node.id === "check")?.condition).toBe("{{unit.exit}} = 0");
    expect(made.workflow.nodes.find((node) => node.id === "fix")?.task).toBe("Fix {{unit.output}}");
    expect(renameNode(FLOW, "implement", "build").workflow.nodes.find((node) => node.id === "fix")?.continue).toBe("build");
    expect(renameNode(FLOW, "test", "fix").error).toBe("Another step has this name");
    expect(renameNode(FLOW, "test", "input").error).toBe('"input" is taken');
    expect(renameNode(FLOW, "test", "9 lives").error).toContain("letter");
  });
});

describe("fields", () => {
  test("a command is split like a shell would, and shown back the same way", () => {
    expect(splitArgs(`gh pr create --title "Ship it" --body ''`)).toEqual(["gh", "pr", "create", "--title", "Ship it", "--body", ""]);
    expect(joinArgs(["gh", "--title", "Ship it", ""])).toBe(`gh --title "Ship it" ""`);
    expect(setField(FLOW, "test", "run", "bun test --bail").nodes[2].run).toEqual(["bun", "test", "--bail"]);
  });

  test("the agent and its model live in the argv", () => {
    const withModel = setField(FLOW, "implement", "model", "opus").nodes[1].agent;
    expect(withModel).toEqual(["claude", "--model", "opus"]);
    expect(modelOf(withModel)).toBe("opus");
    expect(setAgent(withModel, ["codex"])).toEqual(["codex", "--model", "opus"]);
    expect(setField({ ...FLOW, nodes: [{ id: "implement", agent: withModel }] }, "implement", "model", "").nodes[0].agent).toEqual(["claude"]);
  });

  test("allowFail and answer come and go; show is dropped when empty", () => {
    const allowed = setField(FLOW, "test", "allowFail", true);
    expect(allowed.nodes[2].allowFail).toBe(true);
    expect("allowFail" in setField(allowed, "test", "allowFail", false).nodes[2]).toBe(false);
    expect("show" in setField({ nodes: [{ id: "g", approve: "Go?", show: "x" }], edges: [] }, "g", "show", "").nodes[0]).toBe(false);
    const parsed = parseAnswer("verdict: approve|changes, notes: text?, count");
    expect(parsed).toEqual({ answer: { verdict: "approve|changes", notes: "text?", count: "text" }, problems: [] });
    expect(answerText(parsed.answer)).toBe("verdict: approve|changes, notes: text?, count: text");
    expect(parseAnswer("9x: text, ok: colour").problems).toEqual(['"9x" is not a usable field name', "ok: use text, number, boolean or a|b|c, with ? when optional"]);
    expect("answer" in setField(setField(FLOW, "implement", "answer", parsed.answer), "implement", "answer", {}).nodes[1]).toBe(false);
  });
});

describe("history", () => {
  test("typing in one field is one step back; another change starts a new one", () => {
    let state = history();
    let present = FLOW;
    const type = (text: string) => {
      state = record(state, present, "implement:task");
      present = setField(present, "implement", "task", text);
    };
    type("D");
    type("Do");
    type("Do that");
    state = record(state, present);
    present = moveNode(present, "test", { x: 0, y: 0 });
    expect(state.past).toHaveLength(2);
    let back = undo(state, present)!;
    expect(back.workflow.nodes[1].task).toBe("Do that");
    back = undo(back.state, back.workflow)!;
    expect(back.workflow).toBe(FLOW);
    expect(undo(back.state, back.workflow)).toBeNull();
    const forward = redo(back.state, back.workflow)!;
    expect(forward.workflow.nodes[1].task).toBe("Do that");
  });

  test("keeps the last 100 steps", () => {
    let state = history();
    for (let i = 0; i < HISTORY + 20; i += 1) state = record(state, { n: i } as never);
    expect(state.past).toHaveLength(HISTORY);
    expect((state.past[0] as unknown as { n: number }).n).toBe(20);
  });
});

describe("the file", () => {
  test("keeps the format's key order and writes places on one line", () => {
    const text = serialize({ edges: [{ to: "a", from: "start" }], nodes: [{ at: [8, 16], task: "x", agent: ["claude"], id: "a" }], title: "T" });
    expect(text).toBe(`{
  "title": "T",
  "nodes": [
    {
      "id": "a",
      "agent": [
        "claude"
      ],
      "task": "x",
      "at": [8, 16]
    }
  ],
  "edges": [
    {
      "from": "start",
      "to": "a"
    }
  ]
}
`);
  });

  test("a blank workflow is valid and its file name is free", () => {
    expect(checkWorkflow(blank("New workflow"))).toEqual([]);
    expect(fileName("New workflow", ["new-workflow", "new-workflow-2"])).toBe("new-workflow-3");
    expect(fileName("!!!", [])).toBe("workflow");
  });
});
