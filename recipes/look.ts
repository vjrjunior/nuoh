import { type Copy, exact, type Recipe } from "./recipe";

export const SQUARE_KEY = "vjr.square";

const PICKER = ".child(this.layoutPicker(t, cx))";

export const look: Recipe = {
  name: "look",
  mods: [
    { name: "settings", from: "frame" },
    { name: "workspace-chrome", from: "mods" },
  ],
  apply({ copies, replacements, variant }) {
    const settings = copies.settings as Copy;
    const square = `shared("${SQUARE_KEY}") === true`;
    const toggle = `this.toggle(t, "st-square", ${square}, () => setShared("${SQUARE_KEY}", !(${square})))`;
    const line = `this.row(t, "Square corners", "Straight corners on everything this layout draws. The layout rebuilds in a few seconds.", ${toggle})`;
    exact(settings, " shared, appHome,", " shared, setShared, appHome,");
    exact(settings, PICKER, `${PICKER}\n      .when(shared("layout") === "${variant.layout}", (el) => el.child(${line}))`);
    settings.meta.overlay = { kind: "dialog", width: 880, height: 620 };

    exact(copies["workspace-chrome"] as Copy, 'run("app.settings")', 'run("mod.open", { name: "settings" })');
    exact(copies.palette as Copy, '["app.settings", {}, "App", "Settings"', '["mod.open", { name: "settings" }, "App", "Settings"');
    replacements["app.settings"] = "settings";
  },
};
