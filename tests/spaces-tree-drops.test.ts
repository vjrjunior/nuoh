import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node } from "./app-mocks";
import { reset, DRAG_GRACE, SpacesTree, app, click, common, cx, fire, pathTo, space } from "./spaces-tree-harness";

beforeEach(reset);

describe("tab drops", () => {
  const three = [
    { path: "/r/app", branch: "main", main: true },
    { path: "/w/app/one", branch: "one", main: false },
    { path: "/w/app/two", branch: "two", main: false },
  ];
  const DRAG = "move-tab.drag";
  const REQUEST = "move-tab.request";
  const drag = (from = "m") => ({ tab: "t1", space: from, at: Date.now() });

  function dropSetup(extra = false) {
    app.spaces = [space("m"), space("x", { active: true }), space("w"), ...(extra ? [space("e")] : [])];
    const view = new SpacesTree();
    view.init({}, cx);
    view.lastPlaces = { m: "/r/app", x: "/x", w: "/w/app/two", ...(extra ? { e: "/r/app" } : {}) };
    view.looks = { "/r/app": { top: "/r/app", common }, "/x": null, "/w/app/two": { top: "/w/app/two", common } };
    view.repos = { [common]: { common, name: "app", checkouts: three, refs: {} } };
    return view;
  }

  function at(view: { render(): Node }, key: string): Node[] {
    const path = pathTo(view.render(), key);
    if (!path) throw new Error(`no element ${key}`);
    return path;
  }

  function enter(view: { render(): Node }, key: string): void {
    for (const handler of (at(view, key).at(-1) as Node).handlers.hover ?? []) handler(true, cx);
  }

  test("releasing a drag on a worktree row asks for the move", () => {
    const view = dropSetup();
    app.shared[DRAG] = drag();
    enter(view, "kid-/w/app/one");
    fire(at(view, "kid-/w/app/one"), "up:left");
    const request = app.shared[REQUEST] as Record<string, unknown>;
    expect(request).toMatchObject({ tab: "t1", space: "m", to: "/w/app/one", toSpace: null });
    expect(typeof request.id).toBe("string");
    expect(Number.isFinite(request.at)).toBe(true);
    expect(app.shared[DRAG]).toBeNull();

    app.shared[DRAG] = drag();
    enter(view, "kid-w");
    fire(at(view, "kid-w"), "up:left");
    expect(app.shared[REQUEST]).toMatchObject({ tab: "t1", space: "m", to: "/w/app/two", toSpace: "w" });

    delete app.shared[REQUEST];
    app.shared[DRAG] = drag("w");
    enter(view, `head-${common}`);
    fire(at(view, `head-${common}`), "up:left");
    expect(app.shared[REQUEST]).toMatchObject({ tab: "t1", space: "w", to: "/r/app", toSpace: "m" });
    expect(app.runs).toEqual([]);
  });

  test("a drop on its own space or outside the repo asks nothing", () => {
    const view = dropSetup();
    for (const key of [`head-${common}`, "head-x"]) {
      app.shared[DRAG] = drag();
      fire(at(view, key), "up:left");
      expect(app.shared[REQUEST]).toBeUndefined();
      expect(app.shared[DRAG]).toBeNull();
    }
  });

  test("a click on a row after a stale drag opens the row and asks nothing", () => {
    const view = dropSetup();
    app.shared[DRAG] = drag();
    click(view, "kid-/w/app/one");
    expect(app.runs).toEqual([["space.new", { folder: "/w/app/one", machine: "" }]]);
    expect(app.shared[REQUEST]).toBeUndefined();

    app.shared[DRAG] = drag();
    click(view, "kid-w");
    expect(app.runs.at(-1)).toEqual(["space.select", { id: "w" }]);
    expect(app.shared[REQUEST]).toBeUndefined();

    app.shared[DRAG] = drag("w");
    click(view, `head-${common}`);
    expect(app.runs.at(-1)).toEqual(["space.select", { id: "m" }]);
    expect(app.shared[REQUEST]).toBeUndefined();

    app.shared[DRAG] = drag();
    const root = view.render();
    fire([root, root.kids[0] as Node], "down:left");
    expect(app.shared[DRAG]).toBeNull();
  });

  test("a drop on an extra space of the main checkout asks for the move into that space", () => {
    const view = dropSetup(true);
    app.shared[DRAG] = drag("w");
    enter(view, "head-e");
    fire(at(view, "head-e"), "up:left");
    expect(app.shared[REQUEST]).toMatchObject({ tab: "t1", space: "w", to: "/r/app", toSpace: "e" });
    expect(app.shared[DRAG]).toBeNull();
  });

  test("a release on a row that never lit, as after a drag of the list's scrollbar, asks nothing and ends the drag", () => {
    const view = dropSetup();
    app.shared[DRAG] = { ...drag(), at: Date.now() - 5000 };
    fire(at(view, "kid-/w/app/one"), "up:left");
    expect(app.shared[REQUEST]).toBeUndefined();
    expect(app.shared[DRAG]).toBeNull();
    expect(app.runs).toEqual([]);
  });

  test("a press on a row's chevron that slides off onto the row asks nothing", () => {
    const view = dropSetup();
    app.shared[DRAG] = { ...drag("w"), at: Date.now() - 5000 };
    fire(at(view, `fold-${common}`), "down:left");
    fire(at(view, `head-${common}`), "up:left");
    expect(app.shared[REQUEST]).toBeUndefined();
  });

  test("a press outside the header, the list's scrollbar included, forgets a drag older than 300 ms and keeps a younger one", () => {
    const view = dropSetup();
    const root = view.render();
    const [header, list] = root.kids as Node[];
    expect(list.calls.some(([name]) => name === "overflow_y_scrollbar")).toBe(true);
    expect(header.calls.some(([name]) => name === "overflow_y_scrollbar")).toBe(false);
    expect(header.handlers.down_out).toHaveLength(1);
    expect(root.handlers.down_out).toBeUndefined();
    const out = () => {
      for (const handler of (view.render().kids[0] as Node).handlers.down_out ?? []) handler({}, cx);
    };
    expect(DRAG_GRACE).toBe(300);
    app.shared[DRAG] = { ...drag(), at: Date.now() - DRAG_GRACE - 50 };
    out();
    expect(app.shared[DRAG]).toBeNull();
    const fresh = drag();
    app.shared[DRAG] = fresh;
    out();
    expect(app.shared[DRAG]).toEqual(fresh);
    app.shared[DRAG] = { tab: "t1", space: "m" };
    out();
    expect(app.shared[DRAG]).toBeNull();
  });

  test("the narrow rail's header forgets a stale drag and keeps a fresh one", () => {
    herdr.layout = () => ({ id: "root", children: [{ id: "sidebar", size: { px: 60 } }] });
    const view = dropSetup();
    const out = () => {
      for (const handler of (view.render().kids[0] as Node).handlers.down_out ?? []) handler({}, cx);
    };
    app.shared[DRAG] = { ...drag(), at: Date.now() - DRAG_GRACE - 50 };
    out();
    expect(app.shared[DRAG]).toBeNull();
    const fresh = drag();
    app.shared[DRAG] = fresh;
    out();
    expect(app.shared[DRAG]).toEqual(fresh);
  });

  describe("highlight", () => {
    const shared = herdr.theme;
    beforeEach(() => {
      herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `#${prop}` : undefined) });
    });
    afterEach(() => {
      herdr.theme = shared;
    });
    const rows = [`head-${common}`, "kid-w", "kid-/w/app/one", "head-x"];
    const accent = (node: Node) => node.calls.some(([name]) => name === "border_1") && node.calls.some(([name, args]) => name === "border_color" && args[0] === "#accent");
    const dashed = (node: Node) => node.calls.some(([name]) => name === "border_dashed");
    const lit = (node: Node) => accent(node) && !dashed(node);
    const litRows = (view: { render(): Node }) => rows.filter((key) => lit(at(view, key).at(-1) as Node));

    test("only accepting rows highlight", () => {
      const view = dropSetup();
      app.shared[DRAG] = drag();
      const seen: Record<string, string[]> = {};
      for (const key of rows) {
        for (const handler of (at(view, key).at(-1) as Node).handlers.hover ?? []) handler(true, cx);
        seen[key] = litRows(view);
        for (const handler of (at(view, key).at(-1) as Node).handlers.hover ?? []) handler(false, cx);
      }
      expect(seen).toEqual({ [`head-${common}`]: [], "kid-w": ["kid-w"], "kid-/w/app/one": ["kid-/w/app/one"], "head-x": [] });

      for (const handler of (at(view, "kid-w").at(-1) as Node).handlers.move ?? []) handler({}, cx);
      expect(litRows(view)).toEqual(["kid-w"]);
      app.shared[DRAG] = null;
      expect(litRows(view)).toEqual([]);

      for (const handler of (at(view, "kid-/w/app/one").at(-1) as Node).handlers.hover ?? []) handler(true, cx);
      expect(litRows(view)).toEqual([]);
    });

    test("while a tab is being dragged, every row that would take it is dashed and the row under the pointer is solid", () => {
      const view = dropSetup();
      const dashedRows = () => rows.filter((key) => {
        const node = at(view, key).at(-1) as Node;
        return accent(node) && dashed(node);
      });
      app.shared[DRAG] = drag();
      expect(dashedRows()).toEqual([]);
      app.shared[DRAG] = { ...drag(), moving: true };
      expect(dashedRows()).toEqual(["kid-w", "kid-/w/app/one"]);
      expect(litRows(view)).toEqual([]);
      for (const handler of (at(view, "kid-w").at(-1) as Node).handlers.hover ?? []) handler(true, cx);
      expect(litRows(view)).toEqual(["kid-w"]);
      expect(dashedRows()).toEqual(["kid-/w/app/one"]);
      app.shared[DRAG] = null;
      expect(dashedRows()).toEqual([]);
      expect(litRows(view)).toEqual([]);
    });

    test("the tree shows the grabbing cursor only while a tab is being dragged", () => {
      const view = dropSetup();
      const grabbing = () => view.render().calls.some(([name]) => name === "cursor_grabbing");
      expect(grabbing()).toBe(false);
      app.shared[DRAG] = drag();
      expect(grabbing()).toBe(false);
      app.shared[DRAG] = { ...drag(), moving: true };
      expect(grabbing()).toBe(true);
      app.shared[DRAG] = null;
      expect(grabbing()).toBe(false);
    });
  });
});
