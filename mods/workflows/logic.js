import { checkWorkflow, current, FINAL, graphOf, latest, nodeKind, runSummary, scopeOf, fill, warnings } from "../../lib/workflow.js";
import { nodeHeight } from "./canvas.js";

export const RUNS_SHOWN = 20;
export const STARTING_MS = 30000;
export const PREVIEW_LINES = 3;
export const RUN_ID = /^([a-z0-9][a-z0-9_-]*)-(\d+)$/i;

export const RUN_LOOK = {
  starting: { tone: "working", label: "Starting", pill: "starting" },
  running: { tone: "working", label: "Running", pill: "running" },
  approval: { tone: "blocked", label: "Needs you", pill: "waiting" },
  done: { tone: "done", label: "Done", pill: "done" },
  failed: { tone: "blocked", label: "Failed", pill: "failed" },
  stopped: { tone: "unknown", label: "Stopped", pill: "stopped" },
  interrupted: { tone: "unknown", label: "Interrupted", pill: "interrupted" },
};

export function itemOf(name, text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { name, text, workflow: null, problems: [`not valid JSON: ${error.message}`], warnings: [] };
  }
  const problems = checkWorkflow(value);
  const drawable = value != null && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.nodes) && !Object.hasOwn(value, "steps");
  const workflow = drawable ? { ...value, nodes: value.nodes.filter((node) => node && typeof node.id === "string"), edges: Array.isArray(value.edges) ? value.edges : [] } : null;
  return { name, text, workflow, problems, warnings: workflow && !problems.length ? warnings(workflow) : [] };
}

export function checked(workflow) {
  const problems = checkWorkflow(workflow);
  return { problems, warnings: problems.length ? [] : warnings(workflow) };
}

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

export function preview(text, lines = PREVIEW_LINES) {
  const all = String(text ?? "").trim().split("\n");
  return all.length > lines ? `${all.slice(0, lines).join("\n")}\n…` : all.join("\n");
}

export function program(argv) {
  const [first = "", ...rest] = argv ?? [];
  return [first.split("/").pop(), ...rest].join(" ");
}

export function agentLabel(node, workflow, agents) {
  const graph = graphOf(workflow);
  let root = node;
  const seen = new Set();
  while (root && nodeKind(root) === "continue" && !seen.has(root.id)) {
    seen.add(root.id);
    root = graph.byId.get(root.continue);
  }
  const argv = root?.agent ?? [];
  const name = (argv[0] ?? "").split("/").pop();
  const model = argv.includes("--model") ? argv[argv.indexOf("--model") + 1] ?? null : null;
  const known = (agents ?? []).find((agent) => (agent.run?.[0] ?? "").split("/").pop() === name);
  const label = known?.name ?? (name ? name[0].toUpperCase() + name.slice(1) : "Agent");
  return { name: nodeKind(node) === "continue" ? `${label} · ${node.continue}` : label, model, program: known ?? null };
}

export function nodeState(run, status, id) {
  if (!run) return { state: "idle", record: null };
  const going = !FINAL.includes(run.status);
  const now = going ? current(run, id) : null;
  const record = latest(run, id);
  const cut = status === "interrupted";
  if (now?.status === "approval") return { state: cut ? "failed" : "waiting", record: now, cut };
  if (now?.status === "running") return { state: cut ? "failed" : "running", record: now, cut };
  if (!record) return { state: "idle", record: null };
  if (record.status === "done") return { state: "done", record };
  if (record.status === "skipped") return { state: "skipped", record };
  if (record.status === "failed") return { state: "failed", record };
  return { state: "idle", record };
}

export function tries(run, id) {
  return run ? run.steps.filter((record) => record.id === id && !record.reused && record.status !== "skipped").length : 0;
}

export function duration(from, to) {
  if (!from || !to) return "";
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function nodeMeta(run, id, view, now) {
  const record = view.record;
  if (!record) return null;
  if (view.cut) return "cut off";
  if (view.state === "waiting") return "Needs you";
  if (view.state === "skipped") return "skipped";
  if (record.status === "stopped") return "stopped";
  const passes = tries(run, id);
  const time = record.ended && record.started ? duration(record.started, record.ended) : view.state === "running" ? duration(record.started, now) : "";
  return [time, passes > 1 ? `${passes}×` : ""].filter(Boolean).join(" · ") || null;
}

export function resultOf(node, view) {
  const record = view.record;
  if (!record || view.state === "idle" || view.state === "skipped") return null;
  if (record.status === "failed" || record.error) return { text: preview(record.error ?? "failed"), tone: "blocked" };
  if (view.state === "running") return { text: nodeKind(node) === "run" ? "Running the command" : "Working", tone: "working" };
  if (view.state === "waiting" || nodeKind(node) === "condition" || nodeKind(node) === "start" || nodeKind(node) === "approve") return null;
  if (record.fields && Object.keys(record.fields).length) return { fields: record.fields };
  if (record.output) return { text: preview(record.output) };
  return null;
}

export function edgeState(graph, run, edge, status) {
  if (!run) return "idle";
  const source = latest(run, edge.from);
  if (source?.status !== "done") return "idle";
  const branchOk = nodeKind(graph.byId.get(edge.from)) !== "condition" || source.output === edge.branch;
  if (!branchOk) return "faded";
  const target = nodeState(run, status, edge.to);
  if (target.state === "running" || target.state === "waiting") return "running";
  if (target.record && target.state !== "skipped") return "done";
  return "idle";
}

export function viewsOf(workflow, run, status) {
  const views = {};
  for (const node of workflow?.nodes ?? []) views[node.id] = nodeState(run, status, node.id);
  return views;
}

export function heightsOf(workflow, views) {
  const heights = {};
  const inputs = Object.keys(workflow?.inputs ?? {}).length;
  for (const node of workflow?.nodes ?? []) {
    const view = views?.[node.id];
    const result = view ? resultOf(node, view) : null;
    heights[node.id] = nodeHeight(node, { result: Boolean(result), fields: result?.fields ? Object.keys(result.fields).length : 0, waiting: view?.state === "waiting", inputs });
  }
  return heights;
}

export function scopedText(text, run) {
  return run ? fill(text, scopeOf(run)) : text;
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

export function runLine(run, status, now) {
  const when = ago(run.created, now);
  const took = FINAL.includes(status) ? duration(run.created, run.ended) : "";
  return [when, took].filter(Boolean).join(" · ");
}

export function pillOf(run, status) {
  if (!run || !status) return null;
  const look = RUN_LOOK[status] ?? RUN_LOOK.running;
  const summary = runSummary(run);
  const failed = run.steps.findLast((record) => record.status === "failed")?.id;
  let at = null;
  if (status === "approval") at = `Waiting at ${summary.step}`;
  else if (status === "running" || status === "starting") at = summary.step;
  else if (status === "failed") at = failed ? `at ${failed}` : null;
  else if (status === "done") at = `in ${duration(run.created, run.ended)}`;
  else if (status === "interrupted") at = summary.step ? `cut off at ${summary.step}` : null;
  return { status: look.pill, at, step: status === "failed" ? failed : summary.step };
}

export function runActions(status) {
  if (status === "approval" || status === "running" || status === "starting") return ["stop"];
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

export function runArgs(name, inputs, values, space, { from = null, only = null } = {}) {
  return [
    "run",
    name,
    ...inputs.flatMap((input) => (values[input.name] ? ["--input", `${input.name}=${values[input.name]}`] : [])),
    "--space",
    space,
    ...(from ? ["--from", from] : []),
    ...(only ? ["--only", only] : []),
    "--json",
  ];
}

export const RUN_POPUP = { width: 440, header: 52, input: 62, space: 30, spacesMax: 6, footer: 80, padding: 16 };

export function runPopupHeight(inputs, spaces) {
  const rows = Math.min(Math.max(spaces, 1), RUN_POPUP.spacesMax);
  return RUN_POPUP.header + inputs * RUN_POPUP.input + 24 + rows * RUN_POPUP.space + RUN_POPUP.footer + RUN_POPUP.padding;
}

export const SWITCHER = { width: 340, row: 44, max: 8, foot: 84 };

export function switcherHeight(count) {
  return Math.min(Math.max(count, 1), SWITCHER.max) * SWITCHER.row + SWITCHER.foot + 16;
}

export function cli(repo) {
  return `${repo}/scripts/workflow.ts`;
}

export function authorPrompt({ bun, repo, workflows }) {
  const command = `${bun} ${cli(repo)}`;
  return [
    "Help me write a nuoh workflow: a graph of steps that runs agents, commands, conditions and approvals.",
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
    "Ask me what should change before you edit it, and change only that. Keep each step's at.",
    `Then run \`${command} check ${name}\` until it says ok.`,
  ].join("\n");
}

export function chooseAgent(agents) {
  return (agents ?? []).find((agent) => agent.installed && Array.isArray(agent.run) && agent.run.length) ?? null;
}
