export const OUTPUT_CAP = 16000;
export const RUN_FIELDS = ["id", "dir", "folder", "space", "workflow", "number"];
export const FINAL = ["done", "failed", "stopped"];

const ID = /^[a-z][a-z0-9_-]*$/i;
const FIELD = /^[a-z_][a-z0-9_]*$/i;
const NAME = /^[a-z0-9][a-z0-9_-]*$/i;
const TEMPLATE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const KINDS = ["agent", "continue", "run", "approve"];
const COMMON = ["id", "when", "goto", "max"];
const ALLOWED = {
  agent: [...COMMON, "agent", "task", "answer", "cwd", "timeout"],
  continue: [...COMMON, "continue", "task", "answer", "timeout"],
  run: [...COMMON, "run", "allowFail", "cwd", "timeout"],
  approve: [...COMMON, "approve", "show"],
};
const TOP = ["title", "about", "inputs", "steps"];
const INPUT_FIELDS = ["label", "required", "default"];
const OPERATORS = ["!=", ">=", "<=", "=", ">", "<"];
const RISKY = ["--dangerously-skip-permissions", "--yolo", "--dangerously-bypass-approvals-and-sandbox"];

export function isWorkflowName(name) {
  return typeof name === "string" && NAME.test(name);
}

export function stepKind(step) {
  return KINDS.find((kind) => step && Object.hasOwn(step, kind)) ?? null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isArgv(value) {
  return Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === "string" && part !== "");
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

function refProblem(ref, at, steps, inputs) {
  const [head, ...rest] = ref.split(".");
  if (rest.length !== 1) return `{{${ref}}} is not a known value`;
  const [field] = rest;
  if (head === "input") return Object.hasOwn(inputs, field) ? null : `{{${ref}}}: there is no input "${field}"`;
  if (head === "run") return RUN_FIELDS.includes(field) ? null : `{{${ref}}}: run has ${RUN_FIELDS.join(", ")}`;
  const index = steps.findIndex((step) => step?.id === head);
  if (index < 0) return `{{${ref}}}: there is no step "${head}"`;
  if (index >= at) return `{{${ref}}}: step "${head}" runs after this one`;
  const source = steps[index];
  const kind = stepKind(source);
  if (field === "output") return null;
  if (field === "exit") return kind === "run" ? null : `{{${ref}}}: only a run step has exit`;
  if (isObject(source.answer) && Object.hasOwn(source.answer, field)) return null;
  return `{{${ref}}}: step "${head}" answers no field "${field}"`;
}

export function checkWorkflow(value) {
  const problems = [];
  if (!isObject(value)) return ["the file must hold one JSON object"];
  for (const key of Object.keys(value)) if (!TOP.includes(key)) problems.push(`unknown field "${key}"`);
  if (value.title !== undefined && typeof value.title !== "string") problems.push("title must be text");
  if (value.about !== undefined && typeof value.about !== "string") problems.push("about must be text");
  const inputs = value.inputs ?? {};
  if (!isObject(inputs)) problems.push("inputs must be an object");
  else {
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
  }
  const steps = value.steps;
  if (!Array.isArray(steps) || steps.length === 0) return [...problems, "steps must be a list with at least one step"];
  const knownInputs = isObject(inputs) ? inputs : {};
  const seen = new Set();
  steps.forEach((step, index) => {
    const name = isObject(step) && typeof step.id === "string" ? `step "${step.id}"` : `step ${index + 1}`;
    if (!isObject(step)) {
      problems.push(`${name} must be an object`);
      return;
    }
    if (typeof step.id !== "string" || !ID.test(step.id)) problems.push(`${name}: id must start with a letter and use letters, digits, _ and -`);
    else if (["input", "run"].includes(step.id)) problems.push(`${name}: "${step.id}" is taken`);
    else if (seen.has(step.id)) problems.push(`${name}: another step has this id`);
    seen.add(step.id);
    const kinds = KINDS.filter((kind) => Object.hasOwn(step, kind));
    if (kinds.length !== 1) {
      problems.push(`${name}: give exactly one of ${KINDS.join(", ")}`);
      return;
    }
    const [kind] = kinds;
    for (const key of Object.keys(step)) if (!ALLOWED[kind].includes(key)) problems.push(`${name}: a ${kind} step has no field "${key}"`);
    const texts = [];
    if (kind === "agent" && !isArgv(step.agent)) problems.push(`${name}: agent must be a list like ["claude"]`);
    if (kind === "run" && !isArgv(step.run)) problems.push(`${name}: run must be a list like ["bun", "test"]`);
    if (kind === "run") texts.push(...(Array.isArray(step.run) ? step.run : []));
    if (kind === "continue") {
      const target = steps.findIndex((other) => other?.id === step.continue);
      if (target < 0) problems.push(`${name}: continue names no step "${step.continue}"`);
      else if (target >= index) problems.push(`${name}: continue must name an earlier step`);
      else if (!["agent", "continue"].includes(stepKind(steps[target]))) problems.push(`${name}: continue must name an agent step`);
    }
    if (kind === "agent" || kind === "continue") {
      if (typeof step.task !== "string" || step.task.trim() === "") problems.push(`${name}: task must be text`);
      else texts.push(step.task);
      if (step.answer !== undefined) {
        if (!isObject(step.answer) || Object.keys(step.answer).length === 0) problems.push(`${name}: answer must be an object of fields`);
        else
          for (const [field, spec] of Object.entries(step.answer)) {
            if (!FIELD.test(field) || ["output", "exit"].includes(field)) problems.push(`${name}: answer field "${field}" is not a usable name`);
            if (!parseType(spec)) problems.push(`${name}: answer field "${field}" must be text, number, boolean or a|b|c, with ? when optional`);
          }
      }
    }
    if (kind === "approve") {
      if (typeof step.approve !== "string" || step.approve.trim() === "") problems.push(`${name}: approve must be the question`);
      else texts.push(step.approve);
      if (step.show !== undefined) {
        if (typeof step.show !== "string") problems.push(`${name}: show must be text`);
        else texts.push(step.show);
      }
    }
    if (step.cwd !== undefined) {
      if (typeof step.cwd !== "string" || step.cwd === "") problems.push(`${name}: cwd must be text`);
      else texts.push(step.cwd);
    }
    if (step.timeout !== undefined && !(typeof step.timeout === "number" && step.timeout > 0)) problems.push(`${name}: timeout must be seconds above 0`);
    if (step.allowFail !== undefined && typeof step.allowFail !== "boolean") problems.push(`${name}: allowFail must be true or false`);
    for (const text of texts) for (const ref of templateRefs(text)) {
      const problem = refProblem(ref, index, steps, knownInputs);
      if (problem) problems.push(`${name}: ${problem}`);
    }
    if (step.when !== undefined) {
      if (typeof step.when !== "string") problems.push(`${name}: when must be text`);
      else
        try {
          for (const ref of expressionRefs(parseExpression(step.when))) {
            const problem = refProblem(ref, index, steps, knownInputs);
            if (problem) problems.push(`${name}: when: ${problem}`);
          }
        } catch (error) {
          problems.push(`${name}: when: ${error.message}`);
        }
    }
    if (step.goto !== undefined) {
      const target = steps.findIndex((other) => other?.id === step.goto);
      if (target < 0) problems.push(`${name}: goto names no step "${step.goto}"`);
      else if (target > index) problems.push(`${name}: goto must name this step or an earlier one`);
      if (!(Number.isInteger(step.max) && step.max >= 1)) problems.push(`${name}: goto needs max, how many times the step may run`);
    } else if (step.max !== undefined) problems.push(`${name}: max only goes with goto`);
  });
  return problems;
}

export function warnings(workflow) {
  return (workflow?.steps ?? []).flatMap((step) => {
    const flags = (step.agent ?? []).filter((part) => RISKY.includes(part));
    return flags.length ? [`step "${step.id}" runs its agent with ${flags.join(" ")}: it acts without asking`] : [];
  });
}

export function parseWorkflow(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, problems: [`not valid JSON: ${error.message}`] };
  }
  const problems = checkWorkflow(value);
  return problems.length ? { ok: false, problems } : { ok: true, workflow: value };
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

export function agentMessage({ title, step, index, total, task, file, answer }) {
  const lines = [`Workflow "${title}", step "${step}" (${index + 1} of ${total}).`, "", task.trim(), ""];
  if (answer) {
    lines.push(`When you finish, write your answer to ${file} as one JSON object with these fields: ${describeAnswer(answer).join("; ")}. Put nothing else in that file.`);
  } else {
    lines.push(`When you finish, write your answer to ${file}: what you did or found, in plain text or Markdown. The workflow reads only that file.`);
  }
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

export function timesRun(run, id) {
  return run.steps.filter((record) => record.id === id && record.status === "done" && !record.reused).length;
}

export function nextIndex(workflow, index, record) {
  const step = workflow.steps[index];
  if (record.status === "done" && step.goto) return workflow.steps.findIndex((other) => other.id === step.goto);
  return index + 1;
}

export function agentTerminal(run, workflow, id) {
  const step = workflow.steps.find((other) => other.id === id);
  if (!step) return null;
  if (step.continue) return agentTerminal(run, workflow, step.continue);
  return latest(run, id)?.terminal ?? null;
}

export function reuseBefore(previous, workflow, from) {
  const index = workflow.steps.findIndex((step) => step.id === from);
  if (index < 0) return null;
  const ids = new Set(workflow.steps.slice(0, index).map((step) => step.id));
  const kept = new Map();
  for (const record of previous.steps) {
    if (ids.has(record.id) && (record.status === "done" || record.status === "skipped")) kept.set(record.id, record);
  }
  return { index, steps: [...kept.values()].map((record) => ({ ...record, reused: true })) };
}

export function runSummary(run) {
  const current = run.at !== null && run.at !== undefined ? run.definition?.steps?.[run.at]?.id ?? null : null;
  return {
    id: run.id,
    workflow: run.workflow,
    number: run.number,
    title: run.definition?.title ?? run.workflow,
    status: run.status,
    step: current,
    space: run.space,
    runner: run.runner ?? null,
    created: run.created,
    ended: run.ended ?? null,
    error: run.error ?? null,
  };
}
