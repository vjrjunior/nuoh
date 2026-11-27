import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents } from "herdr";
import { LETTER, paint } from "../../lib/space-colors.js";
import { rowsOf } from "./tree.js";
import { folderTail } from "./folders.js";
import { icon, statusDot } from "../../kit/kit.js";

const COMPACT = 26;

export const withRail = (Base) =>
  class extends Base {
    tile(color, size, glyph) {
      return h_flex()
        .size(size)
        .flex_none()
        .rounded(6)
        .bg(color)
        .items_center()
        .justify_center()
        .child(icon("folder", { size: glyph, color: LETTER }));
    }

    compactFolder(folder, entries, t) {
      const tail = folder.folded ? folderTail(entries, agents()) : null;
      const needs = tail?.status === "blocked" || tail?.status === "done";
      return h_flex()
        .id(`compact-folder-${folder.id}`)
        .h(COMPACT)
        .flex_none()
        .justify_center()
        .items_center()
        .gap(4)
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.toggleFolder(folder.id))
        .on_mouse_down("right", () => this.folderMenu(folder))
        .child(this.tile(paint(folder.color, t), 16, 10))
        .when(needs, (el) => el.child(statusDot(t[tail.status], { size: 5 })));
    }

    compactRows({ pinned, folders, loose }, t) {
      const numbered = (entries) => this.compactSpaces(entries, t);
      return [...numbered(pinned), ...folders.flatMap(({ folder, entries }) => [this.compactFolder(folder, entries, t), ...(folder.folded ? [] : numbered(entries))]), ...numbered(loose)];
    }

    compactSpaces(entries, t) {
      const all = spaces();
      const rows = entries.flatMap(rowsOf).filter((row) => row.space);
      return rows.map((row) => {
        const active = Boolean(row.space.active);
        return h_flex()
          .id(`compact-${row.key}`)
          .h(COMPACT)
          .flex_none()
          .justify_center()
          .gap(4)
          .when(active, (el) => el.bg(t.raised))
          .hover((s) => s.bg(t.hover))
          .on_mouse_down("left", () => this.endDrag())
          .on_click(() => this.open(row))
          .child(div().text_color(active ? t.foreground : t.muted).child(String(all.findIndex((space) => space.id === row.space.id) + 1)))
          .when(row.status === "blocked" || row.status === "done", (el) => el.child(statusDot(t[row.status], { size: 5 })));
      });
    }
  };
