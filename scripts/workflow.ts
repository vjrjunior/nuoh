import { mkdirSync } from "node:fs";
import { runSummary, warnings } from "../lib/workflow.js";
import { runsDir, workflowsDir } from "./paths";
import { realIo } from "./workflow-io";
import { decide, type Dirs, executeRun, listWorkflows, loadRun, loadWorkflow, resumeRun, retryRun, type Run, startRun, summaries } from "./workflow-run";

const USAGE = `usage: workflow <command>
  ls [--json]                         the workflows and their problems
  paths                               the folders of workflows and runs, made if missing, as JSON
  check [name]                        validate one workflow, or all
  format                              how to write a workflow
  run <name> [--input key=value]... [--space <id>] [--from <step> | --only <step>] [--json]
  runs [name] [--json]                runs, newest first
  show <run>                          one run as JSON
  approve <run> [--node <step>]       let a run through the gate it waits at
  reject <run> [--node <step>]        stop a run at its gate
  stop <run>                          stop a run
  retry <run> [--from <step>] [--json]
  resume <run>                        start the runner again for a run that was cut off`;

export const FORMAT = `A workflow is one JSON file in ${workflowsDir()}/<name>.json, where <name> uses letters, digits, - and _.
It is a graph: steps (nodes) joined by connections (edges). A run starts at the start step and follows
the connections; a step runs once every step that connects into it is through, and steps that don't
wait on each other run at the same time (up to 4). It runs in a new tab of a Herdr space.

{
  "title": "Implement, review, fix",
  "about": "One line on what it does",
  "inputs": { "task": { "label": "Task", "required": true, "default": "" } },
  "nodes": [ ... ],
  "edges": [ { "from": "start", "to": "implement" }, ... ]
}

Steps. Every step has an "id" (a letter, then letters, digits, - and _), optionally "at": [x, y], its place
on the canvas, and exactly one of:

- "start": {}                  where the run begins; one per workflow. Its output is the inputs.
- "agent": ["claude"]          starts that program in a new pane and gives it "task".
                                Any argv works: ["codex"], ["claude", "--model", "opus"].
- "continue": "<step id>"      gives "task" to the agent an earlier agent step started, in the same conversation.
- "run": ["bun", "test"]       runs a command in the run's folder. It fails the run when it exits non-zero,
                                unless "allowFail": true.
- "approve": "Open the PR?"    waits until a person approves or rejects. "show" adds text under the question.
                                Rejecting stops the run.
- "condition": "{{review.blocking}} = 0"
                                decides yes or no. Its connections out carry "branch": "yes" or "no", and only
                                the matching ones go on. Operators: = != > >= < <= contains, "set" and "unset"
                                after a value, joined with and / or; a value alone is true unless empty, 0 or false.

A step whose connections in all lead nowhere (a condition chose the other branch) is skipped, and so are
the steps after it that have nothing else to wait for.

Agent and continue steps:
- "task" is the message. The answers of the agent and command steps that connect into it are added under
  it, and a last line asks the agent to write its answer to a file; the answer becomes the step's output.
- "answer": { "blocking": "number", "summary": "text", "level": "low|high", "note": "text?" } asks for
  one JSON object with those fields instead. Types: text, number, boolean, or options a|b|c; ? makes a field optional.
  An answer that is missing or invalid gets one more request, then the step fails.
- "cwd" (agent only) and "timeout" (seconds) are optional.

Templates, in task, approve, show, cwd, condition and the run argv, can use the steps before:
- {{input.task}}               an input of the run
- {{<step>.output}}             a step's answer text, a command's output, a condition's yes or no
- {{<step>.exit}}               a command's exit code
- {{<step>.<field>}}            a field of a step's typed answer
- {{run.id}} {{run.dir}} {{run.folder}} {{run.space}} {{run.workflow}} {{run.number}}
A skipped step gives empty values.

Loops. A connection that goes back to an earlier step (or to the same one) is a loop and needs "max", how many
times the run may go back that way: { "from": "fix", "to": "test", "max": 3 }. Going back runs the steps from
there again. Needing it once more fails the run.

Example: implement, test, review, fix until the review passes, then ask before the PR.

{
  "title": "Implement, review, fix",
  "inputs": { "task": { "label": "Task", "required": true } },
  "nodes": [
    { "id": "start", "start": {} },
    { "id": "implement", "agent": ["claude"], "task": "{{input.task}}" },
    { "id": "test", "run": ["bun", "test"], "allowFail": true },
    { "id": "review", "agent": ["codex"], "task": "Review the uncommitted diff.",
      "answer": { "blocking": "number", "summary": "text" } },
    { "id": "clean", "condition": "{{review.blocking}} = 0" },
    { "id": "fix", "continue": "implement", "task": "Fix what the review found:\\n{{review.summary}}" },
    { "id": "ship", "approve": "Open the PR?", "show": "{{review.summary}}" },
    { "id": "pr", "continue": "implement", "task": "Open a PR for this work." }
  ],
  "edges": [
    { "from": "start", "to": "implement" },
    { "from": "implement", "to": "test" },
    { "from": "test", "to": "review" },
    { "from": "review", "to": "clean" },
    { "from": "clean", "to": "ship", "branch": "yes" },
    { "from": "clean", "to": "fix", "branch": "no" },
    { "from": "fix", "to": "test", "max": 3 },
    { "from": "ship", "to": "pr" }
  ]
}

Run from a step with: workflow run <name> --from <step> (the steps before keep their last results unless they
changed), or one step alone with --only <step>.
After writing a file, run: workflow check <name>
A workflow is code its owner chooses to run: the agents get the argv as written, with no permission flags added.`;

type Parsed = { positional: string[]; inputs: Record<string, string>; space?: string; from?: string; only?: string; node?: string; runs?: string; json: boolean };

function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = { positional: [], inputs: {}, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => {
      const next = args[index + 1];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === "--json") parsed.json = true;
    else if (arg === "--space") parsed.space = value();
    else if (arg === "--from") parsed.from = value();
    else if (arg === "--only") parsed.only = value();
    else if (arg === "--node") parsed.node = value();
    else if (arg === "--runs") parsed.runs = value();
    else if (arg === "--input") {
      const pair = value();
      const equals = pair.indexOf("=");
      if (equals < 1) throw new Error(`--input takes key=value, not ${pair}`);
      parsed.inputs[pair.slice(0, equals)] = pair.slice(equals + 1);
    } else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else parsed.positional.push(arg);
  }
  return parsed;
}

function when(ms: number | null | undefined): string {
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function started(run: Run, json: boolean): string {
  return json ? JSON.stringify(runSummary(run)) : `started ${run.id} in a new tab of space ${run.space}`;
}

function need(value: string | undefined, what: string): string {
  if (!value) throw new Error(`give the ${what}`);
  return value;
}

export async function main(args: string[], dirs: Dirs): Promise<number> {
  const [command, ...rest] = args;
  const parsed = parseArgs(rest);
  const [first] = parsed.positional;
  const io = realIo();
  switch (command) {
    case "ls": {
      const workflows = listWorkflows(dirs);
      if (parsed.json) console.log(JSON.stringify(workflows));
      else if (workflows.length === 0) console.log(`no workflows in ${dirs.workflows}`);
      else for (const item of workflows) console.log(item.problems.length ? `${item.name}  invalid: ${item.problems[0]}` : `${item.name}  ${item.title} · ${item.workflow.nodes.length} steps`);
      return 0;
    }
    case "check": {
      const names = first ? [first] : listWorkflows(dirs).map((item) => item.name);
      if (names.length === 0) console.log(`no workflows in ${dirs.workflows}`);
      let bad = 0;
      for (const name of names) {
        const loaded: any = loadWorkflow(dirs, name);
        if (!loaded.ok) {
          bad += 1;
          for (const problem of loaded.problems) console.log(`${name}: ${problem}`);
          continue;
        }
        console.log(`${name}: ok`);
        for (const warning of warnings(loaded.workflow)) console.log(`${name}: warning: ${warning}`);
      }
      return bad ? 1 : 0;
    }
    case "format":
      console.log(FORMAT);
      return 0;
    case "paths":
      mkdirSync(dirs.workflows, { recursive: true });
      mkdirSync(dirs.runs, { recursive: true });
      console.log(JSON.stringify({ workflows: dirs.workflows, runs: dirs.runs, script: import.meta.path }));
      return 0;
    case "run":
      console.log(started(await startRun(io, dirs, need(first, "workflow's name"), parsed.inputs, { space: parsed.space, from: parsed.from, only: parsed.only }), parsed.json));
      return 0;
    case "runs": {
      const list = await summaries(io, dirs, first);
      if (parsed.json) console.log(JSON.stringify(list));
      else if (list.length === 0) console.log("no runs");
      else for (const run of list) console.log(`${run.id}  ${run.status}${run.step ? ` at ${run.step}` : ""}  ${when(run.created)}${run.error ? `  ${run.error.split("\n")[0]}` : ""}`);
      return 0;
    }
    case "show":
      console.log(JSON.stringify(loadRun(dirs, need(first, "run id")), null, 2));
      return 0;
    case "approve":
    case "reject":
    case "stop":
      decide(dirs, need(first, "run id"), command, Date.now(), parsed.node);
      console.log(`${command} sent to ${first}`);
      return 0;
    case "retry":
      console.log(started(await retryRun(io, dirs, need(first, "run id"), parsed.from), parsed.json));
      return 0;
    case "resume":
      await resumeRun(io, dirs, need(first, "run id"));
      console.log(`resumed ${first}`);
      return 0;
    case "exec":
      await executeRun(io, { ...dirs, runs: parsed.runs ?? dirs.runs }, need(first, "run id"));
      return 0;
    default:
      console.log(USAGE);
      return command === undefined || command === "help" || command === "--help" ? 0 : 1;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2), { workflows: workflowsDir(), runs: runsDir() })
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`workflow: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
