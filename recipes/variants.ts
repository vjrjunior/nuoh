import { comeback } from "./comeback";
import { files } from "./files";
import { gitGraphPanel } from "./git-graph-panel";
import { kit } from "./kit";
import { listVjrTheme } from "./list-vjr-theme";
import { look } from "./look";
import { markdown } from "./markdown";
import { moveTab } from "./move-tab";
import { rail, railKeys } from "./rail";
import type { Recipe, Variant } from "./recipe";
import { spacesTree } from "./spaces-tree";
import { squareFor } from "./square";

const OWN: Recipe[] = [listVjrTheme, look, kit, gitGraphPanel, spacesTree, comeback, markdown, moveTab, files];

function refuseTaken(extras: Recipe[]): void {
  const taken = [...OWN, rail, railKeys].map((recipe) => recipe.name);
  for (const recipe of extras) {
    if (taken.includes(recipe.name) || recipe.name === "square") throw new Error(`an extra recipe is named ${recipe.name}, which is taken`);
    taken.push(recipe.name);
  }
}

export function variantWith(extras: Recipe[], square: boolean): Variant {
  refuseTaken(extras);
  const recipes = [...OWN, ...extras];
  return { layout: "vjr-desk", prefix: "vjr-", preview: "layouts/vjr-desk.svg", square, recipes: square ? [...recipes, squareFor(recipes)] : recipes };
}

export function nuohVariant(extras: Recipe[]): Variant {
  refuseTaken(extras);
  return { layout: "nuoh", prefix: "nuoh-", preview: "layouts/nuoh.svg", square: false, oneLook: true, recipes: [...OWN, rail, ...extras, railKeys] };
}

export function variantsWith(extras: Recipe[], square: boolean): Variant[] {
  return [variantWith(extras, square), nuohVariant(extras)];
}

export const LEFT_ROUNDED = ["prompt", "confirm", "toast", "peek", "win98", "terminals-bar", "terminals-pane"];

export const REPLACED = ["spaces", "files"];
