const CODEX_MARK = /^\[ [!.] \] /;
const WAIT_MARK = /^[✋⏳]️?\s/u;
const LEAD = /^[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}~/#]+/u;

export function cleanTitle(text) {
  let rest = text ?? "";
  for (;;) {
    const next = rest.trimStart().replace(CODEX_MARK, "").replace(WAIT_MARK, "").replace(LEAD, "");
    if (next === rest) return rest.trim();
    rest = next;
  }
}
