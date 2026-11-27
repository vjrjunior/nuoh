const CODEX_MARK = /^\[ [!.] \] /;
const WAIT_MARK = /^[✋⏳]️?\s/u;
const LEAD = /^[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}~/#]+/u;
const PATH = /^[~/]|^[A-Za-z]:\\/;

export function cleanTitle(text) {
  let rest = text ?? "";
  for (;;) {
    const next = rest.trimStart().replace(CODEX_MARK, "").replace(WAIT_MARK, "").replace(LEAD, "");
    if (next === rest) return rest.trim();
    rest = next;
  }
}

export function tellingTitle(text) {
  return Boolean(text) && !PATH.test(text) && !text.includes("@");
}

const same = (a, b) => Boolean(a) && Boolean(b) && a.toLowerCase() === String(b).toLowerCase();

function telling(text, agent) {
  return tellingTitle(text) && !same(text, agent.address) && !same(text, agent.program?.name) && !same(text, agent.program?.key);
}

export function agentTitle(agent, tab = null, crowded = false) {
  if (agent.pane_name) return agent.pane_name;
  if (!crowded && tab?.named && tab.name) return tab.name;
  const live = cleanTitle(agent.title);
  if (telling(live, agent)) return live;
  return agent.program?.name || tab?.name || agent.tab_name || agent.address;
}
