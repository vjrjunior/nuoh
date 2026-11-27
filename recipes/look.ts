import { type Copy, exact, type Recipe } from "./recipe";

export const look: Recipe = {
  name: "look",
  mods: [{ name: "settings", from: "frame" }],
  apply({ copies, replacements }) {
    (copies.settings as Copy).meta.overlay = { kind: "dialog", width: 880, height: 620 };
    exact(copies.palette as Copy, '["app.settings", {}, "App", "Settings"', '["mod.open", { name: "settings" }, "App", "Settings"');
    replacements["app.settings"] = "settings";
  },
};
