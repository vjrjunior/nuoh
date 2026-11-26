export const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
export const FALLBACK_COLOR = "ansi6";
export const LETTER = "#ffffff";
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

export function paint(color, t) {
  if (typeof color === "string" && color.startsWith("#")) return color;
  return MARK[color] ?? t[color] ?? t.dim;
}

export function spaceColor(space, colors, t) {
  if (!space) return t.dim;
  return paint((colors ?? {})[space.id] ?? FALLBACK_COLOR, t);
}

export function avatarLook(space, colors, t) {
  return { fill: spaceColor(space, colors, t), letter: LETTER };
}
