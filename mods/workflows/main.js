import { View, div } from "gpui-kit";
import { InputState, h_flex, v_flex } from "gpui-base";
import * as fs from "fs/promises";
import { checking, closeOverlay, exec, focused, knownAgents, notify, openOverlay, props, readTextFile, run, spaces, terminals, theme, watchFolder, window } from "herdr";
import { button, cardHeader, chip, detailLine, emptyState, heading, icon, ICON_SIZE, input, menuItem, pill, stepCard, taskRow, TEXT, timelineStep, toneColor, viewCard, viewTile } from "../../kit/kit.js";
import { parseWorkflow, warnings } from "../../lib/workflow.js";
import {
  authorPrompt,
  chooseAgent,
  cli,
  editPrompt,
  groupRuns,
  inputsOf,
  liveRuns,
  missingInputs,
  RUN_LOOK,
  RUN_POPUP,
  runActions,
  runArgs,
  runLine,
  runPopupHeight,
  RUNS_SHOWN,
  runStatus,
  stepRows,
} from "./logic.js";

const ROLES = ["bar", "body", "run"];
const AGO_MS = 30000;
const POLL_MS = 5000;
const COMMAND_MS = 30000;
const LIST_W = 260;
const RUNS_W = 300;

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
    this.selected = null;
    this.selectedRun = null;
    this.newest = {};
    this.busy = null;
    this.watches = [];
    this.closed = false;
    if (checking() || !this.repo || !this.bun) return;
    cx.spawn(async (cx) => this.start(cx));
    if (this.role === "body") cx.timer.every(AGO_MS, (cx) => window()?.visible !== false && cx.notify());
  }

  async close() {
    this.closed = true;
    for (const watch of this.watches) watch.cancel();
  }

  command(args) {
    return exec(this.bun, [cli(this.repo), ...args], { timeout: COMMAND_MS });
  }

  async start(cx) {
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
    cx.notify();
    const folders = this.role === "body" ? [this.paths.workflows, this.paths.runs] : [this.paths.workflows];
    for (const folder of folders) cx.spawn(async (cx) => this.follow(folder, cx));
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
      cx.notify();
    }
  }

  async load() {
    const files = await names(this.paths.workflows, (file) => file.endsWith(".json"));
    this.workflows = await Promise.all(
      files.map(async (file) => {
        const name = file.slice(0, -5);
        const parsed = parseWorkflow((await readTextFile(`${this.paths.workflows}/${file}`).catch(() => null)) ?? "");
        return parsed.ok ? { name, workflow: parsed.workflow, problems: [], warnings: warnings(parsed.workflow) } : { name, workflow: null, problems: parsed.problems, warnings: [] };
      }),
    );
    if (this.role !== "body") return;
    if (!this.workflows.some((item) => item.name === this.selected)) this.selected = this.workflows[0]?.name ?? null;
    const groups = groupRuns(await names(this.paths.runs, () => true));
    const runs = {};
    for (const [name, list] of Object.entries(groups)) {
      const shown = name === this.selected ? list.slice(0, RUNS_SHOWN) : list.slice(0, 1);
      runs[name] = (await Promise.all(shown.map((entry) => readJson(`${this.paths.runs}/${entry.id}/run.json`)))).filter(Boolean);
    }
    this.runs = runs;
    const newest = runs[this.selected]?.[0]?.id ?? null;
    if (newest !== this.newest[this.selected] || !runs[this.selected]?.some((one) => one.id === this.selectedRun)) {
      this.newest[this.selected] = newest;
      this.selectedRun = newest;
    }
  }

  select(name, cx) {
    this.selected = name;
    this.selectedRun = null;
    cx.spawn(async (cx) => {
      await this.load();
      cx.notify();
    });
    cx.notify();
  }

  act(key, args, cx) {
    if (this.busy) return;
    this.busy = key;
    cx.notify();
    cx.spawn(async (cx) => {
      const result = await this.command(args).catch((error) => ({ code: 1, stderr: String(error?.message ?? error) }));
      if (result.code !== 0) notify({ title: "Workflow", body: (result.stderr ?? "").replace(/^workflow: /, "").trim() || `${args[0]} failed`, level: "error" });
      this.busy = null;
      await this.load();
      cx.notify();
    });
  }

  talk(name, task, cx) {
    cx.spawn(async () => {
      const agent = chooseAgent(await knownAgents().catch(() => []));
      if (!agent) {
        notify({ title: "Workflows", body: "No agent is installed to write it with.", level: "warning" });
        return;
      }
      run("tab.new", { space: focused()?.space, name, folder: this.paths.workflows, argv: agent.run, task });
    });
  }

  author(cx) {
    if (!this.paths) return;
    this.talk("New workflow", authorPrompt({ bun: this.bun, repo: this.repo, workflows: this.paths.workflows }), cx);
  }

  edit(name, cx) {
    this.talk(`Edit ${name}`, editPrompt({ bun: this.bun, repo: this.repo, workflows: this.paths.workflows, name }), cx);
  }

  openRun(item) {
    const inputs = inputsOf(item.workflow);
    const local = (spaces() ?? []).filter((space) => !space.machine);
    openOverlay({
      mod: "workflows",
      kind: "dialog",
      width: RUN_POPUP.width,
      height: runPopupHeight(inputs.length, local.length),
      props: { role: "run", workflow: item.name, title: item.workflow.title ?? item.name, inputs, repo: this.repo, bun: this.bun },
    });
  }

  initRun(own) {
    this.workflow = own.workflow ?? null;
    this.title = own.title ?? this.workflow;
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
      const result = await this.command(runArgs(this.workflow, this.inputs, this.values, this.space)).catch((error) => ({ code: 1, stderr: String(error?.message ?? error) }));
      this.starting = false;
      if (result.code === 0) {
        closeOverlay(this.overlay);
        return;
      }
      this.failure = (result.stderr ?? "").replace(/^workflow: /, "").trim() || "the run did not start";
      cx.notify();
    });
  }

  render() {
    const t = theme();
    if (this.role === "run") return this.runPopup(t);
    if (this.role === "bar") return this.bar(t);
    return this.body(t);
  }

  bar(t) {
    const valid = this.workflows.filter((item) => item.workflow).length;
    return h_flex()
      .id("workflows-bar")
      .size_full()
      .min_w(0)
      .pl(12)
      .pr(2)
      .gap(10)
      .items_center()
      .child(viewTile("route", t))
      .child(div().flex_none().text_size(17).font_semibold().text_color(t.foreground).child("Workflows"))
      .when(this.paths != null, (el) => el.child(div().flex_none().text_size(TEXT.lg).text_color(t.unknown).child(valid === 1 ? "1 workflow" : `${valid} workflows`)))
      .child(div().flex_1())
      .child(pill("workflows-new", { icon: "plus", label: "New workflow", tooltip: "Write one with an agent", onClick: (cx) => this.author(cx) }, t));
  }

  body(t) {
    const root = h_flex().id("workflows-body").size_full().min_w(0).min_h(0).gap(8);
    if (this.problem) return root.child(viewCard("workflows-problem", t).flex_1().h_full().child(emptyState({ icon: "exclamation", title: "Workflows can't start", detail: this.problem }, t)));
    if (!this.paths) return root;
    if (this.workflows.length === 0) {
      const action = button("workflows-empty-new", { label: "New workflow", icon: "plus", variant: "primary", onClick: (cx) => this.author(cx) }, t);
      return root.child(viewCard("workflows-empty", t).flex_1().h_full().child(emptyState({ icon: "route", title: "No workflows yet", detail: `Write one with an agent, or put a file in ${this.paths.workflows}.`, action }, t)));
    }
    const live = liveRuns(terminals());
    const now = Date.now();
    const item = this.workflows.find((one) => one.name === this.selected) ?? this.workflows[0];
    const list = this.runs[item.name] ?? [];
    const chosen = list.find((one) => one.id === this.selectedRun) ?? null;
    return root.child(this.listCard(live, now, t)).child(this.stepsCard(item, chosen, live, now, t)).child(this.runsCard(list, live, now, t));
  }

  listCard(live, now, t) {
    const rows = this.workflows.map((item) => {
      const last = this.runs[item.name]?.[0] ?? null;
      const status = runStatus(last, live, now);
      const steps = item.workflow?.steps.length ?? 0;
      return menuItem(
        `workflows-item-${item.name}`,
        {
          icon: item.workflow ? "route" : "exclamation",
          dot: status ? toneColor(RUN_LOOK[status].tone, t) : undefined,
          label: item.workflow?.title ?? item.name,
          description: item.workflow ? [`${steps} ${steps === 1 ? "step" : "steps"}`, status ? RUN_LOOK[status].label : null].filter(Boolean).join(" · ") : item.problems[0],
          selected: item.name === this.selected,
          danger: !item.workflow,
          onClick: (cx) => this.select(item.name, cx),
        },
        t,
      );
    });
    return viewCard("workflows-list", t)
      .w(LIST_W)
      .flex_none()
      .h_full()
      .child(cardHeader("workflows-list-head", { icon: "route", label: "Workflows", count: this.workflows.length }, t))
      .child(v_flex().id("workflows-list-rows").flex_1().min_h(0).px(6).pb(6).gap(1).overflow_y_scrollbar().children(rows));
  }

  stepsCard(item, chosen, live, now, t) {
    const status = runStatus(chosen, live, now);
    const head = cardHeader("workflows-steps-head", { icon: "list", label: item.workflow?.title ?? item.name }, t)
      .when(item.workflow != null, (el) =>
        el.child(button("workflows-edit", { label: "Edit", icon: "bot", variant: "ghost", size: "sm", tooltip: "Change it with an agent", onClick: (cx) => this.edit(item.name, cx) }, t)).child(
          button("workflows-run", { label: "Run", icon: "play", variant: "primary", size: "sm", onClick: () => this.openRun(item) }, t),
        ),
      )
      .when(item.workflow == null, (el) => el.child(button("workflows-fix", { label: "Fix with an agent", icon: "bot", variant: "secondary", size: "sm", onClick: (cx) => this.edit(item.name, cx) }, t)));
    const scroll = v_flex().id("workflows-steps-scroll").flex_1().min_h(0).px(16).pt(4).pb(12).gap(10).overflow_y_scrollbar();
    if (!item.workflow) {
      return viewCard("workflows-steps", t)
        .flex_1()
        .h_full()
        .child(head)
        .child(scroll.children(item.problems.map((problem, index) => div().id(`workflows-problem-${index}`).text_size(TEXT.base).text_color(t.blocked).child(problem))));
    }
    const rows = stepRows(item.workflow, chosen, status);
    return viewCard("workflows-steps", t)
      .flex_1()
      .h_full()
      .child(head)
      .when(chosen != null, (el) => el.child(this.runBar(chosen, status, live, now, t)))
      .child(
        scroll
          .when(Boolean(item.workflow.about), (el) => el.child(div().text_size(TEXT.base).text_color(t.muted).child(item.workflow.about)))
          .children(item.warnings.map((warning, index) => h_flex().id(`workflows-warning-${index}`).gap(6).items_center().child(icon("exclamation", { size: ICON_SIZE.md, color: t.working })).child(div().min_w(0).text_size(TEXT.base).text_color(t.working).child(warning))))
          .child(
            v_flex()
              .pt(4)
              .children(
                rows.map((row, index) =>
                  timelineStep(`workflows-step-${row.id}`, { name: row.id, node: row.node, current: row.current, note: row.note, last: index === rows.length - 1, body: this.stepBody(row, chosen, live, t) }, t),
                ),
              ),
          ),
      );
  }

  runBar(chosen, status, live, now, t) {
    const look = RUN_LOOK[status];
    const busy = this.busy;
    const actions = {
      stop: () => button("workflows-stop", { label: "Stop", icon: "circle-x", variant: "ghost", size: "sm", loading: busy === "stop", onClick: (cx) => this.act("stop", ["stop", chosen.id], cx) }, t),
      resume: () => button("workflows-resume", { label: "Resume", icon: "play", variant: "secondary", size: "sm", loading: busy === "resume", onClick: (cx) => this.act("resume", ["resume", chosen.id], cx) }, t),
      retry: () => button("workflows-retry", { label: "Retry", icon: "rotate-cw", variant: "secondary", size: "sm", loading: busy === "retry", onClick: (cx) => this.act("retry", ["retry", chosen.id], cx) }, t),
    };
    return v_flex()
      .flex_none()
      .px(16)
      .pb(8)
      .gap(6)
      .child(
        h_flex()
          .id("workflows-run-bar")
          .gap(8)
          .items_center()
          .child(chip(look.label, { tone: look.tone === "unknown" ? "neutral" : look.tone, dot: true }, t))
          .child(div().flex_none().text_size(TEXT.base).text_color(t.muted).child(`#${chosen.number}`))
          .child(div().flex_1().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(runLine(chosen, status, now)))
          .when(live.has(chosen.id) && chosen.runner != null, (el) =>
            el.child(button("workflows-runner", { label: "Show", icon: "terminal", variant: "ghost", size: "sm", tooltip: "The run's tab", onClick: () => run("pane.focus", { terminal: chosen.runner }) }, t)),
          )
          .children(runActions(status).map((action) => actions[action]())),
      )
      .when(Boolean(chosen.error) && (status === "failed" || (status === "stopped" && chosen.error !== "stopped")), (el) => el.child(div().text_size(TEXT.base).text_color(status === "failed" ? t.blocked : t.unknown).child(chosen.error.split("\n")[0])));
  }

  stepBody(row, chosen, live, t) {
    const card = stepCard(t)
      .child(
        h_flex()
          .gap(6)
          .items_center()
          .child(icon(row.icon, { size: ICON_SIZE.md, color: t.unknown }))
          .child(div().flex_1().min_w(0).truncate().text_size(TEXT.base).text_color(t.muted).child(row.detail))
          .when(row.terminal != null && chosen != null && (terminals() ?? []).some((one) => one.address === row.terminal), (el) =>
            el.child(button(`workflows-agent-${row.id}`, { label: "Show", icon: "terminal", variant: "ghost", size: "sm", tooltip: "Go to this agent", onClick: () => run("pane.focus", { terminal: row.terminal }) }, t)),
          ),
      )
      .when(row.condition != null, (el) => el.child(div().text_size(TEXT.sm).text_color(t.unknown).child(`when ${row.condition}`)))
      .when(row.loop != null, (el) => el.child(div().text_size(TEXT.sm).text_color(t.unknown).child(row.loop)))
      .when(Boolean(row.task) && row.output == null, (el) => el.child(div().text_size(TEXT.base).text_color(t.unknown).child(row.task)));
    if (row.fields) {
      return card.child(heading("Answer", t)).children(Object.entries(row.fields).map(([name, value]) => detailLine(name, { detail: value == null ? "" : String(value), color: t.muted }, t)));
    }
    return card
      .when(row.output != null, (el) => el.child(div().text_size(TEXT.base).text_color(t.foreground).child(row.output)))
      .when(row.error != null, (el) => el.child(div().text_size(TEXT.base).text_color(t.blocked).child(row.error)))
      .when(row.waiting, (el) =>
        el.child(
          h_flex()
            .pt(4)
            .gap(8)
            .child(button(`workflows-approve-${row.id}`, { label: "Approve", icon: "check", variant: "primary", size: "sm", loading: this.busy === "approve", onClick: (cx) => this.act("approve", ["approve", chosen.id], cx) }, t))
            .child(button(`workflows-reject-${row.id}`, { label: "Reject", icon: "x", variant: "danger", size: "sm", loading: this.busy === "reject", onClick: (cx) => this.act("reject", ["reject", chosen.id], cx) }, t)),
        ),
      );
  }

  runsCard(list, live, now, t) {
    const rows = list.map((one) => {
      const status = runStatus(one, live, now);
      const look = RUN_LOOK[status];
      const space = (spaces() ?? []).find((entry) => entry.id === one.space)?.name ?? "";
      return taskRow(`workflows-run-${one.id}`, { ring: toneColor(look.tone, t), title: `#${one.number} · ${look.label}`, code: space, meta: runLine(one, status, now), hovered: one.id === this.selectedRun, onClick: (cx) => this.chooseRun(one.id, cx) }, t);
    });
    return viewCard("workflows-runs", t)
      .w(RUNS_W)
      .flex_none()
      .h_full()
      .child(cardHeader("workflows-runs-head", { icon: "activity", label: "Runs", count: list.length }, t))
      .child(
        v_flex()
          .id("workflows-runs-rows")
          .flex_1()
          .min_h(0)
          .px(6)
          .pb(6)
          .gap(1)
          .overflow_y_scrollbar()
          .when(rows.length === 0, (el) => el.child(emptyState({ icon: "play", title: "No runs yet", detail: "Run starts one in a new tab of a space." }, t)))
          .children(rows),
      );
  }

  chooseRun(id, cx) {
    this.selectedRun = id;
    cx.notify();
  }

  runPopup(t) {
    const local = (spaces() ?? []).filter((space) => !space.machine);
    const missing = missingInputs(this.inputs, this.values);
    const rows = Math.min(Math.max(local.length, 1), RUN_POPUP.spacesMax);
    return v_flex()
      .id("workflows-run-popup")
      .size_full()
      .p(RUN_POPUP.padding)
      .gap(12)
      .child(
        v_flex()
          .gap(2)
          .child(div().text_size(TEXT.title).font_semibold().text_color(t.foreground).child(`Run ${this.title}`))
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
