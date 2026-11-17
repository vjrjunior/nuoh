import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, run, shared } from "herdr";
import { branchLabel, counts, foldedTail, holdsActive, isFolded, paint } from "./tree.js";
import { folderOf, folderTail } from "./folders.js";
import { readState } from "./popups.js";
import { CONTROL, ICON_SIZE, TEXT, icon, iconButton, statusDot, toneColor } from "../../kit/kit.js";

const RAIL = 18.25;
const HEAD = 36;
const TALL = 48;
const AVATAR = 22;
const LINE = 18;
const SUB = 14;
const KID = 34;
const LANE = 48;
const TIE = 17;
const NODE = 31;
const BOX = 36;
const BAND = 26;
const CARD = 4;
const alpha = (color, value) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${value}` : color);
const faded = (color) => alpha(color, "B3");

export const withRows = (Base) =>
  class extends Base {
    fill(space, t) {
      if (!space) return t.dim;
      return paint((shared("space.colors") ?? {})[space.id] ?? "ansi6", t);
    }

    tile(color, size, glyph) {
      return h_flex()
        .size(size)
        .flex_none()
        .rounded(6)
        .bg(color)
        .items_center()
        .justify_center()
        .child(icon("folder", { size: glyph, color: "#ffffff" }));
    }

    band(folder, entries, t) {
      const tail = folder.folded ? folderTail(entries, agents()) : null;
      const count = tail?.needs ? `${tail.needs} ${tail.needs === 1 ? "needs" : "need"} you` : String(entries.length);
      return h_flex()
        .id(`folder-${folder.id}`)
        .h(BAND)
        .flex_none()
        .px(8)
        .gap(7)
        .items_center()
        .rounded(6)
        .bg(t.raised)
        .hover((s) => s.bg(t.selected))
        .child(icon("folder", { size: ICON_SIZE.md, color: paint(folder.color, t) }))
        .child(div().flex_1().min_w(0).truncate().text_size(TEXT.xl).font_bold().text_color(t.foreground).child(folder.name))
        .child(this.note(count, t))
        .when(Boolean(tail?.status), (el) => el.child(this.statusDot(tail.status, t)))
        .child(icon(folder.folded ? "chevron-right" : "chevron-down", { size: ICON_SIZE.md, color: t.unknown }))
        .on_hover((on, cx) => this.overFolderRow(folder, on, cx))
        .on_mouse_move((_e, cx) => this.overFolderRow(folder, true, cx))
        .on_mouse_up("left", (_e, cx) => {
          if (this.dropOnFolder(folder)) cx.notify();
        })
        .on_click(() => this.toggleFolder(folder.id))
        .on_mouse_down("right", () => this.folderMenu(folder));
    }

    folderSection({ folder, entries }, t, draw, blocks) {
      const dropping = this.overFolder === folder.id && this.dragUnit != null && folderOf(readState(), this.dragUnit) !== folder.id;
      const active = folder.folded && entries.some(holdsActive);
      return v_flex()
        .id(`folder-card-${folder.id}`)
        .flex_none()
        .mb(6)
        .p(CARD)
        .rounded(10)
        .bg(t.surface)
        .border_1()
        .border_color(dropping ? t.accent : active ? t.dim : t.border)
        .child(this.band(folder, entries, t))
        .when(!folder.folded && entries.length > 0, (el) =>
          el.child(
            v_flex()
              .id(`folder-body-${folder.id}`)
              .flex_none()
              .px(CARD)
              .pt(blocks ? 6 : 2)
              .children(entries.map((entry, index) => draw(entry, true, index === entries.length - 1))),
          ),
        );
    }

    avatar(row, t) {
      return h_flex()
        .size(AVATAR)
        .flex_none()
        .rounded(6)
        .bg(this.fill(row.space, t))
        .items_center()
        .justify_center()
        .text_size(12)
        .font_bold()
        .text_color("#ffffff")
        .child([...row.name][0]?.toUpperCase() ?? "?");
    }

    statusDot(status, t) {
      return statusDot(t[status] ?? t.unknown);
    }

    iconButton(id, name, tooltip, action, t) {
      return iconButton(id, { icon: name, tooltip, color: t.unknown, size: CONTROL.tiny, iconSize: ICON_SIZE.md, bordered: false, stop: true, onPress: () => this.endDrag(), onClick: action }, t);
    }

    name(row, t) {
      return div().flex_1().min_w(0).truncate().text_color(row.open ? t.foreground : t.unknown).child(row.name);
    }

    sub(text, t) {
      return div()
        .pl(AVATAR + 8)
        .min_w(0)
        .h(SUB)
        .line_height(`${SUB}px`)
        .truncate()
        .text_size(11)
        .text_color(t.unknown)
        .child(text);
    }

    laneLine(row, t) {
      const found = row.path ? (shared("spaces-tree.lines") ?? {})[row.path] : null;
      if (!found?.text) return null;
      const color = toneColor(found.tone, t);
      const sub = h_flex()
        .h(SUB)
        .flex_none()
        .min_w(0)
        .items_center()
        .gap(4)
        .truncate()
        .text_size(TEXT.sm)
        .child(div().flex_none().text_color(color).child(found.text))
        .when(Boolean(found.why), (el) => el.child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(`· ${found.why}`)));
      return { height: LANE, sub };
    }

    note(text, t) {
      return div().flex_none().text_size(11).text_color(t.unknown).child(text);
    }

    bar(status, t, height) {
      return div().absolute().left(0).top(0).w(3).h(height).bg(t[status] ?? t.unknown);
    }

    frame(color) {
      return div().absolute().left(0).right(0).top(0).bottom(0).rounded(8).border_1().border_color(color);
    }

    box(left, right, t) {
      return div().absolute().left(left).right(right).top(2).bottom(2).rounded(7).bg(t.hover);
    }

    node(row, rail, t) {
      return div()
        .absolute()
        .left(NODE)
        .top(TIE - 5)
        .size(10)
        .rounded(5)
        .when(row.open, (el) => el.bg(t[row.status] ?? t.dim))
        .when(!row.open, (el) => el.border(1.5).border_color(rail));
    }

    ring(row, color, ground, t) {
      return [
        div().absolute().left(NODE - 2).top(TIE - 7).size(14).rounded(7).border(1.5).border_color(color).bg(ground),
        div()
          .absolute()
          .left(NODE + 2)
          .top(TIE - 3)
          .size(6)
          .rounded(3)
          .bg((row.status && row.status !== "idle" && t[row.status]) || color),
      ];
    }

    headRow(entry, row, t, rail, flat = false) {
      const repo = entry.kind === "repo";
      const folded = isFolded(this.folded(), entry);
      const selected = Boolean(row.space?.active) || (folded && holdsActive(entry));
      const adding = repo && this.hovered === entry.key;
      const summary = folded ? foldedTail(entry) : null;
      const branch = summary ? "" : branchLabel(row);
      const text = summary ? String(summary.count) : counts(row);
      const height = branch ? TALL : HEAD;
      const status = summary ? summary.status : row.status;
      const all = spaces();
      const index = row.space ? all.findIndex((space) => space.id === row.space.id) : -1;
      const line = h_flex()
        .gap(8)
        .items_center()
        .child(this.avatar(row, t))
        .child(this.name(row, t).font_medium())
        .when(adding, (el) => el.child(this.iconButton(`add-${entry.key}`, "plus", "New worktree", () => this.newWorktree(entry), t)))
        .when(!adding && Boolean(text), (el) => el.child(this.note(text, t)))
        .when(Boolean(status) && !flat, (el) => el.child(this.statusDot(status, t)))
        .when(repo && entry.kids.length > 0, (el) =>
          el.child(this.iconButton(`fold-${entry.key}`, folded ? "chevron-right" : "chevron-down", folded ? "Unfold" : "Fold", () => this.toggleFold(entry.key), t)),
        );
      const bottom = (height - (branch ? AVATAR + 1 + SUB : AVATAR)) / 2 + AVATAR;
      const el = (branch ? v_flex().justify_center().gap(1).child(line.h(AVATAR)).child(this.sub(branch, t)) : line)
        .id(`head-${entry.key}`)
        .relative()
        .h(height)
        .flex_none()
        .px(flat ? 10 : 8)
        .when(!flat, (el) => el.rounded(8))
        .when(!selected, (el) => el.hover((s) => s.bg(t.hover)))
        .when(index < 0, (el) => el.on_click(() => this.open(row)))
        .when(index >= 0, (el) => this.draggable(el, index, t))
        .when(Boolean(row.space), (el) => el.on_mouse_down("right", () => this.menu(row.space, entry)))
        .when(Boolean(rail), (el) => el.child(div().absolute().left(RAIL).top(bottom).w(1.5).h(height - bottom).bg(rail)))
        .when(Boolean(status) && flat, (el) => el.child(this.bar(status, t, height)));
      const reorder = index >= 0 ? this.reorder(row, index, all) : {};
      const events = {
        hover: (on, cx) => this.hover(entry.key, on, cx),
        down: () => {
          this.dragUnit = entry.key;
          reorder.down?.();
        },
        move: reorder.move,
        up: (cx) => {
          this.dropOnEntry(entry);
          reorder.up?.(cx);
        },
      };
      return this.pointer(el, row, this.dropFor(entry, row), t, events);
    }

    draggable(el, index, t) {
      return el
        .when(this.pressed === index && this.over !== index, (el) => el.opacity(0.5))
        .when(this.pressed !== null && this.over === index && this.pressed !== index, (el) =>
          el.child(
            div()
              .absolute()
              .left(0)
              .w_full()
              .h(2)
              .bg(t.accent)
              .when(this.pressed < index, (line) => line.bottom(0))
              .when(this.pressed > index, (line) => line.top(0)),
          ),
        );
    }

    reorder(row, index, all) {
      return {
        down: () => {
          this.pressed = index;
          this.over = index;
        },
        move: (cx) => {
          const source = all[this.pressed];
          const over = source && (source.machine ?? null) === (row.space.machine ?? null) ? index : null;
          if (this.pressed !== null && this.over !== over) {
            this.over = over;
            cx.notify();
          }
        },
        up: (cx) => {
          const from = this.pressed;
          const over = this.over;
          this.pressed = null;
          this.over = null;
          if (from !== null && over === index && from !== index) run("space.move", { id: spaces()[from].id, index: index + 1 });
          else if (from === index) this.open(row);
          cx.notify();
        },
      };
    }

    kidLines(row, lane, t) {
      const name = this.name(row, t).when(row.open && !row.space?.active, (el) => el.text_color(t.muted));
      const line = h_flex().h(LINE).flex_none().gap(8).items_center().child(name).when(Boolean(counts(row)), (el) => el.child(this.note(counts(row), t)));
      return lane ? [line, lane.sub] : [line];
    }

    graphKid(entry, row, t, color, last, above, ground) {
      const selected = Boolean(row.space?.active);
      const hovered = !selected && this.kidHover === row.key;
      const lane = this.laneLine(row, t);
      const height = lane?.height ?? KID;
      const rail = faded(color);
      const el = v_flex()
        .id(`kid-${row.key}`)
        .relative()
        .h(height)
        .flex_none()
        .pl(52)
        .pr(8)
        .justify_center()
        .rounded(8)
        .when(hovered, (el) => el.child(this.box(BOX, 0, t)))
        .on_click(() => this.open(row))
        .when(Boolean(row.space), (el) => el.on_mouse_down("right", () => this.menu(row.space, entry)))
        .when(!last, (el) => el.child(div().absolute().left(RAIL).top(above ? 0 : TIE).w(1.5).h(above ? height : height - TIE).bg(above ? color : rail)))
        .child(div().absolute().left(RAIL).top(0).h(TIE).w(13).border_l(1.5).border_b(1.5).border_color(selected ? color : rail).rounded_bl(9))
        .children(selected ? this.ring(row, color, ground, t) : [this.node(row, rail, t)])
        .children(this.kidLines(row, lane, t));
      return this.pointer(el, row, this.dropFor(entry, row), t, { hover: (on, cx) => this.hoverKid(row.key, on, cx) });
    }

    graphEntry(entry, t, inFolder = false) {
      const kids = entry.kind === "repo" && !isFolded(this.folded(), entry) ? entry.kids : [];
      const ground = inFolder ? t.selected : t.raised;
      const rows = entry.kind === "plain" ? [this.headRow(entry, entry.row, t, null)] : this.repoRows(entry, kids, t, ground);
      return v_flex()
        .id(`group-${entry.key}`)
        .relative()
        .flex_none()
        .when(holdsActive(entry), (el) => el.bg(ground).rounded(8).when(kids.length > 0, (el) => el.pb(6)))
        .children(rows)
        .when(holdsActive(entry), (el) => el.child(this.frame(t.dim)));
    }

    repoRows(entry, kids, t, ground) {
      const color = this.fill(entry.main.space, t);
      const active = kids.findIndex((row) => row.space?.active);
      const rail = active >= 0 ? color : faded(color);
      return [this.headRow(entry, entry.main, t, kids.length ? rail : null), ...kids.map((row, index) => this.graphKid(entry, row, t, color, index === kids.length - 1, index < active, ground))];
    }

    blockKid(entry, row, t) {
      const selected = Boolean(row.space?.active);
      const hovered = !selected && this.kidHover === row.key;
      const lane = this.laneLine(row, t);
      const height = lane?.height ?? KID;
      const el = v_flex()
        .id(`kid-${row.key}`)
        .relative()
        .h(height)
        .flex_none()
        .pl(40)
        .pr(10)
        .justify_center()
        .when(hovered, (el) => el.child(this.box(30, 6, t)))
        .on_click(() => this.open(row))
        .when(Boolean(row.space), (el) => el.on_mouse_down("right", () => this.menu(row.space, entry)))
        .when(row.open && Boolean(row.status), (el) => el.child(this.bar(row.status, t, height)))
        .children(this.kidLines(row, lane, t));
      return this.pointer(el, row, this.dropFor(entry, row), t, { hover: (on, cx) => this.hoverKid(row.key, on, cx) });
    }

    blockEntry(entry, t, inFolder = false, last = false) {
      const row = entry.kind === "repo" ? entry.main : entry.row;
      const kids = entry.kind === "repo" && !isFolded(this.folded(), entry) ? entry.kids : [];
      return v_flex()
        .id(`block-${entry.key}`)
        .flex_none()
        .mb(inFolder && last ? 2 : 6)
        .overflow_hidden()
        .bg(holdsActive(entry) ? t.raised : inFolder ? t.chrome : t.surface)
        .border_1()
        .border_color(holdsActive(entry) ? t.dim : t.border)
        .rounded(10)
        .child(this.headRow(entry, row, t, null, true))
        .when(kids.length > 0, (el) => el.child(div().h(1).flex_none().bg(t.border)))
        .children(kids.map((kid) => this.blockKid(entry, kid, t)));
    }
  };
