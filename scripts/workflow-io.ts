import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Io, Space, Status, Terminal } from "./workflow-run";

export const WAIT_SECONDS = 10;

async function capture(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const child = Bun.spawn(argv, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { code, stdout, stderr };
  } catch (error) {
    return { code: 127, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
}

function parse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function failure(name: string, result: { stdout: string; stderr: string }): Error {
  const parsed = parse(result.stdout);
  const message = parsed?.error?.message ?? parsed?.error ?? (result.stderr.trim() || result.stdout.trim());
  return new Error(`${name}: ${typeof message === "string" && message ? message : "failed"}`);
}

async function tee(stream: ReadableStream<Uint8Array>, sink: string[]): Promise<void> {
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    sink.push(text);
    process.stdout.write(text);
  }
}

export function realIo(): Io {
  const lines: string[] = [];
  let reading = false;
  const listen = () => {
    if (reading) return;
    reading = true;
    createInterface({ input: process.stdin }).on("line", (line) => lines.push(line));
  };
  return {
    now: () => Date.now(),
    sleep: (ms) => Bun.sleep(ms),
    print: (text) => console.log(text),
    report(status: Status) {
      process.stdout.write(`\x1b]7501;state=${status}:app=workflow\x07`);
    },
    async get(address): Promise<Terminal | null> {
      const result = await capture(["hc", "get", address, "--json"]);
      const info = result.code === 0 ? parse(result.stdout) : null;
      if (!info) return null;
      return {
        address: info.address,
        state: info.state,
        turn: info.turn ?? 0,
        reported: Boolean(info.reported),
        status: info.status?.state ?? null,
        labels: info.labels ?? {},
        argv: info.argv ?? [],
      };
    },
    async start({ argv, cwd, labels, child }) {
      const flags = child ? ["--outlive-parent", "--no-notify"] : ["--no-parent"];
      const labelArgs = Object.entries(labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
      const result = await capture(["hc", "run", "--bg", "--json", "--cwd", cwd, ...flags, ...labelArgs, "--", ...argv]);
      const address = result.code === 0 ? parse(result.stdout)?.address : null;
      if (!address) throw failure(`could not start ${argv.join(" ")}`, result);
      return address;
    },
    async send(address, text) {
      const result = await capture(["hc", "send", "--json", "--", address, text]);
      if (result.code !== 0) throw failure(`could not send to ${address}`, result);
    },
    async waitTurn(address) {
      await capture(["hc", "wait", address, "--json", "--timeout", String(WAIT_SECONDS)]);
    },
    async waitChildren(address) {
      const result = await capture(["hc", "wait", address, "--children", "all", "--json", "--timeout", String(WAIT_SECONDS)]);
      return result.code === 0 && parse(result.stdout)?.ended === true;
    },
    async screen(address, count) {
      const result = await capture(["hc", "read", address, "--json", "--lines", String(count)]);
      const text: string = (result.code === 0 ? parse(result.stdout)?.text : null) ?? "";
      return text.split("\n").slice(-count).join("\n");
    },
    async spawn(argv, cwd, timeoutMs) {
      const sink: string[] = [];
      try {
        const child = Bun.spawn(argv, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
        const timer = timeoutMs ? setTimeout(() => child.kill(), timeoutMs) : null;
        await Promise.all([tee(child.stdout, sink), tee(child.stderr, sink)]);
        const exit = await child.exited;
        if (timer) clearTimeout(timer);
        return { exit, output: sink.join("") };
      } catch (error) {
        return { exit: 127, output: `${sink.join("")}${error instanceof Error ? error.message : String(error)}\n` };
      }
    },
    async act(name, args) {
      const result = await capture(["herdr-app", "do", name, JSON.stringify(args)]);
      if (result.code !== 0) throw failure(`herdr-app do ${name}`, result);
      return parse(result.stdout);
    },
    async spaces(): Promise<Space[]> {
      const result = await capture(["herdr-app", "ls"]);
      const spaces = result.code === 0 ? parse(result.stdout)?.spaces : null;
      if (!Array.isArray(spaces)) throw failure("herdr-app ls", result);
      return spaces.map((space: any) => ({ id: space.id, name: space.name, folder: space.folder, machine: space.machine ?? null }));
    },
    input() {
      listen();
      return lines.shift() ?? null;
    },
    async enter() {
      if (!process.stdin.isTTY) return;
      listen();
      lines.length = 0;
      while (lines.length === 0) await Bun.sleep(200);
    },
    self: () => process.env.HC_TERMINAL_ID || null,
    runner: (id, runs) => [process.execPath, join(import.meta.dir, "workflow.ts"), "exec", id, "--runs", runs],
  };
}
