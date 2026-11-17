import { beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node } from "./app-mocks";

type Result = { code: number; stderr: string; stdout?: string };
type Notification = { title: string; body: string; level?: string };

const app = { version: "", built: "", square: false, checking: false, shared: {} as Record<string, unknown>, result: { code: 0, stderr: "" } as Result, rejects: "" };
const execCalls: unknown[][] = [];
const notifications: Notification[] = [];

beforeEach(() => {
  Object.assign(herdr, {
    exec: async (...args: unknown[]) => {
      execCalls.push(args);
      if (app.rejects) throw new Error(app.rejects);
      return app.result;
    },
    notify: (notification: Notification) => notifications.push(notification),
    props: () => (app.built ? { built: app.built, repo: "/repo", bun: "/bin/bun", square: app.square } : null),
    checking: () => app.checking,
    shared: (key: string) => app.shared[key],
    setShared: (key: string, value: unknown) => {
      app.shared[key] = value;
    },
    updates: () => ({ app: { version: app.version } }),
  });
});

const { default: VjrSync } = await import("../mods/vjr-sync/main.js");

async function start(settings: Partial<typeof app>) {
  Object.assign(app, { result: { code: 0, stderr: "" }, rejects: "", square: false, checking: false, shared: {} }, settings);
  let task: Promise<unknown> | undefined;
  let look: ((cx: unknown) => void) | undefined;
  const cx = {
    spawn(run: (cx: unknown) => Promise<unknown>) {
      task = run(cx);
    },
    timer: {
      every(_ms: number, run: (cx: unknown) => void) {
        look = run;
      },
    },
  };
  const view = new VjrSync();
  view.init({}, cx);
  await task;
  return {
    view,
    watching: look !== undefined,
    async tick() {
      task = undefined;
      look?.(cx);
      await task;
    },
  };
}

beforeEach(() => {
  execCalls.length = 0;
  notifications.length = 0;
});

describe("vjr-sync", () => {
  test("does nothing when the version matches", async () => {
    await start({ version: "0.1.10", built: "0.1.10" });

    expect(execCalls).toEqual([]);
    expect(notifications).toEqual([]);
  });

  test("does nothing without props, as in herdr-app check", async () => {
    await start({ version: "0.1.11", built: "" });

    expect(execCalls).toEqual([]);
    expect(notifications).toEqual([]);
  });

  test("runs apply with the app's own version", async () => {
    await start({ version: "0.1.11", built: "0.1.10" });

    expect(execCalls).toEqual([["/bin/bun", ["scripts/layout.ts", "apply", "--herdr-version", "0.1.11"], { cwd: "/repo", timeout: 120000 }]]);
  });

  test("stays silent on success", async () => {
    await start({ version: "0.1.11", built: "0.1.10" });

    expect(notifications).toEqual([]);
  });

  test("warns when apply fails", async () => {
    await start({ version: "0.1.11", built: "0.1.10", result: { code: 1, stderr: "error: recipe square: gone\n" } });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.level).toBe("warning");
    expect(notifications[0]?.title).toContain("0.1.10");
    expect(notifications[0]?.body).toContain("recipe square: gone");
    expect(notifications[0]?.body).toStartWith("Run bun run apply-layout");
  });

  test("warns when bun or the repo cannot be reached", async () => {
    await start({ version: "0.1.11", built: "0.1.10", rejects: "cannot run bun" });

    expect(notifications[0]?.body).toContain("cannot run bun");
  });

  test("renders nothing", () => {
    const node = new VjrSync().render() as Node;
    expect(node.kids).toEqual([]);
    expect(node.texts).toEqual([]);
  });
});

describe("the square corners toggle", () => {
  const KEY = "vjr.square";
  const squareCalls = () => execCalls.map((call) => (call[1] as string[]).slice(2));

  test("starts by showing the look the layout was built with", async () => {
    await start({ version: "0.1.10", built: "0.1.10", square: true, shared: { [KEY]: false } });
    expect(app.shared[KEY]).toBe(true);
  });

  test("leaves the layout alone while the toggle matches it", async () => {
    const sync = await start({ version: "0.1.10", built: "0.1.10" });
    await sync.tick();
    expect(execCalls).toEqual([]);
  });

  test("rebuilds square when the toggle goes on, and round when it goes off", async () => {
    const sync = await start({ version: "0.1.10", built: "0.1.10" });
    app.shared[KEY] = true;
    await sync.tick();
    await sync.tick();
    app.shared[KEY] = false;
    await sync.tick();
    expect(squareCalls()).toEqual([["--square", "on"], ["--square", "off"]]);
    expect(notifications.map((notification) => notification.title)).toEqual(["Squaring the corners", "Rounding the corners"]);
  });

  test("a rebuild that fails puts the toggle back and says why", async () => {
    const sync = await start({ version: "0.1.10", built: "0.1.10", result: { code: 1, stderr: "error: recipe square: gone\n" } });
    app.shared[KEY] = true;
    await sync.tick();
    expect(app.shared[KEY]).toBe(false);
    expect(notifications.at(-1)?.level).toBe("warning");
    expect(notifications.at(-1)?.body).toContain("recipe square: gone");
  });

  test("a rebuild that finds another one running puts the toggle back without a warning", async () => {
    const sync = await start({ version: "0.1.10", built: "0.1.10", result: { code: 0, stderr: "", stdout: "busy\n" } });
    app.shared[KEY] = true;
    await sync.tick();
    expect(app.shared[KEY]).toBe(false);
    expect(notifications.filter((notification) => notification.level === "warning")).toEqual([]);
  });

  test("starts nothing while Herdr checks the mod", async () => {
    const sync = await start({ version: "0.1.11", built: "0.1.10", checking: true, shared: { [KEY]: true } });
    expect(sync.watching).toBe(false);
    expect(execCalls).toEqual([]);
    expect(app.shared[KEY]).toBe(true);
  });
});
