import { type Copy, exact, findNode, type LayoutNode, type Recipe } from "./recipe";

const SPACE_CLOSE = '        ["Close", "space.close", { id: tg.id }],';
const MENU_IMPORT = 'import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";';
const CHOSEN = "    closeOverlay(props()?.overlay);\n";
const ICON_NAME = '  const name = command.endsWith(".close")';
const MOVE_POPUP_WIDTH = 240;

export const spacesTree: Recipe = {
  name: "spaces-tree",
  square: { popupRoots: { "spaces-tree": 3 } },
  mods: [
    { name: "spaces-tree", from: "repo" },
    { name: "menu", from: "mods" },
  ],
  apply({ copies, layout }) {
    (findNode(layout, "spaces").content as LayoutNode).mod = "spaces-tree";
    const menu = copies.menu as Copy;
    exact(menu, MENU_IMPORT, MENU_IMPORT.replace("exec }", "exec, setShared }"));
    exact(
      menu,
      SPACE_CLOSE,
      `        ...(p.folder ? [p.folder.pinned ? ["Unpin", "spaces-unpin", p.folder] : ["Pin to top", "spaces-pin", p.folder], ["Move to folder…", "spaces-folder", p.folder]] : []),\n${SPACE_CLOSE}`,
    );
    exact(
      menu,
      CHOSEN,
      `${CHOSEN}    if (it[1] === "spaces-pin" || it[1] === "spaces-unpin") return setShared("spaces.pinned", it[2].pins);\n    if (it[1] === "spaces-folder") return openOverlay({ mod: "spaces-tree", kind: "popup", width: ${MOVE_POPUP_WIDTH}, height: it[2].height, props: { ...it[2], role: "folders" } });\n`,
    );
    exact(
      menu,
      ICON_NAME,
      `  if (command === "spaces-pin") return "mods/workspace-chrome/pin.svg";\n  if (command === "spaces-unpin") return "mods/workspace-chrome/pin-off.svg";\n  if (command === "spaces-folder") return "mods/workspace-chrome/folder.svg";\n${ICON_NAME}`,
    );
  },
};
