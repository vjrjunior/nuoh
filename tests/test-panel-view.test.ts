import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { byKey, click, flush, herdr, makeCx, type Node } from "./app-mocks";

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
