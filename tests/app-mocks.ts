import { mock } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";

type Handler = (...args: unknown[]) => void;

export class Node {
  key?: string;
  handlers: Record<string, Handler[]> = {};
  kids: Node[] = [];
  texts: string[] = [];
  calls: [string, unknown[]][] = [];
  id(value: string) {
    this.key = value;
    return this;
  }
  when(condition: unknown, branch: (el: Node) => Node) {
    return condition ? branch(this) : this;
  }
  child(value: unknown) {
    if (value instanceof Node) this.kids.push(value);
    else this.texts.push(String(value));
    return this;
  }
  children(values: unknown[]) {
    for (const value of values) this.child(value);
    return this;
  }
  listen(kind: string, handler: Handler) {
    (this.handlers[kind] ??= []).push(handler);
    return this;
  }
  on_click(handler: Handler) {
    return this.listen("click", handler);
  }
  on_mouse_down(button: string, handler: Handler) {
    return this.listen(`down:${button}`, handler);
  }
  on_mouse_up(button: string, handler: Handler) {
    return this.listen(`up:${button}`, handler);
  }
  on_mouse_down_out(handler: Handler) {
    return this.listen("down_out", handler);
  }
  on_mouse_move(handler: Handler) {
    return this.listen("move", handler);
  }
  on_hover(handler: Handler) {
    return this.listen("hover", handler);
  }
}

export const walk = (node: Node): Node[] => [node, ...node.kids.flatMap(walk)];

export function texts(node: Node): string[] {
  return [...node.texts, ...node.kids.flatMap(texts)];
}

export function find(node: Node, match: (node: Node) => boolean): Node | null {
  if (match(node)) return node;
  for (const kid of node.kids) {
    const found = find(kid, match);
    if (found) return found;
  }
  return null;
}

export function byKey(root: Node, key: string): Node {
  const node = find(root, (item) => item.key === key);
  if (!node) throw new Error(`no element ${key}`);
  return node;
}

export function own(node: Node | null | undefined, name: string): unknown[][] {
  return (node?.calls ?? []).filter(([call]) => call === name).map(([, args]) => args);
}

export function calls(node: Node | null | undefined, name: string): unknown[] {
  return own(node, name).map(([first]) => first);
}

export function svgs(node: Node): string[] {
  return walk(node).flatMap((item) => calls(item, "svg") as string[]);
}

export function click(node: Node, cx: unknown = {}) {
  for (const handler of node.handlers.click ?? []) handler({}, cx);
}

export async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

export function makeCx(extra: Record<string, unknown> = {}) {
  const cx: Record<string, any> = {
    notified: 0,
    spawned: 0,
    focused: 0,
    stopped: 0,
    clipboard: [] as string[],
    ticks: [] as Handler[],
    afters: [] as Handler[],
    timer: {
      every(_ms: number, work: Handler) {
        cx.ticks.push(work);
      },
      after(_ms: number, work: Handler) {
        cx.afters.push(work);
      },
    },
    spawn(work: (cx: unknown) => unknown) {
      cx.spawned += 1;
      return Promise.resolve().then(() => work(cx));
    },
    notify() {
      cx.notified += 1;
    },
    stop_propagation() {
      cx.stopped += 1;
    },
    focus_handle() {
      return {
        focus() {
          cx.focused += 1;
        },
      };
    },
    write_to_clipboard(text: string) {
      cx.clipboard.push(text);
    },
    sleep: async () => {},
  };
  return Object.assign(cx, extra);
}

export function make(): Node {
  return new Proxy(new Node(), {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      return (...args: unknown[]) => {
        target.calls.push([String(prop), args]);
        return receiver;
      };
    },
  });
}

function recorded(kind: string, path: string): Node {
  const node = make();
  node.calls.push([kind, [path]]);
  return node;
}

export const herdr: Record<string, (...args: never[]) => unknown> = {};

const HERDR = ["exec", "notify", "props", "updates", "spaces", "panes", "run", "openOverlay", "theme", "shared", "setShared", "watchFolder", "window", "nextCommand", "layout", "agents", "readTextFile", "home", "terminals", "focused", "appHome", "closeOverlay", "checking", "hc", "settings", "keys", "setAgentOrder"];

mock.module("gpui-kit", () => ({ View: class {}, div: make, svg: (path: string) => recorded("svg", path), image: (path: string) => recorded("image", path) }));
export class FakeInput {
  text: string;
  placeholder?: string;
  handlers: Record<string, Handler> = {};
  constructor(options?: { placeholder?: string; value?: string }) {
    this.placeholder = options?.placeholder;
    this.text = options?.value ?? "";
  }
  value() {
    return this.text;
  }
  set_value(next: string) {
    this.text = next;
  }
  set_selected_range(_range: { start: number; end: number }) {}
  masked = false;
  set_masked(masked: boolean) {
    this.masked = masked;
  }
  on(event: string, handler: Handler) {
    this.handlers[event] = handler;
    return true;
  }
  focus() {}
  emit(event: string, cx: unknown) {
    this.handlers[event]?.({}, cx);
  }
}

mock.module("gpui-base", () => ({
  v_flex: make,
  h_flex: make,
  TextView: { markdown: (_id: string, text: string) => make().child(text), html: (_id: string, text: string) => make().child(text) },
  InputState: { new: (options?: { placeholder?: string; value?: string }) => new FakeInput(options) },
  Input: { new: () => make() },
  ScrollHandle: { new: () => ({ shown: [] as number[], scroll_to_item(index: number) { this.shown.push(index); } }) },
  EditorState: { new: (options: Record<string, unknown>) => ({ options, released: false, release() { this.released = true; return true; } }) },
  Editor: { new: (state: { options: { value?: string } }) => make().child(state.options.value ?? "") },
}));
mock.module("herdr", () => Object.fromEntries(HERDR.map((name) => [name, (...args: never[]) => herdr[name]?.(...args)])));
mock.module("fs/promises", () => ({
  readFile: async (path: string, encoding?: unknown) => (encoding ? readFileSync(path, "utf8") : new Uint8Array(readFileSync(path))),
  writeFile: async (path: string, contents: string | Uint8Array) => writeFileSync(path, contents),
  readdir: async (path: string, options?: { withFileTypes?: boolean }) =>
    options?.withFileTypes ? readdirSync(path, { withFileTypes: true }).map((entry) => ({ name: entry.name, isDirectory: () => entry.isDirectory() })) : readdirSync(path),
  exists: async (path: string) => existsSync(path),
  unlink: async (path: string) => unlinkSync(path),
  rmdir: async (path: string) => rmdirSync(path),
  mkdir: async (path: string, options?: { recursive?: boolean }) => {
    mkdirSync(path, options);
  },
}));
