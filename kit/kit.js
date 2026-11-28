import { div, image, svg } from "gpui-kit";
import { h_flex, Input, Textarea, v_flex } from "gpui-base";

export const KIT = { name: "kit" };
export const CONTROL = { tiny: 18, small: 22, regular: 24, square: 26, row: 28, large: 32 };
export const TEXT = { xs: 10.5, sm: 11, md: 11.5, base: 12, lg: 12.5, xl: 13, title: 13.5 };
export const RADIUS = { chip: 3, pill: 4, control: 5, card: 6, round: 9, panel: 10 };
export const ICON_SIZE = { sm: 11, md: 12, lg: 14 };
export const CARD_HEADER = 40;
export const MENU_ITEM = 30;
const STATUS_LABEL = { blocked: "Needs you", working: "Working", done: "Done" };
const STATUS_FILL = { blocked: "1F", working: "1F", done: "1A" };
export const ICONS = [
  "activity",
  "arrow-left",
  "arrow-up-right",
  "bell",
  "bot",
  "brain",
  "building-2",
  "calendar",
  "check",
  "check-heavy",
  "chevron-down",
  "chevron-right",
  "chevrons-down-up",
  "circle",
  "circle-check",
  "circle-x",
  "clickup",
  "columns-2",
  "command",
  "copy",
  "copy-plus",
  "cursor",
  "exclamation",
  "external-link",
  "eye",
  "file",
  "file-text",
  "flag",
  "folder",
  "folder-open",
  "folder-plus",
  "git-branch",
  "git-compare",
  "git-fork",
  "git-pull-request",
  "github",
  "hand",
  "image",
  "layers",
  "layout-grid",
  "list",
  "list-checks",
  "list-filter",
  "loader-circle",
  "map",
  "maximize",
  "maximize-2",
  "minimize-2",
  "minus",
  "monitor",
  "mouse-pointer-2",
  "network",
  "panel-left",
  "pin",
  "pin-off",
  "play",
  "plus",
  "repeat",
  "rotate-cw",
  "route",
  "rows-2",
  "search",
  "server",
  "settings",
  "square",
  "square-kanban",
  "terminal",
  "trash-2",
  "x",
  "zed",
];

export const iconPath = (name) => `mods/${KIT.name}/icons/${name}.svg`;

export function icon(name, { size = ICON_SIZE.md, color } = {}) {
  return svg(iconPath(name))
    .size(size)
    .flex_none()
    .when(color != null, (el) => el.text_color(color));
}

export function programIcon(program, { size = ICON_SIZE.lg, color, fallback = null } = {}, t) {
  if (!program?.icon) return fallback ? icon(fallback, { size, color: color ?? t.muted }) : null;
  if (program.tint) return svg(program.icon).size(size).flex_none().text_color(color ?? program.tile ?? t.foreground);
  return image(program.icon).w(size).h(size).flex_none();
}

export function statusDot(color, { size = 7, hollow = false } = {}) {
  return div()
    .size(size)
    .flex_none()
    .rounded(RADIUS.round)
    .when(!hollow, (el) => el.bg(color))
    .when(hollow, (el) => el.border(1.5).border_color(color));
}

export function mark(kind, color, { size = ICON_SIZE.sm } = {}) {
  if (kind === "dot") return statusDot(color, { size: 7 });
  if (kind === "ring") return statusDot(color, { size: 7, hollow: true });
  return icon(kind, { size, color });
}

export const toneColor = (tone, t) => ({ blocked: t.blocked, working: t.working, done: t.done, accent: t.accent }[tone] ?? t.unknown);

export function stepNode(state, t) {
  const box = h_flex().size(18).flex_none().items_center().justify_center().rounded(RADIUS.round);
  if (state === "done") return box.bg(t.done).child(icon("check-heavy", { size: 11, color: t.accent_foreground }));
  if (state === "current") return box.border(1.5).border_color(t.accent).child(statusDot(t.accent, { size: 8 }));
  if (state === "bad") return box.border(1.5).border_color(t.blocked).child(icon("exclamation", { size: 11, color: t.blocked }));
  return box.border(1.5).border_color(t.input);
}

const BUTTON_SIZE = {
  sm: { height: 22, px: 8, gap: 5, radius: 6, text: TEXT.md, icon: 10 },
  md: { height: 28, px: 10, gap: 6, radius: 8, text: TEXT.base, icon: 12 },
  lg: { height: 34, px: 12, gap: 7, radius: 10, text: TEXT.lg, icon: 13 },
};

function buttonLook(variant, t) {
  if (variant === "primary") return { bg: t.solid ?? t.accent, text: t.solid_foreground ?? t.accent_foreground, icon: t.solid_foreground ?? t.accent_foreground, strong: true };
  if (variant === "tinted") return { bg: t.accent + "1F", hover: t.accent + "33", text: t.accent, icon: t.accent };
  if (variant === "danger") return { bg: t.blocked + "1F", hover: t.blocked + "33", text: t.blocked, icon: t.blocked };
  if (variant === "ghost") return { hover: t.foreground + "0D", text: t.muted, icon: t.unknown };
  return { bg: t.foreground + "0D", hover: t.foreground + "17", border: t.foreground + "14", hoverBorder: t.foreground + "24", text: t.foreground, icon: t.muted };
}

export function button(id, { label, icon: iconName, variant = "secondary", size = "md", iconColor, full = false, maxWidth, disabled = false, loading = false, tooltip, stop = false, onClick }, t) {
  const dims = BUTTON_SIZE[size] ?? BUTTON_SIZE.md;
  const look = buttonLook(variant, t);
  const glyph = loading ? icon("loader-circle", { size: dims.icon, color: iconColor ?? look.icon }).spin(900) : iconName != null ? icon(iconName, { size: dims.icon, color: iconColor ?? look.icon }) : null;
  return h_flex()
    .id(id)
    .flex_none()
    .h(dims.height)
    .px(dims.px)
    .gap(dims.gap)
    .items_center()
    .rounded(dims.radius)
    .text_size(dims.text)
    .text_color(look.text)
    .when(look.strong, (el) => el.font_semibold())
    .when(!look.strong, (el) => el.font_medium())
    .when(look.bg != null, (el) => el.bg(look.bg))
    .when(look.border != null, (el) => el.border_1().border_color(look.border))
    .when(disabled, (el) => el.opacity(0.4))
    .when(!disabled && look.strong, (el) => el.hover((s) => s.opacity(0.9)))
    .when(!disabled && !look.strong, (el) => el.hover((s) => (look.hoverBorder ? s.bg(look.hover).border_color(look.hoverBorder) : s.bg(look.hover))))
    .when(full, (el) => el.w_full().justify_center())
    .when(maxWidth != null, (el) => el.min_w(0).max_w(maxWidth))
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .when(stop, (el) => el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()))
    .on_click((_e, cx) => {
      if (stop) cx.stop_propagation();
      onClick?.(cx);
    })
    .when(glyph != null, (el) => el.child(glyph))
    .when(label != null && maxWidth == null, (el) => el.child(label))
    .when(label != null && maxWidth != null, (el) => el.child(div().min_w(0).truncate().child(label)));
}

const ICON_BUTTON_SIZE = { xs: { size: CONTROL.tiny, icon: ICON_SIZE.md, radius: RADIUS.control }, sm: { size: CONTROL.small, icon: ICON_SIZE.md, radius: 6 }, md: { size: CONTROL.row, icon: ICON_SIZE.lg, radius: 7 } };

export function iconButton(id, { icon: iconName, tooltip, variant = "ghost", size = "md", color, selected = false, stop = false, onPress, onClick }, t) {
  const bordered = variant === "bordered";
  const dims = bordered ? { size: 34, icon: ICON_SIZE.lg, radius: 10 } : (ICON_BUTTON_SIZE[size] ?? ICON_BUTTON_SIZE.md);
  return div()
    .id(id)
    .size(dims.size)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded(dims.radius)
    .text_color(color ?? t.muted)
    .when(bordered, (el) => el.bg(t.surface).border_1().border_color(t.foreground + "12").hover((s) => s.bg(t.raised).border_color(t.foreground + "24").text_color(t.foreground)))
    .when(!bordered && selected, (el) => el.bg(t.foreground + "14"))
    .when(!bordered, (el) => el.hover((s) => s.bg(t.foreground + (selected ? "14" : "0D")).text_color(color ?? t.foreground)))
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .when(stop || onPress != null, (el) =>
      el.on_mouse_down("left", (_e, cx) => {
        onPress?.(cx);
        if (stop) cx.stop_propagation();
      }),
    )
    .on_click((_e, cx) => {
      if (stop) cx.stop_propagation();
      onClick?.(cx);
    })
    .child(icon(iconName, { size: dims.icon }));
}

export function segment(id, { icon: iconName, label, selected = false, tooltip, onClick }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(CONTROL.row)
    .px(label != null ? 10 : 7)
    .gap(6)
    .items_center()
    .rounded(8)
    .text_size(TEXT.lg)
    .text_color(selected ? t.foreground : t.muted)
    .when(selected, (el) => el.bg(t.foreground + "14").font_medium())
    .when(!selected, (el) => el.hover((s) => s.bg(t.foreground + "0A").text_color(t.foreground)))
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => onClick?.(cx))
    .when(iconName != null, (el) => el.child(icon(iconName, { size: ICON_SIZE.lg })))
    .when(label != null, (el) => el.child(label));
}

export function input(state, t, { kind = "text", focused = true, height = CONTROL.large, font } = {}) {
  const start = kind === "start";
  const glyph = kind === "search" ? icon("search", { size: 13, color: t.unknown }) : start ? icon("plus", { size: ICON_SIZE.md, color: t.muted }) : null;
  return h_flex()
    .h(height)
    .w_full()
    .px(10)
    .gap(8)
    .items_center()
    .rounded(9)
    .bg(t.background)
    .border_1()
    .when(start, (el) => el.border_dashed())
    .border_color(focused ? t.accent + "B3" : t.foreground + (start ? "24" : "14"))
    .text_size(TEXT.lg)
    .text_color(t.foreground)
    .when(font != null, (el) => el.font_family(font))
    .when(glyph != null, (el) => el.child(glyph))
    .child(div().flex_1().min_w(0).child(Input.new(state)));
}

export function link(id, { label, icon: iconName, onClick }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .gap(4)
    .items_center()
    .text_size(TEXT.md)
    .font_medium()
    .text_color(t.muted)
    .hover((s) => s.text_color(t.foreground))
    .on_click((_e, cx) => onClick?.(cx))
    .child(label)
    .when(iconName != null, (el) => el.child(icon(iconName, { size: ICON_SIZE.md, color: t.unknown })));
}

export function avatar(name, { fill, letter }, { size = 22, radius = 6, textSize = 12 } = {}) {
  return h_flex()
    .size(size)
    .flex_none()
    .rounded(radius)
    .bg(fill)
    .items_center()
    .justify_center()
    .text_size(textSize)
    .font_bold()
    .text_color(letter)
    .child([...(name ?? "")][0]?.toUpperCase() ?? "?");
}

const CHIP_FILL = { blocked: "1F", working: "1F", done: "1A", accent: "1F" };

export function chip(text, { tone = "neutral", size = "sm", dot = false, icon: iconName, iconColor } = {}, t) {
  const color = CHIP_FILL[tone] != null ? t[tone] : t.muted;
  const fill = CHIP_FILL[tone] != null ? color + CHIP_FILL[tone] : t.foreground + "0F";
  const md = size === "md";
  const xs = size === "xs";
  return h_flex()
    .flex_none()
    .h(md ? CONTROL.regular : xs ? 16 : CONTROL.tiny)
    .px(md ? 8 : xs ? 5 : 6)
    .gap(md && iconName != null ? 5 : 6)
    .items_center()
    .rounded(md ? 7 : xs ? RADIUS.pill : RADIUS.control)
    .bg(fill)
    .text_size(md ? TEXT.base : xs ? TEXT.xs : TEXT.sm)
    .when(!xs, (el) => el.font_medium())
    .text_color(color)
    .when(iconName != null, (el) => el.child(icon(iconName, { size: ICON_SIZE.sm, color: iconColor ?? color })))
    .when(iconName == null && (dot || md), (el) => el.child(statusDot(color, { size: 6 })))
    .child(text);
}

export function statusChip(status, t, { label } = {}) {
  const text = label ?? STATUS_LABEL[status];
  if (text == null || STATUS_FILL[status] == null) return null;
  return chip(text, { tone: status }, t);
}

export function tag(id, { icon: iconName, label, chevron = false, bordered = false, tooltip, maxWidth, onClick }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(CONTROL.small)
    .min_w(0)
    .when(maxWidth != null, (el) => el.max_w(maxWidth))
    .px(7)
    .gap(5)
    .items_center()
    .rounded(6)
    .bg(t.foreground + "0D")
    .when(bordered, (el) => el.border_1().border_color(t.foreground + "14"))
    .text_size(TEXT.base)
    .text_color(t.muted)
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .when(onClick != null, (el) => el.hover((s) => s.bg(t.foreground + "14")).on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => onClick(cx)))
    .when(iconName != null, (el) => el.child(icon(iconName, { size: ICON_SIZE.md, color: t.unknown })))
    .child(div().min_w(0).truncate().child(label))
    .when(chevron, (el) => el.child(icon("chevron-down", { size: ICON_SIZE.sm, color: t.dim })));
}

export function paneTile(content, t) {
  return h_flex().size(24).flex_none().items_center().justify_center().rounded(7).bg(t.foreground + "0D").child(content);
}

export function menuItem(id, { icon: iconName, dot, label, description, detail, selected = false, check = false, danger = false, onClick }, t) {
  const color = danger ? t.blocked : t.foreground;
  return h_flex()
    .id(id)
    .min_h(MENU_ITEM)
    .flex_none()
    .px(8)
    .gap(8)
    .when(description != null, (el) => el.py(6).items_start())
    .when(description == null, (el) => el.items_center())
    .rounded(7)
    .text_size(TEXT.xl)
    .text_color(color)
    .when(selected, (el) => el.bg(t.foreground + "0D"))
    .hover((s) => s.bg(t.foreground + "0D"))
    .on_click((_e, cx) => onClick?.(cx))
    .when(dot != null || iconName != null, (el) =>
      el.child(
        h_flex()
          .w(ICON_SIZE.lg)
          .h(18)
          .flex_none()
          .items_center()
          .justify_center()
          .when(dot != null, (box) => box.child(statusDot(dot, { size: 9 })))
          .when(dot == null && iconName != null, (box) => box.child(icon(iconName, { size: ICON_SIZE.lg, color: danger ? t.blocked : t.muted }))),
      ),
    )
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(2)
        .child(div().min_w(0).truncate().child(label))
        .when(description != null, (el) => el.child(div().text_size(TEXT.md).text_color(t.unknown).child(description))),
    )
    .when(detail != null, (el) => el.child(div().flex_none().text_size(TEXT.md).text_color(t.dim).child(detail)))
    .when(check, (el) => el.child(h_flex().h(18).items_center().child(icon("check", { size: 13, color: t.accent }))));
}

export function cardHeader(id, { icon: iconName, label, count }, t) {
  return h_flex()
    .id(id)
    .h(CARD_HEADER)
    .flex_none()
    .pl(14)
    .pr(8)
    .gap(8)
    .items_center()
    .child(icon(iconName, { size: ICON_SIZE.lg, color: t.muted }))
    .child(div().flex_none().text_size(TEXT.xl).font_medium().text_color(t.muted).child(label))
    .when(count != null, (el) => el.child(div().flex_none().text_size(TEXT.base).text_color(t.dim).child(String(count))))
    .child(div().flex_1());
}

export function viewTile(iconName, t) {
  return h_flex()
    .size(28)
    .flex_none()
    .items_center()
    .justify_center()
    .rounded(8)
    .bg(t.foreground + "14")
    .border_1()
    .border_color(t.foreground + "1F")
    .child(icon(iconName, { size: 16, color: t.foreground }));
}

export function pill(id, { icon: iconName, label, chevron = false, spin = false, color, tooltip, onClick }, t) {
  const glyph = icon(iconName, { size: label == null || chevron ? ICON_SIZE.lg : 13, color: color ?? t.muted });
  return h_flex()
    .id(id)
    .flex_none()
    .min_w(0)
    .h(34)
    .when(label == null, (el) => el.w(34).justify_center())
    .when(label != null, (el) => el.px(10).gap(6))
    .items_center()
    .rounded(10)
    .bg(t.surface)
    .border_1()
    .border_color(t.foreground + "12")
    .text_size(TEXT.lg)
    .text_color(t.muted)
    .hover((s) => s.bg(t.raised).border_color(t.foreground + "24").text_color(t.foreground))
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => onClick?.(cx))
    .child(spin ? glyph.spin(900) : glyph)
    .when(label != null, (el) => el.child(div().min_w(0).truncate().child(label)))
    .when(chevron, (el) => el.child(icon("chevron-down", { size: ICON_SIZE.md, color: t.dim })));
}

export function viewCard(id, t) {
  return v_flex().id(id).min_w(0).bg(t.surface).rounded(14).border_1().border_color(t.foreground + "12").shadow_md();
}


export function heading(text, t, right) {
  return h_flex()
    .justify_between()
    .text_size(TEXT.xs)
    .font_medium()
    .text_color(t.unknown)
    .child(div().child(text.toUpperCase()))
    .when(right != null, (el) => el.child(div().text_color(t.dim).child(String(right))));
}

const rule = (t) => div().h(1).flex_none().bg(t.foreground + "0A");

export function stepCard(t) {
  return v_flex().p(8).gap(4).rounded(RADIUS.panel).bg(t.surface).border_1().border_color(t.foreground + "0F");
}

export function detailLine(name, { detail, color, mark: kind }, t) {
  return v_flex()
    .child(rule(t))
    .child(
      h_flex()
        .h(26)
        .gap(10)
        .items_center()
        .text_size(TEXT.md)
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(name))
        .child(
          h_flex()
            .flex_none()
            .gap(4)
            .items_center()
            .text_size(TEXT.sm)
            .text_color(color)
            .when(kind != null, (el) => el.child(mark(kind, color, { size: ICON_SIZE.md })))
            .child(detail),
        ),
    );
}

export function timelineStep(id, { name, node = "todo", current = false, note, last = false, chevron = null, onToggle, body }, t) {
  const done = node === "done";
  const noteColor = node === "bad" ? t.blocked : current ? t.accent : done ? t.done : t.unknown;
  const head = h_flex()
    .id(id)
    .h(20)
    .gap(8)
    .items_center()
    .child(
      div()
        .flex_none()
        .text_size(TEXT.xl)
        .text_color(current ? t.foreground : done ? t.muted : t.unknown)
        .when(current, (el) => el.font_semibold())
        .child(name),
    )
    .when(chevron != null, (el) => el.child(icon(chevron === "down" ? "chevron-down" : "chevron-right", { size: ICON_SIZE.md, color: t.unknown })))
    .child(
      h_flex()
        .flex_1()
        .min_w(0)
        .justify_end()
        .child(
          div()
            .min_w(0)
            .truncate()
            .text_size(TEXT.base)
            .text_color(noteColor)
            .when(done && !current, (el) => el.opacity(0.75))
            .child(note ?? ""),
        ),
    )
    .when(onToggle != null, (el) => el.on_click((_e, cx) => onToggle(cx)));
  const rail = h_flex()
    .flex_1()
    .justify_center()
    .items_stretch()
    .when(!last, (el) => el.child(div().w(1.5).bg(done ? t.done : t.foreground + "1A").when(done, (line) => line.opacity(0.35))));
  return h_flex()
    .items_stretch()
    .gap(10)
    .child(v_flex().flex_none().w(18).child(h_flex().h(20).items_center().justify_center().child(stepNode(node, t))).child(rail))
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .pb(body != null ? 14 : 12)
        .child(head)
        .when(body != null, (el) => el.child(div().pt(8).child(body))),
    );
}

const CHECK_TONE = { passed: "done", failed: "blocked", asking: "working", sent: "working" };

export function checkRow(id, { code, codeFont, steps, expected, state = "pending", label, saw, actions = [], open = null, note = null }, t) {
  const asking = state === "asking";
  const indent = (el) => el.pl(36);
  return v_flex()
    .id(id)
    .gap(4)
    .p(8)
    .rounded(8)
    .when(asking, (el) => el.bg(t.selection ?? t.raised).border_1().border_color(t.accent + "80"))
    .child(
      h_flex()
        .items_start()
        .gap(8)
        .child(
          div()
            .flex_none()
            .w(28)
            .when(codeFont != null, (el) => el.font_family(codeFont))
            .text_size(TEXT.md)
            .text_color(t.unknown)
            .child(code),
        )
        .child(div().flex_1().min_w(0).text_size(TEXT.base).text_color(t.foreground).child(steps))
        .child(chip(label ?? state, { tone: CHECK_TONE[state] ?? "neutral" }, t)),
    )
    .child(indent(div()).text_size(TEXT.md).text_color(t.muted).child(`→ ${expected}`))
    .when(Boolean(saw), (el) => el.child(indent(div()).text_size(TEXT.md).text_color(t.blocked).child(saw)))
    .when(actions.length > 0 || open != null, (el) =>
      el.child(
        indent(h_flex())
          .pt(4)
          .gap(6)
          .items_center()
          .children(actions)
          .child(div().flex_1())
          .when(open != null, (row) => row.child(open)),
      ),
    )
    .when(note != null, (el) => el.child(indent(v_flex()).pt(4).gap(4).child(note)));
}

export function profile(id, { label, off = false, onClick }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(CONTROL.regular)
    .px(8)
    .gap(6)
    .items_center()
    .rounded(7)
    .bg(t.foreground + "08")
    .border_1()
    .border_color(t.foreground + "14")
    .text_size(TEXT.base)
    .font_medium()
    .text_color(off ? t.muted : t.foreground)
    .hover((s) => s.bg(t.foreground + "14"))
    .on_click((_e, cx) => onClick?.(cx))
    .child(statusDot(off ? t.dim : t.accent, { size: 6 }))
    .child(off ? "Off" : label)
    .child(icon("chevron-down", { size: ICON_SIZE.sm, color: t.unknown }));
}

export function laneRow(id, { color, code, codeFont, title, badge = null, step, why, dots = [], action = null, last = false, onClick }, t) {
  const dot = (state) => {
    if (state === "done") return statusDot(t.done, { size: 6 }).opacity(0.6);
    if (state === "current") return statusDot(color, { size: 6 });
    return statusDot(t.dim, { size: 6, hollow: true });
  };
  return v_flex()
    .child(
      h_flex()
        .py(10)
        .gap(10)
        .items_center()
        .child(div().flex_none().w(3).h(34).rounded(2).bg(color))
        .child(
          v_flex()
            .id(id)
            .flex_1()
            .min_w(0)
            .gap(5)
            .hover((s) => s.opacity(0.85))
            .on_click((_e, cx) => onClick?.(cx))
            .child(
              h_flex()
                .gap(6)
                .items_center()
                .child(
                  div()
                    .flex_none()
                    .when(codeFont != null, (el) => el.font_family(codeFont))
                    .text_size(TEXT.md)
                    .text_color(t.unknown)
                    .child(code),
                )
                .child(div().flex_1().min_w(0).truncate().text_size(TEXT.lg).font_medium().text_color(t.foreground).child(title))
                .when(badge != null, (el) => el.child(badge)),
            )
            .child(
              h_flex()
                .gap(8)
                .items_center()
                .text_size(TEXT.md)
                .child(h_flex().flex_none().gap(3).items_center().children(dots.map(dot)))
                .child(div().flex_none().font_medium().text_color(color).child(step))
                .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(why ?? "")),
            ),
        )
        .when(action != null, (el) => el.child(action)),
    )
    .when(!last, (el) => el.child(rule(t)));
}

export function nextStep(id, { label, icon: iconName, disabled = false, loading = false, target, aside = null, note, onClick }, t) {
  return v_flex()
    .gap(6)
    .child(button(id, { label, icon: iconName, variant: "primary", size: "lg", full: true, disabled, loading, onClick }, t))
    .child(
      h_flex()
        .gap(8)
        .items_center()
        .text_size(TEXT.md)
        .child(div().flex_1().min_w(0).truncate().text_color(t.unknown).child(`→ ${target ?? ""}`))
        .when(aside != null, (el) => el.child(aside)),
    )
    .when(Boolean(note), (el) => el.child(div().text_size(TEXT.sm).text_color(t.working).child(note)));
}

export function releaseCard({ heading: head, title, items = null, shots = [], warning = null, copy = null }, t) {
  const rows = [];
  for (let index = 0; index < shots.length; index += 2) rows.push(shots.slice(index, index + 2));
  return v_flex()
    .gap(10)
    .child(div().text_size(TEXT.xs).font_medium().text_color(t.unknown).child(String(head ?? "").toUpperCase()))
    .child(div().text_size(TEXT.xl).font_semibold().text_color(t.foreground).child(title))
    .when(items != null, (el) =>
      el.child(
        h_flex()
          .items_stretch()
          .gap(8)
          .child(div().flex_none().w(2).rounded(1).bg(t.accent))
          .child(div().flex_1().min_w(0).text_size(TEXT.md).text_color(t.muted).child(items)),
      ),
    )
    .children(
      rows.map((pair) =>
        h_flex()
          .gap(6)
          .items_start()
          .children(
            pair.map((shot) =>
              v_flex()
                .id(shot.id)
                .flex_1()
                .min_w(0)
                .gap(4)
                .when(shot.onClick != null, (el) => el.on_click((_e, cx) => shot.onClick(cx)))
                .child(image(shot.image).w_full().h(84).rounded(6))
                .child(div().min_w(0).truncate().text_size(TEXT.xs).text_color(t.unknown).child(shot.caption ?? "")),
            ),
          ),
      ),
    )
    .when(warning != null, (el) =>
      el.child(
        v_flex()
          .gap(4)
          .p(8)
          .rounded(8)
          .bg(t.working + "0D")
          .border_1()
          .border_color(t.working + "66")
          .text_size(TEXT.md)
          .child(div().text_color(t.working).child(warning.text))
          .when(warning.action != null, (box) => box.child(warning.action)),
      ),
    )
    .when(copy != null, (el) => el.child(copy));
}

export function emptyState({ icon: iconName = "command", title, detail, action = null }, t) {
  return v_flex()
    .w_full()
    .pt(40)
    .pb(24)
    .gap(10)
    .items_center()
    .child(
      h_flex()
        .size(32)
        .flex_none()
        .items_center()
        .justify_center()
        .rounded(9)
        .bg(t.foreground + "0A")
        .border_1()
        .border_color(t.foreground + "0F")
        .child(icon(iconName, { size: ICON_SIZE.lg, color: t.muted })),
    )
    .child(
      v_flex()
        .w_full()
        .gap(4)
        .items_center()
        .child(div().text_center().text_size(TEXT.xl).font_medium().text_color(t.foreground).child(title))
        .when(Boolean(detail), (el) => el.child(div().text_center().text_size(TEXT.base).text_color(t.unknown).child(detail))),
    )
    .when(action != null, (el) => el.child(div().pt(4).child(action)));
}

export function lastClick(text, { ok = true } = {}, t) {
  const color = ok ? t.done : t.working;
  return h_flex()
    .flex_none()
    .py(10)
    .gap(6)
    .items_center()
    .border_t_1()
    .border_color(t.foreground + "0A")
    .child(icon(ok ? "check" : "exclamation", { size: ICON_SIZE.md, color }))
    .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(color).child(text));
}

export function segmentGroup(id, segments, t) {
  return h_flex().id(id).flex_none().p(3).gap(2).items_center().rounded(11).bg(t.surface).border_1().border_color(t.foreground + "12").children(segments);
}

export function cardLink(id, { label, onClick }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(26)
    .px(8)
    .gap(5)
    .items_center()
    .rounded(7)
    .bg(t.foreground + "08")
    .hover((s) => s.bg(t.foreground + "14"))
    .on_click((_e, cx) => onClick?.(cx))
    .child(div().text_size(TEXT.base).text_color(t.muted).child(label))
    .child(icon("arrow-up-right", { size: ICON_SIZE.md, color: t.unknown }));
}

export function statCard(id, { icon: iconName, label, value, legend = [], onClick }, t) {
  const number = typeof value === "number";
  return viewCard(id, t)
    .hover((s) => s.bg(t.raised))
    .on_click((_e, cx) => onClick?.(cx))
    .child(
      h_flex()
        .h(CARD_HEADER)
        .flex_none()
        .pl(14)
        .pr(10)
        .gap(8)
        .items_center()
        .child(icon(iconName, { size: ICON_SIZE.lg, color: t.muted }))
        .child(div().flex_1().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(t.muted).child(label))
        .child(icon("arrow-up-right", { size: 13, color: t.dim })),
    )
    .child(
      v_flex()
        .px(14)
        .gap(6)
        .child(div().h(36).text_size(number ? 30 : 15).font_semibold().text_color(number ? t.foreground : t.muted).child(String(value)))
        .child(
          h_flex()
            .gap(12)
            .min_w(0)
            .overflow_hidden()
            .children(legend.map((part) => h_flex().flex_none().gap(6).items_center().child(statusDot(part.color, { size: 6 })).child(div().text_size(TEXT.base).text_color(t.unknown).child(part.text)))),
        ),
    );
}

const rowBox = (id, height, t) => h_flex().id(id).h(height).px(8).gap(12).items_center().rounded(10);
export const ROW_COLUMN = 150;
export const ROW_ACTION = 210;

export function needRow(id, { avatar: face, title, chip: badge, note, time, action }, t) {
  return rowBox(id, 58, t)
    .hover((s) => s.bg(t.foreground + "0A"))
    .child(face)
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(3)
        .child(h_flex().gap(8).items_center().min_w(0).child(div().min_w(0).truncate().text_size(TEXT.xl).font_semibold().text_color(t.foreground).child(title)).when(badge != null, (el) => el.child(badge)))
        .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(note ?? "")),
    )
    .when(time != null, (el) => el.child(div().flex_none().text_size(TEXT.base).text_color(t.dim).child(time)))
    .when(action != null, (el) => el.child(action));
}

export function flightRow(id, { avatar: face, title, code, codeFont, branch, step, color, count, segments = [], action, why }, t) {
  const gap = 3;
  const width = Math.min(22, Math.floor((ROW_COLUMN - gap * (segments.length - 1)) / Math.max(1, segments.length)));
  return rowBox(id, 56, t)
    .hover((s) => s.bg(t.foreground + "0A"))
    .child(face)
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(3)
        .child(
          h_flex()
            .gap(8)
            .items_center()
            .min_w(0)
            .child(div().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(t.foreground).child(title))
            .when(Boolean(code), (el) => el.child(div().flex_none().when(codeFont != null, (c) => c.font_family(codeFont)).text_size(TEXT.md).text_color(t.dim).child(code))),
        )
        .child(h_flex().gap(5).items_center().min_w(0).child(icon("git-branch", { size: ICON_SIZE.sm, color: t.unknown })).child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(branch ?? ""))),
    )
    .child(
      v_flex()
        .w(ROW_COLUMN)
        .flex_none()
        .gap(7)
        .child(h_flex().gap(6).items_center().min_w(0).child(div().min_w(0).truncate().text_size(TEXT.base).font_medium().text_color(color).child(step)).child(div().flex_none().text_size(TEXT.base).text_color(t.dim).child(count ?? "")))
        .child(h_flex().gap(gap).children(segments.map((state) => div().w(width).h(4).rounded(2).bg(state === "done" ? t.done + "B3" : state === "current" ? color : t.foreground + "14")))),
    )
    .child(
      h_flex()
        .w(ROW_ACTION)
        .flex_none()
        .justify_end()
        .when(action != null, (el) => el.child(action))
        .when(action == null && why != null, (el) => el.child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.dim).child(why))),
    );
}

export function prRow(id, { avatar: face, title, where, checks, review, onClick }, t) {
  return rowBox(id, 52, t)
    .hover((s) => s.bg(t.foreground + "0A"))
    .on_click((_e, cx) => onClick?.(cx))
    .child(face)
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(2)
        .child(div().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(t.foreground).child(title))
        .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(where ?? "")),
    )
    .child(h_flex().w(ROW_COLUMN).flex_none().gap(6).items_center().child(icon(checks.icon, { size: 13, color: checks.color })).child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.muted).child(checks.text)))
    .child(h_flex().w(ROW_COLUMN).flex_none().justify_end().when(review != null, (el) => el.child(chip(review.label, { tone: review.tone }, t))));
}

export function taskRow(id, { ring, title, code, codeFont, meta, right, hovered = false, onHover, onClick }, t) {
  return rowBox(id, 54, t)
    .gap(11)
    .when(hovered, (el) => el.bg(t.foreground + "0A"))
    .when(onHover != null, (el) => el.on_hover((on, cx) => onHover(on, cx)))
    .on_click((_e, cx) => onClick?.(cx))
    .child(div().size(14).flex_none().rounded(7).border(1.5).border_color(ring))
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(3)
        .child(div().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(t.foreground).child(title))
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .min_w(0)
            .child(div().flex_none().when(codeFont != null, (c) => c.font_family(codeFont)).text_size(TEXT.md).text_color(t.dim).child(code ?? ""))
            .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(meta ?? "")),
        ),
    )
    .when(right != null, (el) => el.child(right));
}

export function logLine(id, { time, who, what, color, note, font }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .gap(12)
    .items_center()
    .when(font != null, (el) => el.font_family(font))
    .text_size(TEXT.base)
    .line_height("20px")
    .child(div().w(40).flex_none().text_color(t.dim).child(time))
    .child(div().w(122).flex_none().truncate().text_color(t.muted).child(who))
    .child(div().w(76).flex_none().truncate().text_color(color).child(what))
    .child(div().flex_1().min_w(0).truncate().text_color(t.unknown).child(note ?? ""));
}

export function columnHead({ color, label, count }, t) {
  return h_flex()
    .flex_none()
    .h(CARD_HEADER)
    .pl(14)
    .pr(10)
    .gap(8)
    .items_center()
    .child(statusDot(color, { size: 8 }))
    .child(div().min_w(0).truncate().text_size(TEXT.xl).font_medium().text_color(t.muted).child(label))
    .child(div().flex_none().text_size(TEXT.base).text_color(t.dim).child(String(count)));
}

export function meta({ icon: iconName, iconColor, text, color }, t) {
  return h_flex()
    .min_w(0)
    .gap(4)
    .items_center()
    .child(icon(iconName, { size: ICON_SIZE.sm, color: iconColor ?? t.unknown }))
    .child(div().min_w(0).truncate().text_size(TEXT.md).text_color(color ?? t.unknown).child(text));
}

export function taskCard(id, { code, codeFont, top = [], title, meta: lines = [], footer = null, hovered = false, open = false, onHover, onClick }, t) {
  let line = t.foreground + "0F";
  if (open) line = t.accent;
  else if (hovered) line = t.foreground + "1F";
  return v_flex()
    .id(id)
    .flex_none()
    .p(12)
    .gap(8)
    .rounded(10)
    .bg(hovered ? t.selected : t.raised)
    .border_1()
    .border_color(line)
    .when(onHover != null, (el) => el.on_hover((on, cx) => onHover(on, cx)))
    .on_click((_e, cx) => onClick?.(cx))
    .child(
      h_flex()
        .h(22)
        .gap(6)
        .items_center()
        .child(div().flex_none().when(codeFont != null, (c) => c.font_family(codeFont)).text_size(TEXT.md).font_semibold().text_color(t.accent).child(code))
        .children(top),
    )
    .child(div().text_size(TEXT.xl).font_medium().text_color(t.foreground).child(title))
    .when(lines.length > 0, (el) => el.child(h_flex().min_w(0).gap(10).items_center().children(lines)))
    .when(footer != null, (el) => el.child(v_flex().gap(8).child(div().h(1).flex_none().bg(t.foreground + "0A")).child(footer)));
}

export function sheet(id, t) {
  return v_flex().id(id).bg(t.surface).border_1().border_color(t.foreground + "1F").rounded(14).shadow_lg().overflow_hidden();
}

export function sheetBar(items) {
  return h_flex().flex_none().h(50).px(10).gap(6).items_center().children(items.filter(Boolean));
}

export function spaceCard(id, { avatar: face, name, line, action }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .p(12)
    .gap(10)
    .items_center()
    .rounded(10)
    .bg(t.foreground + "06")
    .border_1()
    .border_color(t.foreground + "0F")
    .child(face)
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .gap(2)
        .child(div().min_w(0).truncate().text_size(TEXT.xl).font_semibold().text_color(t.foreground).child(name))
        .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(line ?? "")),
    )
    .when(action != null, (el) => el.child(action));
}

export const NODE_WIDTH = 300;
export const NODE_LABEL = 16;
export const PORT = { dot: 10, under: 14, hit: 22 };
export const EDGE = { width: 1.5, selected: 2, dash: [5, 5], bend: 48 };
export const NODE_ICON = { start: "play", agent: "bot", continue: "bot", run: "terminal", approve: "flag", condition: "git-fork" };

const NODE_LOOK = {
  idle: { line: (t) => t.foreground + "14", width: 1 },
  selected: { line: (t) => t.accent + "66", width: 1.5 },
  running: { line: (t) => t.working, width: 1.5, icon: "loader-circle", tone: (t) => t.working, spin: true },
  done: { line: (t) => t.foreground + "14", width: 1, icon: "check", tone: (t) => t.done },
  failed: { line: (t) => t.blocked, width: 1.5, icon: "circle-x", tone: (t) => t.blocked },
  waiting: { line: (t) => t.blocked, width: 1.5, tone: (t) => t.blocked },
  skipped: { line: (t) => t.foreground + "14", width: 1, fade: 0.5 },
};

export function edgeLook(state, t) {
  if (state === "done") return { color: t.done + "99", width: EDGE.width, dash: null };
  if (state === "running") return { color: t.working, width: EDGE.width, dash: EDGE.dash };
  if (state === "selected") return { color: t.accent, width: EDGE.selected, dash: null };
  if (state === "pulling") return { color: t.accent, width: EDGE.width, dash: EDGE.dash };
  if (state === "refused") return { color: t.blocked, width: EDGE.width, dash: EDGE.dash };
  if (state === "delete") return { color: t.blocked, width: EDGE.selected, dash: null };
  if (state === "faded") return { color: t.dim + "80", width: EDGE.width, dash: EDGE.dash };
  return { color: t.dim, width: EDGE.width, dash: EDGE.dash };
}

export function port(id, { state = "idle", onMouseDown, onMouseUp, onHover } = {}, t, z = 1) {
  const hit = PORT.hit * Math.max(1, Math.min(z, 2));
  const dot = (size) => div().size(size * z).flex_none().rounded(size * z);
  const shown =
    state === "connected"
      ? dot(PORT.dot).bg(t.muted)
      : state === "target"
        ? dot(PORT.dot).bg(t.accent)
        : state === "under"
          ? dot(PORT.under).bg(t.accent)
          : state === "refused"
            ? dot(PORT.dot).bg(t.raised).border(1.5).border_color(t.blocked)
            : dot(PORT.dot).bg(t.raised).border(1.5).border_color(t.dim);
  return h_flex()
    .id(id)
    .size(hit)
    .flex_none()
    .items_center()
    .justify_center()
    .rounded(hit)
    .when(state === "under", (el) => el.bg(t.accent + "4D"))
    .when(state === "dimmed", (el) => el.opacity(0.25))
    .when(state === "hidden", (el) => el.opacity(0))
    .when(onMouseDown != null, (el) => el.on_mouse_down("left", (event, cx) => onMouseDown(event, cx)))
    .when(onMouseUp != null, (el) => el.on_mouse_up("left", (event, cx) => onMouseUp(event, cx)))
    .when(onHover != null, (el) => el.on_hover((on, cx) => onHover(on, cx)))
    .child(shown);
}

export function nodeField(content, t, { z = 1, rows = 3, focused = false, mono = null } = {}) {
  return v_flex()
    .w_full()
    .h((rows * 18 + 16) * z)
    .p(8 * z)
    .rounded(7 * z)
    .bg(t.background)
    .border_1()
    .border_color(focused ? t.accent + "B3" : t.foreground + "14")
    .text_size((mono ? 12 : 12.5) * z)
    .text_color(t.foreground)
    .when(mono != null, (el) => el.font_family(mono))
    .overflow_hidden()
    .child(content);
}

export function textareaField(state, t, options = {}) {
  return nodeField(Textarea.new(state), t, options);
}

export function nodeResult({ head = "RESULT", text, color, fields = null }, t, z = 1) {
  return v_flex()
    .w_full()
    .gap(4 * z)
    .child(div().w_full().h(1).bg(t.foreground + "0A"))
    .child(div().text_size(TEXT.xs * z).font_medium().text_color(t.unknown).child(head))
    .when(fields == null, (el) => el.child(div().w_full().text_size(12 * z).text_color(color ?? t.muted).child(text ?? "")))
    .when(fields != null, (el) =>
      el.children(
        Object.entries(fields ?? {}).map(([name, value]) =>
          h_flex()
            .w_full()
            .gap(8 * z)
            .text_size(12 * z)
            .child(div().flex_none().text_color(t.foreground).child(name))
            .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(value == null ? "" : String(value))),
        ),
      ),
    );
}

export function nodeButton(id, { label, icon: iconName, variant = "secondary", disabled = false, loading = false, onClick }, t, z = 1) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  const text = primary ? t.solid_foreground ?? t.accent_foreground : danger ? t.blocked : t.foreground;
  const glyph = icon(loading ? "loader-circle" : iconName, { size: 12 * z, color: primary ? text : danger ? t.blocked : t.muted });
  return h_flex()
    .id(id)
    .flex_1()
    .h(28 * z)
    .gap(6 * z)
    .items_center()
    .justify_center()
    .rounded(8 * z)
    .bg(primary ? t.solid ?? t.accent : danger ? t.blocked + "1F" : t.foreground + "0D")
    .when(!primary && !danger, (el) => el.border_1().border_color(t.foreground + "14"))
    .when(disabled, (el) => el.opacity(0.4))
    .when(!disabled, (el) => el.hover((s) => s.opacity(0.85)))
    .text_size(12 * z)
    .when(primary, (el) => el.font_semibold())
    .when(!primary, (el) => el.font_medium())
    .text_color(text)
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => {
      cx.stop_propagation();
      if (!disabled && !loading) onClick?.(cx);
    })
    .child(loading ? glyph.spin(900) : glyph)
    .child(label);
}

export function agentPicker(id, { program = null, name, model, open = false, onClick }, t, z = 1) {
  const glyph = (program ? programIcon(program, { size: 14 * z, fallback: "bot" }, t) : null) ?? icon("bot", { size: 13 * z, color: t.muted });
  return h_flex()
    .id(id)
    .h(24 * z)
    .gap(6 * z)
    .items_center()
    .child(
      h_flex()
        .id(`${id}-agent`)
        .h(24 * z)
        .px(8 * z)
        .gap(6 * z)
        .items_center()
        .rounded(6 * z)
        .bg(t.foreground + (open ? "17" : "0D"))
        .when(open, (el) => el.border_1().border_color(t.foreground + "24"))
        .hover((s) => s.bg(t.foreground + "17"))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => onClick?.(cx))
        .child(glyph)
        .child(div().text_size(12 * z).text_color(t.foreground).child(name))
        .child(icon("chevron-down", { size: 11 * z, color: t.dim })),
    )
    .when(model != null, (el) =>
      el.child(
        h_flex()
          .h(24 * z)
          .px(8 * z)
          .min_w(48 * z)
          .when(typeof model !== "string", (box) => box.w(104 * z))
          .items_center()
          .rounded(6 * z)
          .border_1()
          .border_color(t.foreground + "14")
          .text_size(12 * z)
          .text_color(t.unknown)
          .child(model),
      ),
    );
}

export function nodeShell(id, { kind, name, meta = null, state = "idle", width = NODE_WIDTH, body = [], result = null, actions = null }, t, z = 1) {
  const look = NODE_LOOK[state] ?? NODE_LOOK.idle;
  const tone = look.tone?.(t) ?? t.unknown;
  const iconName = look.icon ?? (state === "waiting" ? "flag" : NODE_ICON[kind] ?? "bot");
  const glyph = icon(iconName, { size: 12 * z, color: look.icon || state === "waiting" ? tone : t.unknown });
  return v_flex()
    .id(id)
    .w(width * z)
    .gap(6 * z)
    .when(look.fade != null, (el) => el.opacity(look.fade))
    .child(
      h_flex()
        .id(`${id}-label`)
        .w_full()
        .h(NODE_LABEL * z)
        .gap(6 * z)
        .items_center()
        .child(look.spin ? glyph.spin(900) : glyph)
        .child(div().min_w(0).truncate().text_size(TEXT.sm * z).font_medium().text_color(t.muted).child(name))
        .child(div().flex_1())
        .when(meta != null, (el) => el.child(div().flex_none().text_size(TEXT.sm * z).text_color(state === "idle" || state === "selected" || state === "done" ? t.unknown : tone).child(meta))),
    )
    .child(
      v_flex()
        .w_full()
        .p(10 * z)
        .gap(8 * z)
        .rounded(10 * z)
        .bg(t.raised)
        .border(look.width)
        .border_color(look.line(t))
        .children(body.filter(Boolean))
        .when(result != null, (el) => el.child(result))
        .when(actions != null, (el) => el.child(h_flex().w_full().gap(8 * z).children([].concat(actions).filter(Boolean)))),
    );
}

export function branchRow(id, { label, taken = null }, t, z = 1) {
  return h_flex()
    .id(id)
    .w_full()
    .h(22 * z)
    .px(8 * z)
    .items_center()
    .rounded(6 * z)
    .bg(taken === true ? t.done + "1A" : t.foreground + "08")
    .when(taken === false, (el) => el.opacity(0.5))
    .text_size(12 * z)
    .text_color(t.foreground)
    .child(label);
}

export function nodeCheck(id, { label, checked = false, onClick }, t, z = 1) {
  return h_flex()
    .id(id)
    .h(22 * z)
    .gap(7 * z)
    .items_center()
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => onClick?.(cx))
    .child(
      h_flex()
        .size(14 * z)
        .flex_none()
        .items_center()
        .justify_center()
        .rounded(4 * z)
        .when(checked, (el) => el.bg(t.accent))
        .when(!checked, (el) => el.border(1.5).border_color(t.dim))
        .when(checked, (el) => el.child(icon("check", { size: 10 * z, color: t.accent_foreground }))),
    )
    .child(div().text_size(12 * z).text_color(checked ? t.foreground : t.muted).child(label));
}

export function edgeBadge(id, { label, onClick }, t, z = 1) {
  return h_flex()
    .id(id)
    .h(22 * z)
    .px(8 * z)
    .gap(5 * z)
    .items_center()
    .rounded(11 * z)
    .bg(t.raised)
    .border_1()
    .border_color(t.foreground + "1F")
    .text_size(TEXT.sm * z)
    .text_color(t.muted)
    .when(onClick != null, (el) => el.hover((s) => s.border_color(t.accent + "80")).on_click((_e, cx) => onClick(cx)))
    .child(icon("repeat", { size: 11 * z, color: t.muted }))
    .child(label);
}

export function refusal(text, t) {
  return h_flex().flex_none().h(22).px(8).items_center().rounded(6).bg(t.blocked + "1F").text_size(TEXT.md).text_color(t.blocked).child(text);
}

function barButton(id, { icon: iconName, selected = false, tooltip, onClick, size = 26, iconSize = 14 }, t) {
  return h_flex()
    .id(id)
    .size(size)
    .flex_none()
    .items_center()
    .justify_center()
    .rounded(size === 34 ? 10 : 7)
    .when(selected, (el) => el.bg(t.selected).border_1().border_color(t.input))
    .when(!selected, (el) => el.hover((s) => s.bg(t.foreground + "0D")))
    .when(tooltip != null, (el) => el.tooltip(tooltip))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => onClick?.(cx))
    .child(icon(iconName, { size: iconSize, color: selected ? t.foreground : t.muted }));
}

const barRule = (t, height = 16) => div().w(1).h(height).flex_none().bg(t.foreground + "14");

export function nodeToolbar(id, { answer = false, answerLabel = "Answer fields", hot = false, onAnswer, onDuplicate, onDelete, onDeleteHover }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(34)
    .px(4)
    .gap(2)
    .items_center()
    .rounded(10)
    .bg(t.raised)
    .border_1()
    .border_color(t.foreground + "1F")
    .shadow_md()
    .when(answer, (el) => el.child(barButton(`${id}-answer`, { icon: "list-checks", tooltip: answerLabel, onClick: onAnswer }, t)))
    .child(barButton(`${id}-duplicate`, { icon: "copy-plus", tooltip: "Duplicate", onClick: onDuplicate }, t))
    .child(barRule(t))
    .child(
      h_flex()
        .id(`${id}-delete`)
        .size(26)
        .flex_none()
        .items_center()
        .justify_center()
        .rounded(7)
        .when(hot, (el) => el.bg(t.blocked + "1F"))
        .tooltip("Delete")
        .on_hover((on, cx) => onDeleteHover?.(on, cx))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => onDelete?.(cx))
        .child(icon("trash-2", { size: 14, color: hot ? t.blocked : t.muted })),
    );
}

export function canvasBar(id, { tool = "select", onSelect, onHand, onSearch, onAdd }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(44)
    .p(5)
    .gap(4)
    .items_center()
    .rounded(14)
    .bg(t.surface)
    .border_1()
    .border_color(t.foreground + "14")
    .shadow_lg()
    .child(barButton(`${id}-select`, { icon: "mouse-pointer-2", selected: tool === "select", tooltip: "Select  V", onClick: onSelect, size: 34, iconSize: 16 }, t))
    .child(barButton(`${id}-hand`, { icon: "hand", selected: tool === "hand", tooltip: "Hand  H", onClick: onHand, size: 34, iconSize: 16 }, t))
    .child(barButton(`${id}-search`, { icon: "search", tooltip: "Search  ⌘F", onClick: onSearch, size: 34, iconSize: 16 }, t))
    .child(barRule(t, 20))
    .child(button(`${id}-add`, { label: "Add node", icon: "plus", variant: "primary", size: "lg", stop: true, onClick: onAdd }, t));
}

export function zoomBar(id, { percent, minimap = false, onOut, onIn, onPercent, onFit, onTidy, onMinimap }, t) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(34)
    .px(4)
    .gap(2)
    .items_center()
    .rounded(10)
    .bg(t.surface)
    .border_1()
    .border_color(t.foreground + "14")
    .child(barButton(`${id}-out`, { icon: "minus", tooltip: "Zoom out  ⌘-", onClick: onOut }, t))
    .child(
      h_flex()
        .id(`${id}-percent`)
        .w(46)
        .h(26)
        .items_center()
        .justify_center()
        .rounded(7)
        .hover((s) => s.bg(t.foreground + "0D"))
        .tooltip("Zoom to fit")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => onPercent?.(cx))
        .text_size(TEXT.base)
        .text_color(t.foreground)
        .child(`${Math.round(percent)}%`),
    )
    .child(barButton(`${id}-in`, { icon: "plus", tooltip: "Zoom in  ⌘=", onClick: onIn }, t))
    .child(barRule(t))
    .child(barButton(`${id}-fit`, { icon: "maximize", tooltip: "Fit  ⇧1", onClick: onFit }, t))
    .child(barButton(`${id}-tidy`, { icon: "network", tooltip: "Tidy up  ⇧T", onClick: onTidy }, t))
    .child(barButton(`${id}-map`, { icon: "map", selected: minimap, tooltip: "Minimap", onClick: onMinimap }, t));
}

export const MINIMAP = { width: 200, height: 128 };

export function minimap(id, { blocks = [], view = null, onClick }, t) {
  return div()
    .id(id)
    .relative()
    .w(MINIMAP.width)
    .h(MINIMAP.height)
    .flex_none()
    .rounded(10)
    .bg(t.surface)
    .border_1()
    .border_color(t.foreground + "14")
    .overflow_hidden()
    .on_mouse_down("left", (event, cx) => {
      cx.stop_propagation();
      onClick?.(event, cx);
    })
    .children(blocks.map((block, index) => div().id(`${id}-node-${index}`).absolute().left(block.x).top(block.y).w(Math.max(block.w, 3)).h(Math.max(block.h, 3)).rounded(2).bg(block.color)))
    .when(view != null, (el) => el.child(div().absolute().left(view.x).top(view.y).w(Math.max(view.w, 4)).h(Math.max(view.h, 4)).rounded(3).border_1().border_color(t.accent)));
}

const RUN_TONE = { running: ["working", "Running"], waiting: ["blocked", "Needs you"], failed: ["blocked", "Failed"], done: ["done", "Done"], stopped: ["neutral", "Stopped"], interrupted: ["neutral", "Interrupted"], starting: ["working", "Starting"] };

export function runPill(id, { status, number, at = null, action = null, onAt }, t) {
  const [tone, label] = RUN_TONE[status] ?? ["neutral", status];
  return h_flex()
    .id(id)
    .flex_none()
    .h(30)
    .pl(8)
    .pr(4)
    .gap(8)
    .items_center()
    .rounded(15)
    .bg(t.surface)
    .border_1()
    .border_color(t.foreground + "14")
    .child(chip(label, { tone, dot: true }, t))
    .child(div().flex_none().text_size(TEXT.base).text_color(t.muted).child(`#${number}`))
    .when(at != null, (el) =>
      el.child(
        div()
          .id(`${id}-at`)
          .min_w(0)
          .truncate()
          .text_size(TEXT.base)
          .text_color(t.foreground)
          .when(onAt != null, (row) => row.hover((s) => s.text_color(t.accent)).on_click((_e, cx) => onAt(cx)))
          .child(at),
      ),
    )
    .when(action != null, (el) => el.child(button(`${id}-action`, { label: action.label, icon: action.icon, variant: action.variant ?? "ghost", size: "sm", loading: action.loading, stop: true, onClick: action.onClick }, t)));
}

export function addNodeMenu(id, { search = null, groups = [] }, t) {
  return v_flex()
    .id(id)
    .w(260)
    .p(6)
    .gap(4)
    .rounded(10)
    .bg(t.raised)
    .border_1()
    .border_color(t.foreground + "1F")
    .shadow_lg()
    .when(search != null, (el) => el.child(input(search, t, { kind: "search", height: 30 })))
    .children(
      groups
        .filter((group) => group.items.length)
        .map((group) =>
          v_flex()
            .pt(4)
            .gap(2)
            .child(div().px(8).h(18).child(heading(group.label, t)))
            .children(group.items.map((item) => menuItem(`${id}-${item.id}`, { icon: item.icon, label: item.label, detail: item.note, selected: item.selected, onClick: item.onClick }, t))),
        ),
    );
}
