import { nuohCards } from "./cards";
import { comeback } from "./comeback";
import { files } from "./files";
import { nuohFrame } from "./frame";
import { gitGraphPanel } from "./git-graph-panel";
import { kit } from "./kit";
import { markdown } from "./markdown";
import { moveTab } from "./move-tab";
import { palette } from "./palette";
import { rail, railKeys } from "./rail";
import type { Recipe } from "./recipe";
import { spacesTree } from "./spaces-tree";
import { workflowsView } from "./workflows";

const OWN: Recipe[] = [palette, kit, gitGraphPanel, spacesTree, comeback, markdown, moveTab, files];
const VIEWS: Recipe[] = [workflowsView];

export function recipesWith(extras: Recipe[]): Recipe[] {
  const taken = [...OWN, rail, ...VIEWS, railKeys, nuohFrame, nuohCards].map((recipe) => recipe.name);
  for (const recipe of extras) {
    if (taken.includes(recipe.name)) throw new Error(`an extra recipe is named ${recipe.name}, which is taken`);
    taken.push(recipe.name);
  }
  return [...OWN, rail, ...VIEWS, ...extras, railKeys, nuohFrame, nuohCards];
}
