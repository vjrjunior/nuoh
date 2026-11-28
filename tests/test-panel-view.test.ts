import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { byKey, click, flush, herdr, makeCx, type Node, svgs, texts } from "./app-mocks";

const { default: plan } = await import("../tools/test-panel/run.js");
const { default: TestPanel } = await import("../tools/test-panel/main.js");

const KEY = "test-panel";
const original = { ...plan };

let store: Record<string, any> = {};
let order: string[] = [];
let pending: (() => void)[] = [];
let instant = true;

const cx = makeCx();

beforeEach(() => {
  Object.assign(plan, {
    id: "r1",
    title: "Frame",
    shots: "/s",
    steps: [{ title: "Square" }, { title: "nuoh", run: [{ command: "layout.switch", args: { name: "nuoh" } }] }],
  });
  store = { [KEY]: { run: "r1", step: 0, results: [], log: [], seen: null, closed: false, reported: false } };
  order = [];
  pending = [];
  instant = true;
  Object.assign(herdr, {
    theme: () => new Proxy({}, { get: (_x, p) => (typeof p === "string" ? `t.${p}` : undefined) }),
    props: () => ({}),
    spaces: () => [],
    terminals: () => [],
    shared: (key: string) => store[key],
    setShared: (key: string, value: unknown) => (store[key] = value),
    run: (name: string, args: { name?: string }) => order.push(`${name} ${args.name ?? ""}`.trim()),
    exec: (command: string, args: string[]) => {
      order.push(`${command} ${args.join(" ")}`);
      if (instant) return Promise.resolve({ stdout: "" });
      return new Promise((resolve) => pending.push(() => resolve({ stdout: "" })));
    },
  });
});

afterAll(() => {
  for (const key of Object.keys(plan)) delete (plan as Record<string, unknown>)[key];
  Object.assign(plan, original);
});

function passed() {
  const panel = new TestPanel();
  panel.init({}, cx);
  const button = byKey(panel.render(cx) as Node, "test-pass");
  return () => click(button, cx);
}

describe("answering a step", () => {
  test("saves the step's shot before the next step's commands run", async () => {
    passed()();
    await flush();
    expect(order).toEqual(["herdr-app shot /s/01-passed.png", "layout.switch nuoh"]);
    expect(store[KEY].step).toBe(1);
    expect(store[KEY].results).toMatchObject([{ step: 0, title: "Square", verdict: "passed", shot: "/s/01-passed.png" }]);
  });

  test("the next step waits for the shot, and a second click meanwhile counts once", async () => {
    instant = false;
    const pass = passed();
    pass();
    pass();
    await flush();
    expect(order).toEqual(["herdr-app shot /s/01-passed.png"]);
    expect(store[KEY].step).toBe(0);
    pending.forEach((done) => done());
    await flush();
    expect(order).toEqual(["herdr-app shot /s/01-passed.png", "layout.switch nuoh"]);
    expect(store[KEY].step).toBe(1);
  });

  test("without a shots folder the next step starts with no shot", async () => {
    delete (plan as Record<string, unknown>).shots;
    passed()();
    await flush();
    expect(order).toEqual(["layout.switch nuoh"]);
    expect(store[KEY].results).toMatchObject([{ step: 0, verdict: "passed", shot: null }]);
  });
});

describe("texts to paste", () => {
  const PASTE = ["Say pwd", 'echo "it moved" && pwd'];

  function panel(step = 0) {
    plan.steps = [{ title: "Type", do: ["Paste each text into the Claude."], paste: PASTE }, { title: "Next" }];
    store[KEY] = { ...store[KEY], step };
    herdr.settings = () => ({ font_family: "JetBrains Mono" });
    const view = new TestPanel();
    view.init({}, cx);
    return view;
  }

  test("each text is a mono line with a copy button under the instructions", () => {
    const root = panel().render(cx) as Node;
    expect(texts(root)).toContain("Paste each text into the Claude.");
    for (const [index, text] of PASTE.entries()) {
      const button = byKey(root, `test-paste-${index}`);
      expect(svgs(button)).toEqual(["mods/kit/icons/copy.svg"]);
      expect(texts(root)).toContain(text);
    }
  });

  test("the button copies the exact text and shows a check until the step changes", () => {
    const view = panel();
    const copyCx = makeCx();
    click(byKey(view.render(copyCx) as Node, "test-paste-1"), copyCx);
    expect(copyCx.clipboard).toEqual(['echo "it moved" && pwd']);
    expect(copyCx.stopped).toBeGreaterThan(0);
    const after = view.render(copyCx) as Node;
    expect(svgs(byKey(after, "test-paste-1"))).toEqual(["mods/kit/icons/check.svg"]);
    expect(svgs(byKey(after, "test-paste-0"))).toEqual(["mods/kit/icons/copy.svg"]);
    plan.steps[1] = { title: "Next", paste: PASTE };
    store[KEY] = { ...store[KEY], step: 1 };
    expect(svgs(byKey(view.render(copyCx) as Node, "test-paste-1"))).toEqual(["mods/kit/icons/copy.svg"]);
  });

  test("a step without texts to paste draws no rows", () => {
    plan.steps = [{ title: "Square" }];
    const view = new TestPanel();
    view.init({}, cx);
    expect(() => byKey(view.render(cx) as Node, "test-paste-0")).toThrow("no element test-paste-0");
  });
});
