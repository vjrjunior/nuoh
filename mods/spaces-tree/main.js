import { View } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, exec, theme, shared, setShared, watchFolder, window, nextCommand, layout, props } from "herdr";
import { parseWorktrees, placeOf as place } from "../../lib/checkouts.js";
import { isNarrow } from "../../lib/layout-tree.js";
import { assignColors, buildTree, canOpen, duePlaces, liveFolds, parseRefs, readLook, repoName } from "./tree.js";
import { activeChild, arrange, entryOfSpace, revealFor } from "./folders.js";
import { openNameDialog, readPinned, readState, renderPopup, saveState, startPopup } from "./popups.js";
import { DRAG, withActions } from "./actions.js";
import { withRail } from "./rail.js";
import { withRows } from "./rows.js";
import { CONTROL, ICON_SIZE, cardHeader, iconButton } from "../../kit/kit.js";

const WAIT = 1500;

const git = (args, cwd) => exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], { cwd });

export default class SpacesTree extends withRail(withRows(withActions(View))) {
  init(given, cx) {
    this.role = (given && typeof given === "object" ? given.role : null) ?? props()?.role ?? null;
    if (this.role) {
      startPopup(this, cx);
      return;
    }
    this.looks = {};
    this.unsure = new Set();
    this.checked = {};
    this.repos = {};
    this.pending = new Set();
    this.refreshing = false;
    this.watching = new Map();
    this.lastPlaces = {};
    this.lastBusy = {};
    this.shown = new Set(spaces().map((space) => space.id));
    this.born = {};
    this.opening = {};
    this.hovered = null;
    this.kidHover = null;
    this.pressed = null;
    this.over = null;
    this.dropOver = null;
    this.dragUnit = null;
    this.overFolder = null;
    this.movingFolder = null;
    this.overMove = null;
    this.revealed = spaces().find((space) => space.active)?.id ?? null;
    this.revealing = null;
    this.scroll = ScrollHandle.new();
    this.inView = null;
    this.picked = null;
    cx.timer.every(250, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        if ((await nextCommand()) === "style") this.toggleStyle();
        cx.notify();
      }
    });
  }

  style() {
    return shared("spaces.style") === "blocks" ? "blocks" : "graph";
  }

  toggleStyle() {
    setShared("spaces.style", this.style() === "blocks" ? "graph" : "blocks");
  }

  narrow() {
    return isNarrow(layout());
  }

  folded() {
    const value = shared("spaces.folded");
    return new Set(Array.isArray(value) ? value : []);
  }

  current() {
    const all = spaces();
    const ps = panes();
    const places = {};
    const spaceOfTab = {};
    for (const space of all) {
      for (const tab of space.tabs ?? []) spaceOfTab[tab.id] = space.id;
      if (space.machine != null) continue;
      const at = place(space, ps);
      if (at) places[space.id] = at;
    }
    const busy = {};
    const paneSpace = {};
    for (const pane of ps) {
      const id = spaceOfTab[pane.tab];
      if (!pane.terminal || !id) continue;
      busy[pane.pane] = pane.status === "working" || !(pane.program?.shell || pane.program?.agent);
      paneSpace[pane.pane] = id;
    }
    return { all, places, busy, paneSpace };
  }

  tick(cx) {
    const { all, places, busy, paneSpace } = this.current();
    const time = Date.now();
    for (const space of all) if (!this.shown.has(space.id)) this.born[space.id] ??= time;
    const due = duePlaces({
      places,
      lastPlaces: this.lastPlaces,
      busy,
      lastBusy: this.lastBusy,
      paneSpace,
      looks: this.looks,
      unsure: this.unsure,
      checked: this.checked,
      time,
      active: Boolean(window()?.active),
      folded: new Set([...liveFolds(this.folded(), this.repos), ...this.hiddenUnits()]),
    });
    this.lastPlaces = places;
    this.lastBusy = busy;
    if (due.size) this.refresh(due, cx);
    if (all.some((space) => !this.shown.has(space.id))) cx.notify();
    const active = all.find((space) => space.active)?.id ?? null;
    if (active !== this.revealed) {
      this.revealed = active;
      this.revealing = active;
    }
    if (this.revealing) this.reveal();
  }

  hiddenUnits() {
    const state = readState();
    const folded = new Set(state.folders.filter((folder) => folder.folded).map((folder) => folder.id));
    const pins = new Set(readPinned());
    return Object.keys(state.members).filter((unit) => folded.has(state.members[unit]) && !pins.has(unit));
  }

  reveal() {
    const space = spaces().find((known) => known.id === this.revealing);
    if (!space) {
      this.revealing = null;
      return;
    }
    if (!this.shown.has(space.id) || !this.settled(space)) return;
    const entry = entryOfSpace(this.entries(), space.id);
    if (!entry) return;
    this.revealing = null;
    const state = readState();
    saveState(state, revealFor(state, entry.key, readPinned()));
  }

  settled(space) {
    const look = this.looks[this.lastPlaces[space.id]];
    return space.machine != null || look === null || Boolean(look && this.repos[look.common]);
  }

  refresh(paths, cx) {
    for (const path of paths) this.pending.add(path);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      try {
        while (this.pending.size) {
          const batch = [...this.pending];
          this.pending.clear();
          const looks = await Promise.all(batch.map((path) => this.lookAt(path)));
          const repos = new Set(looks.filter(Boolean).map((look) => look.common));
          await Promise.all([...repos].map((common) => this.readRepo(common, cx)));
          cx.notify();
        }
        this.forget();
      } finally {
        this.refreshing = false;
      }
      cx.notify();
    });
  }

  async lookAt(path) {
    this.checked[path] = Date.now();
    try {
      const look = readLook(await git(["rev-parse", "--show-toplevel", "--path-format=absolute", "--git-common-dir"], path));
      if (look === undefined) {
        this.unsure.add(path);
        return this.looks[path] ?? null;
      }
      this.unsure.delete(path);
      this.looks[path] = look;
      return look;
    } catch {
      this.unsure.add(path);
      return this.looks[path] ?? null;
    }
  }

  async readRepo(common, cx) {
    try {
      const [list, refs] = await Promise.all([
        git(["worktree", "list", "--porcelain"], common),
        git(["for-each-ref", "--format=%(refname:short)%09%(upstream:track)%09%(committerdate:unix)", "refs/heads"], common),
      ]);
      if (list.code !== 0) return;
      this.repos[common] = { common, name: repoName(common), checkouts: parseWorktrees(list.stdout), refs: refs.code === 0 ? parseRefs(refs.stdout) : {} };
      this.watch(common, cx);
    } catch {}
  }

  watch(common, cx) {
    if (this.watching.has(common)) return;
    this.watching.set(common, null);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(common)) {
          const watch = watchFolder(common);
          this.watching.set(common, watch);
          await watch;
          if (this.watching.get(common) !== watch) break;
          const used = new Set(Object.values(this.lastPlaces));
          this.refresh(Object.keys(this.looks).filter((path) => used.has(path) && this.looks[path]?.common === common), cx);
        }
      } catch {
        this.watching.delete(common);
      }
    });
  }

  forget() {
    const used = new Set(Object.values(this.lastPlaces).map((path) => this.looks[path]?.common).filter(Boolean));
    for (const [common, watch] of this.watching) {
      if (used.has(common)) continue;
      this.watching.delete(common);
      watch?.cancel();
    }
  }

  entries() {
    const time = Date.now();
    const all = spaces();
    const lookOf = (space) => this.looks[this.lastPlaces[space.id]];
    for (const space of all) {
      if (!this.shown.has(space.id) && (this.settled(space) || time - (this.born[space.id] ?? time) > WAIT)) this.shown.add(space.id);
    }
    const visible = all.filter((space) => this.shown.has(space.id));
    const looks = Object.fromEntries(visible.map((space) => [space.id, lookOf(space)]));
    return buildTree(visible, looks, this.repos);
  }

  open(row) {
    if (row.space) {
      this.picked = row.space.id;
      run("space.select", { id: row.space.id });
      return;
    }
    const time = Date.now();
    if (!row.path || !canOpen(this.opening, row.path, time)) return;
    this.opening[row.path] = time;
    run("space.new", { folder: row.path, machine: "" });
  }

  bringActive(groups, narrow) {
    const id = spaces().find((space) => space.active)?.id ?? null;
    const { at, folded } = activeChild(groups, narrow);
    const key = `${id}:${at}:${folded}:${narrow}`;
    if (key === this.inView) return;
    this.inView = key;
    if (id === this.picked) return;
    this.picked = null;
    if (at >= 0) this.scroll.scroll_to_item(at);
  }

  headButton(id, name, tooltip, action, t) {
    return iconButton(id, { icon: name, tooltip, color: t.muted, stop: true, onPress: () => this.endDrag(), onClick: action }, t);
  }

  cardHead(t) {
    return cardHeader("spaces-head", { icon: "layers", label: "Spaces", count: spaces().length }, t).child(
      h_flex()
        .items_center()
        .child(
          this.style() === "blocks"
            ? this.headButton("space-style", "git-branch", "Show as a graph", () => this.toggleStyle(), t)
            : this.headButton("space-style", "layers", "Show as blocks", () => this.toggleStyle(), t),
        )
        .child(this.headButton("space-folder", "folder-plus", "New folder", () => openNameDialog({}), t))
        .child(this.headButton("space-new", "plus", "New space", () => run("space.new"), t)),
    );
  }

  header(t, narrow) {
    if (!narrow) return this.cardHead(t);
    return h_flex()
      .h(31)
      .flex_none()
      .items_center()
      .justify_center()
      .child(this.iconButton("space-new", "plus", "New space", () => run("space.new"), t));
  }

  render(cx) {
    if (this.role) return renderPopup(this);
    const t = theme();
    const { colors, changed } = assignColors(spaces(), shared("space.colors") ?? {});
    if (changed) setShared("space.colors", colors);
    const narrow = this.narrow();
    const groups = arrange(this.entries(), readState(), readPinned());
    const blocks = this.style() === "blocks";
    this.bringActive(groups, narrow);
    const draw = (entry, inFolder = false, last = false) => (blocks ? this.blockEntry(entry, t, inFolder, last) : this.graphEntry(entry, t, inFolder));
    return v_flex()
      .size_full()
      .min_h(0)
      .text_size(13)
      .when(shared(DRAG)?.moving === true, (el) => el.cursor_grabbing())
      .on_mouse_down("left", () => this.endDrag())
      .child(this.header(t, narrow).on_mouse_down_out(() => this.forgetOldDrag()))
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .px(narrow ? 0 : 8)
          .pb(8)
          .overflow_y_scrollbar()
          .mode("always")
          .track_scroll(this.scroll)
          .on_mouse_up("left", (_e, cx) => {
            this.landFolder();
            this.pressed = null;
            this.over = null;
            this.dropOver = null;
            this.dragUnit = null;
            this.overFolder = null;
            this.endDrag();
            cx.notify();
          })
          .on_mouse_down_out(() => {
            this.pressed = null;
            this.over = null;
            this.dragUnit = null;
            this.overFolder = null;
            this.movingFolder = null;
            this.overMove = null;
          })
          .children(
            narrow
              ? this.compactRows(groups, t)
              : [...groups.pinned.map((entry) => draw(entry)), ...groups.folders.map((group) => this.folderSection(group, t, draw, blocks)), ...groups.loose.map((entry) => draw(entry))],
          ),
      );
  }
}
