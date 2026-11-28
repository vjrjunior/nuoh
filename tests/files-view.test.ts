import { beforeEach, describe, expect, test } from "bun:test";
import { byKey, calls, flush, herdr, makeCx, type Node, texts, walk } from "./app-mocks";

const { default: Files } = await import("../mods/files/main.js");

const ROOT = "/Users/me/w/app";
const OTHER = "/Users/me/w/other";

let folders: Record<string, [string, boolean][]>;
let gitState: string;
let allFiles: string[];
let files: Record<string, string>;
let execs: [string, string[], Record<string, unknown> | undefined][];
let ran: [string, unknown][];
let overlays: Record<string, any>[];
let closed: string[];
let watches: { dir: string; resolve: (paths: string[]) => void }[];
let cwd: string;
let machine: string | null;
let shared: Record<string, unknown>;

const entries = (list: [string, boolean][]) => list.map(([name, dir]) => `${dir ? "d" : "f"}\0${name}\0`).join("");

beforeEach(() => {
  folders = {
    [ROOT]: [["src", true], ["node_modules", true], ["README.md", false], ["logo.png", false], ["notes.txt", false]],
    [`${ROOT}/src`]: [["a.ts", false], ["b.ts", false]],
    [OTHER]: [["other.md", false]],
  };
  gitState = [ROOT, " M src/a.ts", "?? notes.txt", ":ignored:", "node_modules/", ""].join("\0");
  allFiles = ["README.md", "notes.txt", "src/a.ts", "src/b.ts", "docs/plan.md"];
  files = { [`${ROOT}/notes.txt`]: "hello", [`${ROOT}/src/a.ts`]: "const a = 1;" };
  execs = [];
  ran = [];
  overlays = [];
  closed = [];
  watches = [];
  cwd = `${ROOT}/src`;
  machine = null;
  shared = {};
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `t.${prop}` : undefined) }),
    home: () => "/Users/me",
    settings: () => ({ font_family: "Mono" }),
    checking: () => false,
    props: () => undefined,
    focused: () => ({ tab: "t1", pane: "p1", terminal: "t7", cwd }),
    panes: () => [{ pane: "p1", tab: "t1", terminal: "t7", cwd }],
    spaces: () => [{ id: "s1", active: true, machine, folder: ROOT }],
    exec: async (command: string, args: string[], options?: Record<string, unknown>) => {
      execs.push([command, args, options]);
      if (command === "git") return { code: 0, stdout: `${String(options?.cwd).startsWith(OTHER) ? OTHER : ROOT}\n`, stderr: "" };
      if (command !== "sh") return { code: 0, stdout: "", stderr: "" };
      const script = args[1];
      if (script.includes("status --porcelain")) return { code: 0, stdout: options?.cwd === ROOT ? gitState : "", stderr: "" };
      if (script.includes("ls-files --cached --others --exclude-standard;")) return { code: 0, stdout: `${options?.cwd}\n${allFiles.join("\n")}\n`, stderr: "" };
      const folder = args[3];
      if (!(folder in folders)) return { code: 1, stdout: "", stderr: "" };
      return { code: 0, stdout: entries(folders[folder]), stderr: "" };
    },
    readTextFile: async (path: string) => (path in files ? files[path] : null),
    watchFolder: (dir: string) => Object.assign(new Promise((resolve) => watches.push({ dir, resolve })), { cancel() {} }),
    run: (name: string, args?: unknown) => ran.push([name, args]),
    openOverlay: (spec: Record<string, any>) => {
      overlays.push(spec);
      return "o1";
    },
    closeOverlay: (id: string) => closed.push(id),
    setShared: (key: string, value: unknown) => {
      shared[key] = value;
    },
  });
});

async function open() {
  const cx = makeCx();
  const view = new Files();
  view.init({}, cx);
  view.render(cx);
  await flush();
  return { view, cx, shown: () => texts(view.render(cx)) };
}

const node = (view: { render(cx: unknown): Node }, cx: unknown, key: string) => byKey(view.render(cx), key);

function fire(view: { render(cx: unknown): Node }, cx: unknown, key: string, kind = "click") {
  for (const handler of node(view, cx, key).handlers[kind] ?? []) handler({}, cx);
}

const icons = (item: Node) => walk(item).flatMap((n) => calls(n, "image"));
const iconNode = (item: Node) => walk(item).find((n) => n.calls.some(([c]) => c === "image")) as Node;
const colorOf = (item: Node) => walk(item).flatMap((n) => calls(n, "text_color"));

describe("the tree", () => {
  test("it shows the focused pane's repository, folders first", async () => {
    const { shown } = await open();
    const list = shown();
    expect(list).toContain("app");
    expect(list).toContain("~/w");
    expect(list.indexOf("src")).toBeLessThan(list.indexOf("README.md"));
  });

  test("a folder opens on a click and closes on another", async () => {
    const { view, cx, shown } = await open();
    fire(view, cx, "file-src");
    await flush();
    expect(shown()).toContain("a.ts");
    fire(view, cx, "file-src");
    expect(shown()).not.toContain("a.ts");
  });

  test("a changed file shows its letter in the change's color, its folder the same color, an ignored folder is dim", async () => {
    const { view, cx } = await open();
    fire(view, cx, "file-src");
    await flush();
    const changed = node(view, cx, "file-src/a.ts");
    expect(texts(changed)).toContain("M");
    expect(colorOf(changed)).toContain("t.ansi3");
    expect(colorOf(node(view, cx, "file-src"))).toContain("t.ansi3");
    expect(texts(node(view, cx, "file-notes.txt"))).toContain("A");
    expect(colorOf(node(view, cx, "file-node_modules"))).toContain("t.dim");
  });

  test("each row shows its type's icon in its own colors, and an open folder its open icon", async () => {
    const { view, cx } = await open();
    expect(icons(node(view, cx, "file-README.md"))).toEqual(["mods/files/icons/readme.svg"]);
    expect(icons(node(view, cx, "file-src"))).toEqual(["mods/files/icons/folder-src.svg"]);
    fire(view, cx, "file-src");
    await flush();
    expect(icons(node(view, cx, "file-src"))).toEqual(["mods/files/icons/folder-src-open.svg"]);
    expect(icons(node(view, cx, "file-src/a.ts"))).toEqual(["mods/files/icons/typescript.svg"]);
    expect(iconNode(node(view, cx, "file-src/a.ts")).calls.map(([name]) => name)).not.toContain("text_color");
  });

  test("an ignored row's icon is faded", async () => {
    const { view, cx } = await open();
    expect(iconNode(node(view, cx, "file-node_modules")).calls).toContainEqual(["opacity", [0.5]]);
    expect(iconNode(node(view, cx, "file-README.md")).calls).not.toContainEqual(["opacity", [0.5]]);
  });

  test("a light appearance uses the light icons", async () => {
    herdr.settings = () => ({ font_family: "Mono", dark: false });
    folders[ROOT].push(["bun.lock", false]);
    const { view, cx } = await open();
    expect(icons(node(view, cx, "file-bun.lock"))).toEqual(["mods/files/icons/bun_light.svg"]);
    herdr.settings = () => ({ font_family: "Mono", dark: true });
    expect(icons(node(view, cx, "file-bun.lock"))).toEqual(["mods/files/icons/bun.svg"]);
  });

  test("each row can be dragged into a terminal as its full path", async () => {
    const { view, cx } = await open();
    expect(node(view, cx, "file-README.md").calls).toContainEqual(["drag_paths", [[`${ROOT}/README.md`]]]);
  });

  test("a change in the repository lists it again", async () => {
    const { view, cx, shown } = await open();
    expect(watches.map((watch) => watch.dir)).toEqual([ROOT]);
    folders[ROOT].push(["new.txt", false]);
    watches[0].resolve([`${ROOT}/new.txt`]);
    await flush();
    expect(shown()).toContain("new.txt");
    expect(node(view, cx, "file-new.txt")).toBeDefined();
  });

  test("collapse all closes every folder", async () => {
    const { view, cx, shown } = await open();
    fire(view, cx, "file-src");
    await flush();
    fire(view, cx, "files-collapse");
    expect(shown()).not.toContain("a.ts");
  });

  test("moving to another repository shows it, and coming back opens the same folders", async () => {
    const { view, cx, shown } = await open();
    fire(view, cx, "file-src");
    await flush();
    cwd = OTHER;
    view.render(cx);
    await flush();
    expect(shown()).toContain("other.md");
    cwd = `${ROOT}/src`;
    view.render(cx);
    await flush();
    expect(shown()).toContain("a.ts");
  });

  test("a space on another machine says Files can't show it", async () => {
    machine = "vps";
    const { shown } = await open();
    expect(shown()).toContain("Files on vps isn't supported yet");
  });
});

describe("opening a file", () => {
  test("a Markdown file opens in the viewer beside the focused pane", async () => {
    const { view, cx } = await open();
    fire(view, cx, "file-README.md");
    expect(ran).toEqual([["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: `${ROOT}/README.md` } }]]);
  });

  test("a picture opens in its own app", async () => {
    const { view, cx } = await open();
    fire(view, cx, "file-logo.png");
    expect(execs.at(-1)?.slice(0, 2)).toEqual(["open", [`${ROOT}/logo.png`]]);
  });

  test("a text file shows in the panel, and Back returns to the tree", async () => {
    const { view, cx, shown } = await open();
    fire(view, cx, "file-notes.txt");
    await flush();
    expect(shown()).toContain("hello");
    expect(view.preview.state.options).toMatchObject({ language: "txt", readonly: true, font_family: "Mono" });
    expect(icons(node(view, cx, "files-head"))).toEqual(["mods/files/icons/document.svg"]);
    fire(view, cx, "files-back");
    expect(shown()).toContain("README.md");
    expect(shown()).not.toContain("hello");
  });

  test("a file that is gone says so and offers its app", async () => {
    const { view, cx, shown } = await open();
    delete files[`${ROOT}/notes.txt`];
    fire(view, cx, "file-notes.txt");
    await flush();
    expect(shown()).toContain("This file is gone");
    expect(shown()).toContain("Open with default app");
  });
});

describe("the filter", () => {
  test("typing lists the repository's files by name, and Enter opens the first", async () => {
    const { view, cx, shown } = await open();
    view.input.set_value("plan");
    view.input.emit("change", cx);
    await flush();
    expect(shown()).toContain("plan.md");
    expect(shown()).toContain("docs");
    view.input.emit("submit", cx);
    expect(ran.at(-1)).toEqual(["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: `${ROOT}/docs/plan.md` } }]);
  });

  test("arrows move through the results and Escape clears the filter", async () => {
    const { view, cx, shown } = await open();
    view.input.set_value("ts");
    view.input.emit("change", cx);
    await flush();
    const press = view.render(cx).calls.find(([name]) => name === "on_key_down")?.[1][0] as (event: { key: string }, cx: unknown) => void;
    press({ key: "down" }, cx);
    expect(view.at).toBe(1);
    expect(view.scroll.shown).toEqual([1]);
    press({ key: "escape" }, cx);
    expect(view.query).toBe("");
    expect(shown()).toContain("README.md");
  });

  test("each result shows its type's icon", async () => {
    const { view, cx } = await open();
    view.input.set_value("plan");
    view.input.emit("change", cx);
    await flush();
    expect(icons(node(view, cx, "match-docs/plan.md"))).toEqual(["mods/files/icons/markdown.svg"]);
  });

  test("nothing matching says so", async () => {
    const { view, cx, shown } = await open();
    view.input.set_value("zzz");
    view.input.emit("change", cx);
    await flush();
    expect(shown()).toContain("No file names match");
  });
});

describe("changed only", () => {
  test("the header's button lists only the changed files, and again shows them all", async () => {
    const { view, cx, shown } = await open();
    fire(view, cx, "files-changed");
    expect(shown()).toEqual(expect.arrayContaining(["src", "a.ts", "notes.txt"]));
    expect(shown()).not.toContain("README.md");
    fire(view, cx, "files-changed");
    expect(shown()).toContain("README.md");
  });
});

describe("the row menu", () => {
  test("a right-click opens the menu as a popup sized to its items", async () => {
    const { view, cx } = await open();
    fire(view, cx, "file-README.md", "down:right");
    expect(overlays).toEqual([
      { mod: "files", kind: "popup", width: 240, height: 5 * 2 + 26 + 5 * 30, props: { role: "menu", path: `${ROOT}/README.md`, relative: "README.md", dir: false, open: false, pane: "p1" } },
    ]);
  });

  test("the click that ends a right-click opens nothing, and a later click opens the file", async () => {
    const { view, cx } = await open();
    fire(view, cx, "file-README.md", "down:right");
    fire(view, cx, "file-README.md");
    expect(overlays).toHaveLength(1);
    expect(ran).toEqual([]);
    expect(view.selected).toBeNull();
    fire(view, cx, "file-README.md");
    expect(ran).toEqual([["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: `${ROOT}/README.md` } }]]);
  });

  test("a right-click on a filter result opens its menu without opening it", async () => {
    const { view, cx } = await open();
    view.input.set_value("plan");
    view.input.emit("change", cx);
    await flush();
    fire(view, cx, "match-docs/plan.md", "down:right");
    fire(view, cx, "match-docs/plan.md");
    expect(overlays[0]?.props).toMatchObject({ role: "menu", relative: "docs/plan.md" });
    expect(ran).toEqual([]);
  });

  async function menu(props: Record<string, unknown>) {
    const cx = makeCx();
    const view = new Files();
    view.init({ overlay: "o9", role: "menu", pane: "p1", ...props }, cx);
    return { view, cx };
  }

  test("the menu reads its role from props() when init gets only the overlay", async () => {
    herdr.props = () => ({ overlay: "o9", role: "menu", path: `${ROOT}/README.md`, relative: "README.md", dir: false, pane: "p1" });
    const cx = makeCx();
    const view = new Files();
    view.init({ overlay: "o9" }, cx);
    const shown = texts(view.render(cx));
    expect(shown).toEqual(expect.arrayContaining(["README.md", "Open beside", "Copy path", "Copy relative path"]));
    expect(shown).not.toContain("feat-files-and-markdown");
    fire(view, cx, "files-menu-copy");
    expect(cx.clipboard).toEqual([`${ROOT}/README.md`]);
  });

  test("the menu's title shows the row's icon, open for an open folder", async () => {
    const file = await menu({ path: `${ROOT}/src/a.ts`, relative: "src/a.ts", dir: false });
    expect(icons(file.view.render(file.cx))).toEqual(["mods/files/icons/typescript.svg"]);
    const folder = await menu({ path: `${ROOT}/src`, relative: "src", dir: true, open: true });
    expect(icons(folder.view.render(folder.cx))).toEqual(["mods/files/icons/folder-src-open.svg"]);
  });

  test("Copy path and Copy relative path write the clipboard and close", async () => {
    const { view, cx } = await menu({ path: `${ROOT}/src/a.ts`, relative: "src/a.ts", dir: false });
    fire(view, cx, "files-menu-copy");
    fire(view, cx, "files-menu-copy-relative");
    expect(cx.clipboard).toEqual([`${ROOT}/src/a.ts`, "src/a.ts"]);
    expect(closed).toEqual(["o9", "o9"]);
  });

  test("Reveal in Finder and the default app run open", async () => {
    const { view, cx } = await menu({ path: `${ROOT}/src/a.ts`, relative: "src/a.ts", dir: false });
    fire(view, cx, "files-menu-reveal");
    fire(view, cx, "files-menu-editor");
    expect(execs.map(([command, args]) => [command, args])).toEqual([
      ["open", ["-R", `${ROOT}/src/a.ts`]],
      ["open", [`${ROOT}/src/a.ts`]],
    ]);
  });

  test("a folder starts a terminal there, and a Markdown file opens beside", async () => {
    const folder = await menu({ path: `${ROOT}/src`, relative: "src", dir: true });
    fire(folder.view, folder.cx, "files-menu-terminal");
    const markdown = await menu({ path: `${ROOT}/README.md`, relative: "README.md", dir: false });
    fire(markdown.view, markdown.cx, "files-menu-open");
    expect(ran).toEqual([
      ["terminal.open", { folder: `${ROOT}/src`, place: "tab" }],
      ["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: `${ROOT}/README.md` } }],
    ]);
  });

  test("arrows and Enter pick an item, Escape closes", async () => {
    const { view, cx } = await menu({ path: `${ROOT}/src/a.ts`, relative: "src/a.ts", dir: false });
    const press = view.render(cx).calls.find(([name]) => name === "on_key_down")?.[1][0] as (event: { key: string }, cx: unknown) => void;
    press({ key: "down" }, cx);
    press({ key: "down" }, cx);
    press({ key: "enter" }, cx);
    expect(cx.clipboard).toEqual([`${ROOT}/src/a.ts`]);
    press({ key: "escape" }, cx);
    expect(closed).toEqual(["o9", "o9"]);
  });
});
