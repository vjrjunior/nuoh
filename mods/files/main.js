import { View, div, image } from "gpui-kit";
import { Editor, EditorState, h_flex, InputState, ScrollHandle, v_flex } from "gpui-base";
import { checking, exec, focused, home, openOverlay, panes, props, readTextFile, settings, spaces, theme, watchFolder } from "herdr";
import { CONTROL, ICON_SIZE, RADIUS, TEXT, button, icon, iconButton, input } from "../../kit/kit.js";
import { openMarkdown } from "../../lib/open-markdown.js";
import { editorName, openInEditor, openWithApp } from "./actions.js";
import {
  ALL_FILES,
  GIT_STATE,
  LIST,
  TOTAL,
  changedRows,
  clampEntries,
  fileIcon,
  folderOf,
  isIgnored,
  join,
  kindOfFile,
  languageOf,
  letterOf,
  matches,
  nameOf,
  parseAllFiles,
  parseEntries,
  parseGitState,
  previewText,
  shortFolder,
  statusOf,
  treeRows,
} from "./logic.js";
import { FileMenu, itemsFor, MENU_WIDTH, menuHeight } from "./menu.js";

const REFRESH_MS = 10000;
const INDENT = 14;
const CHANGED_KEY = "files.changed";
const RIGHT_CLICK_MS = 600;
const IGNORED_OPACITY = 0.5;

export function locate(now, list, active) {
  let pane = now?.pane ? list.find((candidate) => candidate.pane === now.pane) : null;
  if (!pane?.cwd) pane = list.find((candidate) => candidate.tab === now?.tab && candidate.cwd) ?? pane;
  return { cwd: pane?.cwd ?? now?.cwd ?? active?.folder ?? null, machine: active?.machine ?? null, pane: pane?.pane ?? null };
}

function statusColor(kind, t) {
  return { added: t.ansi2, modified: t.ansi3, deleted: t.ansi1, conflict: t.ansi5 }[kind] ?? null;
}

function remembered() {
  try {
    return localStorage.getItem(CHANGED_KEY) === "1";
  } catch {
    return false;
  }
}

export default class Files extends View {
  init(given, cx) {
    const start = { ...(props() ?? {}), ...(given && typeof given === "object" ? given : {}) };
    if (start.role === "menu") {
      this.menu = new FileMenu(start, cx);
      return;
    }
    this.cwd = undefined;
    this.root = null;
    this.tops = new Map();
    this.saved = new Map();
    this.entries = new Map();
    this.open = new Set();
    this.git = null;
    this.all = null;
    this.limited = false;
    this.loading = false;
    this.reads = 0;
    this.watches = 0;
    this.watching = null;
    this.preview = null;
    this.selected = null;
    this.query = "";
    this.at = 0;
    this.typing = false;
    this.changedOnly = remembered();
    this.scroll = ScrollHandle.new();
    this.input = InputState.new({ placeholder: "Filter files…" });
    this.input.on("change", (_event, cx) => this.filter(this.input.value(), cx));
    this.input.on("submit", (_event, cx) => {
      const path = this.found()[this.at];
      if (path) this.activate({ path, name: nameOf(path), dir: false }, cx);
    });
    this.input.on("focus", (_event, cx) => {
      this.typing = true;
      cx.notify();
    });
    this.input.on("blur", (_event, cx) => {
      this.typing = false;
      cx.notify();
    });
    if (!checking()) cx.timer.every(REFRESH_MS, (cx) => this.reload(cx));
  }

  follow(cx) {
    const where = locate(focused(), panes(), spaces().find((space) => space.active));
    this.pane = where.pane;
    this.machine = where.machine;
    if (where.machine || where.cwd === this.cwd) return;
    this.cwd = where.cwd;
    if (!where.cwd) return this.switchTo(null, cx);
    const known = this.tops.get(where.cwd);
    if (known !== undefined) return this.switchTo(known, cx);
    const cwd = where.cwd;
    cx.spawn(async (cx) => {
      const result = await exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => null);
      const top = result?.code === 0 ? result.stdout.trim() || cwd : cwd;
      this.tops.set(cwd, top);
      if (this.cwd === cwd) this.switchTo(top, cx);
    });
  }

  switchTo(root, cx) {
    if (root === this.root) return;
    if (this.root) this.saved.set(this.root, { open: this.open });
    this.closePreview();
    this.root = root;
    this.entries = new Map();
    this.open = new Set(this.saved.get(root)?.open ?? []);
    this.git = null;
    this.all = null;
    this.limited = false;
    this.selected = null;
    this.watch(root, cx);
    this.reload(cx);
    if (this.query) this.loadAll(cx);
    cx.notify();
  }

  watch(root, cx) {
    this.watching?.cancel();
    this.watching = null;
    const mine = ++this.watches;
    if (!root) return;
    cx.spawn(async (cx) => {
      for (;;) {
        try {
          const watch = watchFolder(root);
          this.watching = watch;
          await watch;
        } catch {
          return;
        }
        if (this.watches !== mine) return;
        this.reload(cx);
      }
    });
  }

  reload(cx) {
    const root = this.root;
    if (!root) return;
    const ticket = ++this.reads;
    this.loading = true;
    cx.spawn(async (cx) => {
      const entries = new Map();
      let limited = false;
      let used = 0;
      for (const folder of ["", ...[...this.open].sort()]) {
        if (folder && !entries.has(folderOf(folder))) continue;
        const listed = await this.list(root, folder);
        if (ticket !== this.reads) return;
        if (!listed) continue;
        const { kept, limited: cut } = clampEntries(listed, used);
        used += kept.length;
        limited ||= cut;
        entries.set(folder, kept);
      }
      const state = await exec("sh", ["-c", GIT_STATE], { cwd: root }).catch(() => null);
      if (ticket !== this.reads) return;
      this.entries = entries;
      this.limited = limited;
      this.git = state?.code === 0 ? parseGitState(state.stdout) : null;
      if (this.git && this.git.top !== root) this.git = null;
      this.loading = false;
      cx.notify();
    });
  }

  async list(root, folder) {
    const result = await exec("sh", ["-c", LIST, "sh", join(root, folder)]).catch(() => null);
    return result?.code === 0 ? parseEntries(result.stdout) : null;
  }

  loadAll(cx) {
    const root = this.root;
    if (!root || this.all) return;
    this.all = { root, files: null };
    cx.spawn(async (cx) => {
      const result = await exec("sh", ["-c", ALL_FILES], { cwd: root }).catch(() => null);
      if (this.root !== root) return;
      this.all = { root, files: result?.code === 0 ? parseAllFiles(result.stdout).files : [] };
      cx.notify();
    });
  }

  filter(text, cx) {
    this.query = text;
    this.at = 0;
    if (text.trim()) this.loadAll(cx);
    cx.notify();
  }

  found() {
    return this.all?.files ? matches(this.all.files, this.query) : [];
  }

  toggle(path, cx) {
    if (this.open.has(path)) {
      for (const folder of [...this.open]) if (folder === path || folder.startsWith(`${path}/`)) this.open.delete(folder);
      cx.notify();
      return;
    }
    this.open.add(path);
    if (this.entries.has(path)) return cx.notify();
    const root = this.root;
    cx.spawn(async (cx) => {
      const listed = await this.list(root, path);
      if (this.root !== root || !this.open.has(path)) return;
      const used = [...this.entries.values()].reduce((total, list) => total + list.length, 0);
      const { kept, limited } = clampEntries(listed ?? [], used);
      this.entries.set(path, kept);
      this.limited ||= limited;
      cx.notify();
    });
  }

  activate(row, cx) {
    if (row.dir) return this.toggle(row.path, cx);
    const path = join(this.root, row.path);
    const kind = kindOfFile(row.name);
    this.selected = row.path;
    if (kind === "markdown") openMarkdown(path, { pane: this.pane });
    else if (kind === "image" || kind === "document") openWithApp(path);
    else this.show(row.path, cx);
    cx.notify();
  }

  show(relative, cx) {
    this.closePreview();
    const root = this.root;
    const preview = { path: relative, state: null, note: null };
    this.preview = preview;
    cx.spawn(async (cx) => {
      let text = null;
      try {
        text = await readTextFile(join(root, relative));
      } catch {
        preview.note = "Cannot preview this file";
      }
      if (this.preview !== preview) return;
      if (text === null && !preview.note) preview.note = "This file is gone";
      else if (text !== null) {
        const value = previewText(text);
        if (value === null) preview.note = "Binary file · no text preview";
        else {
          const t = theme();
          preview.state = EditorState.new({
            language: languageOf(nameOf(relative)),
            readonly: true,
            value,
            font_family: settings().font_family,
            font_size: TEXT.base,
            syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
          });
        }
      }
      cx.notify();
    });
  }

  closePreview() {
    this.preview?.state?.release();
    this.preview = null;
  }

  rightPress(row, cx) {
    cx.stop_propagation();
    this.rightAt = Date.now();
    this.menuFor(row);
  }

  leftClick(row, cx) {
    const right = Date.now() - (this.rightAt ?? 0) < RIGHT_CLICK_MS;
    this.rightAt = 0;
    if (!right) this.activate(row, cx);
  }

  menuFor(row) {
    const path = join(this.root, row.path);
    const count = itemsFor(path, row.dir).length;
    openOverlay({ mod: "files", kind: "popup", width: MENU_WIDTH, height: menuHeight(count), props: { role: "menu", path, relative: row.path, dir: row.dir, open: Boolean(row.open), pane: this.pane } });
  }

  setChangedOnly(on, cx) {
    this.changedOnly = on;
    try {
      localStorage.setItem(CHANGED_KEY, on ? "1" : "0");
    } catch {}
    cx.notify();
  }

  move(by, cx) {
    const count = this.found().length;
    if (count === 0) return;
    this.at = (this.at + by + count) % count;
    this.scroll.scroll_to_item(this.at);
    cx.notify();
  }

  clearFilter(cx) {
    this.input.set_value("");
    this.filter("", cx);
  }

  render(cx) {
    if (this.menu) return this.menu.render(cx);
    this.follow(cx);
    const t = theme();
    this.light = settings().dark === false;
    return v_flex()
      .id("files")
      .size_full()
      .min_h(0)
      .overflow_hidden()
      .rounded(RADIUS.panel)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .text_color(t.foreground)
      .text_size(TEXT.lg)
      .on_key_down((event, cx) => {
        if (!this.query) return;
        if (event.key === "escape") this.clearFilter(cx);
        else if (event.key === "down") this.move(1, cx);
        else if (event.key === "up") this.move(-1, cx);
      })
      .child(this.header(t))
      .when(!this.preview && !this.machine && Boolean(this.root), (el) =>
        el.child(div().flex_none().px(8).py(6).border_b_1().border_color(t.border).child(input(this.input, t, { height: CONTROL.row, active: this.typing }))),
      )
      .child(this.body(t));
  }

  header(t) {
    const bar = h_flex().id("files-head").flex_none().h(36).pl(12).pr(6).gap(8).items_center().border_b_1().border_color(t.border);
    if (this.preview) {
      const path = join(this.root, this.preview.path);
      const editor = editorName();
      return bar
        .pl(6)
        .child(iconButton("files-back", { icon: "arrow-left", tooltip: "Back to files", bordered: false, size: CONTROL.small, onClick: (cx) => this.back(cx) }, t))
        .child(this.fileImage(this.preview.path))
        .child(div().flex_none().max_w(160).truncate().font_semibold().child(nameOf(path)))
        .child(div().flex_1().min_w(0).truncate().text_size(TEXT.sm).text_color(t.dim).child(folderOf(this.preview.path) || ""))
        .child(button("files-editor", { label: editor ?? "Open", icon: "external-link", iconColor: t.muted, height: CONTROL.small, onClick: () => openInEditor(path) }, t));
    }
    const title = this.root ? nameOf(this.root) : "Files";
    const where = this.root ? shortFolder(folderOf(this.root), home()) : "";
    return bar
      .child(div().flex_none().max_w(180).truncate().font_semibold().child(title))
      .child(div().flex_1().min_w(0).truncate().text_size(TEXT.sm).text_color(t.dim).child(where))
      .when(Boolean(this.root), (el) =>
        el
          .child(
            iconButton(
              "files-changed",
              { icon: "git-compare", tooltip: this.changedOnly ? "Show all files" : "Show changed files only", color: this.changedOnly ? t.accent : t.muted, bordered: this.changedOnly, size: CONTROL.small, onClick: (cx) => this.setChangedOnly(!this.changedOnly, cx) },
              t,
            ),
          )
          .child(
            iconButton(
              "files-collapse",
              {
                icon: "chevrons-down-up",
                tooltip: "Collapse all",
                bordered: false,
                size: CONTROL.small,
                onClick: (cx) => {
                  this.open = new Set();
                  cx.notify();
                },
              },
              t,
            ),
          ),
      );
  }

  fileImage(path, { dir = false, open = false } = {}) {
    return image(fileIcon(path, { dir, open, light: this.light })).size(ICON_SIZE.lg).flex_none();
  }

  back(cx) {
    this.closePreview();
    cx.notify();
  }

  message(text, t) {
    return div().p(12).text_size(TEXT.base).text_color(t.dim).child(text);
  }

  body(t) {
    if (this.machine) return this.message(`Files on ${this.machine} isn't supported yet`, t);
    if (this.cwd === null) return this.message("No folder", t);
    if (!this.root) return this.message("Loading files…", t);
    if (this.preview) {
      if (this.preview.state) return Editor.new(this.preview.state).flex_1().min_h(0);
      return v_flex()
        .p(12)
        .gap(10)
        .items_start()
        .child(div().text_size(TEXT.base).text_color(t.dim).child(this.preview.note ?? "Loading file…"))
        .when(Boolean(this.preview.note), (el) =>
          el.child(button("files-default-app", { label: "Open with default app", icon: "external-link", iconColor: t.muted, onClick: () => openWithApp(join(this.root, this.preview.path)) }, t)),
        );
    }
    if (this.query.trim()) return this.results(t);
    const rows = this.changedOnly ? changedRows(this.git) : treeRows(this.entries, this.open).rows;
    const list = v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().py(4).children(rows.map((row) => this.row(row, t)));
    if (rows.length === 0) return list.child(this.message(this.changedOnly ? (this.git ? "No changes" : "Not a git repository") : this.loading ? "Loading files…" : "No files", t));
    if (this.limited && !this.changedOnly) list.child(div().px(12).py(8).text_size(TEXT.sm).text_color(t.dim).child(`Showing the first ${TOTAL.toLocaleString()} files`));
    return list;
  }

  row(row, t) {
    const path = join(this.root, row.path);
    const kind = statusOf(row.path, row.dir, this.git);
    const ignored = !kind && isIgnored(row.path, this.git);
    const color = statusColor(kind, t) ?? (ignored ? t.dim : t.foreground);
    const letter = row.dir ? "" : letterOf(kind);
    return h_flex()
      .id(`file-${row.path}`)
      .h(CONTROL.regular)
      .flex_none()
      .mx(4)
      .pl(6 + row.depth * INDENT)
      .pr(8)
      .gap(6)
      .items_center()
      .rounded(RADIUS.control)
      .cursor_pointer()
      .when(this.selected === row.path, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_event, cx) => this.leftClick(row, cx))
      .on_mouse_down("right", (_event, cx) => this.rightPress(row, cx))
      .drag_paths([path])
      .child(row.dir ? icon(row.open ? "chevron-down" : "chevron-right", { size: ICON_SIZE.md, color: t.dim }) : div().w(ICON_SIZE.md).flex_none())
      .child(this.fileImage(row.path, row).when(ignored, (el) => el.opacity(IGNORED_OPACITY)))
      .child(div().flex_1().min_w(0).truncate().text_color(color).child(row.name))
      .when(Boolean(letter), (el) => el.child(div().flex_none().text_size(TEXT.sm).text_color(color).child(letter)));
  }

  results(t) {
    if (!this.all?.files) return this.message("Searching…", t);
    const found = this.found();
    if (found.length === 0) return this.message("No file names match", t);
    if (this.at >= found.length) this.at = 0;
    return v_flex()
      .id("files-results")
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .track_scroll(this.scroll)
      .py(4)
      .children(
        found.map((relative, index) => {
          const name = nameOf(relative);
          const path = join(this.root, relative);
          const kind = statusOf(relative, false, this.git);
          return h_flex()
            .id(`match-${relative}`)
            .h(CONTROL.row)
            .flex_none()
            .mx(4)
            .px(8)
            .gap(8)
            .items_center()
            .rounded(RADIUS.control)
            .cursor_pointer()
            .when(index === this.at, (el) => el.bg(t.selected))
            .hover((s) => s.bg(t.hover))
            .on_click((_event, cx) => this.leftClick({ path: relative, name, dir: false }, cx))
            .on_mouse_down("right", (_event, cx) => this.rightPress({ path: relative, name, dir: false }, cx))
            .drag_paths([path])
            .child(this.fileImage(relative))
            .child(div().flex_none().max_w(180).truncate().text_color(statusColor(kind, t) ?? t.foreground).child(name))
            .child(div().flex_1().min_w(0).truncate().text_size(TEXT.sm).text_color(t.dim).child(folderOf(relative) || ""));
        }),
      );
  }
}
