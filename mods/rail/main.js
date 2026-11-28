import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { agents, focused, keys, layout, nextCommand, notify, panes, props, run, theme, window } from "herdr";
import { icon, statusDot } from "../../kit/kit.js";
import { readChanged, track } from "../../lib/agent-since.js";
import { VIEWS, WORKSPACE, badgeOf, focusOf, followFocus, hint, keyFor, nextWaiting, shownView, viewsOf } from "./logic.js";

const PALETTE = { name: "palette" };
const INSET = 7;
const TILE = 40;
const TILE_RADIUS = 11;
const GLYPH = 18;
const BADGE = 13;
const STORE = "changed";
const NOBODY = { title: "Nobody is waiting", level: "info", timeout: 2000 };

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

export default class Rail extends View {
  init(_given, cx) {
    this.last = null;
    this.changed = load();
    cx.spawn(async () => {
      for (;;) {
        if ((await nextCommand()) === "waiting") this.waiting();
      }
    });
  }

  stamp(list) {
    const next = track(this.changed, list, Date.now());
    if (!next.dirty) return;
    this.changed = next.changed;
    save(this.changed);
  }

  waiting() {
    const list = agents() ?? [];
    this.stamp(list);
    const current = focused()?.terminal ?? list.find((agent) => agent.focused)?.address ?? null;
    const next = nextWaiting(list, { since: (agent) => this.changed[agent.address]?.at ?? 0, current });
    if (!next) {
      notify(NOBODY);
      return;
    }
    if (shownView(layout(), viewsOf(props())) !== WORKSPACE) run("layout.select", { stack: VIEWS, child: WORKSPACE });
    if (next.pane) run("pane.focus", { pane: next.pane });
    else run("terminal.peek", { terminal: next.address });
  }

  select(id) {
    this.last = focusOf(focused());
    run("layout.select", { stack: VIEWS, child: id });
  }

  follow(shown) {
    const next = followFocus(this.last, focusOf(focused()), { shown, paneIds: (panes() ?? []).map((pane) => pane.pane) });
    this.last = next.last;
    if (next.back) run("layout.select", { stack: VIEWS, child: WORKSPACE });
  }

  tile(id, { glyph, label, selected = false, badge = null, onClick }, t) {
    return div()
      .id(`rail-${id}`)
      .relative()
      .size(TILE)
      .flex_none()
      .flex()
      .items_center()
      .justify_center()
      .rounded(TILE_RADIUS)
      .text_color(selected ? t.foreground : t.muted)
      .when(selected, (el) => el.bg(t.selected).border_1().border_color(t.input))
      .when(!selected, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .tooltip(label)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => onClick())
      .child(icon(glyph, { size: GLYPH }))
      .when(badge != null, (el) => el.child(statusDot(t[badge], { size: BADGE }).absolute().top(2).right(2).border(2).border_color(t.surface)));
  }

  render() {
    const t = theme();
    const views = viewsOf(props());
    const shown = shownView(layout(), views);
    this.follow(shown);
    const platform = window()?.platform;
    const bindings = keys();
    const list = agents() ?? [];
    this.stamp(list);
    const badge = badgeOf(list);
    return v_flex()
      .id("rail")
      .size_full()
      .items_center()
      .py(INSET)
      .gap(6)
      .child(
        this.tile("search", { glyph: "search", label: hint("Search", keyFor(bindings, [`mod.open:${PALETTE.name}`, "app.palette"]), platform), onClick: () => run("mod.open", PALETTE) }, t),
      )
      .child(div().w(24).h(1).my(4).flex_none().bg(t.border))
      .children(
        views.map((view) =>
          this.tile(
            view.id,
            {
              glyph: view.icon,
              label: hint(view.label, view.key, platform),
              selected: view.id === shown,
              badge: view.id === WORKSPACE ? badge : null,
              onClick: () => this.select(view.id),
            },
            t,
          ),
        ),
      )
      .child(div().flex_1())
      .child(
        this.tile("settings", { glyph: "settings", label: hint("Settings", keyFor(bindings, ["app.settings"]), platform), onClick: () => run("app.settings") }, t),
      );
  }
}
