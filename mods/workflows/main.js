import { View, div } from "gpui-kit";
import { InputState, TextareaState, h_flex, v_flex } from "gpui-base";
import * as fs from "fs/promises";
import { checking, closeOverlay, exec, focused, knownAgents, nextCommand, notify, openOverlay, props, readTextFile, run, settings, setShared, shared, spaces, terminals, theme, watchFolder, window, writeTextFile } from "herdr";
import { button, emptyState, heading, iconButton, input, menuItem, pill, runPill, TEXT, toneColor, viewCard, viewTile } from "../../kit/kit.js";
import { agentTerminal, nodeKind } from "../../lib/workflow.js";
import { barsLayer, drawerLayer, edgesLayer, gridLayer, menuLayer, nodeLayer, noticesLayer, portLayer, toolbarLayer } from "./board.js";
import { bounds, clampZoom, fit, freeSpot, fromMinimap, hitEdge, inPort, LABEL, NODE_W, placesOf, PORT_Y, tidy, toScreen, toWorld, zoomAt, ZOOM } from "./canvas.js";
import {
  addNode,
  answerText,
  blank,
  connect,
  connectProblem,
  disconnect,
  duplicateNode,
  fileName,
  history,
  joinArgs,
  modelOf,
  moveNode,
  parseAnswer,
  placeAll,
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
} from "./editor.js";
import {
  authorPrompt,
  checked,
  chooseAgent,
  cli,
  editPrompt,
  groupRuns,
  heightsOf,
  inputsOf,
  itemOf,
  liveRuns,
  missingInputs,
  pillOf,
  RUN_LOOK,
  RUN_POPUP,
  runActions,
  runArgs,
  runPopupHeight,
  RUNS_SHOWN,
  runStatus,
  SWITCHER,
  switcherHeight,
  viewsOf,
} from "./logic.js";

const ROLES = ["bar", "body", "run", "switcher"];
const VIEW_KEY = "workflows.view";
const MAP_KEY = "workflows.minimap";
const AGO_MS = 30000;
const POLL_MS = 5000;
const COMMAND_MS = 30000;
const SAVE_MS = 400;
const MOVE_PX = 4;
const PORT_REACH = 18;
const WHEEL_ZOOM = 0.004;
const FIELDS = { agent: ["task", "model"], continue: ["task"], run: ["run"], condition: ["condition"], approve: ["approve", "show"] };
const AREAS = ["task"];

function viewState() {
  const value = shared(VIEW_KEY);
  return value && typeof value === "object" ? value : {};
}

function setView(patch) {
  setShared(VIEW_KEY, { ...viewState(), ...patch });
}

function zoomOf() {
  return settings()?.zoom ?? 1;
}

function fieldValue(node, field) {
  if (field === "run") return joinArgs(node.run);
  if (field === "model") return modelOf(node.agent);
  return node[field] ?? "";
}

function same(field, text, node) {
  if (field === "run") return joinArgs(splitArgs(text)) === fieldValue(node, field);
  return text === fieldValue(node, field);
}

async function names(dir, test) {
  try {
    return (await fs.readdir(dir)).filter(test).sort();
  } catch {
    return [];
  }
}

async function readJson(path) {
  try {
    const text = await readTextFile(path);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export default class Workflows extends View {
  init(given, cx) {
    const own = { ...(props() ?? {}), ...(given && typeof given === "object" ? given : {}) };
    this.role = ROLES.includes(own.role) ? own.role : "body";
    this.repo = own.repo ?? null;
    this.bun = own.bun ?? null;
    this.overlay = own.overlay ?? null;
    if (this.role === "run") return this.initRun(own);
    this.paths = null;
    this.workflows = [];
    this.runs = {};
    this.newest = {};
    this.busy = null;
    this.watches = [];
    this.closed = false;
    this.problem = null;
    this.loadedFor = undefined;
    this.loading = false;
    if (this.role === "body") this.initBoard(cx);
    if (this.role === "bar") this.titleState = null;
    if (checking() || !this.repo || !this.bun) return;
    cx.spawn(async (cx) => this.start(cx).catch((error) => this.fail(error, cx)));
    if (this.role !== "switcher") cx.timer.every(AGO_MS, (cx) => window()?.visible !== false && cx.notify());
  }

  initBoard(cx) {
    this.handle = cx.focus_handle();
    this.doc = null;
    this.cameras = {};
    this.camera = null;
    this.viewport = { width: 0, height: 0 };
    this.origin = null;
    this.sel = { node: null, edge: null };
    this.drag = null;
    this.pan = null;
    this.pull = null;
    this.menu = null;
    this.tool = "select";
    this.showMap = stored(MAP_KEY) === "1";
    this.fields = new Map();
    this.typing = null;
    this.renaming = null;
    this.renameState = InputState.new({ placeholder: "Step name" });
    this.renameState.on("submit", (_e, cx) => this.finishRename(cx));
    this.renameState.on("blur", (_e, cx) => this.renaming && this.finishRename(cx));
    this.answerState = InputState.new({ placeholder: "verdict: approve|changes, notes: text?" });
    this.answerState.on("submit", (_e, cx) => this.saveAnswer(cx));
    this.answerProblem = null;
    this.addSearch = InputState.new({ placeholder: "Search nodes" });
    this.addSearch.on("change", (_e, cx) => cx.notify());
    this.findState = InputState.new({ placeholder: "Find a step" });
    this.findState.on("change", (_e, cx) => cx.notify());
    this.refusal = null;
    this.hover = null;
    this.deleteHot = false;
    this.hotEdges = null;
    this.agents = [];
    this.saveTask = null;
    this.saveError = null;
    this.memo = null;
    this.seenFocus = viewState().focusAt ?? null;
    this.theme = null;
  }

  async close() {
    this.closed = true;
    for (const watch of this.watches) watch.cancel();
    if (this.role === "body" && this.doc?.dirty) await this.write(this.doc).catch(() => {});
  }

  command(args) {
    return exec(this.bun, [cli(this.repo), ...args], { timeout: COMMAND_MS });
  }

  fail(error, cx) {
    this.problem = String(error?.message ?? error);
    cx.notify();
  }

  async listen() {
    while (!this.closed) {
      const next = nextCommand();
      if (typeof next?.then !== "function") return;
      const command = await next;
      if (command === "focus") this.handle?.focus();
    }
  }

  async start(cx) {
    if (this.role === "body") cx.spawn(async () => this.listen());
    const result = await this.command(["paths"]).catch(() => null);
    try {
      this.paths = JSON.parse(result?.stdout ?? "");
    } catch {
      this.paths = null;
    }
    if (!this.paths) {
      this.problem = (result?.stderr ?? "").trim() || "the workflow command did not answer";
      cx.notify();
      return;
    }
    await this.load();
    if (this.role === "body") this.openDoc();
    cx.notify();
    if (this.role === "body") {
      const agents = await knownAgents().catch(() => []);
      this.agents = [...agents].sort((a, b) => Number(Boolean(b.installed)) - Number(Boolean(a.installed)));
      cx.notify();
    }
    if (this.role === "switcher") return;
    for (const folder of [this.paths.workflows, this.paths.runs]) cx.spawn(async (cx) => this.follow(folder, cx));
  }

  async follow(folder, cx) {
    while (!this.closed) {
      const watch = watchFolder(folder);
      this.watches.push(watch);
      try {
        await watch;
      } catch {
        await cx.sleep(POLL_MS);
      }
      this.watches = this.watches.filter((one) => one !== watch);
      if (this.closed) return;
      await this.load();
      if (this.role === "body") this.openDoc();
      cx.notify();
    }
  }

  selectedName() {
    const want = viewState().workflow;
    return this.workflows.some((item) => item.name === want) ? want : (this.workflows[0]?.name ?? null);
  }

  item() {
    const name = this.selectedName();
    return this.workflows.find((one) => one.name === name) ?? null;
  }

  async load() {
    this.loading = true;
    const files = await names(this.paths.workflows, (file) => file.endsWith(".json"));
    this.workflows = await Promise.all(
      files.map(async (file) => itemOf(file.slice(0, -5), (await readTextFile(`${this.paths.workflows}/${file}`).catch(() => null)) ?? "")),
    );
    const selected = this.selectedName();
    const groups = groupRuns(await names(this.paths.runs, () => true));
    const runs = {};
    for (const [name, list] of Object.entries(groups)) {
      const shown = name === selected && this.role !== "switcher" ? list.slice(0, RUNS_SHOWN) : list.slice(0, 1);
      runs[name] = (await Promise.all(shown.map((entry) => readJson(`${this.paths.runs}/${entry.id}/run.json`)))).filter(Boolean);
    }
    this.runs = runs;
    this.loadedFor = selected;
    this.loading = false;
    if (this.role !== "body" || !selected) return;
    const newest = runs[selected]?.[0]?.id ?? null;
    const seen = this.newest[selected];
    this.newest[selected] = newest;
    if (seen !== undefined && newest !== seen && newest && viewState().run !== "newest" && viewState().run !== undefined) setView({ run: "newest" });
  }

  follows(cx) {
    if (!this.paths || this.loading || this.selectedName() === this.loadedFor) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      await this.load();
      if (this.role === "body") this.openDoc();
      cx.notify();
    });
  }

  chosenRun(name) {
    const list = this.runs[name] ?? [];
    const want = viewState().run;
    if (want === null) return null;
    if (want && want !== "newest") return list.find((one) => one.id === want) ?? list[0] ?? null;
    return list[0] ?? null;
  }

  act(key, args, cx, { save = false } = {}) {
    if (this.busy) return;
    this.busy = key;
    cx.notify();
    cx.spawn(async (cx) => {
      if (save && this.doc?.dirty) await this.save(cx);
      const result = await this.command(args).catch((error) => ({ code: 1, stderr: String(error?.message ?? error) }));
      if (result.code !== 0) notify({ title: "Workflow", body: (result.stderr ?? "").replace(/^workflow: /, "").trim() || `${args[0]} failed`, level: "error" });
      this.busy = null;
      await this.load();
      if (this.role === "body") this.openDoc();
      cx.notify();
    });
  }

  talk(name, task) {
    knownAgents()
      .catch(() => [])
      .then((agents) => {
        const agent = chooseAgent(agents);
        if (!agent) {
          notify({ title: "Workflows", body: "No agent is installed to write it with.", level: "warning" });
          return;
        }
        run("tab.new", { space: focused()?.space, name, folder: this.paths.workflows, argv: agent.run, task });
      });
  }

  author() {
    if (this.paths) this.talk("New workflow", authorPrompt({ bun: this.bun, repo: this.repo, workflows: this.paths.workflows }));
  }

  editWithAgent(name) {
    if (this.paths && name) this.talk(`Edit ${name}`, editPrompt({ bun: this.bun, repo: this.repo, workflows: this.paths.workflows, name }));
  }

  createBlank(cx) {
    if (!this.paths) return;
    const name = fileName("New workflow", this.workflows.map((item) => item.name));
    cx.spawn(async (cx) => {
      try {
        await writeTextFile(`${this.paths.workflows}/${name}.json`, serialize(blank("New workflow")), null);
        setView({ workflow: name, run: "newest" });
        if (this.overlay) closeOverlay(this.overlay);
      } catch (error) {
        notify({ title: "Workflows", body: `Could not write ${name}.json: ${error?.message ?? error}`, level: "error" });
      }
      cx.notify();
    });
  }

  openRunPopup(item, { from = null, only = null, inputs: given = null } = {}) {
    if (!item?.workflow) return;
    const inputs = inputsOf(item.workflow).map((one) => ({ ...one, value: given?.[one.name] ?? one.value }));
    const local = (spaces() ?? []).filter((space) => !space.machine);
    openOverlay({
      mod: "workflows",
      kind: "dialog",
      width: RUN_POPUP.width,
      height: runPopupHeight(inputs.length, local.length),
      props: { role: "run", workflow: item.name, title: item.workflow.title ?? item.name, inputs, from, only, repo: this.repo, bun: this.bun },
    });
  }

  openSwitcher() {
    openOverlay({ mod: "workflows", kind: "popup", width: SWITCHER.width, height: switcherHeight(this.workflows.length), props: { role: "switcher", repo: this.repo, bun: this.bun } });
  }

  initRun(own) {
    this.workflow = own.workflow ?? null;
    this.title = own.title ?? this.workflow;
    this.from = own.from ?? null;
    this.only = own.only ?? null;
    this.inputs = Array.isArray(own.inputs) ? own.inputs : [];
    this.values = Object.fromEntries(this.inputs.map((one) => [one.name, one.value ?? ""]));
    this.states = {};
    for (const one of this.inputs) {
      const state = InputState.new({ value: one.value ?? "", placeholder: one.label });
      state.on("change", (_e, cx) => {
        this.values[one.name] = state.value();
        cx.notify();
      });
      this.states[one.name] = state;
    }
    const shown = focused()?.space;
    const local = (spaces() ?? []).filter((space) => !space.machine);
    this.space = local.some((space) => space.id === shown) ? shown : (local[0]?.id ?? null);
    this.starting = false;
    this.failure = null;
  }

  startRun(cx) {
    if (this.starting || !this.space || missingInputs(this.inputs, this.values).length) return;
    this.starting = true;
    this.failure = null;
    cx.notify();
    cx.spawn(async (cx) => {
      const result = await this.command(runArgs(this.workflow, this.inputs, this.values, this.space, { from: this.from, only: this.only })).catch((error) => ({ code: 1, stderr: String(error?.message ?? error) }));
      this.starting = false;
      if (result.code === 0) {
        setView({ workflow: this.workflow, run: "newest" });
        closeOverlay(this.overlay);
        return;
      }
      this.failure = (result.stderr ?? "").replace(/^workflow: /, "").trim() || "the run did not start";
      cx.notify();
    });
  }

  render(cx) {
    const t = theme();
    if (this.role === "run") return this.runPopup(t);
    this.follows(cx);
    if (this.role === "switcher") return this.switcher(t);
    if (this.role === "bar") return this.band(t);
    return this.body(t);
  }

  band(t) {
    const item = this.item();
    const name = item?.name ?? null;
    const chosen = name ? this.chosenRun(name) : null;
    const live = liveRuns(terminals());
    const status = runStatus(chosen, live, Date.now());
    const pillState = pillOf(chosen, status);
    const actions = runActions(status);
    const action = actions[0];
    const actionLook = {
      stop: { label: "Stop", icon: "circle-x" },
      resume: { label: "Resume", icon: "play" },
      retry: { label: "Retry", icon: "rotate-cw" },
    }[action];
    const drawer = Boolean(viewState().drawer);
    return h_flex()
      .id("workflows-bar")
      .size_full()
      .min_w(0)
      .pl(12)
      .pr(2)
      .gap(10)
      .items_center()
      .child(viewTile("route", t))
      .child(pill("workflows-switch", { icon: "list", label: `All workflows · ${this.workflows.length}`, chevron: true, tooltip: "Workflows", onClick: () => this.openSwitcher() }, t))
      .when(item != null, (el) => el.child(this.titleField(item, t)))
      .when(pillState != null, (el) =>
        el
          .child(
            runPill(
              "workflows-pill",
              {
                status: pillState.status,
                number: chosen.number,
                at: pillState.at,
                onAt: pillState.step ? () => setView({ focus: pillState.step, focusAt: Date.now() }) : null,
                action: actionLook ? { ...actionLook, loading: this.busy === action, onClick: (cx) => this.act(action, [action, chosen.id], cx) } : null,
              },
              t,
            ),
          )
          .when(live.has(chosen.id) && chosen.runner != null, (row) => row.child(iconButton("workflows-runner", { icon: "terminal", tooltip: "The run's tab", stop: true, onClick: () => run("pane.focus", { terminal: chosen.runner }) }, t)))
          .child(iconButton("workflows-hide-run", { icon: "x", tooltip: "Hide this run", stop: true, onClick: () => setView({ run: null }) }, t)),
      )
      .child(div().flex_1())
      .when(item != null, (el) =>
        el
          .child(button("workflows-agent-edit", { label: item.workflow ? "Edit with an agent" : "Fix with an agent", icon: "bot", variant: "ghost", size: "sm", stop: true, onClick: () => this.editWithAgent(item.name) }, t))
          .child(button("workflows-runs", { label: "Runs", icon: "activity", variant: drawer ? "tinted" : "ghost", size: "sm", stop: true, onClick: () => setView({ drawer: !drawer }) }, t))
          .child(button("workflows-run", { label: "Run workflow", icon: "play", variant: "primary", size: "sm", disabled: !item.workflow || item.problems.length > 0, stop: true, onClick: () => this.openRunPopup(item) }, t)),
      )
      .when(item == null && this.paths != null, (el) => el.child(pill("workflows-new", { icon: "plus", label: "New workflow", tooltip: "Write one with an agent", onClick: () => this.author() }, t)));
  }

  titleField(item, t) {
    const title = item.workflow?.title ?? item.name;
    if (this.titleState && this.titleFor === item.name) return div().w(260).flex_none().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(input(this.titleState, t, { height: 28 }));
    return div()
      .id("workflows-title")
      .min_w(0)
      .max_w(320)
      .truncate()
      .text_size(17)
      .font_semibold()
      .text_color(t.foreground)
      .when(item.workflow != null, (el) => el.hover((s) => s.text_color(t.accent)).on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => this.startTitle(item, cx)))
      .child(title);
  }

  startTitle(item, cx) {
    this.titleFor = item.name;
    this.titleState?.release();
    this.titleState = InputState.new({ value: item.workflow?.title ?? item.name, placeholder: "Workflow name" });
    const done = (cx) => this.finishTitle(cx);
    this.titleState.on("submit", (_e, cx) => done(cx));
    this.titleState.on("blur", (_e, cx) => done(cx));
    this.titleState.focus();
    cx.notify();
  }

  finishTitle(cx) {
    const state = this.titleState;
    const name = this.titleFor;
    if (!state) return;
    const title = state.value().trim();
    this.titleState = null;
    this.titleFor = null;
    state.release();
    cx.notify();
    if (!title || !this.paths) return;
    cx.spawn(async (cx) => {
      const path = `${this.paths.workflows}/${name}.json`;
      try {
        const text = await readTextFile(path);
        const value = JSON.parse(text);
        if (value.title === title) return;
        await writeTextFile(path, serialize({ ...value, title }), text);
      } catch (error) {
        notify({ title: "Workflows", body: `Could not rename it: ${error?.message ?? error}`, level: "error" });
      }
      cx.notify();
    });
  }

  switcher(t) {
    const selected = this.selectedName();
    const live = liveRuns(terminals());
    const now = Date.now();
    const rows = this.workflows.map((item) => {
      const status = runStatus(this.runs[item.name]?.[0] ?? null, live, now);
      const steps = item.workflow?.nodes.length ?? 0;
      return menuItem(
        `workflows-pick-${item.name}`,
        {
          icon: item.workflow && !item.problems.length ? "route" : "exclamation",
          dot: status ? toneColor(RUN_LOOK[status].tone, t) : undefined,
          label: item.workflow?.title ?? item.name,
          description: item.workflow ? [`${steps} ${steps === 1 ? "step" : "steps"}`, status ? RUN_LOOK[status].label : null].filter(Boolean).join(" · ") : item.problems[0],
          selected: item.name === selected,
          danger: !item.workflow,
          onClick: () => {
            setView({ workflow: item.name, run: "newest" });
            closeOverlay(this.overlay);
          },
        },
        t,
      );
    });
    return v_flex()
      .id("workflows-switcher")
      .size_full()
      .p(6)
      .gap(2)
      .child(v_flex().id("workflows-switcher-rows").max_h(SWITCHER.max * SWITCHER.row).overflow_y_scrollbar().gap(1).children(rows))
      .child(div().h(1).mx(4).my(4).bg(t.foreground + "14"))
      .child(menuItem("workflows-switcher-blank", { icon: "plus", label: "New workflow", description: "a blank canvas with a start", onClick: (cx) => this.createBlank(cx) }, t))
      .child(
        menuItem(
          "workflows-switcher-agent",
          {
            icon: "bot",
            label: "Write one with an agent",
            onClick: () => {
              this.author();
              closeOverlay(this.overlay);
            },
          },
          t,
        ),
      );
  }

  body(t) {
    const empty = (id, state) => viewCard(id, t).size_full().child(emptyState(state, t));
    if (this.problem) return empty("workflows-problem", { icon: "exclamation", title: "Workflows can't start", detail: this.problem });
    if (!this.paths) return viewCard("workflows-loading", t).size_full();
    if (!this.workflows.length) {
      const action = h_flex()
        .gap(8)
        .child(button("workflows-empty-blank", { label: "New workflow", icon: "plus", variant: "primary", onClick: (cx) => this.createBlank(cx) }, t))
        .child(button("workflows-empty-agent", { label: "Write one with an agent", icon: "bot", onClick: () => this.author() }, t));
      return empty("workflows-empty", { icon: "route", title: "No workflows yet", detail: `Start a blank one, have an agent write it, or put a file in ${this.paths.workflows}.`, action });
    }
    const item = this.item();
    if (!item?.workflow || !this.doc) {
      const action = button("workflows-fix", { label: "Fix with an agent", icon: "bot", onClick: () => this.editWithAgent(item?.name) }, t);
      return empty("workflows-broken", { icon: "exclamation", title: `${item?.name ?? "This"}.json can't be drawn`, detail: item?.problems[0] ?? "", action });
    }
    return this.board(item, t);
  }

  scene(item) {
    const workflow = this.doc.workflow;
    const name = item.name;
    const list = this.runs[name] ?? [];
    const chosen = this.chosenRun(name);
    const live = liveRuns(terminals());
    const now = Date.now();
    const status = runStatus(chosen, live, now);
    const views = viewsOf(workflow, chosen, status);
    const heights = heightsOf(workflow, views);
    const places = placesOf(workflow, heights);
    const box = bounds(workflow.nodes, places, heights);
    if (this.memo?.workflow !== workflow) this.memo = { workflow, ...checked(workflow) };
    if (!this.camera && this.viewport.width) this.camera = this.cameras[name] ?? fit(box, this.viewport);
    const camera = this.camera ?? { x: 64, y: 64, z: 1 };
    return { name, workflow, run: chosen, status, views, heights, places, box, camera, viewport: this.viewport, now, runs: list, live, problems: this.memo.problems, warnings: this.memo.warnings, valid: !this.memo.problems.length && !item.problems.length };
  }

  board(item, t) {
    const scene = this.scene(item);
    this.lastScene = scene;
    const focus = viewState();
    if (focus.focusAt != null && focus.focusAt !== this.seenFocus) {
      this.seenFocus = focus.focusAt;
      if (scene.places[focus.focus]) this.centerOn(focus.focus, scene);
    }
    const edges = edgesLayer(this, { ...scene, camera: this.camera ?? scene.camera }, t);
    this.routes = edges.routes;
    return viewCard("workflows-canvas", t)
      .relative()
      .size_full()
      .overflow_hidden()
      .when(this.handle != null, (el) => el.track_focus(this.handle))
      .when(this.tool === "hand" || this.pan != null, (el) => (this.pan ? el.cursor_grabbing() : el.cursor_grab()))
      .on_size_change((size, cx) => this.resized(size, cx))
      .on_mouse_down("left", (event, cx) => this.pressCanvas(event, cx))
      .on_window_mouse_move((event, cx) => this.moved(event, cx))
      .on_window_mouse_up("left", (event, cx) => this.released(event, cx))
      .on_scroll_wheel((event, cx) => this.wheel(event, cx))
      .on_pinch((event, cx) => this.pinch(event, cx))
      .on_key_down((event, cx) => this.key(event, cx))
      .children(
        [
          gridLayer(scene.viewport, scene.camera, t),
          ...edges.paths,
          ...edges.badges,
          ...nodeLayer(this, scene, t),
          ...portLayer(this, scene, t),
          toolbarLayer(this, scene, t),
          noticesLayer(this, scene, t),
          ...barsLayer(this, scene, t),
          drawerLayer(this, scene, t),
          menuLayer(this, scene, t),
        ].filter(Boolean),
      );
  }

  selection() {
    return viewState();
  }

  statusOf(one, scene) {
    return runStatus(one, scene.live, scene.now);
  }

  spaceName(id) {
    return (spaces() ?? []).find((entry) => entry.id === id)?.name ?? "";
  }

  chooseRun(id) {
    setView({ run: id });
  }

  toggleDrawer() {
    setView({ drawer: !viewState().drawer });
  }

  openDoc() {
    const item = this.item();
    const name = item?.name ?? null;
    if (this.doc && this.doc.name === name) return this.reconcile(item);
    if (this.doc?.dirty) this.write(this.doc).catch(() => {});
    this.releaseFields();
    this.sel = { node: null, edge: null };
    this.menu = null;
    this.renaming = null;
    this.pull = null;
    this.drag = null;
    this.saveError = null;
    this.memo = null;
    if (this.doc) this.cameras[this.doc.name] = this.camera;
    this.camera = name ? (this.cameras[name] ?? null) : null;
    this.doc = item?.workflow ? { name, base: item.text, workflow: this.placed(item.workflow), history: history(), dirty: false, saving: false, conflict: null } : null;
    this.syncFields();
  }

  placed(workflow) {
    const copy = JSON.parse(JSON.stringify(workflow));
    if (copy.nodes.every((node) => Array.isArray(node.at))) return copy;
    const places = tidy(copy, heightsOf(copy, {}));
    const missing = Object.fromEntries(copy.nodes.filter((node) => !Array.isArray(node.at)).map((node) => [node.id, places[node.id]]));
    return placeAll(copy, missing);
  }

  reconcile(item) {
    const doc = this.doc;
    if (!item?.workflow) {
      if (item && item.text !== doc.base && !doc.saving) this.saveError = `The file can't be read now: ${item.problems[0]}`;
      return;
    }
    if (doc.saving || item.text === doc.base) return;
    if (serialize(doc.workflow) === item.text) {
      doc.base = item.text;
      doc.dirty = false;
      return;
    }
    if (doc.dirty) {
      doc.conflict = item.text;
      return;
    }
    doc.history = record(doc.history, doc.workflow);
    doc.workflow = this.placed(item.workflow);
    doc.base = item.text;
    this.saveError = null;
    this.syncFields();
  }

  keepMine(cx) {
    const doc = this.doc;
    if (!doc?.conflict) return;
    doc.base = doc.conflict;
    doc.conflict = null;
    this.save(cx);
    cx.notify();
  }

  takeFile(cx) {
    const doc = this.doc;
    if (!doc?.conflict) return;
    const item = itemOf(doc.name, doc.conflict);
    doc.conflict = null;
    if (!item.workflow) return;
    doc.history = record(doc.history, doc.workflow);
    doc.workflow = this.placed(item.workflow);
    doc.base = item.text;
    doc.dirty = false;
    this.syncFields();
    cx.notify();
  }

  field(id, field) {
    return this.fields.get(`${id}:${field}`) ?? null;
  }

  wanted() {
    const keys = new Map();
    for (const node of this.doc?.workflow.nodes ?? []) for (const field of FIELDS[nodeKind(node)] ?? []) keys.set(`${node.id}:${field}`, { node, field });
    return keys;
  }

  syncFields() {
    if (checking()) return;
    const wanted = this.wanted();
    for (const [key, state] of this.fields) {
      if (wanted.has(key)) continue;
      state.release();
      this.fields.delete(key);
      if (this.typing === key) this.typing = null;
    }
    for (const [key, { node, field }] of wanted) {
      const existing = this.fields.get(key);
      if (existing) {
        if (!same(field, existing.value(), node)) existing.set_value(fieldValue(node, field));
        continue;
      }
      const options = { value: fieldValue(node, field), placeholder: field === "show" ? "What to show (optional)" : field === "model" ? "default" : "" };
      const state = AREAS.includes(field) ? TextareaState.new({ ...options, rows: 3 }) : InputState.new(options);
      const id = node.id;
      state.on("change", (_e, cx) => this.typed(id, field, state.value(), cx));
      state.on("focus", (_e, cx) => {
        this.typing = key;
        if (this.sel.node !== id) this.sel = { node: id, edge: null };
        cx.notify();
      });
      state.on("blur", (_e, cx) => {
        if (this.typing === key) this.typing = null;
        cx.notify();
      });
      this.fields.set(key, state);
    }
  }

  releaseFields() {
    for (const state of this.fields.values()) state.release();
    this.fields.clear();
    this.typing = null;
  }

  typed(id, field, value, cx) {
    const node = this.doc?.workflow.nodes.find((one) => one.id === id);
    if (!node || same(field, value, node)) return;
    this.commit(setField(this.doc.workflow, id, field, value), cx, { key: `${id}:${field}`, structural: false });
  }

  commit(next, cx, { key = null, structural = true } = {}) {
    const doc = this.doc;
    if (!doc || next === doc.workflow) return;
    doc.history = record(doc.history, doc.workflow, key);
    doc.workflow = next;
    doc.dirty = true;
    if (structural) this.syncFields();
    this.schedule(cx);
    cx.notify();
  }

  schedule(cx) {
    this.saveTask?.cancel();
    this.saveTask = cx.timer.after(SAVE_MS, (cx) => this.save(cx));
  }

  async write(doc) {
    const text = serialize(doc.workflow);
    if (text === doc.base) {
      doc.dirty = false;
      return;
    }
    doc.saving = true;
    try {
      await writeTextFile(`${this.paths.workflows}/${doc.name}.json`, text, doc.base);
      doc.base = text;
      doc.dirty = serialize(doc.workflow) !== text;
    } finally {
      doc.saving = false;
    }
  }

  async save(cx) {
    const doc = this.doc;
    if (!doc?.dirty || doc.saving || doc.conflict) return;
    this.saveTask = null;
    try {
      await this.write(doc);
      this.saveError = null;
      if (doc.dirty) this.schedule(cx);
    } catch (error) {
      const now = await readTextFile(`${this.paths.workflows}/${doc.name}.json`).catch(() => null);
      if (now != null && now !== doc.base) doc.conflict = now;
      else this.saveError = `Could not save ${doc.name}.json: ${error?.message ?? error}`;
    }
    cx.notify();
  }

  undo(cx) {
    const doc = this.doc;
    const back = doc && undo(doc.history, doc.workflow);
    if (!back) return;
    doc.history = back.state;
    doc.workflow = back.workflow;
    this.afterHistory(cx);
  }

  redo(cx) {
    const doc = this.doc;
    const next = doc && redo(doc.history, doc.workflow);
    if (!next) return;
    doc.history = next.state;
    doc.workflow = next.workflow;
    this.afterHistory(cx);
  }

  afterHistory(cx) {
    const ids = new Set(this.doc.workflow.nodes.map((node) => node.id));
    if (this.sel.node && !ids.has(this.sel.node)) this.sel = { node: null, edge: null };
    if (this.sel.edge != null && !this.doc.workflow.edges[this.sel.edge]) this.sel = { ...this.sel, edge: null };
    this.doc.dirty = true;
    this.syncFields();
    this.schedule(cx);
    cx.notify();
  }

  resized(size, cx) {
    const z = zoomOf();
    this.viewport = { width: size.width / z, height: size.height / z };
    if (!this.camera && this.lastScene) this.camera = this.cameras[this.lastScene.name] ?? fit(this.lastScene.box, this.viewport);
    cx.notify();
  }

  local(event) {
    if (event.bounds && !this.origin) this.origin = { x: event.bounds.x, y: event.bounds.y };
    const z = zoomOf();
    const origin = this.origin ?? { x: 0, y: 0 };
    return { x: (event.position.x - origin.x) / z, y: (event.position.y - origin.y) / z };
  }

  remember() {
    if (this.doc) this.cameras[this.doc.name] = this.camera;
  }

  setCamera(camera, cx) {
    this.camera = camera;
    this.remember();
    cx.notify();
  }

  pressCanvas(event, cx) {
    if (event.bounds) this.origin = { x: event.bounds.x, y: event.bounds.y };
    this.handle?.focus();
    const point = this.local(event);
    if (this.menu) {
      this.closeMenu(cx);
      return;
    }
    if (this.renaming) this.finishRename(cx);
    const camera = this.camera ?? this.lastScene?.camera;
    if (!camera) return;
    if (event.click_count >= 2 && this.tool === "select") {
      this.openMenu({ kind: "add", at: point }, cx);
      return;
    }
    const hit = this.tool === "select" && this.routes ? hitEdge(this.routes, toWorld(point, camera), camera.z) : null;
    if (hit != null) {
      this.selectEdge(hit, cx);
      return;
    }
    this.sel = { node: null, edge: null };
    this.pan = { from: point, camera };
    cx.notify();
  }

  selectEdge(index, cx) {
    this.handle?.focus();
    this.sel = { node: null, edge: index };
    this.menu = null;
    cx.notify();
  }

  pressNode(id, event, cx) {
    this.handle?.focus();
    const point = this.local(event);
    if (this.menu) this.menu = null;
    if (this.tool === "hand") {
      this.pan = { from: point, camera: this.camera ?? this.lastScene.camera };
      return;
    }
    if (event.click_count >= 2 && nodeKind(this.doc.workflow.nodes.find((one) => one.id === id)) !== "start") {
      this.startRename(id, cx);
      return;
    }
    this.sel = { node: id, edge: null };
    this.drag = { id, from: this.lastScene.places[id], pointer: point, place: this.lastScene.places[id], moved: false };
    cx.notify();
  }

  pressField(id, cx) {
    if (this.sel.node !== id) {
      this.sel = { node: id, edge: null };
      this.menu = null;
      cx.notify();
    }
  }

  dragging(id) {
    return this.drag?.id === id && this.drag.moved ? this.drag.place : null;
  }

  hoverNode(id, on, cx) {
    const next = on ? id : this.hover === id ? null : this.hover;
    if (next === this.hover) return;
    this.hover = next;
    cx.notify();
  }

  moved(event, cx) {
    if (event.bounds) this.origin = { x: event.bounds.x, y: event.bounds.y };
    if (!this.drag && !this.pan && !this.pull) return;
    const point = this.local(event);
    if (event.pressed_button !== "left") {
      this.finishPointer(point, cx, true);
      return;
    }
    if (this.pan) {
      const from = this.pan.camera;
      this.setCamera({ ...from, x: from.x + point.x - this.pan.from.x, y: from.y + point.y - this.pan.from.y }, cx);
      return;
    }
    const camera = this.camera ?? this.lastScene.camera;
    if (this.drag) {
      const dx = point.x - this.drag.pointer.x;
      const dy = point.y - this.drag.pointer.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < MOVE_PX) return;
      this.drag.moved = true;
      this.drag.place = { x: this.drag.from.x + dx / camera.z, y: this.drag.from.y + dy / camera.z };
      cx.notify();
      return;
    }
    this.pullTo(point, camera, cx);
  }

  pullTo(point, camera, cx) {
    const scene = this.lastScene;
    const world = toWorld(point, camera);
    let target = null;
    for (const node of scene.workflow.nodes) {
      const place = scene.places[node.id];
      const port = inPort(node, place);
      const inside = world.x >= place.x && world.x <= place.x + NODE_W && world.y >= place.y && world.y <= place.y + (scene.heights[node.id] ?? 0);
      if (inside || Math.hypot(world.x - port.x, world.y - port.y) * camera.z <= PORT_REACH) target = node.id;
    }
    this.pull.point = point;
    this.pull.target = target;
    this.pull.refused = target ? connectProblem(this.doc.workflow, this.pull.from, target, this.pull.branch) : null;
    this.refusal = this.pull.refused ? { text: this.pull.refused, at: point } : null;
    cx.notify();
  }

  startPull(id, branch, event, cx) {
    this.handle?.focus();
    const node = this.doc.workflow.nodes.find((one) => one.id === id);
    const place = this.lastScene.places[id];
    const point = this.local(event);
    this.menu = null;
    this.sel = { node: id, edge: null };
    const start = nodeKind(node) === "condition" ? { x: place.x + NODE_W, y: toWorld(point, this.camera ?? this.lastScene.camera).y } : { x: place.x + NODE_W, y: place.y + LABEL + PORT_Y };
    this.pull = { from: id, branch, start, point, target: null, refused: null };
    cx.notify();
  }

  released(event, cx) {
    if (!this.drag && !this.pan && !this.pull) return;
    this.finishPointer(this.local(event), cx, false);
  }

  finishPointer(point, cx, cancel) {
    const drag = this.drag;
    const pull = this.pull;
    this.drag = null;
    this.pan = null;
    this.pull = null;
    this.refusal = null;
    if (!cancel && drag?.moved) this.commit(moveNode(this.doc.workflow, drag.id, drag.place), cx);
    if (!cancel && pull) {
      if (pull.target && !pull.refused) this.link(pull.from, pull.target, pull.branch, cx);
      else if (!pull.target) this.openMenu({ kind: "add", at: point, link: { from: pull.from, branch: pull.branch } }, cx);
    }
    cx.notify();
  }

  link(from, to, branch, cx) {
    const made = connect(this.doc.workflow, from, to, branch);
    if (made.error) return;
    this.commit(made.workflow, cx);
    if (made.loop) this.sel = { node: null, edge: made.workflow.edges.length - 1 };
  }

  wheel(event, cx) {
    const z = zoomOf();
    const point = this.local(event);
    const camera = this.camera ?? this.lastScene?.camera;
    if (!camera) return;
    if (event.modifiers?.platform || event.modifiers?.control) {
      this.setCamera(zoomAt(camera, camera.z * Math.exp((event.delta.y / z) * WHEEL_ZOOM), point), cx);
      return;
    }
    this.setCamera({ ...camera, x: camera.x + event.delta.x / z, y: camera.y + event.delta.y / z }, cx);
  }

  pinch(event, cx) {
    const camera = this.camera ?? this.lastScene?.camera;
    if (!camera) return;
    this.setCamera(zoomAt(camera, camera.z * (1 + event.delta), this.local(event)), cx);
  }

  zoomBy(factor, cx) {
    const camera = this.camera ?? this.lastScene?.camera;
    if (!camera) return;
    this.setCamera(zoomAt(camera, clampZoom(camera.z * factor), { x: this.viewport.width / 2, y: this.viewport.height / 2 }), cx);
  }

  fitView(cx) {
    if (this.lastScene) this.setCamera(fit(this.lastScene.box, this.viewport), cx);
  }

  centerOn(id, scene) {
    const place = scene.places[id];
    const camera = this.camera ?? scene.camera;
    const z = Math.max(camera.z, 0.75);
    this.camera = { z, x: this.viewport.width / 2 - (place.x + NODE_W / 2) * z, y: this.viewport.height / 2 - (place.y + (scene.heights[id] ?? 0) / 2) * z };
    this.sel = { node: id, edge: null };
    this.remember();
  }

  tidyUp(cx) {
    if (!this.lastScene) return;
    this.commit(placeAll(this.doc.workflow, tidy(this.doc.workflow, this.lastScene.heights)), cx);
    cx.spawn(async (cx) => {
      await cx.sleep(0);
      this.fitView(cx);
    });
  }

  toggleMap(cx) {
    this.showMap = !this.showMap;
    store(MAP_KEY, this.showMap ? "1" : "0");
    cx.notify();
  }

  mapClick(event, map, cx) {
    const box = event.bounds;
    if (!box) return;
    const z = zoomOf();
    const point = { x: (event.position.x - box.x) / z, y: (event.position.y - box.y) / z };
    this.setCamera(fromMinimap(point, map, this.viewport, this.camera ?? this.lastScene.camera), cx);
  }

  setTool(tool, cx) {
    this.tool = tool;
    cx.notify();
  }

  nodeAnchor(id, scene) {
    const place = scene.places[id];
    if (!place) return { x: 16, y: 16 };
    const at = toScreen(place, this.camera ?? scene.camera);
    return { x: at.x + (NODE_W * (this.camera ?? scene.camera).z) / 2 - 130, y: at.y - 8 - 40 };
  }

  openMenu(menu, cx) {
    this.menu = menu;
    if (menu.kind === "add") {
      this.addSearch.set_value("");
      this.addSearch.focus();
    }
    if (menu.kind === "find") {
      this.findState.set_value("");
      this.findState.focus();
    }
    if (menu.kind === "answer") {
      const node = this.doc.workflow.nodes.find((one) => one.id === menu.node);
      this.answerState.set_value(answerText(node?.answer));
      this.answerProblem = null;
      this.answerState.focus();
    }
    cx.notify();
  }

  closeMenu(cx) {
    this.menu = null;
    this.answerProblem = null;
    this.handle?.focus();
    cx?.notify();
  }

  add(kind, cx) {
    const scene = this.lastScene;
    const menu = this.menu;
    const camera = this.camera ?? scene.camera;
    let at;
    if (menu?.link) {
      const world = toWorld(menu.at, camera);
      at = { x: world.x, y: world.y - LABEL - PORT_Y };
    } else if (menu?.at && menu.kind === "add" && !menu.fromBar) {
      at = toWorld(menu.at, camera);
    } else {
      at = freeSpot(scene.workflow.nodes, scene.places, scene.heights, toWorld({ x: this.viewport.width / 2, y: this.viewport.height / 2 }, camera));
    }
    const made = addNode(this.doc.workflow, kind, at, menu?.link ?? null);
    this.menu = null;
    this.commit(made.workflow, cx);
    this.sel = { node: made.id, edge: null };
    const first = FIELDS[kind]?.[0];
    if (first) this.field(made.id, first)?.focus();
    cx.notify();
  }

  edit(id, field, value, cx, close = false) {
    this.commit(setField(this.doc.workflow, id, field, value), cx);
    if (close) this.closeMenu(cx);
  }

  pickAgent(id, argv, cx) {
    const node = this.doc.workflow.nodes.find((one) => one.id === id);
    this.edit(id, "agent", setAgent(node?.agent, argv), cx, true);
  }

  saveAnswer(cx) {
    const id = this.menu?.node;
    if (!id) return;
    const parsed = parseAnswer(this.answerState.value());
    if (parsed.problems.length) {
      this.answerProblem = parsed.problems[0];
      cx.notify();
      return;
    }
    this.edit(id, "answer", parsed.answer, cx, true);
  }

  remove(cx, id = null) {
    this.menu = null;
    if (id == null && this.sel.edge != null) {
      this.commit(disconnect(this.doc.workflow, this.sel.edge), cx);
      this.sel = { node: null, edge: null };
      return;
    }
    const target = id ?? this.sel.node;
    if (!target) return;
    const next = removeNode(this.doc.workflow, target);
    if (next === this.doc.workflow) return;
    this.deleteHot = false;
    this.hotEdges = null;
    this.sel = { node: null, edge: null };
    this.commit(next, cx);
  }

  duplicate(cx, id = null) {
    this.menu = null;
    const made = duplicateNode(this.doc.workflow, id ?? this.sel.node);
    if (!made.id) return;
    this.commit(made.workflow, cx);
    this.sel = { node: made.id, edge: null };
  }

  hotDelete(on, cx) {
    this.deleteHot = on;
    const id = this.sel.node;
    this.hotEdges = on && id ? new Set(this.doc.workflow.edges.flatMap((edge, index) => (edge.from === id || edge.to === id ? [index] : []))) : null;
    cx.notify();
  }

  loopMax(index, by, cx) {
    const edge = this.doc.workflow.edges[index];
    if (!edge) return;
    const max = Math.max(1, Math.min(20, (edge.max ?? 1) + by));
    if (max !== edge.max) this.commit(setLoopMax(this.doc.workflow, index, max), cx);
  }

  startRename(id, cx) {
    this.menu = null;
    this.renaming = id;
    this.renameProblem = null;
    this.renameState.set_value(id);
    this.renameState.focus();
    cx.notify();
  }

  finishRename(cx) {
    const from = this.renaming;
    if (!from) return;
    this.renaming = null;
    const to = this.renameState.value().trim();
    if (to && to !== from) {
      const made = renameNode(this.doc.workflow, from, to);
      if (made.error) notify({ title: "Workflows", body: made.error, level: "warning" });
      else {
        this.commit(made.workflow, cx);
        if (this.sel.node === from) this.sel = { node: to, edge: null };
      }
    }
    this.handle?.focus();
    cx.notify();
  }

  find(id, cx) {
    this.menu = null;
    if (this.lastScene) this.centerOn(id, this.lastScene);
    this.handle?.focus();
    cx.notify();
  }

  openRun() {
    this.openRunPopup(this.item());
  }

  runNode(id, mode, cx) {
    this.menu = null;
    const item = this.item();
    const list = this.runs[item?.name] ?? [];
    if (!list.length) {
      this.openRunPopup(item, mode === "only" ? { only: id } : { from: id });
      cx.notify();
      return;
    }
    this.act(`${mode}:${id}`, ["run", item.name, mode === "only" ? "--only" : "--from", id, "--json"], cx, { save: true });
  }

  decide(action, id, cx) {
    const chosen = this.lastScene?.run;
    if (!chosen) return;
    this.act(`${action}:${id}`, [action, chosen.id, "--node", id], cx);
  }

  showAgent(id) {
    const scene = this.lastScene;
    const terminal = scene?.run ? agentTerminal(scene.run, scene.workflow, id) : null;
    if (terminal && (terminals() ?? []).some((one) => one.address === terminal)) run("pane.focus", { terminal });
  }

  liveAgent(id, scene) {
    const terminal = scene.run ? agentTerminal(scene.run, scene.workflow, id) : null;
    return Boolean(terminal && (terminals() ?? []).some((one) => one.address === terminal));
  }

  key(event, cx) {
    const key = event.key;
    const mods = event.modifiers ?? {};
    if (key === "escape") {
      if (this.menu) this.closeMenu(cx);
      else if (this.pull || this.drag) this.finishPointer(this.pull?.point ?? { x: 0, y: 0 }, cx, true);
      else if (this.typing) {
        this.fields.get(this.typing)?.blur();
        this.handle?.focus();
      } else {
        this.sel = { node: null, edge: null };
        cx.notify();
      }
      return;
    }
    if (this.typing || this.renaming || this.menu) return;
    if (typeof this.handle?.is_focused === "function" && !this.handle.is_focused()) return;
    const cmd = mods.platform;
    if (cmd && key === "z") return mods.shift ? this.redo(cx) : this.undo(cx);
    if (cmd && key === "y") return this.redo(cx);
    if (cmd && key === "d") return this.duplicate(cx);
    if (cmd && (key === "=" || key === "+")) return this.zoomBy(ZOOM.step, cx);
    if (cmd && key === "-") return this.zoomBy(1 / ZOOM.step, cx);
    if (cmd && key === "f") return this.openMenu({ kind: "find", at: { x: this.viewport.width / 2 - 130, y: this.viewport.height - 330 } }, cx);
    if (cmd) return;
    if (key === "backspace" || key === "delete") return this.remove(cx);
    if (mods.shift && (key === "1" || key === "!")) return this.fitView(cx);
    if (mods.shift && key === "t") return this.tidyUp(cx);
    if (key === "v") return this.setTool("select", cx);
    if (key === "h") return this.setTool("hand", cx);
    if (key === "enter" && this.sel.node) {
      const node = this.doc.workflow.nodes.find((one) => one.id === this.sel.node);
      const first = FIELDS[nodeKind(node)]?.[0];
      if (first) this.field(node.id, first)?.focus();
    }
  }

  runPopup(t) {
    const local = (spaces() ?? []).filter((space) => !space.machine);
    const missing = missingInputs(this.inputs, this.values);
    const rows = Math.min(Math.max(local.length, 1), RUN_POPUP.spacesMax);
    const title = this.only ? `Run ${this.only} alone` : this.from ? `Run ${this.title} from ${this.from}` : `Run ${this.title}`;
    return v_flex()
      .id("workflows-run-popup")
      .size_full()
      .p(RUN_POPUP.padding)
      .gap(12)
      .child(
        v_flex()
          .gap(2)
          .child(div().text_size(TEXT.title).font_semibold().text_color(t.foreground).child(title))
          .child(div().text_size(TEXT.base).text_color(t.unknown).child("Opens a new tab in the space you pick, without leaving this one.")),
      )
      .children(
        this.inputs.map((one) =>
          v_flex()
            .id(`workflows-input-${one.name}`)
            .gap(4)
            .child(div().text_size(TEXT.sm).font_semibold().text_color(t.muted).child(one.required ? `${one.label} (required)` : one.label))
            .child(input(this.states[one.name], t, { focused: false })),
        ),
      )
      .child(
        v_flex()
          .gap(4)
          .child(heading("Space", t))
          .child(
            v_flex()
              .id("workflows-spaces")
              .h(rows * RUN_POPUP.space)
              .overflow_y_scrollbar()
              .children(local.map((space) => menuItem(`workflows-space-${space.id}`, { icon: "folder", label: space.name, check: space.id === this.space, onClick: (cx) => this.pickSpace(space.id, cx) }, t))),
          ),
      )
      .when(this.failure != null, (el) => el.child(div().text_size(TEXT.base).text_color(t.blocked).child(this.failure)))
      .child(div().flex_1())
      .child(
        h_flex()
          .justify_end()
          .gap(8)
          .child(button("workflows-cancel", { label: "Cancel", variant: "ghost", onClick: () => closeOverlay(this.overlay) }, t))
          .child(button("workflows-start", { label: "Run", icon: "play", variant: "primary", disabled: missing.length > 0 || !this.space, loading: this.starting, onClick: (cx) => this.startRun(cx) }, t)),
      );
  }

  pickSpace(id, cx) {
    this.space = id;
    cx.notify();
  }
}
