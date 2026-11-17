import { comeback } from "./comeback";
import { gitGraphPanel } from "./git-graph-panel";
import { kit } from "./kit";
import { listVjrTheme } from "./list-vjr-theme";
import { look } from "./look";
import { markdown } from "./markdown";
import { moveTab } from "./move-tab";
import type { Recipe, Variant } from "./recipe";
import { spacesTree } from "./spaces-tree";
import { squareFor } from "./square";

const OWN: Recipe[] = [listVjrTheme, look, kit, gitGraphPanel, spacesTree, comeback, markdown, moveTab];

export function variantWith(extras: Recipe[], square: boolean): Variant {
  const taken = OWN.map((recipe) => recipe.name);
  for (const recipe of extras) {
    if (taken.includes(recipe.name) || recipe.name === "square") throw new Error(`an extra recipe is named ${recipe.name}, which is taken`);
    taken.push(recipe.name);
  }
  const recipes = [...OWN, ...extras];
  return { layout: "vjr-desk", prefix: "vjr-", preview: "layouts/vjr-desk.svg", square, recipes: square ? [...recipes, squareFor(recipes)] : recipes };
}

export function variantsWith(extras: Recipe[] = []): Variant[] {
  return [variantWith(extras, false), variantWith(extras, true)];
}

export const LEFT_ROUNDED = ["prompt", "confirm", "toast", "peek", "win98", "terminals-bar", "terminals-pane"];

export const REPLACED = ["spaces"];
