import { div } from "gpui-kit";
import { h_flex, InputState, ScrollHandle, v_flex } from "gpui-base";
import { closeOverlay, exec, focused, hc, home, panes, theme } from "herdr";
import { CONTROL, TEXT, heading, input, popupRow } from "../../kit/kit.js";
import { openMarkdown } from "../../lib/open-markdown.js";
import { EXISTING, LOOKUP, REPO_MARKDOWN, mentions, missingNames, onScreen, parseExisting, parseLookup, parseRepoMarkdown, pickerRows } from "./logic.js";

const HISTORY = "400";
const CHECKED = 200;
const LIST_HEIGHT = 320;

export function sourceOf(given, list, now) {
  const local = (terminal) => (terminal && !terminal.includes("/") ? terminal : null);
  if (given?.terminal) {
    const pane = list.find((candidate) => candidate.pane === given.pane) ?? list.find((candidate) => candidate.terminal === given.terminal) ?? null;
    return { terminal: local(given.terminal), pane: pane?.pane ?? null, cwd: pane?.cwd ?? null };
  }
  const focusedPane = now?.pane ? list.find((candidate) => candidate.pane === now.pane) : null;
  const pane = focusedPane?.terminal ? focusedPane : list.find((candidate) => candidate.tab === now?.tab && candidate.terminal) ?? null;
  if (pane) return { terminal: local(pane.terminal), pane: pane.pane, cwd: pane.cwd ?? null };
  return { terminal: local(now?.terminal ?? null), pane: null, cwd: now?.cwd ?? null };
}

export class Picker {
  constructor(given, cx) {
    this.overlay = given.overlay;
    this.source = sourceOf(given, panes(), focused());
    this.screen = null;
    this.repo = [];
    this.top = null;
    this.filter = "";
    this.at = 0;
    this.note = null;
    this.scroll = ScrollHandle.new();
    this.input = InputState.new({ placeholder: "Filter, or type a path…" });
    this.input.on("change", (_event, cx) => {
      this.filter = this.input.value();
      this.at = 0;
      this.note = null;
      cx.notify();
    });
    this.input.on("submit", (_event, cx) => this.choose(this.rows()[this.at] ?? null, cx));
    this.input.focus();
    this.load(cx);
  }

  load(cx) {
    const { terminal, cwd } = this.source;
    cx.spawn(async (cx) => {
      let screen = [];
      try {
        if (terminal) {
          const read = await hc(["read", terminal, "--json", "--lines", HISTORY]);
          const candidates = mentions(read.code === 0 ? (JSON.parse(read.stdout).text ?? "") : "").slice(0, CHECKED);
          if (candidates.length > 0) {
            const found = parseExisting((await exec("sh", ["-c", EXISTING, "sh", cwd ?? home(), ...candidates])).stdout);
            const names = cwd ? missingNames(candidates, found) : [];
            const byName = names.length > 0 ? parseLookup((await exec("sh", ["-c", LOOKUP, "sh", ...names], { cwd })).stdout) : new Map();
            screen = onScreen(candidates, found, byName);
          }
        }
        if (cwd) {
          const listed = parseRepoMarkdown((await exec("sh", ["-c", REPO_MARKDOWN], { cwd })).stdout);
          this.top = listed.top;
          this.repo = listed.files;
        }
      } catch {}
      this.screen = screen;
      cx.notify();
    });
  }

  sections() {
    return pickerRows(this.screen ?? [], this.repo, this.filter, { top: this.top, home: home() });
  }

  rows() {
    const { screen, repo } = this.sections();
    return [...screen, ...repo];
  }

  choose(row, cx) {
    if (row) {
      openMarkdown(row.path, { pane: this.source.pane });
      closeOverlay(this.overlay);
      return;
    }
    const typed = this.filter.trim();
    if (!typed) return;
    cx.spawn(async (cx) => {
      const found = parseExisting((await exec("sh", ["-c", EXISTING, "sh", this.source.cwd ?? home(), typed]).catch(() => ({ stdout: "" }))).stdout);
      const path = found.get(typed);
      if (path) {
        openMarkdown(path, { pane: this.source.pane });
        closeOverlay(this.overlay);
        return;
      }
      this.note = `No file at ${typed}`;
      cx.notify();
    });
  }

  move(by, cx) {
    const count = this.rows().length;
    if (count === 0) return;
    this.at = (this.at + by + count) % count;
    this.scroll.scroll_to_item(this.place[this.at] ?? 0);
    cx.notify();
  }

  render() {
    const t = theme();
    const { screen, repo } = this.sections();
    const count = screen.length + repo.length;
    if (this.at >= count) this.at = Math.max(0, count - 1);
    const children = [];
    this.place = [];
    const section = (title, rows, offset) => {
      children.push(div().px(8).pt(children.length > 0 ? 8 : 4).pb(2).child(heading(title, t)));
      rows.forEach((row, index) => {
        const at = offset + index;
        this.place.push(children.length);
        children.push(
          popupRow(`md-pick-${at}`, { icon: "file-text", label: row.name, detail: row.where, selected: at === this.at, onClick: (cx) => this.choose(row, cx) }, t),
        );
      });
    };
    if (this.screen === null) children.push(this.message("Reading the terminal…", t));
    else if (screen.length > 0) section("On this screen", screen, 0);
    else if (!this.filter.trim()) children.push(this.message(this.source.terminal ? "No Markdown on this terminal's screen. Type a path." : "No terminal to read. Type a path.", t));
    if (repo.length > 0) section("In this repository", repo, screen.length);
    if (this.screen !== null && count === 0 && this.filter.trim()) children.push(this.message(this.note ?? "No match. Enter opens it as a path.", t));
    return v_flex()
      .id("md-picker")
      .w_full()
      .p(6)
      .gap(6)
      .bg(t.popover)
      .text_color(t.foreground)
      .on_key_down((event, cx) => {
        if (event.key === "escape") closeOverlay(this.overlay);
        else if (event.key === "down") this.move(1, cx);
        else if (event.key === "up") this.move(-1, cx);
      })
      .child(input(this.input, t))
      .child(v_flex().id("md-picker-list").flex_none().h(LIST_HEIGHT).overflow_y_scrollbar().track_scroll(this.scroll).children(children))
      .child(
        h_flex()
          .flex_none()
          .h(CONTROL.small)
          .px(8)
          .gap(12)
          .items_center()
          .text_size(TEXT.sm)
          .text_color(t.dim)
          .child("↵ open beside")
          .child("↑↓ choose")
          .child("esc close"),
      );
  }

  message(text, t) {
    return div().px(8).py(10).text_size(TEXT.base).text_color(t.dim).child(text);
  }
}
