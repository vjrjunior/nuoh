import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { byKey, click, find, flush, herdr, makeCx, type Node, svgs, texts } from "./app-mocks";

const { default: Markdown } = await import("../mods/markdown/main.js");
const { handleLink } = await import("../mods/markdown/link.js");

const HOME = "/Users/me";
const DIR = "/Users/me/w/app/abc-1234";
const FILE = `${DIR}/NOTES.md`;

let files: Record<string, string>;
let reads: string[];
let execs: [string, string[]][];
let watches: { dir: string; resolve: (paths: string[]) => void }[];
let given: Record<string, unknown>;
let slow: ((value: string | null) => void)[] | null;
let commands: ((command: string) => void)[];
let sharedState: Record<string, unknown>;

const originalTheme = herdr.theme;

afterEach(() => {
  herdr.theme = originalTheme;
});

beforeEach(() => {
  files = { [FILE]: "# Draft autosave\n\nBody text" };
  reads = [];
  execs = [];
  watches = [];
  given = { file: FILE };
  slow = null;
  commands = [];
  sharedState = {};
  Object.assign(herdr, {
    nextCommand: () => new Promise((resolve) => commands.push(resolve)),
    shared: (key: string) => sharedState[key],
    props: () => given,
    home: () => HOME,
    theme: () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? "#505050" : undefined) }),
    readTextFile: (path: string) => {
      reads.push(path);
      if (slow) return new Promise((resolve) => slow?.push(resolve));
      return Promise.resolve(path in files ? files[path] : null);
    },
    watchFolder: (dir: string) => Object.assign(new Promise((resolve) => watches.push({ dir, resolve })), { cancel() {} }),
    exec: async (command: string, args: string[]) => {
      execs.push([command, args]);
      return { code: 0, stdout: "", stderr: "" };
    },
  });
});

async function open(props: Record<string, unknown> = given, full: Record<string, unknown> = props) {
  given = full;
  const cx = makeCx();
  const view = new Markdown();
  view.init(props, cx);
  await flush();
  return { view, cx };
}

function linkHandler(view: { render(): Node }) {
  const node = find(view.render(), (item) => item.calls.some(([name]) => name === "on_link_click"));
  return node?.calls.find(([name]) => name === "on_link_click")?.[1][0] as (url: string, cx: unknown) => void;
}

describe("reading", () => {
  test("the pane shows the file, its name and its folder from home", async () => {
    const { view } = await open();
    const shown = texts(view.render());
    expect(shown).toContain("# Draft autosave\n\nBody text");
    expect(shown).toContain("NOTES.md");
    expect(shown).toContain("~/w/app/abc-1234");
  });

  test("the text view scrolls and its text can be selected", async () => {
    const { view } = await open();
    const node = find(view.render(), (item) => item.texts.includes("# Draft autosave\n\nBody text")) as Node;
    expect(node.calls).toContainEqual(["scrollable", [true]]);
    expect(node.calls).toContainEqual(["selectable", [true]]);
  });

  test("front matter is hidden", async () => {
    files[FILE] = "---\ntitle: x\n---\n# Plan";
    const { view } = await open();
    expect(texts(view.render())).toContain("# Plan");
    expect(texts(view.render()).join("\n")).not.toContain("title: x");
  });

  test("a missing file says so and comes back when it appears", async () => {
    delete files[FILE];
    const { view } = await open();
    expect(texts(view.render())).toContain("NOTES.md is gone");
    files[FILE] = "# Back";
    watches.at(-1)?.resolve([DIR]);
    await flush();
    expect(texts(view.render())).toContain("# Back");
  });

  test("without a file the pane says there is nothing to show", async () => {
    const { view } = await open({});
    expect(texts(view.render())).toContain("No file to show");
    expect(reads).toEqual([]);
  });
});

describe("watching", () => {
  test("the folder of the file is watched", async () => {
    await open();
    expect(watches.map((watch) => watch.dir)).toEqual([DIR]);
  });

  test("a change to the file reads it again", async () => {
    const { view } = await open();
    files[FILE] = "# Changed";
    watches.at(-1)?.resolve([FILE]);
    await flush();
    expect(texts(view.render())).toContain("# Changed");
    expect(watches).toHaveLength(2);
  });

  test("a change to another file does not read it again", async () => {
    await open();
    watches.at(-1)?.resolve([`${DIR}/other.ts`]);
    await flush();
    expect(reads).toEqual([FILE]);
  });

  test("only the newest read is shown", async () => {
    slow = [];
    const { view, cx } = await open();
    click(byKey(view.render(), "md-reload"), cx);
    await flush();
    const [first, second] = slow;
    second?.("# Second");
    first?.("# First");
    await flush();
    expect(texts(view.render())).toContain("# Second");
    expect(texts(view.render())).not.toContain("# First");
  });
});

describe("watching, after review", () => {
  test("a failed watch starts again on reload", async () => {
    let fail = true;
    herdr.watchFolder = ((dir: string) => {
      if (fail) {
        fail = false;
        return Object.assign(Promise.reject(new Error("too many folders")), { cancel() {} });
      }
      return Object.assign(new Promise((resolve) => watches.push({ dir, resolve })), { cancel() {} });
    }) as never;
    const { view, cx } = await open();
    expect(watches).toEqual([]);
    click(byKey(view.render(), "md-reload"), cx);
    await flush();
    expect(watches.map((watch) => watch.dir)).toEqual([DIR]);
  });

  test("going back to a folder keeps a single watcher on it", async () => {
    files["/Users/me/w/app/docs/plan.md"] = "# The plan";
    const { view, cx } = await open();
    linkHandler(view)("../docs/plan.md", cx);
    await flush();
    click(byKey(view.render(), "md-back"), cx);
    await flush();
    const before = reads.length;
    files[FILE] = "# Changed";
    for (const watch of watches.filter((item) => item.dir === DIR)) watch.resolve([FILE]);
    await flush();
    expect(reads.length - before).toBe(1);
  });

  test("a change that leaves the text the same does not redraw", async () => {
    const { cx } = await open();
    const before = cx.notified;
    watches.at(-1)?.resolve([DIR]);
    await flush();
    expect(reads).toEqual([FILE, FILE]);
    expect(cx.notified).toBe(before);
  });
});

describe("links and buttons", () => {
  test("a web link opens in the browser", async () => {
    const { view, cx } = await open();
    linkHandler(view)("https://example.com/a", cx);
    expect(execs).toContainEqual(["open", ["https://example.com/a"]]);
  });

  test("a link to another file opens in its own app", async () => {
    const { view, cx } = await open();
    linkHandler(view)("shots/01.png", cx);
    expect(execs).toContainEqual(["open", [`${DIR}/shots/01.png`]]);
  });

  test("a markdown link opens in the pane and Back returns", async () => {
    files["/Users/me/w/app/docs/plan.md"] = "# The plan";
    const { view, cx } = await open();
    linkHandler(view)("../docs/plan.md", cx);
    await flush();
    expect(texts(view.render())).toContain("# The plan");
    expect(texts(view.render())).toContain("plan.md");
    expect(watches.at(-1)?.dir).toBe("/Users/me/w/app/docs");
    click(byKey(view.render(), "md-back"), cx);
    await flush();
    expect(texts(view.render())).toContain("# Draft autosave\n\nBody text");
    expect(find(view.render(), (item) => item.key === "md-back")).toBeNull();
  });

  test("the old folder's watch stops after moving to another folder", async () => {
    files["/Users/me/w/app/docs/plan.md"] = "# The plan";
    const { view, cx } = await open();
    const old = watches[0];
    linkHandler(view)("../docs/plan.md", cx);
    await flush();
    const before = reads.length;
    old?.resolve([FILE]);
    await flush();
    expect(reads.length).toBe(before);
    expect(texts(view.render())).toContain("# The plan");
  });

  test("an anchor on the same page does nothing", async () => {
    const { view, cx } = await open();
    linkHandler(view)("#plan", cx);
    await flush();
    expect(execs).toEqual([]);
    expect(reads).toEqual([FILE]);
  });

  test("Open opens the shown file in its own app", async () => {
    const { view, cx } = await open();
    click(byKey(view.render(), "md-editor"), cx);
    expect(execs).toContainEqual(["open", [FILE]]);
  });

  test("the header's Open is a named button with a gray icon and Reload an icon with a tooltip", async () => {
    herdr.theme = () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) });
    files["/Users/me/w/app/docs/plan.md"] = "# The plan";
    const { view, cx } = await open();
    linkHandler(view)("../docs/plan.md", cx);
    await flush();
    const root = view.render();
    const zed = byKey(root, "md-editor");
    expect(texts(zed)).toContain("Open");
    expect(svgs(zed)).toEqual(["mods/kit/icons/external-link.svg"]);
    const zedIcon = find(zed, (item) => item.calls.some(([n, a]) => n === "svg" && a[0] === "mods/kit/icons/external-link.svg")) as Node;
    expect(zedIcon.calls).toContainEqual(["text_color", ["t.muted"]]);
    const reload = byKey(root, "md-reload");
    expect(reload.calls).toContainEqual(["tooltip", ["Reload"]]);
    expect(svgs(reload)).toEqual(["mods/kit/icons/rotate-cw.svg"]);
    const back = byKey(root, "md-back");
    expect(svgs(back)).toEqual(["mods/kit/icons/arrow-left.svg"]);
    expect(texts(back)).toEqual(["Back"]);
    for (const node of [zed, reload, back]) {
      for (const glyph of ["\u2197", "\u21bb", "\u2190"]) expect(texts(node).join("")).not.toContain(glyph);
    }
  });

  test("reload reads the file again", async () => {
    const { view, cx } = await open();
    click(byKey(view.render(), "md-reload"), cx);
    await flush();
    expect(reads).toEqual([FILE, FILE]);
  });
});

describe("leaving a folder", () => {
  test("cancels the watch on it", async () => {
    const cancelled: string[] = [];
    herdr.watchFolder = ((dir: string) => Object.assign(new Promise((resolve) => watches.push({ dir, resolve })), { cancel: () => cancelled.push(dir) })) as never;
    files["/Users/me/w/app/docs/plan.md"] = "# The plan";
    const { view, cx } = await open();
    linkHandler(view)("../docs/plan.md", cx);
    await flush();
    expect(cancelled).toEqual([DIR]);
    expect(watches.map((watch) => watch.dir)).toEqual([DIR, "/Users/me/w/app/docs"]);
  });
});

describe("taking a file from another mod", () => {
  async function send(file: string, at: string) {
    sharedState["markdown.request"] = { file, tab: "t1", at };
    commands.shift()?.("show");
    await flush();
  }

  test("show switches to the requested file and Back returns", async () => {
    files[`${DIR}/PLAN.md`] = "# Plan";
    const { view, cx } = await open();
    await send(`${DIR}/PLAN.md`, "1");
    expect(texts(view.render())).toContain("# Plan");
    click(byKey(view.render(), "md-back"), cx);
    await flush();
    expect(texts(view.render())).toContain("# Draft autosave\n\nBody text");
  });

  test("a request is taken once", async () => {
    files[`${DIR}/PLAN.md`] = "# Plan";
    const { view } = await open();
    await send(`${DIR}/PLAN.md`, "1");
    await send(`${DIR}/PLAN.md`, "1");
    expect(view.history).toEqual([FILE]);
  });

  test("the file already shown keeps its history", async () => {
    const { view } = await open();
    await send(FILE, "2");
    expect(view.history).toEqual([]);
  });

  test("a viewer opened empty takes the file without a Back", async () => {
    const { view } = await open({});
    await send(FILE, "3");
    expect(texts(view.render())).toContain("NOTES.md");
    expect(view.history).toEqual([]);
  });

  test("other commands are ignored", async () => {
    const { view } = await open();
    sharedState["markdown.request"] = { file: `${DIR}/PLAN.md`, tab: "t1", at: "4" };
    commands.shift()?.("other");
    await flush();
    expect(view.file).toBe(FILE);
  });
});

describe("reading in a column", () => {
  test("the text sits in a centered column at most 760 px wide, at 14 px", async () => {
    const { view } = await open();
    const column = find(view.render(), (node) => node.calls.some(([name, args]) => name === "max_w" && args[0] === 760)) as Node;
    expect(column.calls).toContainEqual(["text_size", [14]]);
  });
});

describe("the picker", () => {
  const TOP = "/Users/me/w/app";
  let read: string;
  let opened: [string, unknown][];
  let closed: string[];
  let readFrom: string[];

  beforeEach(() => {
    readFrom = [];
    read = ["● Wrote docs/plan.md", "  and NOTES.md"].join("\n");
    opened = [];
    closed = [];
    Object.assign(herdr, {
      panes: () => [
        { pane: "p1", tab: "t1", terminal: "t7", cwd: TOP },
        { pane: "p2", tab: "t1", terminal: null, mod: "files" },
      ],
      focused: () => ({ tab: "t1", pane: "p1", terminal: "t7", cwd: TOP }),
      hc: async (args: string[]) => (readFrom.push(args[1]), { code: 0, stdout: JSON.stringify({ text: args[1] === "t7" ? read : "" }), stderr: "" }),
      exec: async (command: string, args: string[]) => {
        const script = args[1];
        if (script.includes("ls-files --cached --others --exclude-standard -z")) return { code: 0, stdout: `${TOP}\nREADME.md\ndocs/plan.md\n`, stderr: "" };
        if (script.includes("awk")) return { code: 0, stdout: `${TOP}\nsub/NOTES.md\n`, stderr: "" };
        const found = args.slice(4).filter((path) => path === "docs/plan.md");
        return { code: 0, stdout: found.map((path) => `${path}\0${TOP}/${path}\0`).join(""), stderr: "" };
      },
      run: (name: string, args: unknown) => opened.push([name, args]),
      closeOverlay: (id: string) => closed.push(id),
    });
  });

  async function picker(props: Record<string, unknown> = { overlay: "o1" }) {
    const { view, cx } = await open(props);
    return { view, cx, rows: () => texts(view.render()) };
  }

  test("the screen's Markdown files come first, newest first, then the repository's", async () => {
    const { rows } = await picker();
    const shown = rows();
    expect(shown).toContain("ON THIS SCREEN");
    expect(shown).toContain("IN THIS REPOSITORY");
    expect(shown.indexOf("NOTES.md")).toBeLessThan(shown.indexOf("plan.md"));
    expect(shown.indexOf("plan.md")).toBeLessThan(shown.indexOf("README.md"));
    expect(shown.filter((text) => text === "plan.md")).toHaveLength(1);
  });

  test("Enter opens the chosen file beside the terminal it read and closes", async () => {
    const { view, cx } = await picker();
    view.picker.input.emit("submit", cx);
    expect(opened).toEqual([["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: `${TOP}/sub/NOTES.md` } }]]);
    expect(closed).toEqual(["o1"]);
  });

  test("arrows move the choice and wrap", async () => {
    const { view, cx } = await picker();
    const root = view.render();
    const keys = root.calls.find(([name]) => name === "on_key_down")?.[1][0] as (event: { key: string }, cx: unknown) => void;
    keys({ key: "up" }, cx);
    expect(view.picker.at).toBe(2);
    keys({ key: "down" }, cx);
    expect(view.picker.at).toBe(0);
    keys({ key: "escape" }, cx);
    expect(closed).toEqual(["o1"]);
  });

  test("typing filters the rows", async () => {
    const { view, cx, rows } = await picker();
    view.picker.input.set_value("readme");
    view.picker.input.emit("change", cx);
    expect(rows()).toContain("README.md");
    expect(rows()).not.toContain("plan.md");
  });

  test("a typed path that exists opens when nothing matches", async () => {
    const { view, cx } = await picker();
    view.picker.input.set_value("docs/plan.md");
    view.picker.input.emit("change", cx);
    view.picker.at = 99;
    view.picker.filter = "docs/plan.md";
    view.picker.choose(null, cx);
    await flush();
    expect(opened[0]?.[1]).toMatchObject({ props: { file: `${TOP}/docs/plan.md` } });
  });

  test("a typed path that doesn't exist says so", async () => {
    const { view, cx, rows } = await picker();
    view.picker.input.set_value("gone.md");
    view.picker.input.emit("change", cx);
    view.picker.choose(null, cx);
    await flush();
    expect(rows()).toContain("No file at gone.md");
    expect(closed).toEqual([]);
  });

  test("a right-click's terminal comes from props() when init gets only the overlay", async () => {
    await open({ overlay: "o3" }, { overlay: "o3", terminal: "t9", pane: "p9" });
    expect(readFrom).toEqual(["t9"]);
  });

  test("a right-click reads the terminal it was opened on", async () => {
    await picker({ overlay: "o2", terminal: "t9", pane: "p9" });
    expect(readFrom).toEqual(["t9"]);
  });

  test("with the viewer focused, it reads the tab's terminal", async () => {
    herdr.focused = () => ({ tab: "t1", pane: "p2", terminal: null, cwd: null });
    const { rows } = await picker();
    expect(rows()).toContain("NOTES.md");
    expect(readFrom).toEqual(["t7"]);
  });

  test("nothing on screen says so and still lists the repository", async () => {
    read = "no paths here";
    const { rows } = await picker();
    expect(rows()).toContain("No Markdown on this terminal's screen. Type a path.");
    expect(rows()).toContain("README.md");
  });
});

describe("Cmd-click on a Markdown path", () => {
  let ran: [string, unknown][];
  const source = { terminal: "t7", machine: null, cwd: DIR, pane: "p1", tab: "t1", space: "s1" };

  beforeEach(() => {
    ran = [];
    Object.assign(herdr, {
      panes: () => [{ pane: "p1", tab: "t1" }],
      focused: () => ({ tab: "t1", pane: "p1" }),
      run: (name: string, args?: unknown) => ran.push([name, args]),
      setShared: (key: string, value: unknown) => {
        sharedState[key] = value;
      },
    });
  });

  test("opens the file beside the clicked terminal", () => {
    expect(handleLink({ link: { kind: "file", raw: "NOTES.md", path: FILE }, source })).toBe("handled");
    expect(ran).toEqual([["pane.split", { direction: "right", pane: "p1", mod: "markdown", props: { file: FILE } }]]);
  });

  test("a viewer already in the tab shows the file", () => {
    herdr.panes = () => [
      { pane: "p1", tab: "t1" },
      { pane: "p2", tab: "t1", mod: "markdown" },
    ];
    expect(handleLink({ link: { kind: "file", raw: "NOTES.md", path: FILE }, source })).toBe("handled");
    expect(ran).toEqual([["markdown.show", undefined]]);
    expect(sharedState["markdown.request"]).toMatchObject({ file: FILE, tab: "t1" });
  });

  test("a path Herdr couldn't resolve goes to the next handler", () => {
    expect(handleLink({ link: { kind: "file", raw: "vps:/w/NOTES.md", path: null }, source: { ...source, machine: "vps" } })).toBe("pass");
    expect(ran).toEqual([]);
  });

  test("a web address goes to the next handler", () => {
    expect(handleLink({ link: { kind: "url", raw: "https://x.dev/a.md", url: "https://x.dev/a.md" }, source })).toBe("pass");
    expect(ran).toEqual([]);
  });
});
