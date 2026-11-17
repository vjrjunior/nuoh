import { beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node, texts } from "./app-mocks";
import { reset, app, click, common, cx, pathTo, setup, space, style } from "./spaces-tree-harness";

beforeEach(reset);

describe("clicks", () => {
  for (const button of ["space-new", "space-style"]) {
    test(`a row click works right after ${button}`, () => {
      const view = setup();
      click(view, button);
      click(view, `head-${common}`);
      expect(app.runs).toContainEqual(["space.select", { id: "m" }]);
    });
  }

  test("folding a repository does not switch to it", () => {
    const view = setup();
    click(view, `fold-${common}`);
    expect(app.runs.filter(([name]) => name === "space.select")).toEqual([]);
    expect(app.shared["spaces.folded"]).toEqual([common]);
  });

  test("a closed worktree opens one space on this computer", () => {
    const view = setup();
    click(view, "kid-/w/app/one");
    click(view, "kid-/w/app/one");
    expect(app.runs).toEqual([["space.new", { folder: "/w/app/one", machine: "" }]]);
  });
});

describe("git", () => {
  test("a repository is read from its git folder", async () => {
    const view = setup();
    await view.readRepo(common, cx);
    expect(app.execs.map((call) => call.cwd)).toEqual([common, common]);
  });
});

describe("folding", () => {
  test("a folded repository without worktrees keeps its branch and shows no count", () => {
    const view = setup([{ path: "/r/app", branch: "vjr", main: true }]);
    app.shared["spaces.folded"] = [common];
    const head = pathTo(view.render(), `head-${common}`)?.at(-1) as Node;
    expect(texts(head)).toContain("vjr");
    expect(texts(head)).not.toContain("0");
  });
});

describe("git and folder watches", () => {
  const live: Record<string, any> = { ...cx, spawn: (work: (cx: unknown) => unknown) => work(live) };

  test("a repo no space is in any more stops being watched", () => {
    const cancelled: string[] = [];
    herdr.watchFolder = ((dir: string) => Object.assign(new Promise(() => {}), { cancel: () => cancelled.push(dir) })) as never;
    const view = setup();
    view.watch(common, live);
    view.forget();
    expect(cancelled).toEqual([]);
    view.lastPlaces = { x: "/x" };
    view.forget();
    expect(cancelled).toEqual([common]);
    expect(view.watching.has(common)).toBe(false);
  });

  test("a refresh looks at its folders at the same time", async () => {
    let open = 0;
    let most = 0;
    herdr.exec = (async () => {
      most = Math.max(most, ++open);
      await new Promise((resolve) => setTimeout(resolve, 5));
      open -= 1;
      return { code: 1, stdout: "", stderr: "" };
    }) as never;
    const view = setup();
    view.refresh(["/a", "/b", "/c"], live);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(most).toBe(3);
    expect(view.refreshing).toBe(false);
  });
});

describe("bringing the active space into view", () => {
  const FOLDERS = "spaces.folders";
  const shownBy = (view: { scroll: { shown: number[] } }) => view.scroll.shown;
  const activate = (id: string) => {
    app.spaces = app.spaces.map((known) => ({ ...known, active: known.id === id }));
  };

  test("the first draw scrolls to the active space, and a redraw leaves the list where it is", () => {
    const view = setup();
    view.render();
    view.render();
    expect(shownBy(view)).toEqual([1]);
  });

  test("a space made active from outside the tree is scrolled to", () => {
    const view = setup();
    view.render();
    activate("m");
    view.render();
    expect(shownBy(view)).toEqual([1, 0]);
  });

  test("a space picked in the tree stays where the pointer is", () => {
    const view = setup();
    view.render();
    view.open({ space: { id: "m" } });
    activate("m");
    view.render();
    expect(shownBy(view)).toEqual([1]);
    activate("x");
    view.render();
    expect(shownBy(view)).toEqual([1, 1]);
  });

  test("a folder counts as one item, and unfolding it scrolls again", () => {
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: true }], members: { x: "f1" } };
    const view = setup();
    view.render();
    expect(shownBy(view)).toEqual([0]);
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: false }], members: { x: "f1" } };
    view.render();
    expect(shownBy(view)).toEqual([0, 0]);
  });

  test("the narrow rail counts each folder tile and each space", () => {
    app.sidebar = 60;
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: false }], members: { [common]: "f1" } };
    const view = setup();
    view.render();
    expect(shownBy(view)).toEqual([2]);
  });
});
