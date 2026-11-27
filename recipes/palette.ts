import { type Copy, exact, LAYOUT, type Recipe } from "./recipe";

export const palette: Recipe = {
  name: "palette",
  mods: [{ name: "palette", from: "frame" }],
  apply({ copies, replacements }) {
    const palette = copies.palette as Copy;
    exact(palette, 'if (section !== "global") continue;', `if (section !== "global" && section !== "layout:${LAYOUT}") continue;`);
    palette.meta.overlay = { kind: "popup", at: "top", offset: 60, width: 620, height: 410 };
    replacements["app.palette"] = "palette";
  },
};
