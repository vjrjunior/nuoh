import { herdr, type Node } from "./app-mocks";

export const app = {
  spaces: [] as Record<string, unknown>[],
  shared: {} as Record<string, unknown>,
  runs: [] as [string, unknown][],
  execs: [] as { args: string[]; cwd: unknown }[],
  agents: [] as { space: string; status: string }[],
  overlays: [] as Record<string, any>[],
  closed: [] as unknown[],
  props: null as Record<string, unknown> | null,
  sidebar: 268,
};

export function reset() {
  app.shared = {};
  app.runs = [];
  app.execs = [];
  app.agents = [];
  app.overlays = [];
  app.closed = [];
  app.props = null;
  app.sidebar = 268;
  Object.assign(herdr, {
    spaces: () => app.spaces,
    agents: () => app.agents,
    props: () => app.props,
    closeOverlay: (id: unknown) => {
      app.closed.push(id);
      return null;
    },
    panes: () => [],
    run: (name: string, args: unknown) => {
      app.runs.push([name, args]);
      return null;
    },
    openOverlay: (spec: Record<string, any>) => {
      app.overlays.push(spec);
      return "overlay";
    },
    exec: async (_command: string, args: string[], options: { cwd?: unknown }) => {
      app.execs.push({ args, cwd: options?.cwd });
      return { code: 0, stdout: "", stderr: "" };
    },
    theme: () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? "#505050" : undefined) }),
    shared: (key: string) => app.shared[key],
    setShared: (key: string, value: unknown) => {
      app.shared[key] = value;
      return null;
    },
    watchFolder: () => Object.assign(new Promise(() => {}), { cancel() {} }),
    window: () => ({ active: true }),
    nextCommand: () => new Promise(() => {}),
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: app.sidebar } }] }),
  });
}

export const { default: SpacesTree } = await import("../mods/spaces-tree/main.js");
export const { DRAG_GRACE } = await import("../mods/spaces-tree/tree.js");

export const common = "/r/app/.git";
export const cx = { timer: { every() {}, after() {} }, spawn() {}, notify() {}, focus_handle: () => ({ focus() {} }) };
export const space = (id: string, over = {}) => ({ id, index: 1, name: id, named: false, folder: "", machine: null, branch: null, active: false, status: null, tabs: [], ...over });

export function setup(checkouts = [{ path: "/r/app", branch: "main", main: true }, { path: "/w/app/one", branch: "one", main: false }]) {
  app.spaces = [space("m"), space("x", { active: true })];
  const view = new SpacesTree();
  view.init({}, cx);
  view.lastPlaces = { m: "/r/app", x: "/x" };
  view.looks = { "/r/app": { top: "/r/app", common }, "/x": null };
  view.repos = { [common]: { common, name: "app", checkouts, refs: {} } };
  return view;
}

export function pathTo(node: Node, key: string): Node[] | null {
  if (node.key === key) return [node];
  for (const kid of node.kids) {
    const path = pathTo(kid, key);
    if (path) return [node, ...path];
  }
  return null;
}

export function fire(path: Node[], kind: string) {
  let stopped = false;
  const context = {
    stop_propagation() {
      stopped = true;
    },
    notify() {},
  };
  for (const node of [...path].reverse()) {
    for (const handler of node.handlers[kind] ?? []) handler({}, context);
    if (stopped) return;
  }
}

export function click(view: { render(): Node }, key: string) {
  const path = pathTo(view.render(), key);
  if (!path) throw new Error(`no element ${key}`);
  fire(path, "down:left");
  fire(path, "up:left");
  fire(path, "click");
}

export function texts(node: Node): string[] {
  return [...node.texts, ...node.kids.flatMap(texts)];
}

export const BRANCH = "feat/enrollment-delete-charge-waiver";
export const onMain = [{ path: "/r/app", branch: "main", main: true }, { path: "/w/app/one", branch: "one", main: false }];
export const onBranch = [{ path: "/r/app", branch: BRANCH, main: true }, { path: "/w/app/one", branch: "one", main: false }];

export function style(node: Node, name: string): unknown[] | undefined {
  return node.calls.findLast(([called]) => called === name)?.[1];
}

export function find(node: Node, match: (node: Node) => boolean): Node | null {
  if (match(node)) return node;
  for (const kid of node.kids) {
    const found = find(kid, match);
    if (found) return found;
  }
  return null;
}

export function headOf(view: { render(): Node }): Node {
  return pathTo(view.render(), `head-${common}`)?.at(-1) as Node;
}
