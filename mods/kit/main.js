import { View } from "gpui-kit";
import { h_flex, InputState, v_flex } from "gpui-base";
import { theme } from "herdr";
import { ICONS, TEXT, avatar, button, cardHeader, checkRow, chip, detailLine, emptyState, heading, icon, iconButton, iconPath, input, laneRow, lastClick, link, menuItem, nextStep, paneTile, pill, profile, programIcon, releaseCard, segment, stepCard, stepNode, statusChip, statusDot, tag, timelineStep, viewCard, viewTile } from "../../kit/kit.js";

const STATUSES = ["working", "blocked", "done", "idle", "unknown"];
const STEPS = ["done", "current", "bad", "todo"];
const VARIANTS = ["primary", "secondary", "tinted", "ghost", "danger"];
const SIZES = ["sm", "md", "lg"];

function section(id, title, t) {
  return v_flex().id(`kit-${id}`).gap(8).w_full().child(heading(title, t));
}

function row() {
  return h_flex().gap(8).items_center().flex_wrap();
}

export default class Kit extends View {
  init() {
    this.field = InputState.new({ placeholder: "Filter files…" });
    this.quiet = InputState.new({ value: "Typed text" });
    this.start = InputState.new({ placeholder: "CUP-1234 or what you'll work on" });
  }

  render() {
    const t = theme();
    const noop = () => {};
    const buttons = v_flex()
      .gap(8)
      .child(row().children(VARIANTS.map((variant) => button(`kit-b-${variant}`, { label: variant[0].toUpperCase() + variant.slice(1), icon: "play", variant, onClick: noop }, t))))
      .child(row().children(SIZES.map((size) => button(`kit-b-${size}`, { label: `Size ${size}`, icon: "plus", size, onClick: noop }, t))))
      .child(
        row()
          .child(button("kit-b-named", { label: "GitHub", icon: "github", onClick: noop }, t))
          .child(button("kit-b-pass", { label: "Passed", icon: "check", iconColor: t.done, size: "sm", onClick: noop }, t))
          .child(button("kit-b-fail", { label: "Failed…", icon: "x", iconColor: t.blocked, size: "sm", onClick: noop }, t))
          .child(button("kit-b-loading", { label: "Working…", variant: "primary", loading: true, onClick: noop }, t))
          .child(button("kit-b-disabled", { label: "Disabled", variant: "primary", disabled: true, onClick: noop }, t)),
      );
    const iconButtons = row()
      .child(iconButton("kit-ib-ghost", { icon: "settings", tooltip: "Ghost", onClick: noop }, t))
      .child(iconButton("kit-ib-sm", { icon: "arrow-left", tooltip: "Small", size: "sm", onClick: noop }, t))
      .child(iconButton("kit-ib-xs", { icon: "plus", tooltip: "Extra small", size: "xs", onClick: noop }, t))
      .child(iconButton("kit-ib-selected", { icon: "git-compare", tooltip: "Selected", selected: true, color: t.accent, onClick: noop }, t))
      .child(iconButton("kit-ib-bordered", { icon: "settings", tooltip: "Bordered", variant: "bordered", onClick: noop }, t));
    const segments = row()
      .gap(2)
      .child(segment("kit-seg-board", { icon: "square-kanban", label: "Board", selected: true, onClick: noop }, t))
      .child(segment("kit-seg-list", { icon: "list", label: "List", onClick: noop }, t))
      .child(segment("kit-seg-icon", { icon: "layers", tooltip: "Icon only", onClick: noop }, t));
    const tags = row()
      .child(tag("kit-tag-branch", { icon: "git-branch", label: "main" }, t))
      .child(tag("kit-tag-date", { icon: "calendar", label: "Wednesday, Nov 25" }, t))
      .child(tag("kit-tag-picker", { icon: "building-2", label: "A workspace", chevron: true, onClick: noop }, t))
      .child(tag("kit-tag-key", { label: "K", bordered: true }, t));
    const links = row()
      .child(link("kit-l-plain", { label: "A link", onClick: noop }, t))
      .child(link("kit-l-icon", { label: "Open", icon: "arrow-up-right", onClick: noop }, t));
    const chips = v_flex()
      .gap(8)
      .child(row().children(["blocked", "working", "done", "neutral"].map((tone) => chip(tone, { tone }, t))))
      .child(row().children(["blocked", "working", "done", "neutral"].map((tone) => chip(tone, { tone, size: "md" }, t))));
    const statusChips = row().children(["blocked", "working", "done"].map((name) => statusChip(name, t)));
    const pills = row()
      .child(pill("kit-pill-picker", { icon: "monitor", label: "This computer", chevron: true, onClick: noop }, t))
      .child(pill("kit-pill-status", { icon: "rotate-cw", label: "Read 2m ago", tooltip: "Read again", onClick: noop }, t))
      .child(pill("kit-pill-failed", { icon: "rotate-cw", label: "Failed", color: t.blocked, onClick: noop }, t))
      .child(pill("kit-pill-square", { icon: "settings", tooltip: "Settings", onClick: noop }, t));
    const ghost = (id, name) => iconButton(id, { icon: name, tooltip: name, onClick: noop }, t);
    const cardHeaders = v_flex()
      .w(300)
      .gap(8)
      .child(
        v_flex()
          .rounded(14)
          .bg(t.surface)
          .border_1()
          .border_color(t.border)
          .child(cardHeader("kit-ch-actions", { icon: "layers", label: "Spaces", count: 9 }, t).child(h_flex().items_center().child(ghost("kit-ch-folder", "folder-plus")).child(ghost("kit-ch-new", "plus")))),
      )
      .child(
        v_flex()
          .rounded(14)
          .bg(t.surface)
          .border_1()
          .border_color(t.border)
          .child(cardHeader("kit-ch-chip", { icon: "bot", label: "Agents", count: 4 }, t).child(h_flex().gap(4).items_center().child(statusChip("blocked", t, { label: "1 needs you" })).child(ghost("kit-ch-sort", "list-filter")))),
      );
    const viewParts = v_flex()
      .gap(8)
      .child(row().gap(10).child(viewTile("layers", t)).child(paneTile(icon("command", { size: 14, color: t.muted }), t)))
      .child(viewCard("kit-view-card", t).w(300).child(cardHeader("kit-vc-head", { icon: "bot", label: "A view card", count: 2 }, t)));
    const lines = stepCard(t)
      .w(300)
      .child(detailLine("Deploy to Preview", { detail: "success", color: t.done, mark: "check" }, t))
      .child(detailLine("Tests", { detail: "running", color: t.working, mark: "dot" }, t))
      .child(detailLine("Typecheck", { detail: "failure", color: t.blocked, mark: "exclamation" }, t))
      .child(detailLine("meta.json", { detail: "missing", color: t.unknown, mark: "ring" }, t));
    const timeline = v_flex()
      .w(340)
      .child(timelineStep("kit-step-done", { name: "Build", node: "done", note: "3 done items", chevron: "right" }, t))
      .child(timelineStep("kit-step-current", { name: "Check", node: "current", current: true, note: "1 of 3 checks", body: stepCard(t).child(nextStep("kit-next-run", { label: "Run the next step", icon: "play", target: "the agent in this worktree", aside: link("kit-next-tab", { label: "New tab instead", onClick: noop }, t), onClick: noop }, t)) }, t))
      .child(timelineStep("kit-step-bad", { name: "Review", node: "bad", note: "2 checks failing" }, t))
      .child(timelineStep("kit-step-todo", { name: "Merge", note: "you merge on GitHub", last: true }, t));
    const checks = stepCard(t)
      .w(320)
      .child(checkRow("kit-check-passed", { code: "D01", steps: "Close a ticket", expected: "No email goes out", state: "passed" }, t))
      .child(
        checkRow(
          "kit-check-asking",
          {
            code: "D02",
            steps: "Reply to the closed ticket",
            expected: "It reopens quietly",
            state: "asking",
            actions: [button("kit-check-pass", { label: "Passed", icon: "check", iconColor: t.done, size: "sm", onClick: noop }, t), button("kit-check-fail", { label: "Failed…", icon: "x", iconColor: t.blocked, size: "sm", onClick: noop }, t)],
            open: link("kit-check-open", { label: "Open", icon: "arrow-up-right", onClick: noop }, t),
          },
          t,
        ),
      )
      .child(checkRow("kit-check-failed", { code: "D03", steps: "Run the digest", expected: "The ticket is left out", state: "failed", saw: "Saw: it is still listed" }, t))
      .child(checkRow("kit-check-pending", { code: "D04", steps: "Open the inbox", expected: "The count is right", state: "pending" }, t));
    const lanes = v_flex()
      .w(340)
      .child(laneRow("kit-lane-asks", { color: t.blocked, code: "T-12", title: "A task waiting on you", step: "Check", why: "the agent asks", dots: ["done", "current", "todo", "todo"], action: button("kit-lane-go", { label: "Go to task", icon: "terminal", size: "sm", onClick: noop }, t), onClick: noop }, t))
      .child(laneRow("kit-lane-running", { color: t.working, code: "T-13", title: "A task at work", step: "Ship", why: "running", dots: ["done", "done", "current", "todo"], last: true, onClick: noop }, t));
    const release = stepCard(t)
      .w(320)
      .child(
        v_flex()
          .p(4)
          .child(
            releaseCard(
              {
                heading: "Release 4.12 · #team",
                title: "Closed tickets stay quiet",
                items: "• Replying to a closed ticket reopens it quietly",
                shots: [],
                warning: { text: "Links still point to preview.", action: link("kit-release-regen", { label: "Regenerate", onClick: noop }, t) },
                copy: button("kit-release-copy", { label: "Copy message", icon: "copy", full: true, onClick: noop }, t),
              },
              t,
            ),
          ),
      );
    const empties = v_flex()
      .w(340)
      .rounded(10)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .child(emptyState({ title: "Nothing here", detail: "Focus a terminal in a repo." }, t))
      .child(emptyState({ title: "Switched off", detail: "Nothing is read until it's on.", action: button("kit-empty-on", { label: "Turn on", onClick: noop }, t) }, t));
    const clicks = v_flex().w(340).child(lastClick("Sent to the agent", {}, t)).child(lastClick("Not sent: the agent is busy", { ok: false }, t));
    const profiles = row().child(profile("kit-profile-on", { label: "Work", onClick: noop }, t)).child(profile("kit-profile-off", { off: true, onClick: noop }, t));
    const menuItems = v_flex()
      .w(260)
      .p(4)
      .gap(1)
      .bg(t.raised)
      .border_1()
      .border_color(t.foreground + "1F")
      .rounded(12)
      .child(menuItem("kit-mi-icon", { icon: "plus", label: "New folder…", onClick: noop }, t))
      .child(menuItem("kit-mi-dot", { dot: t.ansi4, label: "Clients", check: true, onClick: noop }, t))
      .child(menuItem("kit-mi-detail", { icon: "columns-2", label: "Split right", detail: "cmd-d", onClick: noop }, t))
      .child(menuItem("kit-mi-selected", { icon: "git-branch", label: "Selected", selected: true, onClick: noop }, t))
      .child(menuItem("kit-mi-described", { label: "Work", description: "the team's flow", check: true, onClick: noop }, t))
      .child(menuItem("kit-mi-danger", { icon: "x", label: "Remove from folder", danger: true, onClick: noop }, t));
    const dots = v_flex()
      .gap(8)
      .child(row().children(STATUSES.map((name) => h_flex().gap(4).items_center().text_size(TEXT.sm).text_color(t.muted).child(statusDot(t[name])).child(name))))
      .child(row().children(STATUSES.map((name) => h_flex().gap(4).items_center().text_size(TEXT.sm).text_color(t.muted).child(statusDot(t[name], { hollow: true })).child(name))));
    const steps = row().gap(16).children(
      STEPS.map((state) => h_flex().gap(6).items_center().text_size(TEXT.sm).text_color(t.muted).child(stepNode(state, t)).child(state)),
    );
    const icons = row().gap(12).children(
      ICONS.map((name) =>
        v_flex()
          .w(84)
          .gap(4)
          .items_center()
          .text_size(TEXT.xs)
          .text_color(t.muted)
          .child(icon(name, { size: 18, color: t.foreground }))
          .child(name),
      ),
    );

    const inputs = v_flex()
      .gap(8)
      .w(320)
      .child(input(this.field, t, { kind: "search" }))
      .child(input(this.quiet, t, { focused: false }))
      .child(input(this.start, t, { kind: "start", focused: false }));

    return v_flex()
      .id("kit")
      .size_full()
      .overflow_y_scrollbar()
      .bg(t.background)
      .p(16)
      .gap(20)
      .text_color(t.foreground)
      .child(section("buttons", "Buttons", t).child(buttons))
      .child(section("icon-buttons", "Icon buttons", t).child(iconButtons))
      .child(section("segments", "Segments", t).child(segments))
      .child(section("tags", "Tags", t).child(tags))
      .child(section("links", "Links", t).child(links))
      .child(section("chips", "Chips", t).child(chips))
      .child(section("status-chips", "Status chips", t).child(statusChips))
      .child(section("pills", "Pills", t).child(pills))
      .child(
        section("program-icons", "Program icons", t).child(
          row()
            .child(programIcon({ icon: iconPath("terminal"), tint: true, tile: t.accent }, {}, t))
            .child(programIcon(null, { fallback: "terminal" }, t)),
        ),
      )
      .child(section("avatars", "Avatars", t).child(row().child(avatar("nuoh", { fill: t.accent, letter: t.accent_foreground })).child(avatar("work", { fill: t.done, letter: t.accent_foreground }, { size: 28, radius: 8 }))))
      .child(section("inputs", "Inputs", t).child(inputs))
      .child(section("card-headers", "Card headers", t).child(cardHeaders))
      .child(section("view-parts", "View parts", t).child(viewParts))
      .child(section("lines", "Detail lines", t).child(lines))
      .child(section("timeline", "Timeline steps", t).child(timeline))
      .child(section("checks", "Check rows", t).child(checks))
      .child(section("lanes", "Lane rows", t).child(lanes))
      .child(section("release", "Release card", t).child(release))
      .child(section("empty", "Empty states", t).child(empties))
      .child(section("last-click", "Last click", t).child(clicks))
      .child(section("profile", "Profile", t).child(profiles))
      .child(section("menu-items", "Menu items", t).child(menuItems))
      .child(section("dots", "Dots", t).child(dots))
      .child(section("steps", "Steps", t).child(steps))
      .child(section("icons", "Icons", t).child(icons));
  }
}
