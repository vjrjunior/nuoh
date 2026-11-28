import { FINAL, fill, scopeOf, stepKind } from "../../lib/workflow.js";

export const RUNS_SHOWN = 20;
export const STARTING_MS = 30000;
export const PREVIEW_LINES = 6;
export const RUN_ID = /^([a-z0-9][a-z0-9_-]*)-(\d+)$/i;

export const RUN_LOOK = {
  starting: { tone: "working", label: "Starting" },
  running: { tone: "working", label: "Running" },
  approval: { tone: "blocked", label: "Needs you" },
  done: { tone: "done", label: "Done" },
  failed: { tone: "blocked", label: "Failed" },
  stopped: { tone: "unknown", label: "Stopped" },
  interrupted: { tone: "unknown", label: "Interrupted" },
};

const STEP_NOTE = {
  running: "Running",
  approval: "Needs you",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
  skipped: "Skipped",
  interrupted: "Cut off",
};

const KIND_ICON = { agent: "bot", continue: "bot", run: "terminal", approve: "flag" };

export function groupRuns(ids) {
  const groups = {};
  for (const id of ids) {
    const match = RUN_ID.exec(id);
    if (!match) continue;
    (groups[match[1]] ??= []).push({ id, number: Number(match[2]) });
  }
  for (const list of Object.values(groups)) list.sort((a, b) => b.number - a.number);
  return groups;
}

export function liveRuns(terminals) {
  const live = new Set();
  for (const terminal of terminals ?? []) {
    const label = terminal?.labels?.["nuoh.workflow"];
    if (label && !label.includes(":") && terminal.state !== "finished") live.add(label);
  }
  return live;
}

export function runStatus(run, live, now) {
  if (!run) return null;
  if (FINAL.includes(run.status)) return run.status;
  if (run.status === "starting" && now - run.created < STARTING_MS) return "starting";
  return live.has(run.id) ? run.status : "interrupted";
}

export function latestRecord(run, id) {
  return run?.steps?.findLast((record) => record.id === id) ?? null;
}

function preview(text, lines = PREVIEW_LINES) {
  const all = String(text ?? "").trim().split("\n");
  return all.length > lines ? `${all.slice(0, lines).join("\n")}\n…` : all.join("\n");
}

export function program(argv) {
  const [first, ...rest] = argv;
  return [first.split("/").pop(), ...rest].join(" ");
}

export function stepDetail(step) {
  const kind = stepKind(step);
  if (kind === "agent") return program(step.agent);
  if (kind === "continue") return `continues ${step.continue}`;
  if (kind === "run") return `$ ${step.run.join(" ")}`;
  return step.approve;
}

export function stepRows(workflow, run, status) {
  const steps = workflow?.steps ?? [];
  const current = run && !FINAL.includes(run.status) ? run.at : null;
  const scope = run ? scopeOf(run) : null;
  const text = (value) => (scope ? fill(value, scope) : value);
  return steps.map((step, index) => {
    const record = latestRecord(run, step.id);
    const tries = run ? run.steps.filter((one) => one.id === step.id && !one.reused).length : 0;
    let node = "todo";
    if (record?.status === "done") node = "done";
    if (record?.status === "failed" || (index === current && status === "interrupted")) node = "bad";
    if (index === current && status !== "interrupted") node = "current";
    const label = record ? (index === current && status === "interrupted" ? "Cut off" : STEP_NOTE[record.status] ?? record.status) : null;
    return {
      id: step.id,
      kind: stepKind(step),
      icon: KIND_ICON[stepKind(step)],
      detail: stepKind(step) === "approve" ? text(step.approve) : stepDetail(step),
      task: step.task ? preview(text(step.task), 3) : step.show ? preview(text(step.show)) : null,
      condition: step.when ?? null,
      loop: step.goto ? `back to ${step.goto}, up to ${step.max}×` : null,
      node,
      current: index === current,
      note: label ? (tries > 1 ? `${label} · ${tries}×` : label) : null,
      output: record?.output ? preview(record.output) : null,
      fields: record?.fields ?? null,
      error: record?.error ? preview(record.error) : null,
      terminal: record?.terminal ?? null,
      waiting: index === current && status === "approval",
      reused: Boolean(record?.reused),
    };
  });
}

export function ago(ms, now) {
  if (!ms) return "";
  const minutes = Math.floor(Math.max(0, now - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function duration(from, to) {
  if (!from || !to) return "";
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function runLine(run, status, now) {
  const when = ago(run.created, now);
  const took = FINAL.includes(status) ? duration(run.created, run.ended) : "";
  return [when, took].filter(Boolean).join(" · ");
}

export function runActions(status) {
  if (status === "approval") return ["stop"];
  if (status === "running" || status === "starting") return ["stop"];
  if (status === "interrupted") return ["resume", "stop"];
  if (status === "failed" || status === "stopped") return ["retry"];
  return [];
}

export function inputsOf(workflow) {
  return Object.entries(workflow?.inputs ?? {}).map(([name, input]) => ({ name, label: input.label ?? name, required: Boolean(input.required), value: input.default ?? "" }));
}

export function missingInputs(inputs, values) {
  return inputs.filter((input) => input.required && !String(values[input.name] ?? "").trim()).map((input) => input.name);
}

export function runArgs(name, inputs, values, space) {
  return ["run", name, ...inputs.flatMap((input) => (values[input.name] ? ["--input", `${input.name}=${values[input.name]}`] : [])), "--space", space, "--json"];
}

export const RUN_POPUP = { width: 440, header: 52, input: 62, space: 30, spacesMax: 6, footer: 80, padding: 16 };

export function runPopupHeight(inputs, spaces) {
  const rows = Math.min(Math.max(spaces, 1), RUN_POPUP.spacesMax);
  return RUN_POPUP.header + inputs * RUN_POPUP.input + 24 + rows * RUN_POPUP.space + RUN_POPUP.footer + RUN_POPUP.padding;
}

export function cli(repo) {
  return `${repo}/scripts/workflow.ts`;
}

export function authorPrompt({ bun, repo, workflows }) {
  const command = `${bun} ${cli(repo)}`;
  return [
    "Help me write a nuoh workflow: steps that run agents, commands and approvals in order.",
    `First run \`${command} format\` and read how a workflow file works.`,
    "Then ask me what the workflow should do, and what its steps and inputs are, before you write anything.",
    `Write it as ${workflows}/<name>.json and run \`${command} check <name>\` until it says ok.`,
  ].join("\n");
}

export function editPrompt({ bun, repo, workflows, name }) {
  const command = `${bun} ${cli(repo)}`;
  return [
    `Help me change the nuoh workflow in ${workflows}/${name}.json.`,
    `Run \`${command} format\` to see how the file works, read the workflow, and tell me what it does now.`,
    "Ask me what should change before you edit it, and change only that.",
    `Then run \`${command} check ${name}\` until it says ok.`,
  ].join("\n");
}

export function chooseAgent(agents) {
  return (agents ?? []).find((agent) => agent.installed && Array.isArray(agent.run) && agent.run.length) ?? null;
}
