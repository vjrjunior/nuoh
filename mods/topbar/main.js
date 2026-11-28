import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { focused, layout, panes, props, run, setShared, shared, spaces, theme } from "herdr";
import { avatar, iconButton, pill, tag } from "../../kit/kit.js";
import { avatarLook } from "../../lib/space-colors.js";
import { SIDEBAR, isNarrow } from "../../lib/layout-tree.js";
import { branchOf, foldSidebar, machineOf, roleOf, shownSpace } from "./logic.js";

const MACHINE_ADD = { name: "machine-add" };
const AVATAR = 28;
const AVATAR_RADIUS = 8;
const NAME_SIZE = 17;
const CHIP_MAX = 140;

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
      { icon: "panel-left", tooltip: narrow ? "Expand sidebar" : "Collapse sidebar", color: t.muted, stop: true, onClick: () => this.toggleSidebar() },
      t,
    );
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
          .when(branch != null, (row) => row.child(tag("branch", { icon: "git-branch", label: branch, tooltip: branch, maxWidth: CHIP_MAX }, t))),
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
      .child(pill("machine", { icon: glyph, label, chevron: true, tooltip: "Add machine", onClick: () => run("mod.open", MACHINE_ADD) }, t));
  }

  render() {
    const t = theme();
    const role = roleOf(props());
    if (role === "title") return this.title(t);
    if (role === "machine") return this.machine(t);
    return div().id("lights").size_full();
  }
}
