import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { home, panes, props, run, settings, theme } from "herdr";
import { TEXT, iconButton, paneTile, programIcon, statusChip } from "../../kit/kit.js";
import { folderLabel, isNarrow, paneTitle, showsZoom } from "./logic.js";

const PROGRAM_ICON = 14;

export default class PaneHeader extends View {
  init() {
    this.hovered = false;
    this.width = null;
  }

  button(id, glyph, tooltip, command, args, t) {
    return iconButton(id, { icon: glyph, tooltip, stop: true, color: t.muted, onClick: () => run(command, args) }, t);
  }

  buttons(me, all, t) {
    const pane = me.pane;
    return h_flex()
      .flex_none()
      .gap(2)
      .items_center()
      .child(this.button(`split-right-${pane}`, "columns-2", "Split right", "pane.split", { direction: "right", pane }, t))
      .child(this.button(`split-down-${pane}`, "rows-2", "Split down", "pane.split", { direction: "down", pane }, t))
      .when(showsZoom(me, all), (el) =>
        el.child(this.button(`zoom-${pane}`, me.zoomed ? "minimize-2" : "maximize-2", me.zoomed ? "Unzoom" : "Zoom", "pane.zoom", { pane }, t)),
      )
      .child(this.button(`close-${pane}`, "x", "Close pane", "pane.close", { pane }, t));
  }

  render() {
    const t = theme();
    const all = panes();
    const me = all.find((p) => p.pane === props()?.pane);
    if (!me) return div().id("pane-header").size_full();
    const chip = statusChip(me.status, t);
    const folder = isNarrow(this.width, settings()?.zoom) ? "" : folderLabel(me.cwd, home());
    return h_flex()
      .id("pane-header")
      .size_full()
      .min_w(0)
      .pl(10)
      .pr(6)
      .gap(8)
      .items_center()
      .on_size_change((size, cx) => {
        if (size.width === this.width) return;
        this.width = size.width;
        cx.notify();
      })
      .on_hover((hovered, cx) => {
        this.hovered = hovered;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane: me.pane }))
      .child(paneTile(programIcon(me.program, { size: PROGRAM_ICON, color: t.muted, fallback: "terminal" }, t), t))
      .child(div().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(me.focused ? t.foreground : t.muted).child(paneTitle(me)))
      .when(chip != null, (el) => el.child(chip))
      .child(div().flex_1())
      .when(folder !== "", (el) => el.child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.dim).child(folder)))
      .when(this.hovered, (el) => el.child(this.buttons(me, all, t)));
  }
}
