import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { find, herdr, type Node, texts } from "./app-mocks";
import { reset, BRANCH, SpacesTree, app, common, cx, headOf, onBranch, onMain, pathTo, setup, space, style } from "./spaces-tree-harness";

beforeEach(reset);

describe("head rows", () => {
  test("a head row without a branch is 36 px tall", () => {
    expect(style(headOf(setup(onMain)), "h")).toEqual([36]);
  });

  test("a head row with a branch is 48 px tall", () => {
    expect(style(headOf(setup(onBranch)), "h")).toEqual([48]);
  });

  test("the branch gets its own line under the name and ends with an ellipsis", () => {
    const row = headOf(setup(onBranch));
    const sub = find(row, (node) => node.texts.includes(BRANCH));
    expect(sub?.texts).toEqual([BRANCH]);
    expect(sub?.calls.map(([name]) => name)).toContain("truncate");
    expect(row.kids).toContain(sub as Node);
    expect(style(sub as Node, "pl")).toEqual([30]);
    expect(style(sub as Node, "line_height")).toEqual(["14px"]);
  });

  test("the avatar, the status dot and the buttons sit on the name's line", () => {
    const view = setup(onBranch);
    app.spaces = [space("m", { status: "working" }), space("x", { active: true })];
    const row = headOf(view);
    const name = find(row, (node) => node.texts.includes("app")) as Node;
    const line = find(row, (node) => node.kids.includes(name)) as Node;
    expect(line).not.toBe(row);
    expect(row.kids).toContain(line);
    expect(line.kids.some((node) => node.texts.includes("A"))).toBe(true);
    expect(find(line, (node) => style(node, "size")?.[0] === 7)).not.toBeNull();
    expect(find(line, (node) => node.key === `fold-${common}`)).not.toBeNull();
  });

  test("ahead and behind stay on the row, outside the branch cut", () => {
    const view = setup(onBranch);
    view.repos[common].refs = { [BRANCH]: { ahead: 2, behind: 1 } };
    const row = headOf(view);
    expect(find(row, (node) => node.texts.includes(BRANCH))?.texts).toEqual([BRANCH]);
    expect(texts(row)).toContain("↑2 ↓1");
  });

  test("the rail under a head row starts at the bottom of its avatar", () => {
    for (const [checkouts, top, height] of [[onMain, 29, 7], [onBranch, 27.5, 20.5]] as const) {
      const rail = find(headOf(setup([...checkouts])), (node) => style(node, "w")?.[0] === 1.5) as Node;
      expect([style(rail, "top"), style(rail, "h")]).toEqual([[top], [height]]);
    }
  });

  test("in blocks the status bar is as tall as the row", () => {
    const view = setup(onBranch);
    app.spaces = [space("m", { status: "working" }), space("x", { active: true })];
    app.shared["spaces.style"] = "blocks";
    const bar = find(headOf(view), (node) => style(node, "w")?.[0] === 3) as Node;
    expect(style(bar, "h")).toEqual([48]);
  });

  test("a folded repository shows its count on one 36 px line", () => {
    const view = setup(onBranch);
    app.shared["spaces.folded"] = [common];
    const row = headOf(view);
    expect(style(row, "h")).toEqual([36]);
    expect(texts(row)).not.toContain(BRANCH);
    expect(texts(row)).toContain("1");
  });
});

describe("a worktree's second line", () => {
  const row = (view: { render(): Node }) => pathTo(view.render(), "kid-/w/app/one")?.at(-1) as Node;
  const find = (node: Node, text: string): Node | null => {
    if (node.texts.includes(text)) return node;
    for (const kid of node.kids) {
      const found = find(kid, text);
      if (found) return found;
    }
    return null;
  };
  const shared = herdr.theme;
  beforeEach(() => {
    herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `#${prop}` : undefined) });
  });
  afterEach(() => {
    herdr.theme = shared;
  });
  const colorOf = (node: Node) => node.calls.find(([call]) => call === "text_color")?.[1][0];
  const withLane = (lane: Record<string, unknown>) => {
    const view = setup();
    app.shared["spaces-tree.lines"] = { "/w/app/one": lane };
    return view;
  };

  test("a worktree row with a lane shows its step and why under its name", () => {
    const node = row(withLane({ text: "AC 3/5", tone: "blocked", why: "review asks M4" }));
    expect(node.calls).toContainEqual(["h", [48]]);
    expect(texts(node)).toContain("AC 3/5");
    expect(texts(node)).toContain("· review asks M4");
    expect(colorOf(find(node, "AC 3/5") as Node)).toBe("#blocked");
    expect(colorOf(find(node, "· review asks M4") as Node)).toBe("#muted");
  });

  test("a row without a lane stays one 34 px line", () => {
    const node = row(setup());
    expect(node.calls).toContainEqual(["h", [34]]);
    expect(node.calls).not.toContainEqual(["h", [48]]);
  });

  test("the narrow rail shows no lane line", () => {
    const view = withLane({ text: "AC 3/5", tone: "blocked", why: "review asks M4" });
    herdr.layout = () => ({ id: "root", children: [{ id: "sidebar", size: { px: 100 } }] });
    const root = view.render();
    expect(texts(root)).not.toContain("AC 3/5");
    expect(texts(root)).not.toContain("· review asks M4");
    expect(pathTo(root, "kid-/w/app/one")).toBeNull();
  });

  test("a lane without a why shows only its step", () => {
    const node = row(withLane({ text: "PR open", tone: "work" }));
    expect(texts(node)).toContain("PR open");
    expect(texts(node).filter((text) => text.startsWith("·"))).toEqual([]);
    expect(colorOf(find(node, "PR open") as Node)).toBe("#unknown");
  });

  test("both lines of a lane row truncate", () => {
    const node = row(withLane({ text: "AC 3/5", tone: "blocked", why: "review asks M4" }));
    const name = find(node, "one") as Node;
    expect(name.calls.some(([call]) => call === "truncate")).toBe(true);
    const sub = node.kids.flatMap((kid) => [kid, ...kid.kids]).find((kid) => kid.calls.some(([call, args]) => call === "h" && args[0] === 14) && kid.calls.some(([call]) => call === "text_size")) as Node;
    expect(sub.calls.some(([call]) => call === "truncate")).toBe(true);
    const why = find(node, "· review asks M4") as Node;
    const names = why.calls.map(([call]) => call);
    expect(names).toContain("flex_1");
    expect(names).toContain("truncate");
    expect(why.calls).toContainEqual(["min_w", [0]]);
  });

  test("the lane line shows in the blocks style too", () => {
    const view = withLane({ text: "Ready", tone: "done", why: "ready to merge" });
    app.shared["spaces.style"] = "blocks";
    const node = row(view);
    expect(texts(node)).toContain("Ready");
    expect(texts(node)).toContain("· ready to merge");
    expect(node.calls).toContainEqual(["h", [48]]);
  });

  test("the rail runs past a two-line row", () => {
    const view = withLane({ text: "AC 3/5", tone: "blocked", why: "x" });
    app.spaces = [space("m"), space("x", { active: true })];
    view.repos[common].checkouts.push({ path: "/w/app/two", branch: "two", main: false });
    const node = row(view);
    const rail = node.kids.find((kid) => kid.calls.some(([call, args]) => call === "top" && args[0] === 17) && kid.calls.some(([call, args]) => call === "h" && args[0] === 31));
    expect(rail).toBeDefined();
  });
});

describe("the active space", () => {
  const shared = herdr.theme;
  beforeEach(() => {
    herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `#${prop}` : undefined) });
  });
  afterEach(() => {
    herdr.theme = shared;
  });

  const checkouts = [
    { path: "/r/app", branch: "main", main: true },
    { path: "/w/app/one", branch: "one", main: false },
    { path: "/w/app/two", branch: "two", main: false },
    { path: "/w/app/three", branch: "three", main: false },
  ];

  function treeWith(active: string) {
    app.spaces = [space("m", { active: active === "m" }), space("k", { active: active === "k" }), space("o", { active: active === "o" }), space("x", { active: active === "x" })];
    const view = new SpacesTree();
    view.init({}, cx);
    view.lastPlaces = { m: "/r/app", k: "/w/app/one", o: "/w/app/two", x: "/x" };
    view.looks = { "/r/app": { top: "/r/app", common }, "/w/app/one": { top: "/w/app/one", common }, "/w/app/two": { top: "/w/app/two", common }, "/x": null };
    view.repos = { [common]: { common, name: "app", checkouts, refs: {} } };
    return view;
  }

  const rowOf = (view: { render(): Node }, key: string) => pathTo(view.render(), key)?.at(-1) as Node;
  const colorOf = (row: Node) => style(find(row, (node) => style(node, "size")?.[0] === 22) as Node, "bg")?.[0] as string;
  const marks = (row: Node) => row.kids.filter((kid) => kid.calls.some(([name]) => name === "absolute") && style(kid, "right")?.[0] !== undefined);
  const has = (node: Node, name: string, value?: unknown) => node.calls.some(([called, args]) => called === name && (value === undefined || args[0] === value));
  const rail = (row: Node) => row.kids.find((kid) => style(kid, "w")?.[0] === 1.5) as Node;
  const elbow = (row: Node) => row.kids.find((kid) => has(kid, "border_l")) as Node;

  const groupOf = (view: { render(): Node }, key: string) => pathTo(view.render(), `group-${key}`)?.at(-1) as Node;

  test("only the group holding the active space is raised, padded below when it shows worktrees", () => {
    for (const [active, raised, padded] of [["x", "x", false], ["o", common, true], ["m", common, true], ["k", common, true]] as const) {
      const view = treeWith(active);
      const group = groupOf(view, raised);
      expect([style(group, "bg"), style(group, "pb")]).toEqual([["#raised"], padded ? [6] : undefined]);
      expect(group.calls.some(([name]) => name === "border_1")).toBe(false);
      const other = groupOf(view, raised === "x" ? common : "x");
      expect(style(other, "bg")).toBeUndefined();
    }
    const view = treeWith("o");
    app.shared["spaces.folded"] = [common];
    expect([style(groupOf(view, common), "bg"), style(groupOf(view, common), "pb")]).toEqual([["#raised"], undefined]);
  });

  const frameOf = (group: Node) => group.kids.find((kid) => kid.calls.some(([name]) => name === "absolute") && kid.calls.some(([name]) => name === "border_1"));

  test("a dim border wraps the whole group holding the active space, painted over it", () => {
    for (const [active, key, folded] of [["x", "x", false], ["m", common, false], ["o", common, false], ["k", common, false], ["o", common, true]] as const) {
      const view = treeWith(active);
      if (folded) app.shared["spaces.folded"] = [common];
      const group = groupOf(view, key);
      const frame = frameOf(group) as Node;
      expect([style(frame, "left"), style(frame, "right"), style(frame, "top"), style(frame, "bottom"), style(frame, "border_color"), style(frame, "bg")]).toEqual([[0], [0], [0], [0], ["#dim"], undefined]);
      expect(group.kids.at(-1)).toBe(frame);
      expect(has(group, "relative")).toBe(true);
      expect(has(group, "border_1")).toBe(false);
      const head = rowOf(view, `head-${key}`);
      expect(marks(head)).toEqual([]);
      expect(has(head, "bg")).toBe(false);
      expect(frameOf(groupOf(view, key === "x" ? common : "x"))).toBeUndefined();
      delete app.shared["spaces.folded"];
    }
  });

  test("an active worktree's name is white, the other open ones muted, closed ones as before", () => {
    const view = treeWith("o");
    const nameColor = (key: string, text: string) => style(find(rowOf(view, key), (node) => node.texts.includes(text)) as Node, "text_color");
    expect(nameColor("kid-o", "two")).toEqual(["#foreground"]);
    expect(nameColor("kid-k", "one")).toEqual(["#muted"]);
    expect(nameColor("kid-/w/app/three", "three")).toEqual(["#unknown"]);
    expect(nameColor(`head-${common}`, "app")).toEqual(["#foreground"]);
  });

  test("the rail is in full color down to the active worktree and faded after it", () => {
    const view = treeWith("o");
    const color = colorOf(rowOf(view, `head-${common}`));
    expect(style(rail(rowOf(view, `head-${common}`)), "bg")).toEqual([color]);
    const above = rowOf(view, "kid-k");
    expect([style(rail(above), "top"), style(rail(above), "bg")]).toEqual([[0], [color]]);
    expect(style(elbow(above), "border_color")).toEqual([`${color}B3`]);
    const active = rowOf(view, "kid-o");
    expect(style(elbow(active), "border_color")).toEqual([color]);
    expect([style(rail(active), "top"), style(rail(active), "bg")]).toEqual([[17], [`${color}B3`]]);

    const idle = treeWith("x");
    expect(style(rail(rowOf(idle, `head-${common}`)), "bg")).toEqual([`${color}B3`]);
    expect(style(rail(rowOf(idle, "kid-k")), "top")).toEqual([17]);
  });

  test("the active worktree gets no box, only a ring around its node", () => {
    const view = treeWith("o");
    const color = colorOf(rowOf(view, `head-${common}`));
    const row = rowOf(view, "kid-o");
    expect(has(row, "bg")).toBe(false);
    expect(marks(row)).toEqual([]);
    expect(row.kids.some((kid) => kid.calls.some(([name]) => name === "border_1"))).toBe(false);
    for (const handler of row.handlers.hover ?? []) handler(true, cx);
    expect(marks(rowOf(view, "kid-o"))).toEqual([]);
    const ring = row.kids.find((kid) => style(kid, "size")?.[0] === 14) as Node;
    expect([style(ring, "left"), style(ring, "top"), style(ring, "border"), style(ring, "border_color"), style(ring, "bg")]).toEqual([[29], [10], [1.5], [color], ["#raised"]]);
    expect(ring.kids).toEqual([]);
    const dot = row.kids.find((kid) => style(kid, "size")?.[0] === 6) as Node;
    expect([style(dot, "left"), style(dot, "top")]).toEqual([[33], [14]]);
    expect(row.kids.indexOf(dot)).toBe(row.kids.indexOf(ring) + 1);
    expect(style(rowOf(view, "kid-k"), "pl")).toEqual([52]);
    expect(marks(rowOf(view, "kid-k"))).toEqual([]);
    expect(rowOf(view, "kid-k").kids.some((kid) => style(kid, "size")?.[0] === 10 && style(kid, "left")?.[0] === 31 && style(kid, "top")?.[0] === 12)).toBe(true);
  });

  test("the ring's center takes the space's color while idle and the status color otherwise", () => {
    const view = treeWith("o");
    const color = colorOf(rowOf(view, `head-${common}`));
    const center = () => rowOf(view, "kid-o").kids.find((kid) => style(kid, "size")?.[0] === 6) as Node;
    expect(style(center(), "bg")).toEqual([color]);
    for (const status of ["idle", "working", "blocked", "done"]) {
      app.spaces = app.spaces.map((one) => (one.id === "o" ? { ...one, status } : one));
      expect(style(center(), "bg")).toEqual([status === "idle" ? color : `#${status}`]);
    }
  });

  test("hovering a worktree shows the box in the same gray as a head row's hover, with no border", () => {
    const view = treeWith("x");
    const hover = (on: boolean) => {
      for (const handler of rowOf(view, "kid-k").handlers.hover ?? []) handler(on, cx);
    };
    hover(true);
    const [box] = marks(rowOf(view, "kid-k"));
    expect([style(box as Node, "left"), style(box as Node, "bg")]).toEqual([[36], ["#hover"]]);
    expect(has(box as Node, "border_1")).toBe(false);
    expect(has(rowOf(view, "kid-k"), "hover")).toBe(false);
    hover(false);
    expect(marks(rowOf(view, "kid-k"))).toEqual([]);
  });

  describe("blocks", () => {
    const card = (view: { render(): Node }, key: string) => pathTo(view.render(), key)?.find((node) => node.key?.startsWith("block-")) as Node;

    test("the card holding the active space is raised with a dim border; the others keep surface and border", () => {
      for (const [active, key] of [["x", "head-x"], ["m", `head-${common}`], ["o", `head-${common}`]] as const) {
        const view = treeWith(active);
        app.shared["spaces.style"] = "blocks";
        expect([style(card(view, key), "bg"), style(card(view, key), "border_color")]).toEqual([["#raised"], ["#dim"]]);
        const other = key === "head-x" ? `head-${common}` : "head-x";
        expect([style(card(view, other), "bg"), style(card(view, other), "border_color")]).toEqual([["#surface"], ["#border"]]);
        const row = rowOf(view, key);
        expect(has(row, "bg")).toBe(false);
        expect(marks(row)).toEqual([]);
      }
    });

    test("the active worktree gets no box, and a hovered one the hover gray without a border", () => {
      const view = treeWith("o");
      app.shared["spaces.style"] = "blocks";
      expect(marks(rowOf(view, "kid-o"))).toEqual([]);
      expect(style(rowOf(view, "kid-k"), "pl")).toEqual([40]);
      for (const handler of rowOf(view, "kid-k").handlers.hover ?? []) handler(true, cx);
      const [hovered] = marks(rowOf(view, "kid-k"));
      expect([style(hovered as Node, "left"), style(hovered as Node, "bg")]).toEqual([[30], ["#hover"]]);
      expect(hovered?.calls.some(([name]) => name === "border_1")).toBe(false);
    });
  });
});
