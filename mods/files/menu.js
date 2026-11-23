import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, settings, theme } from "herdr";
import { ICON_SIZE, TEXT, popupRow } from "../../kit/kit.js";
import { openMarkdown } from "../../lib/open-markdown.js";
import { editorName, newTerminal, openInEditor, reveal } from "./actions.js";
import { fileIcon, kindOfFile, menuItems, nameOf } from "./logic.js";

export const MENU_WIDTH = 240;
const PAD = 5;
const TITLE = 26;
const ROW = 28;

export const menuHeight = (count) => PAD * 2 + TITLE + count * ROW;

export function itemsFor(path, dir) {
  return menuItems({ dir, markdown: !dir && kindOfFile(path) === "markdown", editor: editorName() });
}

export class FileMenu {
  constructor(given, cx) {
    this.given = given;
    this.items = itemsFor(given.path, given.dir);
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  run(item, cx) {
    const { path, relative, pane, overlay } = this.given;
    closeOverlay(overlay);
    if (item.id === "open") openMarkdown(path, { pane });
    else if (item.id === "editor") openInEditor(path);
    else if (item.id === "terminal") newTerminal(path);
    else if (item.id === "reveal") reveal(path);
    else if (item.id === "copy") cx.write_to_clipboard(path);
    else if (item.id === "copy-relative") cx.write_to_clipboard(relative);
  }

  render() {
    const t = theme();
    const { path, relative, dir, open, overlay } = this.given;
    return v_flex()
      .id("files-menu")
      .size_full()
      .p(PAD)
      .bg(t.popover)
      .text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((event, cx) => {
        const count = this.items.length;
        if (event.key === "escape") closeOverlay(overlay);
        else if (event.key === "down") this.at = (this.at + 1) % count;
        else if (event.key === "up") this.at = (this.at + count - 1) % count;
        else if (event.key === "enter") return this.run(this.items[this.at], cx);
        cx.notify();
      })
      .child(
        h_flex()
          .h(TITLE)
          .flex_none()
          .px(8)
          .gap(6)
          .items_center()
          .text_size(TEXT.sm)
          .text_color(t.dim)
          .child(image(fileIcon(relative ?? path, { dir, open, light: settings().dark === false })).size(ICON_SIZE.md).flex_none())
          .child(div().flex_1().min_w(0).truncate().child(nameOf(path))),
      )
      .children(this.items.map((item, index) => popupRow(`files-menu-${item.id}`, { icon: item.icon, label: item.label, selected: index === this.at, onClick: (cx) => this.run(item, cx) }, t)));
  }
}
