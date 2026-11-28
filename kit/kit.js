import { div, image, svg } from "gpui-kit";
import { h_flex, Input, v_flex } from "gpui-base";

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
  "git-pull-request",
  "github",
  "image",
  "layers",
  "list",
  "list-filter",
  "loader-circle",
  "maximize-2",
  "minimize-2",
  "monitor",
  "panel-left",
  "pin",
  "pin-off",
  "play",
  "plus",
  "rotate-cw",
  "route",
  "rows-2",
  "search",
  "server",
  "settings",
  "square-kanban",
  "terminal",
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
