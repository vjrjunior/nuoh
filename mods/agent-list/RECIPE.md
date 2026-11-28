# Agent list

The `nuoh` layout's Agents card: every agent that reports its status, one 54px row each, with the space's avatar, the program's icon, the space's name, a chip with what the agent asks of the person and how long it has been in that state, and the agent's own title under it. It keeps what Herdr's Agents list does (priority or space order, pins, sub-agents, the order `agent.next` follows, the folded sidebar) in the look of the rest of `nuoh`.

![Agent list](preview.png)

## What you see

- **The card,** 8px under the Spaces card: `surface` `#161616`, 14px corners, a 1px `#FFFFFF12` line and a `md` shadow, painted by the layout node; the mod paints no fill.
- **The header,** the kit's 40px `cardHeader`: a 14px `bot`, `Agents` in 13px medium `muted` `#A0A0A0` and the count of agents in 12px `dim` `#505050`; on the right, 4px apart, a `statusChip` reading `N needs you` in `blocked` `#FF8080` while any agent or sub-agent waits on the person, and a 28px ghost `list-filter` button with the tooltip `Sort agents: Priority` or `Sort agents: Grouped by space`. With no agents, `No agent status yet. Agents show up here when they report their status.` in 12px `dim` under it.
- **The rows,** 6px in from the card's sides and bottom, 2px apart, 54px tall with 8px sides, 10px corners and 11px between parts: a 30px avatar (8px corners, the space's first letter in bold 12px white on the space's color, `#22a99a` before it has one) with a 17 x 14px badge on `canvas` at its bottom-right holding the program's 12px icon (a one-color glyph in the program's tile color, a picture as it is, none without an icon); a first line with the space's name in 13px semibold `foreground`, another machine's name in 11px `dim`, the `statusChip` (`Needs you`, `Working`, `Done`, none when idle) and, at the end, the sub-agents' chevron, an 11px `pin` on a pinned agent and the time in 12px `dim` (`now`, `5m`, `6h`, `1d`); and the agent's title 2px under in 12px `unknown` `#707070`. The focused agent's row sits on `selected`, a hovered one on `hover`.
- **Sub-agents,** under their agent in 26px rows 22px in: the tree's lines in `input` (9px wide, 1.5px), the program's 14px icon, the name (its name, template, program or address) in 12.5px `muted` and a 7px dot in its state, a ring when idle. Folded, the chevron turns right and shows how many there are, in the most urgent one's color.
- **The folded sidebar** (under 160px): only the avatars, centered in 38px rows 3px in from the sides; one that isn't idle carries a 10px dot in its state with a 2px `surface` ring on its top-right corner, and hovering one shows its space's name.
- **The sort popup,** 200 x 102px on `popover`: `Sort agents` in 11px `dim`, then `Priority` (`list`) and `Grouped by space` (`layers`) as `menuItem`s, an `accent` check on the current one.

## How it behaves

- **Statuses:** blocked shows `Needs you` and counts toward the header's chip; done shows `Done` until someone looks, then turns idle. A sub-agent's `error` counts as blocked, and a sub-agent without a pane is never done: its parent's done is the news.
- **Order:** pinned agents first. In Priority, by urgency (its own state or its most urgent sub-agent's, a sub-agent's done counting as idle), then the latest change, then the newest; in Grouped by space, in the app's order. `setAgentOrder` publishes the rows' order on every draw, folded sidebar included, so `agent.next`, `agent.prev` and `agent.select` follow it.
- **The title** is `agentTitle` from `lib/agent-title.js`: the pane's name; else the tab's name when someone named the tab and it holds only this agent; else the agent's live title without the glyph it puts first (`✳ Fix login` reads `Fix login`), unless it only names the program, the address, a path or `user@host`; else the program's name, the tab's name or the address.
- **The time** is stamped when an agent's state changes, done and idle counting as one, kept in the mod's `localStorage` (`changed`) and forgotten once the agent is gone and its last change is more than 30 days old; the card redraws every 30 seconds. Right after the first install every agent reads `now`.
- **Clicks:** a row runs `pane.focus` on the agent's pane; a sub-agent's row focuses its pane when it has one and runs `terminal.peek` otherwise. Hovering a row swaps its time for an 18px pin button (`pin` or `pin-off`, tooltip `Pin to the top` or `Unpin`) that runs `terminal.pin`; it and the chevron never focus the agent. The sort button opens the popup at the pointer, and a choice is saved in shared `agents.sort`, the key Herdr's own list uses.

## Built from

- `recipes/cards.ts` (`nuoh-cards`) makes the `agents` block of `sidebar-lists` a card and points it at `agent-list`, installed as `nuoh-agent-list`.
- `mods/agent-list/logic.js` holds the ages, the sub-agent trees and urgency, the order, the needs-you count and the machine of an address; `lib/agent-since.js` stamps when each state began, shared with the rail; `main.js` draws with the kit and takes the space's color from `lib/space-colors.js` and the folded check from `lib/layout-tree.js`. The sort popup is the same mod opened with `openOverlay({ kind: "popup", props: { sortMenu: true } })`. It reads `agents()`, `terminals()`, `spaces()`, `layout()` and `shared("space.colors")`, and runs no programs and reads no files.

## Watch out

- The rows stay inset because a card doesn't clip its mod ([`mods/pane-header/RECIPE.md`](../pane-header/RECIPE.md)).
- `agents()` has no time, only `seq`: the mod stamps the times itself, apart from Herdr's list. Pins are the terminals' `herdr.pinned` label, read as `pinned`.
- A sub-agent kept as a pane is in `agents()` too: it shows under its parent, with a row of its own only when pinned, or when the sidebar is folded and the trees are gone.
- A copy of Herdr's `agents` can't import the kit, which the generator installs while reading a mod, before the recipes run; that is why this list is a mod of this repo and not a patched copy.

## Done when

- `bun run apply-layout` installs `nuoh-agent-list`, the `agents` block of `nuoh` shows it, and `herdr-app status` shows no errors.
- The card shows the header with the count and, with an agent blocked, the `N needs you` chip; each row shows its avatar, badge, name, chip, time and title; the focused agent's row is selected.
- Clicking a row focuses its pane; pinning from the hover button brings the agent to the top, unpinning sends it back.
- The sort button switches between Priority and Grouped by space, and Herdr's own Agents list in `main` follows; `agent.next` goes through the agents in the card's order.
- Folding the sidebar from the top bar leaves only the avatars with their dots, and opening it brings the rows back.
