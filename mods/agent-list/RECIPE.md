# Agent list

The `nuoh` layout's Agents card: every agent that reports its status, one 54px row each, with the space's avatar, the program's icon, the space's name, a chip with what the agent asks of the person and how long it has been asking, and the agent's own title under it. It keeps what Herdr's Agents list does (priority or space order, pins, sub-agents, the order `agent.next` follows, the folded sidebar) in the look of the rest of `nuoh`. `vjr-desk` keeps Herdr's list.

## What you see

- **The card,** under the Spaces card in the sidebar, 8px below it: `surface` `#161616`, 14px corners, a 1px `#FFFFFF12` line and a `md` shadow, painted by the layout node. The mod paints no fill of its own.
- **The header,** 40px, 14px in on the left and 8px on the right, 8px between its parts: a 14px `bot` and `Agents` in 13px medium `muted` `#A0A0A0`, then how many agents there are in 12px `dim` `#505050`. On the right, 4px apart: while any agent waits on the person, a chip `N needs you` (18px tall, 6px sides, 5px corners, 11px medium `blocked` `#FF8080` on `blocked` at `1F`), then a 28px ghost button with a 14px `list-filter` in `muted`, its tooltip `Sort agents: Priority` or `Sort agents: Grouped by space`.
- **The rows,** 6px in from the card's sides and bottom, 2px apart. Each is 54px tall with 8px sides, 10px corners and 11px between its parts:
  - **The avatar,** 30px with 8px corners, the space's first letter in bold 12px white on the space's color from the Spaces tree (`#22a99a` before it has one). On its bottom-right corner, 17px in and 19px down, a 17 x 14px badge with 4px corners on `canvas` `#101010` holds the program's 12px icon: a one-color glyph in the program's tile color, a picture as it is. A program without an icon gets no badge.
  - **The first line,** 8px apart: the space's name in 13px semibold `foreground`, cut with an ellipsis; an agent on another machine adds that machine's name in 11px `dim`; then the status chip, the same shape as the header's: `Needs you` in `blocked`, `Working` in `working` `#FFC799` (both on their color at `1F`), `Done` in `done` `#99FFE4` (at `1A`), none when idle. At the line's end, how long the agent has been in this state in 12px `dim`: `now`, `5m`, `6h`, `1d`. A pinned agent shows an 11px `pin` in `dim` before the time.
  - **The second line,** 2px under: the agent's title in 12px `unknown` `#707070`, cut with an ellipsis.
  - The focused agent's row sits on `selected` `#232323`; any row turns `hover` under the pointer.
- **Sub-agents,** under their agent, in 26px rows 22px in: the tree's lines in `input` (9px wide, 1.5px), the program's 14px icon, the name in 12.5px `muted` and a 7px dot in their state, a ring when idle. An agent with sub-agents shows a chevron before the time; folded, the chevron turns right and is followed by how many there are, in the most urgent one's color.
- **No agents:** `No agent status yet. Agents show up here when they report their status.` in 12px `dim` under the header.
- **The folded sidebar** (under 160px): no header, only the avatars, 30px, centered in 38px rows 3px in from the sides, 2px apart. One that isn't idle carries a 10px dot in its state with a 2px `surface` ring on its top-right corner, as the rail's Workspace tile does. The focused one sits on `selected`. Hovering one shows its space's name.
- **The sort popup,** 200 x 102px on `popover`: `Sort agents` in 11px `dim`, then `Priority` (`list`) and `Grouped by space` (`layers`) as the kit's popup rows, an `accent` check on the current one.

## How it behaves

- **Statuses:** blocked shows `Needs you` and counts toward the header's chip; working shows `Working`; done (finished while the person wasn't looking) shows `Done` until someone looks, when it turns idle; idle shows no chip. A sub-agent's error counts as blocked, and a sub-agent without a pane is never done: its parent's done is the news.
- **Order:** pinned agents first, then the rest. In Priority, each by urgency (its own state or its most urgent sub-agent's, a sub-agent's done counting as idle), then the latest change, then the newest. In Grouped by space, in the app's order, which keeps a space's agents together. There are no section headers: the chip says the state.
- **The title** is the pane's name when someone named it; else the tab's name when someone named the tab and it holds only this agent; else the agent's own title without the status glyph or spinner it puts first (`✳ Fix login` reads `Fix login`, `[ ! ] Review` reads `Review`); else the program's name. A title that only names the program, a folder, `user@host` or the terminal is skipped.
- **The time** is stamped by the mod each time an agent's state changes, done and idle counting as one (looking at a finished agent isn't the agent doing anything). The stamps are kept in the mod's `localStorage` (`changed`) across restarts, forgotten 30 days after their agent is gone, and the card redraws every 30 seconds so the times move. Right after the first install every agent reads `now`.
- **A click** on a row focuses the agent's pane. On a sub-agent's row it focuses its pane when it has one, and peeks at it otherwise.
- **Hovering** a row swaps its time for an 18px pin button (`pin`, or `pin-off` when pinned; tooltip `Pin to the top` or `Unpin`). Clicking it pins or unpins the agent everywhere Herdr shows it, without focusing it.
- **The chevron** folds or unfolds the agent's sub-agents, without focusing it.
- **The sort button** opens the popup at the pointer; a choice is saved in shared `agents.sort`, the key Herdr's list uses, so `vjr-desk` and `nuoh` remember the same order, and the popup closes.
- **`agent.next`, `agent.prev` and `agent.select`** follow the rows' order, published on every draw, folded sidebar included.

## Built from

- **Layout:** the `agents` block in `sidebar-lists`, which `nuoh-cards` (`recipes/cards.ts`) turns into a card and points at `agent-list` (installed as `nuoh-agent-list`). See [`mods/topbar/RECIPE.md`](../topbar/RECIPE.md) for the rest of the frame.
- **Mod** `mods/agent-list/`:
  - `logic.js` is pure: `agentTitle`, `crowdedTabs`, `machineOf`, `track`, `readChanged`, `ago`, `subTree`, `kidStatus`, `mostUrgent`, `arrange` (rows, sub-agent trees and urgency), `needsYou`, `sortOf`, `isNarrow`. The title's cleanup, `cleanTitle`, is in `lib/agent-title.js`, shared with the pane header.
  - `main.js` draws with the kit (`cardHeader`, `statusChip`, `avatar`, `iconButton`, `popupRow`, `statusDot`, `icon`) and takes the space's color from `lib/space-colors.js` (`avatarLook`), shared with the Spaces tree and the top bar.
  - It reads `agents()`, `terminals()`, `spaces()`, `layout()`, `props()`, `shared("agents.sort")` and `shared("space.colors")`; it writes `agents.sort`, calls `setAgentOrder`, and runs `pane.focus`, `terminal.peek` and `terminal.pin`. The sort popup is the same mod opened with `openOverlay({ kind: "popup", props: { sortMenu: true } })`. It runs no programs and reads no files.
- **Icons:** `bot`, `list-filter` (new in the kit), `pin`, `pin-off`, `chevron-down`, `chevron-right`, `list`, `layers`, `check`; the programs' icons come from Herdr's program table.

## Watch out

- A node's `radius` doesn't clip the mod: the rows stay 6px in from the card's edges with 10px corners, so a hover or a selection never pokes out of the card's 14px corners.
- `agents()` has no time, only `seq`: the mod stamps the times itself. Its `localStorage` is its own, so it starts empty, and Herdr's list keeps its stamps apart.
- Herdr's list moved old pins from its `localStorage` to the terminals' `herdr.pinned` label; this one reads the label (`pinned`) only.
- A sub-agent kept as a pane is in `agents()` too: it shows under its parent, and gets a row of its own only when pinned, or when the sidebar is folded and the trees are gone.
- Publish the order with `setAgentOrder` on every draw, even folded, or `agent.next` follows the app's own order.
- The popup reads its role from `props()` as well as from `init`'s first argument, which can carry only part of the props.
- A copy of Herdr's `agents` can't import the kit: the generator installs `kit.js` while reading a mod, before the recipes run. That is why this list is a mod of this repo and not a patched copy.

## Done when

- `bun run apply-layout` installs `nuoh-agent-list`, the `agents` block of `nuoh` shows it, `vjr-desk` still shows Herdr's `agents`, and `herdr-app status` shows no errors.
- The card shows the header with the count and, with an agent blocked, the `N needs you` chip; each row shows its avatar, badge, name, chip, time and title; the focused agent's row is selected.
- Clicking a row focuses its pane; hovering it shows the pin button, and pinning brings the agent to the top, unpinning sends it back.
- The sort button switches between Priority and Grouped by space, and `vjr-desk`'s list follows.
- Folding the sidebar from the top bar leaves only the avatars with their dots, and opening it brings the rows back.
- `agent.next` goes through the agents in the card's order.
