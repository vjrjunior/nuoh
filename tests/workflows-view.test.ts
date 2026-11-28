import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { byKey, click, find, flush, herdr, makeCx, type Node, painted, texts } from "./app-mocks";
import { removeTempDirs, tempDir } from "./helpers";

const { default: Workflows } = await import("../mods/workflows/main.js");

const REPO = "/repo";
const BUN = "/bin/bun";
const FLOW = {
  title: "Flow",
  inputs: { task: { label: "Task", required: true } },
  nodes: [
    { id: "start", start: {}, at: [0, 0] },
    { id: "implement", agent: ["claude"], task: "Do {{input.task}}", at: [400, 0] },
    { id: "ship", approve: "Ship {{input.task}}?", at: [800, 0] },
  ],
  edges: [
    { from: "start", to: "implement" },
    { from: "implement", to: "ship" },
  ],
};
const MODS = { shift: false, control: false, alt: false, platform: false, function: false };

let dirs = { workflows: "", runs: "" };
let execs: string[][] = [];
let answer: (args: string[]) => { code: number; stdout: string; stderr: string } = () => ({ code: 0, stdout: "{}", stderr: "" });
let terminalsNow: Record<string, unknown>[] = [];
let commands: { name: string; args: unknown }[] = [];
let overlays: Record<string, any>[] = [];
let closed: string[] = [];
let notices: Record<string, unknown>[] = [];
let sharedState: Record<string, unknown> = {};

function writeWorkflow(name: string, value: unknown) {
  writeFileSync(join(dirs.workflows, `${name}.json`), typeof value === "string" ? value : JSON.stringify(value));
}

function readWorkflow(name: string) {
  return JSON.parse(readFileSync(join(dirs.workflows, `${name}.json`), "utf8"));
}

function writeRun(id: string, value: Record<string, unknown>) {
  mkdirSync(join(dirs.runs, id), { recursive: true });
  writeFileSync(join(dirs.runs, id, "run.json"), JSON.stringify({ id, workflow: "flow", number: Number(id.split("-").pop()), created: Date.now(), inputs: { task: "login" }, space: "s1", steps: [], ...value }));
}

function at(x: number, y: number, extra: Record<string, unknown> = {}) {
  return { position: { x, y }, bounds: { x: 0, y: 0, width: 1200, height: 800 }, pressed_button: "left", click_count: 1, modifiers: MODS, ...extra };
}

function press(node: Node, event: unknown, cx: unknown, button = "left") {
  for (const handler of node.handlers[`down:${button}`] ?? []) handler(event, cx);
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
  sharedState = {};
  painted.length = 0;
  answer = () => ({ code: 0, stdout: "{}", stderr: "" });
  herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `t.${prop}` : undefined) });
  herdr.checking = () => false;
  herdr.props = () => null;
  herdr.settings = () => ({ zoom: 1 }) as never;
  herdr.window = () => ({ visible: true });
  herdr.shared = ((key: string) => sharedState[key]) as never;
  herdr.setShared = ((key: string, value: unknown) => {
    sharedState[key] = JSON.parse(JSON.stringify(value));
  }) as never;
  herdr.watchFolder = () => Object.assign(new Promise(() => {}), { cancel() {} });
  herdr.readTextFile = (async (path: string) => (existsSync(path) ? Bun.file(path).text() : null)) as never;
  herdr.writeTextFile = (async (path: string, text: string, expected: string | null) => {
    const now = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (now !== expected) throw new Error("the file changed");
    writeFileSync(path, text);
    return null;
  }) as never;
  herdr.terminals = () => terminalsNow as never;
  herdr.spaces = () => [{ id: "s1", name: "app", machine: null }, { id: "s2", name: "vps", machine: "vps" }, { id: "s3", name: "api", machine: null }] as never;
  herdr.focused = () => ({ space: "s3" }) as never;
  herdr.run = ((name: string, args: unknown) => commands.push({ name, args })) as never;
  herdr.openOverlay = ((spec: Record<string, any>) => overlays.push(spec)) as never;
  herdr.closeOverlay = ((id: string) => closed.push(id)) as never;
  herdr.notify = ((notice: Record<string, unknown>) => notices.push(notice)) as never;
  herdr.knownAgents = (async () => [{ name: "Codex", installed: false, run: ["codex"] }, { name: "Claude Code", installed: true, run: ["claude"] }]) as never;
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
  if (role === "body") {
    view.resized?.({ width: 1200, height: 800 }, cx);
    if (view.doc) view.camera = { x: 0, y: 0, z: 1 };
  }
  return { view, cx, draw: () => view.render(cx) };
}

async function saved(cx: ReturnType<typeof makeCx>) {
  const save = cx.afters.at(-1);
  expect(save).toBeDefined();
  save!(cx);
  await flush();
}

const bezierPaths = () => painted.filter((one) => one.path.ops.some(([op]) => op === "cubic_bezier_to"));

describe("the canvas", () => {
  test("without workflows it starts a blank one or has an agent write one", async () => {
    const { draw, cx, view } = await open();
    expect(texts(draw())).toContain("No workflows yet");
    click(byKey(draw(), "workflows-empty-agent"), cx);
    await flush();
    expect(commands[0]).toMatchObject({ name: "tab.new", args: { space: "s3", name: "New workflow", folder: dirs.workflows, argv: ["claude"] } });
    expect((commands[0].args as { task: string }).task).toContain(`${BUN} ${REPO}/scripts/workflow.ts format`);
    click(byKey(draw(), "workflows-empty-blank"), cx);
    await flush();
    expect(readWorkflow("new-workflow")).toEqual({ title: "New workflow", inputs: {}, nodes: [{ id: "start", start: {}, at: [0, 0] }], edges: [] });
    expect(sharedState["workflows.view"]).toEqual({ workflow: "new-workflow", run: "newest" });
    await view.load();
    view.openDoc();
    expect(find(draw(), (node) => node.key === "workflows-node-start")).not.toBeNull();
  });

  test("draws each step as a node and each connection as a curve, with the bars under them", async () => {
    writeWorkflow("flow", FLOW);
    const { draw } = await open();
    const tree = draw();
    for (const id of ["start", "implement", "ship"]) expect(find(tree, (node) => node.key === `workflows-node-${id}`)).not.toBeNull();
    expect(bezierPaths().flatMap((one) => one.path.ops.filter(([op]) => op === "cubic_bezier_to"))).toHaveLength(2);
    expect(texts(tree)).toContain("Claude Code");
    expect(texts(tree)).toContain("100%");
    expect(find(tree, (node) => node.key === "workflows-canvas-bar-add")).not.toBeNull();
    expect(find(tree, (node) => node.key === "workflows-port-dot-implement-in")).not.toBeNull();
    expect(find(tree, (node) => node.key === "workflows-port-dot-start-in")).toBeNull();
  });

  test("a chosen run paints its nodes and the Runs drawer lists the runs, newest first", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "done", ended: Date.now(), steps: [{ id: "start", status: "done" }] });
    writeRun("flow-2", { status: "running", runner: "t9", steps: [{ id: "start", status: "done" }, { id: "implement", status: "running", terminal: "t10", started: Date.now() }] });
    terminalsNow = [{ address: "t9", labels: { "nuoh.workflow": "flow-2" } }, { address: "t10", labels: { "nuoh.workflow": "flow-2:implement" } }];
    sharedState["workflows.view"] = { drawer: true };
    const { draw, cx } = await open();
    const tree = draw();
    expect(texts(byKey(tree, "workflows-node-implement"))).toContain("Working");
    const rows = texts(byKey(tree, "workflows-drawer-rows"));
    expect(rows.indexOf("#2 · Running")).toBeLessThan(rows.indexOf("#1 · Done"));
    click(byKey(draw(), "workflows-show-implement"), cx);
    expect(commands.at(-1)).toEqual({ name: "pane.focus", args: { terminal: "t10" } });
    click(byKey(draw(), "workflows-run-flow-1"), cx);
    expect(sharedState["workflows.view"]).toMatchObject({ run: "flow-1" });
    expect(texts(byKey(draw(), "workflows-node-implement"))).not.toContain("Working");
  });

  test("a run at its gate is approved or rejected on the node", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "approval", runner: "t9", steps: [{ id: "implement", status: "done", output: "Did it" }, { id: "ship", status: "approval" }] });
    terminalsNow = [{ address: "t9", labels: { "nuoh.workflow": "flow-1" } }];
    const { draw, cx } = await open();
    expect(texts(byKey(draw(), "workflows-node-implement"))).toContain("Did it");
    expect(texts(byKey(draw(), "workflows-node-ship"))).toContain("Needs you");
    click(byKey(draw(), "workflows-approve-ship"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["approve", "flow-1", "--node", "ship"]);
    click(byKey(draw(), "workflows-reject-ship"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["reject", "flow-1", "--node", "ship"]);
  });

  test("a command that fails says why in a toast", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "approval", runner: "t9", steps: [{ id: "ship", status: "approval" }] });
    terminalsNow = [{ address: "t9", labels: { "nuoh.workflow": "flow-1" } }];
    answer = () => ({ code: 1, stdout: "", stderr: "workflow: flow-1 is not at a gate\n" });
    const { draw, cx } = await open();
    click(byKey(draw(), "workflows-approve-ship"), cx);
    await flush();
    expect(notices).toEqual([{ title: "Workflow", body: "flow-1 is not at a gate", level: "error" }]);
  });

  test("a file that isn't a graph offers an agent to fix it; one with problems is drawn with them", async () => {
    writeWorkflow("broken", "{");
    const first = await open();
    expect(texts(first.draw())).toContain("broken.json can't be drawn");
    click(byKey(first.draw(), "workflows-fix"), first.cx);
    await flush();
    expect(commands[0].args).toMatchObject({ name: "Edit broken" });
    writeWorkflow("broken", { nodes: [{ id: "start", start: {}, at: [0, 0] }, { id: "a", run: [], at: [400, 0] }], edges: [] });
    const second = await open();
    expect(texts(second.draw())).toContain('step "a": run must be a list like ["bun", "test"]');
    click(byKey(second.draw(), "workflows-start-start"), second.cx);
    expect(overlays).toEqual([]);
  });

  test("Run workflow opens the run popup with the inputs and a height for this machine's spaces", async () => {
    writeWorkflow("flow", FLOW);
    const { draw, cx } = await open();
    click(byKey(draw(), "workflows-start-start"), cx);
    expect(overlays[0]).toMatchObject({ mod: "workflows", kind: "dialog", width: 440, props: { role: "run", workflow: "flow", title: "Flow", repo: REPO, bun: BUN, from: null, only: null, inputs: [{ name: "task", label: "Task", required: true, value: "" }] } });
    expect(overlays[0].height).toBeGreaterThan(200);
  });

  test("Run step and Run from here reuse the last run's inputs, or ask for them before the first", async () => {
    writeWorkflow("flow", FLOW);
    const fresh = await open();
    click(byKey(fresh.draw(), "workflows-step-implement"), fresh.cx);
    expect(overlays[0].props).toMatchObject({ role: "run", only: "implement", from: null });
    writeRun("flow-1", { status: "done", ended: Date.now(), steps: [{ id: "implement", status: "done", output: "ok" }] });
    const { draw, cx, view } = await open();
    click(byKey(draw(), "workflows-step-implement"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["run", "flow", "--only", "implement", "--json"]);
    press(byKey(draw(), "workflows-place-ship"), at(810, 10), cx, "right");
    expect(view.menu).toMatchObject({ kind: "context", node: "ship" });
    click(byKey(draw(), "workflows-ctx-from"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["run", "flow", "--from", "ship", "--json"]);
  });

  test("starts no work while Herdr checks it", async () => {
    herdr.checking = () => true;
    await open();
    expect(execs).toEqual([]);
  });

  test("30 nodes render well inside a frame", async () => {
    const nodes = [{ id: "start", start: {}, at: [0, 0] }, ...Array.from({ length: 29 }, (_, i) => ({ id: `s${i}`, agent: ["claude"], task: `Step ${i}`, at: [((i % 6) + 1) * 400, Math.floor(i / 6) * 320] }))];
    const edges = nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id }));
    writeWorkflow("big", { title: "Big", nodes, edges });
    const { draw } = await open();
    draw();
    const started = performance.now();
    for (let i = 0; i < 5; i += 1) draw();
    expect((performance.now() - started) / 5).toBeLessThan(15);
  });
});

describe("editing on the canvas", () => {
  test("typing in a node's field saves the file after a pause, keeping the format", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx } = await open();
    const task = view.field("implement", "task");
    task.set_value("Do {{input.task}} now");
    task.emit("change", cx);
    expect(view.doc.dirty).toBe(true);
    await saved(cx);
    const file = readFileSync(join(dirs.workflows, "flow.json"), "utf8");
    expect(JSON.parse(file).nodes[1].task).toBe("Do {{input.task}} now");
    expect(file).toContain('"at": [400, 0]');
    expect(view.doc.dirty).toBe(false);
  });

  test("dragging a node moves it on an 8px grid; undo puts it back", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    press(byKey(draw(), "workflows-place-ship"), at(810, 10), cx);
    view.moved(at(812, 11), cx);
    expect(view.drag.moved).toBe(false);
    view.moved(at(913, 61), cx);
    expect(view.dragging("ship")).toEqual({ x: 903, y: 51 });
    view.released(at(913, 61), cx);
    await saved(cx);
    expect(readWorkflow("flow").nodes[2].at).toEqual([904, 48]);
    view.key({ key: "z", modifiers: { ...MODS, platform: true } }, cx);
    expect(view.doc.workflow.nodes[2].at).toEqual([800, 0]);
    view.key({ key: "z", modifiers: { ...MODS, platform: true, shift: true } }, cx);
    expect(view.doc.workflow.nodes[2].at).toEqual([904, 48]);
  });

  test("pulling a connection into the open adds a node there, connected", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    press(byKey(draw(), "workflows-port-dot-ship-out"), at(1100, 46), cx);
    view.moved(at(1300, 300), cx);
    expect(bezierPaths().length).toBeGreaterThan(0);
    view.released(at(1300, 300), cx);
    expect(view.menu).toMatchObject({ kind: "add", link: { from: "ship", branch: null } });
    click(byKey(draw(), "workflows-add-agent"), cx);
    expect(view.doc.workflow.nodes.at(-1)).toMatchObject({ id: "agent", agent: ["claude"], at: [1304, 256] });
    expect(view.doc.workflow.edges.at(-1)).toEqual({ from: "ship", to: "agent" });
    expect(view.sel.node).toBe("agent");
  });

  test("a connection the graph can't take is refused with the reason, and nothing changes", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    press(byKey(draw(), "workflows-port-dot-implement-out"), at(700, 46), cx);
    view.moved(at(500, 80), cx);
    expect(texts(draw())).toContain("A node cannot connect to itself");
    view.released(at(500, 80), cx);
    press(byKey(draw(), "workflows-port-dot-start-out"), at(300, 46), cx);
    view.moved(at(450, 60), cx);
    expect(texts(draw())).toContain("Already connected");
    view.released(at(450, 60), cx);
    expect(view.doc.workflow.edges).toEqual(FLOW.edges);
    expect(view.menu).toBeNull();
  });

  test("a connection back is a loop with a max the badge changes", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    press(byKey(draw(), "workflows-port-dot-ship-out"), at(1100, 46), cx);
    view.moved(at(450, 60), cx);
    view.released(at(450, 60), cx);
    expect(view.doc.workflow.edges.at(-1)).toEqual({ from: "ship", to: "implement", max: 3 });
    expect(view.sel.edge).toBe(2);
    expect(texts(draw())).toContain("up to 3×");
    click(byKey(draw(), "workflows-loop-more-2"), cx);
    expect(view.doc.workflow.edges[2].max).toBe(4);
  });

  test("Delete takes the selected node and its connections; the toolbar duplicates", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    press(byKey(draw(), "workflows-place-implement"), at(410, 10), cx);
    view.released(at(410, 10), cx);
    click(byKey(draw(), "workflows-node-toolbar-duplicate"), cx);
    expect(view.doc.workflow.nodes.at(-1)).toMatchObject({ id: "implement-2", at: [432, 32] });
    expect(view.sel.node).toBe("implement-2");
    view.key({ key: "backspace", modifiers: MODS }, cx);
    expect(view.doc.workflow.nodes.map((node: { id: string }) => node.id)).toEqual(["start", "implement", "ship"]);
    view.sel = { node: "implement", edge: null };
    view.key({ key: "delete", modifiers: MODS }, cx);
    expect(view.doc.workflow.edges).toEqual([]);
    view.key({ key: "z", modifiers: { ...MODS, platform: true } }, cx);
    expect(view.doc.workflow.edges).toEqual(FLOW.edges);
  });

  test("keys don't edit the graph while a field has the keyboard", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx } = await open();
    view.sel = { node: "implement", edge: null };
    view.field("implement", "task").emit("focus", cx);
    view.key({ key: "backspace", modifiers: MODS }, cx);
    expect(view.doc.workflow.nodes).toHaveLength(3);
    view.field("implement", "task").emit("blur", cx);
    view.handle = { focus() {}, is_focused: () => false };
    view.key({ key: "backspace", modifiers: MODS }, cx);
    expect(view.doc.workflow.nodes).toHaveLength(3);
    view.handle = { focus() {}, is_focused: () => true };
    view.key({ key: "backspace", modifiers: MODS }, cx);
    expect(view.doc.workflow.nodes).toHaveLength(2);
  });

  test("the agent picker lists the installed agents first and sets the program", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    click(byKey(draw(), "workflows-agent-implement-agent"), cx);
    const menu = texts(byKey(draw(), "workflows-agent-menu"));
    expect(menu.indexOf("Claude Code")).toBeLessThan(menu.indexOf("Codex"));
    click(byKey(draw(), "workflows-pick-Codex"), cx);
    expect(view.doc.workflow.nodes[1].agent).toEqual(["codex"]);
    const model = view.field("implement", "model");
    model.set_value("gpt-5");
    model.emit("change", cx);
    expect(view.doc.workflow.nodes[1].agent).toEqual(["codex", "--model", "gpt-5"]);
  });

  test("answer fields are typed in the toolbar's popover and checked", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    view.sel = { node: "implement", edge: null };
    click(byKey(draw(), "workflows-node-toolbar-answer"), cx);
    view.answerState.set_value("verdict: yes|maybe, count: nope");
    click(byKey(draw(), "workflows-answer-save"), cx);
    expect(texts(draw())).toContain("count: use text, number, boolean or a|b|c, with ? when optional");
    view.answerState.set_value("verdict: approve|changes, notes: text?");
    click(byKey(draw(), "workflows-answer-save"), cx);
    expect(view.doc.workflow.nodes[1].answer).toEqual({ verdict: "approve|changes", notes: "text?" });
    expect(view.menu).toBeNull();
  });

  test("a change from outside is taken when nothing is pending, and asked about when something is", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx, draw } = await open();
    writeWorkflow("flow", { ...FLOW, title: "Renamed" });
    await view.load();
    view.openDoc();
    expect(view.doc.workflow.title).toBe("Renamed");
    const task = view.field("implement", "task");
    task.set_value("mine");
    task.emit("change", cx);
    writeWorkflow("flow", { ...FLOW, title: "Theirs" });
    await view.load();
    view.openDoc();
    expect(texts(draw())).toContain("The file changed outside while you were editing.");
    click(byKey(draw(), "workflows-keep-mine"), cx);
    await flush();
    expect(readWorkflow("flow")).toMatchObject({ title: "Renamed", nodes: [{}, { task: "mine" }, {}] });
  });

  test("Cmd-scroll and pinch zoom around the pointer; a plain scroll pans", async () => {
    writeWorkflow("flow", FLOW);
    const { view, cx } = await open();
    view.wheel({ delta: { x: 10, y: -20 }, position: { x: 600, y: 400 }, modifiers: MODS }, cx);
    expect(view.camera).toEqual({ x: 10, y: -20, z: 1 });
    view.wheel({ delta: { x: 0, y: 100 }, position: { x: 600, y: 400 }, modifiers: { ...MODS, platform: true } }, cx);
    expect(view.camera.z).toBeCloseTo(Math.exp(0.4));
    view.pinch({ delta: 5, position: { x: 600, y: 400 }, modifiers: MODS }, cx);
    expect(view.camera.z).toBe(2);
  });
});

describe("the run popup", () => {
  const popup = (extra: Record<string, unknown> = {}) => open("run", { workflow: "flow", title: "Flow", overlay: "o1", inputs: [{ name: "task", label: "Task", required: true, value: "" }], ...extra });

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
    expect(sharedState["workflows.view"]).toEqual({ workflow: "flow", run: "newest" });
  });

  test("runs one step alone when opened for it", async () => {
    const { view, draw, cx } = await popup({ only: "implement" });
    expect(texts(draw())).toContain("Run implement alone");
    view.states.task.set_value("x");
    view.states.task.emit("change", cx);
    click(byKey(draw(), "workflows-start"), cx);
    await flush();
    expect(execs).toEqual([["run", "flow", "--input", "task=x", "--space", "s3", "--only", "implement", "--json"]]);
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
  test("names the workflow, opens the switcher and toggles the Runs drawer", async () => {
    writeWorkflow("flow", FLOW);
    writeWorkflow("broken", "{");
    sharedState["workflows.view"] = { workflow: "flow" };
    const { draw, cx } = await open("bar");
    expect(texts(draw())).toContain("All workflows · 2");
    expect(texts(draw())).toContain("Flow");
    click(byKey(draw(), "workflows-switch"), cx);
    expect(overlays[0]).toMatchObject({ mod: "workflows", kind: "popup", props: { role: "switcher" } });
    click(byKey(draw(), "workflows-runs"), cx);
    expect(sharedState["workflows.view"]).toMatchObject({ drawer: true });
    click(byKey(draw(), "workflows-run"), cx);
    expect(overlays[1].props).toMatchObject({ role: "run", workflow: "flow" });
  });

  test("the run pill says where the run is and acts on it", async () => {
    writeWorkflow("flow", FLOW);
    writeRun("flow-1", { status: "running", runner: "t9", steps: [{ id: "implement", status: "running" }] });
    const { draw, cx } = await open("bar");
    const pill = texts(byKey(draw(), "workflows-pill"));
    expect(pill).toContain("Interrupted");
    expect(pill).toContain("#1");
    expect(pill).toContain("cut off at implement");
    click(byKey(draw(), "workflows-pill-action"), cx);
    await flush();
    expect(execs.at(-1)).toEqual(["resume", "flow-1"]);
    click(byKey(draw(), "workflows-pill-at"), cx);
    expect(sharedState["workflows.view"]).toMatchObject({ focus: "implement" });
    click(byKey(draw(), "workflows-hide-run"), cx);
    expect(sharedState["workflows.view"]).toMatchObject({ run: null });
    expect(find(draw(), (node) => node.key === "workflows-pill")).toBeNull();
  });

  test("the title is renamed in place, in the file", async () => {
    writeWorkflow("flow", FLOW);
    const { draw, cx, view } = await open("bar");
    click(byKey(draw(), "workflows-title"), cx);
    view.titleState.set_value("Login flow");
    view.titleState.emit("submit", cx);
    await flush();
    expect(readWorkflow("flow").title).toBe("Login flow");
  });
});

describe("the switcher", () => {
  test("lists the workflows with their steps and last run, and picks one", async () => {
    writeWorkflow("flow", FLOW);
    writeWorkflow("other", { ...FLOW, title: "Other" });
    writeRun("flow-1", { status: "done", ended: Date.now() });
    const { draw, cx } = await open("switcher", { overlay: "o2" });
    expect(texts(draw())).toContain("3 steps · Done");
    click(byKey(draw(), "workflows-pick-other"), cx);
    expect(sharedState["workflows.view"]).toEqual({ workflow: "other", run: "newest" });
    expect(closed).toEqual(["o2"]);
  });

  test("New workflow writes a blank one and shows it", async () => {
    writeWorkflow("flow", FLOW);
    const { draw, cx } = await open("switcher", { overlay: "o2" });
    click(byKey(draw(), "workflows-switcher-blank"), cx);
    await flush();
    expect(readWorkflow("new-workflow").nodes).toEqual([{ id: "start", start: {}, at: [0, 0] }]);
    expect(sharedState["workflows.view"]).toEqual({ workflow: "new-workflow", run: "newest" });
    expect(closed).toEqual(["o2"]);
  });
});
