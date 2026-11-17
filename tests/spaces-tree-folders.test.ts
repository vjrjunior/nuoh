import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { herdr, type Node } from "./app-mocks";
import { reset, SpacesTree, app, click, common, cx, fire, onMain, pathTo, setup, space, style, texts } from "./spaces-tree-harness";

beforeEach(reset);

describe("folders", () => {
  const FOLDERS = "spaces.folders";
  const folders = (members: Record<string, string>, folded = false) => ({
    folders: [
      { id: "f1", name: "Clients", color: "ansi4", folded },
      { id: "f2", name: "Empty", color: "ansi2", folded: false },
    ],
    members,
  });
  const state = () => app.shared[FOLDERS] as ReturnType<typeof folders>;
  const listKeys = (view: { render(): Node }) => (view.render().kids[1] as Node).kids.map((kid) => kid.key);
  const node = (view: { render(): Node }, key: string) => pathTo(view.render(), key) as Node[];
  const drag = (view: { render(): Node }, from: string, to: string) => {
    fire(node(view, from), "down:left");
    fire(node(view, to), "move");
    fire(node(view, to), "up:left");
  };

  function placed(spaces: Record<string, unknown>[], looks: Record<string, unknown>) {
    app.spaces = spaces;
    const view = new SpacesTree();
    view.init({}, cx);
    view.lastPlaces = Object.fromEntries(spaces.map((one) => [one.id, one.folder]));
    view.looks = looks;
    view.repos = { [common]: { common, name: "app", checkouts: onMain, refs: {} } };
    return view;
  }

  test("folders come first in their order, then the loose repos and spaces", () => {
    app.shared[FOLDERS] = folders({ x: "f1" });
    const view = setup();
    expect(listKeys(view)).toEqual(["folder-card-f1", "folder-card-f2", `group-${common}`]);
    expect(pathTo(view.render(), "group-x")?.map((one) => one.key)).toEqual([undefined, undefined, "folder-card-f1", "folder-body-f1", "group-x"]);
  });

  test("blocks draw the same folders around their cards", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" });
    app.shared["spaces.style"] = "blocks";
    const keys = listKeys(setup());
    expect(keys).toEqual(["folder-card-f1", "folder-card-f2", "block-x"]);
    expect(pathTo(setup().render(), `block-${common}`)?.map((one) => one.key)).toContain("folder-body-f1");
  });

  test("a click folds a folder and hides what is in it", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" });
    const view = setup();
    click(view, "folder-f1");
    expect(state().folders[0].folded).toBe(true);
    expect(listKeys(view)).toEqual(["folder-card-f1", "folder-card-f2", "group-x"]);
    expect(pathTo(view.render(), "folder-body-f1")).toBeNull();
    expect(app.runs.filter(([name]) => name === "space.select")).toEqual([]);
    click(view, "folder-f1");
    expect(state().folders[0].folded).toBe(false);
  });

  test("a folded folder says how many agents need you, counting blocked and done", () => {
    app.shared[FOLDERS] = folders({ x: "f1" }, true);
    const view = setup();
    app.spaces = [space("m"), space("x", { active: true, status: "blocked" })];
    app.agents = [
      { space: "x", status: "blocked" },
      { space: "x", status: "done" },
      { space: "x", status: "working" },
      { space: "m", status: "blocked" },
    ];
    const row = node(view, "folder-f1").at(-1) as Node;
    expect(texts(row)).toContain("2 need you");
    app.agents = [{ space: "x", status: "done" }];
    expect(texts(node(view, "folder-f1").at(-1) as Node)).toContain("1 needs you");
    app.agents = [{ space: "x", status: "working" }];
    expect(texts(node(view, "folder-f1").at(-1) as Node).join(" ")).not.toContain("need");
  });

  test("an open folder shows how many repositories and spaces it holds", () => {
    app.shared[FOLDERS] = folders({ x: "f1", [common]: "f1" });
    app.agents = [{ space: "x", status: "blocked" }];
    const view = setup();
    expect(texts(node(view, "folder-f1").at(-1) as Node)).toEqual(["Clients", "2"]);
    expect(texts(node(view, "folder-f2").at(-1) as Node)).toEqual(["Empty", "0"]);
  });

  test("a folded folder with nobody waiting shows how many it holds", () => {
    app.shared[FOLDERS] = folders({ x: "f1" }, true);
    app.agents = [{ space: "x", status: "working" }];
    expect(texts(node(setup(), "folder-f1").at(-1) as Node)).toEqual(["Clients", "1"]);
  });

  test("dragging a repository's row onto a folder files it there", () => {
    app.shared[FOLDERS] = folders({});
    const view = setup();
    drag(view, `head-${common}`, "folder-f1");
    expect(state().members).toEqual({ [common]: "f1" });
    expect(app.runs.filter(([name]) => name === "space.move")).toEqual([]);
  });

  describe("look", () => {
    const shared = herdr.theme;
    beforeEach(() => {
      herdr.theme = () => new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? `#${prop}` : undefined) });
    });
    afterEach(() => {
      herdr.theme = shared;
    });
    const border = (view: { render(): Node }, id: string) => style(node(view, `folder-card-${id}`).at(-1) as Node, "border_color")?.[0];

    test("a folder is a card holding a gray band with its name, not a tile", () => {
      app.shared[FOLDERS] = folders({ x: "f1" });
      const view = setup();
      const card = node(view, "folder-card-f1").at(-1) as Node;
      expect([style(card, "bg"), style(card, "rounded"), style(card, "p"), style(card, "border_color")]).toEqual([["#surface"], [10], [4], ["#border"]]);
      const band = node(view, "folder-f1").at(-1) as Node;
      expect([style(band, "h"), style(band, "bg"), style(band, "rounded")]).toEqual([[26], ["#raised"], [6]]);
      const [glyph, name] = band.kids;
      expect(glyph?.calls[0]).toEqual(["svg", ["mods/kit/icons/folder.svg"]]);
      expect(style(glyph as Node, "text_color")).toEqual(["#5b8def"]);
      expect([style(name as Node, "text_color"), style(name as Node, "text_size")]).toEqual([["#foreground"], [13]]);
      expect(band.kids.some((kid) => style(kid, "size")?.[0] === 22)).toBe(false);
      const body = node(view, "folder-body-f1").at(-1) as Node;
      expect([style(body, "px"), style(body, "pt")]).toEqual([[4], [2]]);
    });

    test("a card lights up only while a row is held over its band", () => {
      app.shared[FOLDERS] = folders({});
      const view = setup();
      fire(node(view, "folder-f1"), "move");
      expect(border(view, "f1")).toBe("#border");
      fire(node(view, `head-${common}`), "down:left");
      fire(node(view, "folder-f1"), "move");
      expect(border(view, "f1")).toBe("#accent");
      expect(border(view, "f2")).toBe("#border");
      fire(node(view, "folder-f1"), "up:left");
      expect(border(view, "f1")).toBe("#border");
    });

    test("a folded folder holding the active space gets a dim card border", () => {
      app.shared[FOLDERS] = folders({ x: "f1" }, true);
      const view = setup();
      expect(border(view, "f1")).toBe("#dim");
      expect(style(node(view, "folder-f1").at(-1) as Node, "bg")).toEqual(["#raised"]);
      app.shared[FOLDERS] = folders({ x: "f1" });
      expect(border(view, "f1")).toBe("#border");
    });

    test("the active group inside a card sits on selected, and outside on raised", () => {
      app.shared[FOLDERS] = folders({ x: "f1" });
      expect(style(node(setup(), "group-x").at(-1) as Node, "bg")).toEqual(["#selected"]);
      app.shared[FOLDERS] = folders({});
      expect(style(node(setup(), "group-x").at(-1) as Node, "bg")).toEqual(["#raised"]);
    });

    test("the active worktree's ring is filled with the card's ground inside a folder", () => {
      app.shared[FOLDERS] = folders({ [common]: "f1" });
      app.spaces = [space("m"), space("o", { active: true })];
      const view = new SpacesTree();
      view.init({}, cx);
      view.lastPlaces = { m: "/r/app", o: "/w/app/one" };
      view.looks = { "/r/app": { top: "/r/app", common }, "/w/app/one": { top: "/w/app/one", common } };
      view.repos = { [common]: { common, name: "app", checkouts: onMain, refs: {} } };
      const kid = node(view, "kid-o").at(-1) as Node;
      expect(kid.kids.some((one) => style(one, "size")?.[0] === 14 && style(one, "bg")?.[0] === "#selected")).toBe(true);
    });

    test("blocks inside a card sit on chrome, and the last one keeps 2px under it", () => {
      app.shared[FOLDERS] = folders({ x: "f1", [common]: "f1" });
      app.shared["spaces.style"] = "blocks";
      const view = setup();
      app.spaces = [space("m"), space("x")];
      const first = node(view, `block-${common}`).at(-1) as Node;
      const last = node(view, "block-x").at(-1) as Node;
      expect([style(first, "bg"), style(first, "mb")]).toEqual([["#chrome"], [6]]);
      expect([style(last, "bg"), style(last, "mb")]).toEqual([["#chrome"], [2]]);
      expect(style(node(view, "folder-body-f1").at(-1) as Node, "pt")).toEqual([6]);
      app.shared[FOLDERS] = folders({});
      expect(style(node(view, "block-x").at(-1) as Node, "bg")).toEqual(["#surface"]);
    });
  });

  test("a click on a row, then hovering a folder, files nothing", () => {
    app.shared[FOLDERS] = folders({});
    const view = setup();
    click(view, `head-${common}`);
    fire(node(view, "folder-f1"), "move");
    fire(node(view, "folder-f1"), "up:left");
    expect(state().members).toEqual({});
  });

  test("a press outside the list forgets a row drag", () => {
    app.shared[FOLDERS] = folders({});
    const view = setup();
    fire(node(view, `head-${common}`), "down:left");
    for (const handler of (view.render().kids[1] as Node).handlers.down_out ?? []) handler({}, cx);
    fire(node(view, "folder-f1"), "move");
    fire(node(view, "folder-f1"), "up:left");
    expect(state().members).toEqual({});
  });

  test("a row let go on a row outside its folder leaves the folder and still reorders", () => {
    app.shared[FOLDERS] = folders({ x: "f1" });
    const view = setup();
    drag(view, "head-x", `head-${common}`);
    expect(state().members).toEqual({});
    expect(app.runs).toContainEqual(["space.move", { id: "x", index: 1 }]);
  });

  test("a row let go on a row in a folder joins that folder", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" });
    const view = setup();
    drag(view, "head-x", `head-${common}`);
    expect(state().members).toEqual({ [common]: "f1", x: "f1" });
  });

  test("a repository whose main checkout is closed drags into a folder too", () => {
    app.shared[FOLDERS] = folders({});
    const view = placed([space("o", { folder: "/w/app/one" }), space("x", { active: true, folder: "/x" })], { "/w/app/one": { top: "/w/app/one", common }, "/x": null });
    drag(view, `head-${common}`, "folder-f1");
    expect(state().members).toEqual({ [common]: "f1" });
  });

  test("going to a space in a folded folder opens the folder, and folding it again sticks", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" }, true);
    const looks = { "/r/app": { top: "/r/app", common }, "/x": null };
    const view = placed([space("m", { folder: "/r/app" }), space("x", { active: true, folder: "/x" })], looks);
    view.tick(cx);
    expect(state().folders[0].folded).toBe(true);
    app.spaces = [space("m", { active: true, folder: "/r/app" }), space("x", { folder: "/x" })];
    view.tick(cx);
    expect(state().folders[0].folded).toBe(false);
    click(view, "folder-f1");
    view.tick(cx);
    expect(state().folders[0].folded).toBe(true);
  });

  test("going to a loose space leaves the folders as they are", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" }, true);
    const before = app.shared[FOLDERS];
    const looks = { "/r/app": { top: "/r/app", common }, "/x": null };
    const view = placed([space("m", { active: true, folder: "/r/app" }), space("x", { folder: "/x" })], looks);
    app.spaces = [space("m", { folder: "/r/app" }), space("x", { active: true, folder: "/x" })];
    view.tick(cx);
    expect(app.shared[FOLDERS]).toBe(before);
  });

  test("the space menu learns the row's repository and its name", () => {
    app.shared[FOLDERS] = folders({ [common]: "f1" });
    fire(node(setup(), `head-${common}`), "down:right");
    const menu = app.overlays.at(-1) as Record<string, any>;
    expect(menu.mod).toBe("menu");
    expect(menu.props.target).toEqual({ id: "m" });
    expect(menu.props.folder.unit).toBe(common);
    expect(menu.props.folder.name).toBe("app");
    expect(menu.props.folder.height).toBeGreaterThan(100);
  });

  test("a worktree's menu files its whole repository", () => {
    app.shared[FOLDERS] = folders({});
    const view = placed([space("m", { folder: "/r/app" }), space("o", { folder: "/w/app/one" })], { "/r/app": { top: "/r/app", common }, "/w/app/one": { top: "/w/app/one", common } });
    fire(node(view, "kid-o"), "down:right");
    expect(app.overlays.at(-1)?.props.folder.unit).toBe(common);
  });

  test("a folder's right-click opens its own popup", () => {
    app.shared[FOLDERS] = folders({});
    fire(node(setup(), "folder-f1"), "down:right");
    expect(app.overlays.at(-1)).toMatchObject({ mod: "spaces-tree", kind: "popup", props: { role: "folder", folder: "f1" } });
  });

  test("the folder button left of + opens the name dialog for an empty folder", () => {
    const header = setup().render().kids[0] as Node;
    expect(header.kids.at(-1)?.kids.map((kid) => kid.key)).toEqual(["space-style", "space-folder", "space-new"]);
    click(setup(), "space-folder");
    expect(app.overlays.at(-1)).toMatchObject({ mod: "spaces-tree", kind: "dialog", props: { role: "name" } });
    expect(app.overlays.at(-1)?.props.unit).toBeUndefined();
  });

  test("a folder made with no space in it shows empty at the top", () => {
    app.props = { role: "name", overlay: "o1" };
    const dialog = new SpacesTree();
    dialog.init({}, { ...cx, focus_handle: () => null, timer: { every() {}, after() {} } });
    dialog.input.set_value("Later");
    dialog.input.emit("submit", cx);
    app.props = null;
    expect((app.shared[FOLDERS] as ReturnType<typeof folders>).members).toEqual({});
    expect(listKeys(setup())[0]).toMatch(/^folder-card-f/);
  });

  test("the narrow rail draws a folder as its tile and folds it on a click", () => {
    app.shared[FOLDERS] = folders({ x: "f1" });
    app.sidebar = 100;
    const view = setup();
    expect(listKeys(view)).toEqual(["compact-folder-f1", "compact-x", "compact-folder-f2", "compact-m"]);
    click(view, "compact-folder-f1");
    expect(listKeys(view)).toEqual(["compact-folder-f1", "compact-folder-f2", "compact-m"]);
  });
});

describe("folder popups", () => {
  const FOLDERS = "spaces.folders";
  const saved = () => app.shared[FOLDERS] as { folders: Record<string, unknown>[]; members: Record<string, string> };
  const open = (role: string, given: Record<string, unknown>) => {
    app.props = { ...given, role, overlay: "o1" };
    const view = new SpacesTree();
    view.init({}, { ...cx, focus_handle: () => ({ focus() {} }), timer: { every() {}, after() {} } });
    return view;
  };
  const press = (view: { render(): Node }, key: string) => fire(pathTo(view.render(), key) as Node[], "click");

  beforeEach(() => {
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: false }], members: {} };
  });

  test("Move to folder lists the folders and files the repository in the one picked", () => {
    const view = open("folders", { unit: common, name: "app" });
    const root = view.render();
    expect(texts(root)).toEqual(expect.arrayContaining(["MOVE TO FOLDER · APP", "Clients", "New folder…"]));
    expect(texts(root)).not.toContain("Remove from folder");
    press(view, "move-f1");
    expect(saved().members).toEqual({ [common]: "f1" });
    expect(app.closed).toEqual(["o1"]);
  });

  test("Move to folder takes a filed repository out, and checks its folder", () => {
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: false }], members: { [common]: "f1" } };
    const view = open("folders", { unit: common, name: "app" });
    expect(texts(view.render())).toContain("Remove from folder");
    press(view, "move-out");
    expect(saved().members).toEqual({});
  });

  test("New folder… opens the name dialog for the repository", () => {
    const view = open("folders", { unit: common, name: "app" });
    press(view, "move-new");
    expect(app.closed).toEqual(["o1"]);
    expect(app.overlays.at(-1)).toMatchObject({ mod: "spaces-tree", kind: "dialog", props: { role: "name", unit: common } });
  });

  test("the name dialog creates nothing while the name is empty, and creates the folder with the repository in it", () => {
    const view = open("name", { unit: common });
    expect(texts(view.render())).toEqual(expect.arrayContaining(["New folder", "Create"]));
    press(view, "name-save");
    expect(saved().folders).toHaveLength(1);
    press(view, "name-color-ansi5");
    view.input.set_value("  Personal ");
    view.input.emit("submit", cx);
    expect(saved().folders.at(-1)).toMatchObject({ name: "Personal", color: "ansi5", folded: false });
    expect(saved().members[common]).toBe(saved().folders.at(-1)?.id as string);
    expect(app.closed).toEqual(["o1"]);
  });

  test("a new folder starts on the color the fewest folders use", () => {
    expect(open("name", { unit: common }).color).toBe("ansi6");
  });

  test("Cancel leaves no folder behind", () => {
    const view = open("name", { unit: common });
    view.input.set_value("Later");
    press(view, "name-cancel");
    expect(saved().folders).toHaveLength(1);
    expect(app.closed).toEqual(["o1"]);
  });

  test("renaming starts from the folder's name and color", () => {
    const view = open("name", { folder: "f1" });
    expect(view.input.value()).toBe("Clients");
    expect(view.color).toBe("ansi4");
    expect(texts(view.render())).toEqual(expect.arrayContaining(["Rename folder", "Save"]));
    view.input.set_value("Work");
    press(view, "name-color-ansi3");
    press(view, "name-save");
    expect(saved().folders).toEqual([{ id: "f1", name: "Work", color: "ansi3", folded: false }]);
  });

  test("the folder popup recolors at once, renames through the dialog and deletes", () => {
    app.shared[FOLDERS] = { folders: [{ id: "f1", name: "Clients", color: "ansi4", folded: false }], members: { [common]: "f1" } };
    const view = open("folder", { folder: "f1" });
    press(view, "folder-color-ansi1");
    expect(saved().folders[0]?.color).toBe("ansi1");
    press(view, "folder-rename");
    expect(app.overlays.at(-1)).toMatchObject({ mod: "spaces-tree", kind: "dialog", props: { role: "name", folder: "f1" } });
    press(view, "folder-delete");
    expect(saved()).toEqual({ folders: [], members: {} });
  });

  test("a popup copy starts no timer, no git and no command loop", () => {
    let timers = 0;
    let spawns = 0;
    app.props = { role: "folder", folder: "f1", overlay: "o1" };
    new SpacesTree().init({}, { notify() {}, focus_handle: () => null, timer: { every: () => timers++, after() {} }, spawn: () => spawns++ });
    expect([timers, spawns]).toEqual([0, 0]);
  });
});
