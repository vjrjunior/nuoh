import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, closeOverlay, layout, openOverlay, props, run, setAgentOrder, setShared, shared, spaces, terminals, theme } from "herdr";
import { CONTROL, ICON_SIZE, TEXT, avatar, cardHeader, icon, iconButton, menuItem, programIcon, statusChip, statusDot } from "../../kit/kit.js";
import { avatarLook } from "../../lib/space-colors.js";
import { isNarrow } from "../../lib/layout-tree.js";
import { agentTitle } from "../../lib/agent-title.js";
import { readChanged, track } from "../../lib/agent-since.js";
import { SORTS, SORT_KEY, ago, arrange, crowdedTabs, kidStatus, machineOf, mostUrgent, needsYou, sortOf } from "./logic.js";

const ROW = 54;
const SUB_ROW = 26;
const AVATAR = 30;
const AVATAR_RADIUS = 8;
const BADGE_W = 17;
const BADGE_H = 14;
const BADGE_ICON = 12;
const SUB_ICON = 14;
const NARROW_ROW = 38;
const DOT = 10;
const REDRAW = 30000;
const SORT_POPUP = { width: 200, height: 102 };
const STORE = "changed";
const EMPTY = "No agent status yet. Agents show up here when they report their status.";

function load() {
  try {
    return readChanged(localStorage.getItem(STORE));
  } catch {
    return {};
  }
}

function save(changed) {
  try {
    localStorage.setItem(STORE, JSON.stringify(changed));
  } catch {}
}

export default class AgentList extends View {
  init(given, cx) {
    this.menu = Boolean({ ...(props() ?? {}), ...(given && typeof given === "object" ? given : {}) }.sortMenu);
    if (this.menu) return;
    this.changed = load();
    this.folded = new Set();
    this.hovered = null;
    cx.timer.every(REDRAW, (cx) => cx.notify());
  }

  since(agent) {
    return this.changed[agent.address]?.at ?? 0;
  }

  stamp(list, now) {
    const next = track(this.changed, list, now);
    if (!next.dirty) return;
    this.changed = next.changed;
    save(this.changed);
  }

  sortMenu(t) {
    const on = sortOf(shared(SORT_KEY)).id;
    return v_flex()
      .id("sort-menu")
      .size_full()
      .p(4)
      .gap(1)
      .bg(t.popover)
      .child(div().px(8).pt(4).pb(6).text_size(TEXT.sm).text_color(t.dim).child("Sort agents"))
      .children(
        SORTS.map((sort) =>
          menuItem(
            `sort-${sort.id}`,
            {
              icon: sort.icon,
              label: sort.label,
              check: sort.id === on,
              onClick: () => {
                setShared(SORT_KEY, sort.id);
                closeOverlay(props()?.overlay);
              },
            },
            t,
          ),
        ),
      );
  }

  face(agent, colors, t) {
    const badge = programIcon(agent.program, { size: BADGE_ICON }, t);
    return div()
      .relative()
      .size(AVATAR)
      .flex_none()
      .child(avatar(agent.space_name, avatarLook({ id: agent.space }, colors, t), { size: AVATAR, radius: AVATAR_RADIUS, textSize: TEXT.base }))
      .when(badge != null, (el) =>
        el.child(h_flex().absolute().left(17).top(19).w(BADGE_W).h(BADGE_H).rounded(4).bg(t.canvas).items_center().justify_center().child(badge)),
      );
  }

  pin(agent, t) {
    return iconButton(
      `pin-${agent.address}`,
      {
        icon: agent.pinned ? "pin-off" : "pin",
        tooltip: agent.pinned ? "Unpin" : "Pin to the top",
        color: t.dim,
        size: "xs",
        stop: true,
        onClick: (cx) => {
          run("terminal.pin", { terminal: agent.address, pinned: !agent.pinned });
          this.hovered = null;
          cx?.notify();
        },
      },
      t,
    );
  }

  fold(agent, kids, t) {
    const open = !this.folded.has(agent.address);
    const top = mostUrgent(kids.map((kid) => kidStatus(kid.terminal, this.listed)));
    return h_flex()
      .id(`fold-${agent.address}`)
      .flex_none()
      .h(CONTROL.tiny)
      .px(3)
      .gap(3)
      .items_center()
      .rounded(4)
      .text_size(TEXT.sm)
      .text_color(open ? t.dim : (t[top] ?? t.dim))
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (open) this.folded.add(agent.address);
        else this.folded.delete(agent.address);
        cx.notify();
      })
      .child(icon(open ? "chevron-down" : "chevron-right", { size: ICON_SIZE.sm }))
      .when(!open, (el) => el.child(String(kids.length)));
  }

  row(agent, { title, kids, colors, now }, t) {
    const machine = machineOf(agent.address);
    const chip = statusChip(agent.status, t);
    const when = this.since(agent);
    const hovered = this.hovered === agent.address;
    return h_flex()
      .id(`ag-${agent.address}`)
      .h(ROW)
      .flex_none()
      .px(8)
      .gap(11)
      .items_center()
      .rounded(10)
      .cursor_pointer()
      .when(agent.focused, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_hover((on, cx) => {
        if (on) this.hovered = agent.address;
        else if (this.hovered === agent.address) this.hovered = null;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane: agent.pane }))
      .child(this.face(agent, colors, t))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(2)
          .child(
            h_flex()
              .min_w(0)
              .gap(8)
              .items_center()
              .child(div().min_w(0).truncate().text_size(TEXT.xl).font_semibold().text_color(t.foreground).child(agent.space_name || title))
              .when(machine != null, (el) => el.child(div().flex_none().text_size(TEXT.sm).text_color(t.dim).child(machine)))
              .when(chip != null, (el) => el.child(chip))
              .child(div().flex_1())
              .when(kids.length > 0, (el) => el.child(this.fold(agent, kids, t)))
              .when(hovered, (el) => el.child(this.pin(agent, t)))
              .when(!hovered && agent.pinned, (el) => el.child(icon("pin", { size: ICON_SIZE.sm, color: t.dim })))
              .when(!hovered && when > 0, (el) => el.child(div().flex_none().text_size(TEXT.base).text_color(t.dim).child(ago(now - when)))),
          )
          .child(div().min_w(0).truncate().text_size(TEXT.base).text_color(t.unknown).child(title)),
      );
  }

  subRow({ terminal, lines }, t) {
    const status = kidStatus(terminal, this.listed);
    const kept = this.listed.has(terminal.address);
    const pic = programIcon(terminal.program, { size: SUB_ICON }, t);
    return h_flex()
      .id(`sub-${terminal.address}`)
      .h(SUB_ROW)
      .flex_none()
      .pl(22)
      .pr(8)
      .items_center()
      .rounded(8)
      .text_size(TEXT.lg)
      .hover((s) => s.bg(t.hover))
      .on_click(() => (kept ? run("pane.focus", { terminal: terminal.address }) : run("terminal.peek", { terminal: terminal.address })))
      .children(
        lines.map((line) =>
          div()
            .self_start()
            .mt(-4)
            .w(9)
            .h(17)
            .mr(4)
            .flex_none()
            .when(Boolean(line), (el) => el.border_l(1.5).border_color(t.input))
            .when(line === "└" || line === "├", (el) => el.border_b(1.5).rounded_bl(6)),
        ),
      )
      .when(pic != null, (el) => el.child(div().mr(8).child(pic)))
      .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(terminal.name || terminal.template || terminal.program?.name || terminal.address))
      .child(statusDot(t[status] ?? t.dim, { size: 7, hollow: status === "idle" }));
  }

  narrowRow(agent, colors, t) {
    const dot = agent.status === "idle" ? null : t[agent.status];
    return h_flex()
      .id(`ag-${agent.address}`)
      .h(NARROW_ROW)
      .flex_none()
      .mx(3)
      .items_center()
      .justify_center()
      .rounded(8)
      .when(agent.focused, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .tooltip(agent.space_name || agent.address)
      .on_click(() => run("pane.focus", { pane: agent.pane }))
      .child(
        div()
          .relative()
          .size(AVATAR)
          .flex_none()
          .child(avatar(agent.space_name, avatarLook({ id: agent.space }, colors, t), { size: AVATAR, radius: AVATAR_RADIUS, textSize: TEXT.base }))
          .when(dot != null, (el) => el.child(statusDot(dot, { size: DOT }).absolute().top(-3).right(-3).border(2).border_color(t.surface))),
      );
  }

  header(count, blocked, sort, t) {
    return cardHeader("agents-head", { icon: "bot", label: "Agents", count }, t).child(
      h_flex()
        .gap(4)
        .items_center()
        .when(blocked > 0, (el) => el.child(statusChip("blocked", t, { label: `${blocked} needs you` })))
        .child(
          iconButton(
            "ag-sort",
            {
              icon: "list-filter",
              tooltip: `Sort agents: ${sort.label}`,
              color: t.muted,
              onClick: () => openOverlay({ mod: "agent-list", kind: "popup", width: SORT_POPUP.width, height: SORT_POPUP.height, props: { sortMenu: true } }),
            },
            t,
          ),
        ),
    );
  }

  render() {
    const t = theme();
    if (this.menu) return this.sortMenu(t);
    const narrow = isNarrow(layout());
    const sort = sortOf(shared(SORT_KEY));
    const list = agents();
    const now = Date.now();
    this.stamp(list, now);
    const { rows, trees, listed, urgency } = arrange(list, terminals(), { sort: sort.id, since: (agent) => this.since(agent), narrow });
    this.listed = listed;
    setAgentOrder(rows.map((agent) => agent.address));
    const colors = shared("space.colors");
    if (narrow) {
      return v_flex()
        .id("agent-list")
        .size_full()
        .min_h(0)
        .child(v_flex().id("ag-list").flex_1().min_h(0).py(6).gap(2).overflow_y_scrollbar().children(rows.map((agent) => this.narrowRow(agent, colors, t))));
    }
    const tabs = new Map(spaces().flatMap((space) => space.tabs ?? []).map((tab) => [tab.id, tab]));
    const crowded = crowdedTabs(list);
    const drawn = rows.flatMap((agent) => {
      const kids = trees.get(agent.address) ?? [];
      const row = this.row(agent, { title: agentTitle(agent, tabs.get(agent.tab), crowded.has(agent.tab)), kids, colors, now }, t);
      return this.folded.has(agent.address) ? [row] : [row, ...kids.map((kid) => this.subRow(kid, t))];
    });
    return v_flex()
      .id("agent-list")
      .size_full()
      .min_h(0)
      .text_size(TEXT.xl)
      .child(this.header(list.length, needsYou(rows, urgency), sort, t))
      .when(rows.length === 0, (el) => el.child(div().px(14).text_size(TEXT.base).text_color(t.dim).child(EMPTY)))
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(6).pb(6).gap(2).overflow_y_scrollbar().children(drawn));
  }
}
