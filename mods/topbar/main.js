import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { focused, layout, panes, props, run, setShared, shared, spaces, theme } from "herdr";
import { CONTROL, ICON_SIZE, avatar, icon, iconButton } from "../../kit/kit.js";
import { avatarLook } from "../../lib/space-colors.js";
import { SIDEBAR, branchOf, foldSidebar, isNarrow, machineOf, roleOf, shownSpace } from "./logic.js";

const MACHINE_ADD = { name: "machine-add" };
const AVATAR = 28;
const AVATAR_RADIUS = 8;
const NAME_SIZE = 17;
const CHIP = 22;
const CHIP_MAX = 140;
const PILL = 34;
const PILL_RADIUS = 10;

export default class Topbar extends View {
  toggleSidebar() {
    const next = foldSidebar(layout(), shared("sidebar.width"));
    if (next.save != null) setShared("sidebar.width", next.save);
    setShared("sidebar.collapsed", next.collapsed);
    run("layout.resize", { id: SIDEBAR, px: next.px });
  }

  sidebarButton(narrow, t) {
    return iconButton(
      "sidebar-toggle",
      { icon: "panel-left", tooltip: narrow ? "Expand sidebar" : "Collapse sidebar", color: t.muted, size: CONTROL.row, iconSize: ICON_SIZE.lg, bordered: false, stop: true, onClick: () => this.toggleSidebar() },
      t,
    );
  }

  branchChip(branch, t) {
    return h_flex()
      .id("branch")
      .h(CHIP)
      .min_w(0)
      .max_w(CHIP_MAX)
      .px(7)
      .gap(5)
      .items_center()
      .rounded(6)
      .bg(t.raised)
      .text_size(12)
      .text_color(t.muted)
      .tooltip(branch)
      .child(icon("git-branch", { size: ICON_SIZE.md, color: t.unknown }))
      .child(div().min_w(0).truncate().child(branch));
  }

  title(t) {
    const narrow = isNarrow(layout());
    const space = shownSpace(spaces());
    const branch = branchOf(space, focused(), panes());
    return h_flex()
      .id("title")
      .size_full()
      .min_w(0)
      .gap(10)
      .items_center()
      .when(narrow, (el) => el.justify_center())
      .when(!narrow, (el) => el.pl(12).pr(8))
      .child(this.sidebarButton(narrow, t))
      .when(!narrow && space != null, (el) =>
        el
          .child(avatar(space.name, avatarLook(space, shared("space.colors"), t), { size: AVATAR, radius: AVATAR_RADIUS }))
          .child(div().min_w(0).truncate().text_size(NAME_SIZE).font_semibold().text_color(t.foreground).child(space.name))
          .when(branch != null, (row) => row.child(this.branchChip(branch, t))),
      );
  }

  machine(t) {
    const { label, icon: glyph } = machineOf(shownSpace(spaces()));
    return h_flex()
      .size_full()
      .min_w(0)
      .pl(4)
      .pr(2)
      .justify_end()
      .items_center()
      .child(
        h_flex()
          .id("machine")
          .h(PILL)
          .min_w(0)
          .px(10)
          .gap(6)
          .items_center()
          .rounded(PILL_RADIUS)
          .bg(t.surface)
          .border_1()
          .border_color(t.border)
          .text_size(12.5)
          .text_color(t.muted)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip("Add machine")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => run("mod.open", MACHINE_ADD))
          .child(icon(glyph, { size: ICON_SIZE.lg }))
          .child(div().min_w(0).truncate().child(label))
          .child(icon("chevron-down", { size: ICON_SIZE.md, color: t.dim })),
      );
  }

  render() {
    const t = theme();
    const role = roleOf(props());
    if (role === "title") return this.title(t);
    if (role === "machine") return this.machine(t);
    return div().id("lights").size_full();
  }
}
