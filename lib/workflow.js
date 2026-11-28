export const OUTPUT_CAP = 16000;
export const RUN_FIELDS = ["id", "dir", "folder", "space", "workflow", "number"];
export const FINAL = ["done", "failed", "stopped"];
export const MAX_PARALLEL = 4;
export const KINDS = ["start", "agent", "continue", "run", "approve", "condition"];

const ID = /^[a-z][a-z0-9_-]*$/i;
const FIELD = /^[a-z_][a-z0-9_]*$/i;
const NAME = /^[a-z0-9][a-z0-9_-]*$/i;
const TEMPLATE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const PLACE = ["at", "size"];
const ALLOWED = {
  start: ["id", "start", ...PLACE],
  agent: ["id", "agent", "task", "answer", "cwd", "timeout", ...PLACE],
  continue: ["id", "continue", "task", "answer", "timeout", ...PLACE],
  run: ["id", "run", "allowFail", "cwd", "timeout", ...PLACE],
  approve: ["id", "approve", "show", ...PLACE],
  condition: ["id", "condition", ...PLACE],
};
const TOP = ["title", "about", "inputs", "nodes", "edges"];
const EDGE_FIELDS = ["from", "to", "branch", "max"];
const INPUT_FIELDS = ["label", "required", "default"];
const OPERATORS = ["!=", ">=", "<=", "=", ">", "<"];
const RISKY = ["--dangerously-skip-permissions", "--yolo", "--dangerously-bypass-approvals-and-sandbox"];
const PASSES_INPUT = ["agent", "continue", "run"];

export function isWorkflowName(name) {
  return typeof name === "string" && NAME.test(name);
}

export function nodeKind(node) {
  return KINDS.find((kind) => node && Object.hasOwn(node, kind)) ?? null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isArgv(value) {
  return Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === "string" && part !== "");
}

function isPair(value) {
  return Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

export function parseType(spec) {
  if (typeof spec !== "string") return null;
  const optional = spec.endsWith("?");
  const base = optional ? spec.slice(0, -1).trim() : spec.trim();
  if (["text", "number", "boolean"].includes(base)) return { type: base, optional };
  const options = base.split("|").map((option) => option.trim());
  if (options.length >= 2 && options.every((option) => /^[\w-]+$/.test(option))) return { type: "one of", options, optional };
  return null;
}

export function templateRefs(text) {
  return [...String(text ?? "").matchAll(TEMPLATE)].map((match) => match[1]);
}

function tokenize(text) {
  const tokens = [];
  let rest = String(text ?? "").trim();
  while (rest) {
    let match = /^\{\{\s*([^{}]*?)\s*\}\}/.exec(rest);
    if (match) tokens.push({ ref: match[1] });
    else if ((match = /^"([^"]*)"|^'([^']*)'/.exec(rest))) tokens.push({ literal: match[1] ?? match[2] });
    else if ((match = new RegExp(`^(${OPERATORS.map((op) => op.replace(/[<>=!]/g, "\\$&")).join("|")})`).exec(rest))) tokens.push({ op: match[1] });
    else if ((match = /^[^\s"'{}<>=!]+/.exec(rest))) {
      const word = match[0];
      if (["and", "or", "contains", "set", "unset"].includes(word.toLowerCase())) tokens.push({ word: word.toLowerCase() });
      else tokens.push({ literal: word });
    } else throw new Error(`cannot read "${rest.slice(0, 20)}"`);
    rest = rest.slice(match[0].length).trim();
  }
  return tokens;
}

export function parseExpression(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) throw new Error("empty condition");
  let at = 0;
  const operand = () => {
    const token = tokens[at];
    if (!token || (!("ref" in token) && !("literal" in token))) throw new Error("expected a value");
    at += 1;
    return token;
  };
  const comparison = () => {
    const left = operand();
    const next = tokens[at];
    if (next?.op || next?.word === "contains") {
      at += 1;
      return { left, op: next.op ?? "contains", right: operand() };
    }
    if (next?.word === "set" || next?.word === "unset") {
      at += 1;
      return { left, op: next.word };
    }
    return { left, op: "truthy" };
  };
  const all = () => {
    const parts = [comparison()];
    while (tokens[at]?.word === "and") {
      at += 1;
      parts.push(comparison());
    }
    return { and: parts };
  };
  const any = [all()];
  while (tokens[at]?.word === "or") {
    at += 1;
    any.push(all());
  }
  if (at < tokens.length) throw new Error(`unexpected "${tokens[at].op ?? tokens[at].word ?? tokens[at].literal ?? tokens[at].ref}"`);
  return { or: any };
}

function expressionRefs(tree) {
  return tree.or.flatMap((all) => all.and.flatMap((part) => [part.left, part.right].filter((side) => side && "ref" in side).map((side) => side.ref)));
}

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function blank(value) {
  return value === undefined || value === null || value === "";
}

function compare(left, op, right) {
  if (op === "set") return !blank(left);
  if (op === "unset") return blank(left);
  if (op === "truthy") return !(blank(left) || left === false || left === 0 || left === "false" || left === "0");
  if (op === "contains") return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
  const a = numeric(left);
  const b = numeric(right);
  if (op === "=" || op === "!=") {
    const same = a !== null && b !== null ? a === b : String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();
    return op === "=" ? same : !same;
  }
  if (a === null || b === null) return false;
  if (op === ">") return a > b;
  if (op === ">=") return a >= b;
  if (op === "<") return a < b;
  return a <= b;
}

export function lookup(ref, scope) {
  const [head, ...rest] = String(ref).split(".");
  if (head === "input") return scope.input?.[rest.join(".")];
  if (head === "run") return scope.run?.[rest.join(".")];
  const step = scope.steps?.[head];
  if (!step || rest.length !== 1) return undefined;
  const [field] = rest;
  if (field === "output") return step.output;
  if (field === "exit") return step.exit;
  return step.fields?.[field];
}

export function evaluate(text, scope) {
  const value = (side) => ("ref" in side ? lookup(side.ref, scope) : side.literal);
  return parseExpression(text).or.some((all) => all.and.every((part) => compare(value(part.left), part.op, part.right ? value(part.right) : undefined)));
}

function show(value) {
  if (blank(value)) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function fill(text, scope) {
  return String(text ?? "").replace(TEMPLATE, (_, ref) => show(lookup(ref, scope)));
}

export function graphOf(workflow) {
  const nodes = (Array.isArray(workflow?.nodes) ? workflow.nodes : []).filter((node) => isObject(node) && typeof node.id === "string");
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = (Array.isArray(workflow?.edges) ? workflow.edges : [])
    .filter((edge) => isObject(edge) && byId.has(edge.from) && byId.has(edge.to))
    .map((edge, index) => ({ ...edge, index }));
  const out = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) out.get(edge.from).push(edge);
  const start = nodes.find((node) => nodeKind(node) === "start")?.id ?? null;
  const loops = new Set();
  const state = new Map();
  const visit = (id) => {
    state.set(id, 1);
    for (const edge of out.get(id)) {
      const seen = state.get(edge.to) ?? 0;
      if (seen === 1) loops.add(edge.index);
      else if (seen === 0) visit(edge.to);
    }
    state.set(id, 2);
  };
  if (start) visit(start);
  const reachable = new Set(state.keys());
  for (const node of nodes) if (!state.has(node.id)) visit(node.id);
  const forwardIn = new Map(nodes.map((node) => [node.id, []]));
  const forwardOut = new Map(nodes.map((node) => [node.id, []]));
  const loopIn = new Map(nodes.map((node) => [node.id, []]));
  const loopOut = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    const loop = loops.has(edge.index);
    (loop ? loopIn : forwardIn).get(edge.to).push(edge);
    (loop ? loopOut : forwardOut).get(edge.from).push(edge);
  }
  const order = [];
  const waiting = new Map(nodes.map((node) => [node.id, forwardIn.get(node.id).length]));
  const queue = nodes.filter((node) => waiting.get(node.id) === 0).map((node) => node.id);
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const edge of forwardOut.get(id)) {
      waiting.set(edge.to, waiting.get(edge.to) - 1);
      if (waiting.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  return { nodes, byId, edges, start, loops, reachable, forwardIn, forwardOut, loopIn, loopOut, order };
}

export function isLoop(graph, edge) {
  return graph.loops.has(edge.index);
}

export function ancestors(graph, id) {
  const seen = new Set();
  const stack = [...(graph.forwardIn.get(id) ?? [])].map((edge) => edge.from);
  while (stack.length) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    for (const edge of graph.forwardIn.get(next) ?? []) stack.push(edge.from);
  }
  return seen;
}

export function reach(graph, id) {
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const next = stack.pop();
    for (const edge of graph.forwardOut.get(next) ?? []) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return seen;
}

export function agentRoot(graph, id) {
  let node = graph.byId.get(id);
  const seen = new Set();
  while (node && nodeKind(node) === "continue" && !seen.has(node.id)) {
    seen.add(node.id);
    node = graph.byId.get(node.continue);
  }
  return node && nodeKind(node) === "agent" ? node.id : null;
}

function refProblem(ref, id, graph, inputs) {
  const [head, ...rest] = ref.split(".");
  if (rest.length !== 1) return `{{${ref}}} is not a known value`;
  const [field] = rest;
  if (head === "input") return Object.hasOwn(inputs, field) ? null : `{{${ref}}}: there is no input "${field}"`;
  if (head === "run") return RUN_FIELDS.includes(field) ? null : `{{${ref}}}: run has ${RUN_FIELDS.join(", ")}`;
  const source = graph.byId.get(head);
  if (!source) return `{{${ref}}}: there is no step "${head}"`;
  if (!ancestors(graph, id).has(head)) return `{{${ref}}}: step "${head}" doesn't come before this one`;
  const kind = nodeKind(source);
  if (field === "output") return null;
  if (field === "exit") return kind === "run" ? null : `{{${ref}}}: only a run step has exit`;
  if (isObject(source.answer) && Object.hasOwn(source.answer, field)) return null;
  return `{{${ref}}}: step "${head}" answers no field "${field}"`;
}

function checkInputs(value, problems) {
  const inputs = value.inputs ?? {};
  if (!isObject(inputs)) {
    problems.push("inputs must be an object");
    return {};
  }
  for (const [name, input] of Object.entries(inputs)) {
    if (!FIELD.test(name)) problems.push(`input "${name}": use letters, digits and _`);
    if (!isObject(input)) {
      problems.push(`input "${name}" must be an object`);
      continue;
    }
    for (const key of Object.keys(input)) if (!INPUT_FIELDS.includes(key)) problems.push(`input "${name}": unknown field "${key}"`);
    if (input.label !== undefined && typeof input.label !== "string") problems.push(`input "${name}": label must be text`);
    if (input.required !== undefined && typeof input.required !== "boolean") problems.push(`input "${name}": required must be true or false`);
    if (input.default !== undefined && typeof input.default !== "string") problems.push(`input "${name}": default must be text`);
  }
  return inputs;
}

function checkNode(node, index, graph, inputs, problems, seen) {
  const name = isObject(node) && typeof node.id === "string" ? `step "${node.id}"` : `step ${index + 1}`;
  if (!isObject(node)) {
    problems.push(`${name} must be an object`);
    return;
  }
  if (typeof node.id !== "string" || !ID.test(node.id)) problems.push(`${name}: id must start with a letter and use letters, digits, _ and -`);
  else if (["input", "run"].includes(node.id)) problems.push(`${name}: "${node.id}" is taken`);
  else if (seen.has(node.id)) problems.push(`${name}: another step has this id`);
  seen.add(node.id);
  const kinds = KINDS.filter((kind) => Object.hasOwn(node, kind));
  if (kinds.length !== 1) {
    problems.push(`${name}: give exactly one of ${KINDS.join(", ")}`);
    return;
  }
  const [kind] = kinds;
  for (const key of Object.keys(node)) if (!ALLOWED[kind].includes(key)) problems.push(`${name}: a ${kind} step has no field "${key}"`);
  if (node.at !== undefined && !isPair(node.at)) problems.push(`${name}: at must be [x, y]`);
  if (node.size !== undefined && !isPair(node.size)) problems.push(`${name}: size must be [width, height]`);
  const texts = [];
  if (kind === "start" && !isObject(node.start)) problems.push(`${name}: start must be {}`);
  if (kind === "agent" && !isArgv(node.agent)) problems.push(`${name}: agent must be a list like ["claude"]`);
  if (kind === "run") {
    if (!isArgv(node.run)) problems.push(`${name}: run must be a list like ["bun", "test"]`);
    else texts.push(...node.run);
  }
  if (kind === "continue") {
    const target = graph.byId.get(node.continue);
    if (!target) problems.push(`${name}: continue names no step "${node.continue}"`);
    else if (!["agent", "continue"].includes(nodeKind(target))) problems.push(`${name}: continue must name an agent step`);
    else if (!ancestors(graph, node.id).has(node.continue)) problems.push(`${name}: continue must name a step that comes before it`);
  }
  if (kind === "agent" || kind === "continue") {
    if (typeof node.task !== "string" || node.task.trim() === "") problems.push(`${name}: task must be text`);
    else texts.push(node.task);
    if (node.answer !== undefined) {
      if (!isObject(node.answer) || Object.keys(node.answer).length === 0) problems.push(`${name}: answer must be an object of fields`);
      else
        for (const [field, spec] of Object.entries(node.answer)) {
          if (!FIELD.test(field) || ["output", "exit"].includes(field)) problems.push(`${name}: answer field "${field}" is not a usable name`);
          if (!parseType(spec)) problems.push(`${name}: answer field "${field}" must be text, number, boolean or a|b|c, with ? when optional`);
        }
    }
  }
  if (kind === "approve") {
    if (typeof node.approve !== "string" || node.approve.trim() === "") problems.push(`${name}: approve must be the question`);
    else texts.push(node.approve);
    if (node.show !== undefined) {
      if (typeof node.show !== "string") problems.push(`${name}: show must be text`);
      else texts.push(node.show);
    }
  }
  if (node.cwd !== undefined) {
    if (typeof node.cwd !== "string" || node.cwd === "") problems.push(`${name}: cwd must be text`);
    else texts.push(node.cwd);
  }
  if (node.timeout !== undefined && !(typeof node.timeout === "number" && node.timeout > 0)) problems.push(`${name}: timeout must be seconds above 0`);
  if (node.allowFail !== undefined && typeof node.allowFail !== "boolean") problems.push(`${name}: allowFail must be true or false`);
  for (const text of texts)
    for (const ref of templateRefs(text)) {
      const problem = refProblem(ref, node.id, graph, inputs);
      if (problem) problems.push(`${name}: ${problem}`);
    }
  if (kind === "condition") {
    if (typeof node.condition !== "string") problems.push(`${name}: condition must be text`);
    else
      try {
        for (const ref of expressionRefs(parseExpression(node.condition))) {
          const problem = refProblem(ref, node.id, graph, inputs);
          if (problem) problems.push(`${name}: ${problem}`);
        }
      } catch (error) {
        problems.push(`${name}: condition: ${error.message}`);
      }
  }
}

function checkEdges(value, graph, problems) {
  if (!Array.isArray(value.edges ?? [])) {
    problems.push("edges must be a list");
    return;
  }
  const seen = new Set();
  (value.edges ?? []).forEach((edge, index) => {
    const name = `connection ${index + 1}`;
    if (!isObject(edge)) {
      problems.push(`${name} must be an object`);
      return;
    }
    for (const key of Object.keys(edge)) if (!EDGE_FIELDS.includes(key)) problems.push(`${name}: unknown field "${key}"`);
    const from = graph.byId.get(edge.from);
    const to = graph.byId.get(edge.to);
    if (!from) problems.push(`${name}: there is no step "${edge.from}"`);
    if (!to) problems.push(`${name}: there is no step "${edge.to}"`);
    if (!from || !to) return;
    const label = `${edge.from} → ${edge.to}`;
    if (nodeKind(to) === "start") problems.push(`${label}: nothing connects into start`);
    if (nodeKind(from) === "condition") {
      if (!["yes", "no"].includes(edge.branch)) problems.push(`${label}: a connection out of a condition needs branch "yes" or "no"`);
    } else if (edge.branch !== undefined) problems.push(`${label}: only a condition's connections have a branch`);
    const key = `${edge.from}|${edge.to}|${edge.branch ?? ""}`;
    if (seen.has(key)) problems.push(`${label}: this connection is there twice`);
    seen.add(key);
    const loop = graph.edges.find((other) => other.from === edge.from && other.to === edge.to && other.branch === edge.branch && isLoop(graph, other));
    if (loop) {
      if (!(Number.isInteger(edge.max) && edge.max >= 1)) problems.push(`${label} goes back: give it max, how many times it may go back`);
    } else if (edge.max !== undefined) problems.push(`${label}: max only goes on a connection that goes back`);
  });
}

export function checkWorkflow(value) {
  const problems = [];
  if (!isObject(value)) return ["the file must hold one JSON object"];
  if (Object.hasOwn(value, "steps")) return ["this is the first format, with steps: workflows now have nodes and edges (run workflow format)"];
  for (const key of Object.keys(value)) if (!TOP.includes(key)) problems.push(`unknown field "${key}"`);
  if (value.title !== undefined && typeof value.title !== "string") problems.push("title must be text");
  if (value.about !== undefined && typeof value.about !== "string") problems.push("about must be text");
  const inputs = checkInputs(value, problems);
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) return [...problems, "nodes must be a list with at least a start"];
  const graph = graphOf(value);
  const seen = new Set();
  value.nodes.forEach((node, index) => checkNode(node, index, graph, inputs, problems, seen));
  const starts = value.nodes.filter((node) => nodeKind(node) === "start").length;
  if (starts !== 1) problems.push(starts === 0 ? "add a start step: the run begins there" : "a workflow has one start step");
  checkEdges(value, graph, problems);
  return problems;
}

export function warnings(workflow) {
  const graph = graphOf(workflow);
  const risky = graph.nodes.flatMap((node) => {
    const flags = (node.agent ?? []).filter((part) => RISKY.includes(part));
    return flags.length ? [`step "${node.id}" runs its agent with ${flags.join(" ")}: it acts without asking`] : [];
  });
  const stranded = graph.start ? graph.nodes.filter((node) => !graph.reachable.has(node.id)).map((node) => `step "${node.id}" is not connected from start: it never runs`) : [];
  return [...risky, ...stranded];
}

export function parseWorkflow(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, problems: [`not valid JSON: ${error.message}`] };
  }
  const problems = checkWorkflow(value);
  return problems.length ? { ok: false, problems, value: isObject(value) ? value : null } : { ok: true, workflow: value };
}

export function resolveInputs(workflow, given) {
  const declared = workflow.inputs ?? {};
  const problems = [];
  const inputs = {};
  for (const name of Object.keys(given)) if (!Object.hasOwn(declared, name)) problems.push(`the workflow has no input "${name}"`);
  for (const [name, input] of Object.entries(declared)) {
    const value = given[name] ?? input.default;
    if ((value === undefined || value === "") && input.required) problems.push(`input "${name}" is required`);
    inputs[name] = value ?? "";
  }
  return { inputs, problems };
}

function stripFence(text) {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/.exec(text);
  return fenced ? fenced[1] : text;
}

export function describeAnswer(answer) {
  return Object.entries(answer).map(([field, spec]) => {
    const type = parseType(spec);
    const kind = type.type === "one of" ? `one of ${type.options.join(", ")}` : type.type;
    return `${field} (${kind}${type.optional ? ", optional" : ""})`;
  });
}

export function readAnswer(text, answer) {
  const body = stripFence(String(text ?? "")).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) return { ok: false, error: "it holds no JSON object" };
  let value;
  try {
    value = JSON.parse(body.slice(start, end + 1));
  } catch (error) {
    return { ok: false, error: `its JSON does not parse: ${error.message}` };
  }
  if (!isObject(value)) return { ok: false, error: "it must be one JSON object" };
  const fields = {};
  for (const [field, spec] of Object.entries(answer)) {
    const type = parseType(spec);
    const raw = value[field];
    if (blank(raw)) {
      if (type.optional) {
        fields[field] = null;
        continue;
      }
      return { ok: false, error: `${field} is missing` };
    }
    if (type.type === "number") {
      const number = numeric(raw);
      if (number === null) return { ok: false, error: `${field} must be a number` };
      fields[field] = number;
    } else if (type.type === "boolean") {
      if (raw === true || raw === "true") fields[field] = true;
      else if (raw === false || raw === "false") fields[field] = false;
      else return { ok: false, error: `${field} must be true or false` };
    } else if (type.type === "one of") {
      const option = type.options.find((choice) => choice.toLowerCase() === String(raw).toLowerCase());
      if (!option) return { ok: false, error: `${field} must be one of ${type.options.join(", ")}` };
      fields[field] = option;
    } else fields[field] = typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  return { ok: true, fields };
}

export function agentMessage({ title, step, task, file, answer, inputs = [] }) {
  const lines = [`Workflow "${title}", step "${step}".`, "", task.trim(), ""];
  for (const input of inputs) lines.push(`--- input from ${input.id} ---`, input.output.trim(), "");
  if (answer) lines.push(`When you finish, write your answer to ${file} as one JSON object with these fields: ${describeAnswer(answer).join("; ")}. Put nothing else in that file.`);
  else lines.push(`When you finish, write your answer to ${file}: what you did or found, in plain text or Markdown. The workflow reads only that file.`);
  return lines.join("\n");
}

export function retryMessage({ file, answer, error }) {
  if (error) return `Your answer in ${file} cannot be used: ${error}. Write it again as one JSON object with: ${describeAnswer(answer).join("; ")}.`;
  return `The workflow found no answer in ${file}. Write your answer there now.`;
}

export function cap(text) {
  const value = String(text ?? "");
  return value.length > OUTPUT_CAP ? `${value.slice(0, OUTPUT_CAP)}\n[cut at ${OUTPUT_CAP} characters]` : value;
}

export function latest(run, id) {
  return run.steps.findLast((record) => record.id === id) ?? null;
}

export function epochOf(run, id) {
  return run.epoch?.[id] ?? 0;
}

export function current(run, id) {
  const record = latest(run, id);
  return record && (record.epoch ?? 0) === epochOf(run, id) && record.status !== "interrupted" ? record : null;
}

export function scopeOf(run) {
  const steps = {};
  for (const record of run.steps) {
    if (record.status === "done") steps[record.id] = { output: record.output ?? "", exit: record.exit, fields: record.fields ?? {} };
    else if (record.status === "skipped") steps[record.id] = { output: "", fields: {} };
  }
  return {
    input: run.inputs ?? {},
    run: { id: run.id, dir: run.dir, folder: run.folder, space: run.space, workflow: run.workflow, number: run.number },
    steps,
  };
}

function edgeActive(graph, run, edge) {
  const record = current(run, edge.from);
  if (record?.status !== "done") return false;
  if (nodeKind(graph.byId.get(edge.from)) === "condition") return record.output === edge.branch;
  return true;
}

export function activeIn(graph, run, id) {
  return (graph.forwardIn.get(id) ?? []).filter((edge) => edgeActive(graph, run, edge));
}

export function readyNodes(graph, run) {
  const scope = run.only ? [...new Set([graph.start, run.only].filter(Boolean))] : graph.order.filter((id) => graph.reachable.has(id));
  return scope.filter((id) => {
    if (current(run, id)) return false;
    return (graph.forwardIn.get(id) ?? []).every((edge) => ["done", "skipped"].includes(current(run, edge.from)?.status));
  });
}

export function loopsTaken(graph, run, id) {
  return (graph.loopOut.get(id) ?? []).filter((edge) => edgeActive(graph, run, edge));
}

export function loopKey(edge) {
  return `${edge.from}->${edge.to}${edge.branch ? `:${edge.branch}` : ""}`;
}

export function loopsExhausted(graph, run, id) {
  const node = graph.byId.get(id);
  if (nodeKind(node) === "condition") return [];
  return (graph.loopOut.get(id) ?? []).filter((edge) => (run.loops?.[loopKey(edge)] ?? 0) >= edge.max);
}

export function takeLoop(graph, run, edge) {
  run.loops = { ...(run.loops ?? {}), [loopKey(edge)]: (run.loops?.[loopKey(edge)] ?? 0) + 1 };
  const epoch = { ...(run.epoch ?? {}) };
  for (const id of reach(graph, edge.to)) epoch[id] = (epoch[id] ?? 0) + 1;
  run.epoch = epoch;
}

export function nodeInputs(graph, run, id) {
  const edges = [...(graph.forwardIn.get(id) ?? []), ...(graph.loopIn.get(id) ?? [])];
  const out = [];
  for (const edge of edges) {
    const source = graph.byId.get(edge.from);
    if (!PASSES_INPUT.includes(nodeKind(source))) continue;
    const record = latest(run, edge.from);
    if (record?.status !== "done" || out.some((input) => input.id === edge.from)) continue;
    out.push({ id: edge.from, output: record.output ?? "" });
  }
  return out;
}

export function agentTerminal(run, workflow, id) {
  const graph = graphOf(workflow);
  const root = agentRoot(graph, id);
  if (!root) return null;
  for (const record of [...run.steps].reverse()) {
    if (record.terminal && agentRoot(graph, record.id) === root) return record.terminal;
  }
  return null;
}

function signature(node) {
  const { at: _at, size: _size, ...rest } = node;
  return JSON.stringify(rest);
}

function incoming(workflow, id) {
  return (workflow.edges ?? [])
    .filter((edge) => edge.to === id)
    .map((edge) => `${edge.from}|${edge.branch ?? ""}|${edge.max ?? ""}`)
    .sort()
    .join(",");
}

export function staleNodes(before, after) {
  const graph = graphOf(after);
  const old = new Map((before?.nodes ?? []).map((node) => [node.id, node]));
  const stale = new Set();
  for (const node of graph.nodes) {
    const was = old.get(node.id);
    if (!was || signature(was) !== signature(node) || incoming(before, node.id) !== incoming(after, node.id)) for (const id of reach(graph, node.id)) stale.add(id);
  }
  return stale;
}

export function reuseFor(previous, workflow, { from, only }) {
  const graph = graphOf(workflow);
  const target = from ?? only;
  if (target && !graph.byId.has(target)) return { problems: [`${workflow.title ?? "the workflow"} has no step "${target}"`] };
  const stale = previous ? staleNodes(previous.definition, workflow) : new Set(graph.nodes.map((node) => node.id));
  const fresh = from ? reach(graph, from) : new Set(only ? [only] : []);
  const steps = [];
  for (const node of graph.nodes) {
    if (fresh.has(node.id) || stale.has(node.id) || !previous || nodeKind(node) === "start") continue;
    const record = latest(previous, node.id);
    if (record && ["done", "skipped"].includes(record.status)) steps.push({ ...record, epoch: 0, reused: true });
  }
  const problems = [];
  if (only) {
    const have = new Set(steps.map((record) => record.id));
    for (const edge of graph.forwardIn.get(only) ?? []) {
      if (!have.has(edge.from) && edge.from !== graph.start) problems.push(`${only} needs a fresh result from ${edge.from} first: run the workflow, or run from ${edge.from}`);
    }
  }
  return { steps, problems };
}

export function waitingAt(run) {
  const going = new Map();
  for (const record of run.steps) {
    if ((record.epoch ?? 0) !== epochOf(run, record.id)) continue;
    if (["running", "approval"].includes(record.status)) going.set(record.id, record.status);
    else going.delete(record.id);
  }
  return [...going.entries()].map(([id, status]) => ({ id, status }));
}

export function runSummary(run) {
  const going = FINAL.includes(run.status) ? [] : waitingAt(run);
  const gate = going.find((entry) => entry.status === "approval");
  return {
    id: run.id,
    workflow: run.workflow,
    number: run.number,
    title: run.definition?.title ?? run.workflow,
    status: run.status,
    step: gate?.id ?? going[0]?.id ?? null,
    steps: going.map((entry) => entry.id),
    space: run.space,
    runner: run.runner ?? null,
    created: run.created,
    ended: run.ended ?? null,
    error: run.error ?? null,
  };
}
