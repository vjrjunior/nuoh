import { type Copy, exact, type Recipe } from "./recipe";

export const listVjrTheme: Recipe = {
  name: "list-vjr-theme",
  mods: [
    { name: "palette", from: "frame" },
    { name: "workspace-status", from: "mods" },
  ],
  apply({ copies, replacements, variant }) {
    const palette = copies.palette as Copy;
    exact(palette, 'if (section !== "global") continue;', `if (section !== "global" && section !== "layout:${variant.layout}") continue;`);
    exact(copies["workspace-status"] as Copy, 'run("app.palette")', 'run("mod.open", { name: "palette" })');
    palette.meta.overlay = { kind: "popup", at: "top", offset: 60, width: 620, height: 410 };
    replacements["app.palette"] = "palette";
  },
};
