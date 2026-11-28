import { graphOf, nodeKind, parseType } from "../../lib/workflow.js";

export const SNAP = 8;
export const HISTORY = 100;
export const DUPLICATE_OFFSET = 32;
export const LOOP_MAX = 3;

const NODE_ORDER = ["id", "start", "agent", "continue", "run", "approve", "condition", "task", "show", "answer", "allowFail", "cwd", "timeout", "at", "size"];
const TOP_ORDER = ["title", "about", "inputs", "nodes", "edges"];
const EDGE_ORDER = ["from", "to", "branch", "max"];

export const ADD_KINDS = [
  { group: "Steps", kind: "agent", icon: "bot", label: "Agent", note: "a task for an agent" },
  { group: "Steps", kind: "continue", icon: "bot", label: "Same agent", note: "goes on talking" },
  { group: "Steps", kind: "run", icon: "terminal", label: "Command", note: "runs in the folder" },
  { group: "Flow", kind: "condition", icon: "git-fork", label: "Condition", note: "yes or no" },
  { group: "Flow", kind: "approve", icon: "flag", label: "Approval", note: "waits for you" },
];

export function snap(value) {
  return Math.round(value / SNAP) * SNAP;
}

function ordered(object, order) {
  const out = {};
  for (const key of order) if (Object.hasOwn(object, key)) out[key] = object[key];
  for (const key of Object.keys(object)) if (!Object.hasOwn(out, key)) out[key] = object[key];
  return out;
}

export function serialize(workflow) {
  const top = ordered(workflow, TOP_ORDER);
  top.nodes = (workflow.nodes ?? []).map((node) => ordered(node, NODE_ORDER));
  top.edges = (workflow.edges ?? []).map((edge) => ordered(edge, EDGE_ORDER));
  return `${JSON.stringify(top, null, 2).replace(/\[\n\s+(-?\d+(?:\.\d+)?),\n\s+(-?\d+(?:\.\d+)?)\n\s+\]/g, "[$1, $2]")}\n`;
}

export function blank(title) {
  return { title, inputs: {}, nodes: [{ id: "start", start: {}, at: [0, 0] }], edges: [] };
}

export function fileName(title, taken) {
  const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";
  let name = base;
  for (let n = 2; taken.includes(name); n += 1) name = `${base}-${n}`;
  return name;
}

export function newId(workflow, base) {
  const ids = new Set((workflow.nodes ?? []).map((node) => node.id));
  const root = String(base).replace(/[^a-z0-9_-]/gi, "") || "step";
  if (!ids.has(root)) return root;
  for (let n = 2; ; n += 1) if (!ids.has(`${root}-${n}`)) return `${root}-${n}`;
}

function nearestAgent(workflow, from) {
  if (!from) return null;
  const graph = graphOf(workflow);
  const stack = [from];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph.byId.get(id);
    if (["agent", "continue"].includes(nodeKind(node))) return id;
    for (const edge of graph.forwardIn.get(id) ?? []) stack.push(edge.from);
  }
  return null;
}

export function nodeFor(kind, workflow, id, from) {
  if (kind === "agent") return { id, agent: ["claude"], task: "" };
  if (kind === "continue") return { id, continue: nearestAgent(workflow, from) ?? "", task: "" };
  if (kind === "run") return { id, run: ["echo", "done"] };
  if (kind === "condition") return { id, condition: from ? `{{${from}.output}} set` : "" };
  return { id, approve: "Go on?" };
}

export function addNode(workflow, kind, at, link = null) {
  const id = newId(workflow, { agent: "agent", continue: "again", run: "command", condition: "check", approve: "approve" }[kind] ?? kind);
  const node = { ...nodeFor(kind, workflow, id, link?.from), at: [snap(at.x), snap(at.y)] };
  let next = { ...workflow, nodes: [...workflow.nodes, node] };
  if (link) {
    const made = connect(next, link.from, id, link.branch);
    if (made.error) return { workflow: next, id, error: made.error };
    next = made.workflow;
  }
  return { workflow: next, id };
}

export function moveNode(workflow, id, at) {
  return { ...workflow, nodes: workflow.nodes.map((node) => (node.id === id ? { ...node, at: [snap(at.x), snap(at.y)] } : node)) };
}

export function placeAll(workflow, places) {
  return { ...workflow, nodes: workflow.nodes.map((node) => (places[node.id] ? { ...node, at: [snap(places[node.id].x), snap(places[node.id].y)] } : node)) };
}

export function connectProblem(workflow, from, to, branch) {
  const graph = graphOf(workflow);
  const source = graph.byId.get(from);
  const target = graph.byId.get(to);
  if (!source || !target) return "Connect an output to an input";
  if (from === to) return "A node cannot connect to itself";
  if (nodeKind(target) === "start") return "Nothing connects into start";
  if (nodeKind(source) === "condition" && !["yes", "no"].includes(branch)) return "Pick yes or no";
  if ((workflow.edges ?? []).some((edge) => edge.from === from && edge.to === to && (edge.branch ?? null) === (branch ?? null))) return "Already connected";
  return null;
}

export function makesLoop(workflow, from, to) {
  const graph = graphOf(workflow);
  const seen = new Set();
  const stack = [to];
  while (stack.length) {
    const id = stack.pop();
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of graph.forwardOut.get(id) ?? []) stack.push(edge.to);
  }
  return false;
}

export function connect(workflow, from, to, branch = null) {
  const problem = connectProblem(workflow, from, to, branch);
  if (problem) return { error: problem };
  const loop = makesLoop(workflow, from, to);
  const edge = { from, to, ...(branch ? { branch } : {}), ...(loop ? { max: LOOP_MAX } : {}) };
  return { workflow: { ...workflow, edges: [...(workflow.edges ?? []), edge] }, loop };
}

export function disconnect(workflow, index) {
  return { ...workflow, edges: workflow.edges.filter((_edge, at) => at !== index) };
}

export function setLoopMax(workflow, index, max) {
  return { ...workflow, edges: workflow.edges.map((edge, at) => (at === index ? { ...edge, max } : edge)) };
}

export function removeNode(workflow, id) {
  const node = workflow.nodes.find((one) => one.id === id);
  if (!node || nodeKind(node) === "start") return workflow;
  return { ...workflow, nodes: workflow.nodes.filter((one) => one.id !== id), edges: workflow.edges.filter((edge) => edge.from !== id && edge.to !== id) };
}

export function duplicateNode(workflow, id) {
  const node = workflow.nodes.find((one) => one.id === id);
  if (!node || nodeKind(node) === "start") return { workflow, id: null };
  const copy = { ...JSON.parse(JSON.stringify(node)), id: newId(workflow, node.id), at: [snap((node.at?.[0] ?? 0) + DUPLICATE_OFFSET), snap((node.at?.[1] ?? 0) + DUPLICATE_OFFSET)] };
  return { workflow: { ...workflow, nodes: [...workflow.nodes, copy] }, id: copy.id };
}

function renameInText(text, from, to) {
  return typeof text === "string" ? text.replace(new RegExp(`\\{\\{(\\s*)${from.replace(/[-]/g, "\\-")}\\.`, "g"), `{{$1${to}.`) : text;
}

export function renameNode(workflow, from, to) {
  const id = String(to).trim();
  if (!/^[a-z][a-z0-9_-]*$/i.test(id)) return { error: "Use a letter, then letters, digits, - and _" };
  if (["input", "run"].includes(id)) return { error: `"${id}" is taken` };
  if (id !== from && workflow.nodes.some((node) => node.id === id)) return { error: "Another step has this name" };
  const fields = ["task", "show", "approve", "condition", "cwd"];
  const nodes = workflow.nodes.map((node) => {
    const next = { ...node, id: node.id === from ? id : node.id };
    for (const field of fields) if (Object.hasOwn(next, field)) next[field] = renameInText(next[field], from, id);
    if (next.continue === from) next.continue = id;
    if (Array.isArray(next.run)) next.run = next.run.map((part) => renameInText(part, from, id));
    return next;
  });
  const edges = workflow.edges.map((edge) => ({ ...edge, from: edge.from === from ? id : edge.from, to: edge.to === from ? id : edge.to }));
  return { workflow: { ...workflow, nodes, edges } };
}

export function splitArgs(text) {
  const parts = [];
  let current = "";
  let quote = null;
  let started = false;
  for (const char of String(text ?? "")) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current) parts.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started || current) parts.push(current);
  return parts;
}

export function joinArgs(argv) {
  return (argv ?? []).map((part) => (part === "" || /[\s"']/.test(part) ? `"${part.replace(/"/g, "'")}"` : part)).join(" ");
}

export function setAgent(argv, program) {
  const rest = (argv ?? []).slice(1);
  return [...(program ?? ["claude"]), ...rest.filter((part, index) => part === "--model" || rest[index - 1] === "--model")];
}

export function setModel(argv, model) {
  const base = [];
  for (let index = 0; index < (argv ?? []).length; index += 1) {
    if (argv[index] === "--model") {
      index += 1;
      continue;
    }
    base.push(argv[index]);
  }
  return model ? [...base, "--model", model] : base;
}

export function modelOf(argv) {
  const index = (argv ?? []).indexOf("--model");
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

export function setField(workflow, id, field, value) {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => {
      if (node.id !== id) return node;
      const next = { ...node };
      if (field === "run") next.run = splitArgs(value);
      else if (field === "agent") next.agent = value;
      else if (field === "model") next.agent = setModel(next.agent, value);
      else if (field === "allowFail") {
        if (value) next.allowFail = true;
        else delete next.allowFail;
      } else if (field === "show" && !value) delete next.show;
      else if (field === "answer") {
        if (value && Object.keys(value).length) next.answer = value;
        else delete next.answer;
      } else next[field] = value;
      return next;
    }),
  };
}

export function parseAnswer(text) {
  const answer = {};
  const problems = [];
  for (const part of String(text ?? "").split(/[,\n]/).map((one) => one.trim()).filter(Boolean)) {
    const colon = part.indexOf(":");
    const name = (colon < 0 ? part : part.slice(0, colon)).trim();
    const type = colon < 0 ? "text" : part.slice(colon + 1).trim();
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) problems.push(`"${name}" is not a usable field name`);
    else if (!parseType(type)) problems.push(`${name}: use text, number, boolean or a|b|c, with ? when optional`);
    else answer[name] = type;
  }
  return { answer, problems };
}

export function answerText(answer) {
  return Object.entries(answer ?? {})
    .map(([name, type]) => `${name}: ${type}`)
    .join(", ");
}

export function history() {
  return { past: [], future: [], key: null };
}

export function record(state, snapshot, key = null) {
  if (key && state.key === key && state.past.length) return { past: state.past, future: [], key };
  return { past: [...state.past, snapshot].slice(-HISTORY), future: [], key };
}

export function undo(state, present) {
  if (!state.past.length) return null;
  return { state: { past: state.past.slice(0, -1), future: [present, ...state.future], key: null }, workflow: state.past.at(-1) };
}

export function redo(state, present) {
  if (!state.future.length) return null;
  return { state: { past: [...state.past, present], future: state.future.slice(1), key: null }, workflow: state.future[0] };
}
