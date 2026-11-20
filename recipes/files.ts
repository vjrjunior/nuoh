import { type Copy, exact, findNode, type LayoutNode, type Recipe } from "./recipe";

const DEFAULT_EDITOR = "const EDITOR = null;";

export const files: Recipe = {
  name: "files",
  square: { popupRoots: { files: 1 }, frameless: ["files"] },
  mods: [{ name: "files", from: "repo" }],
  apply({ copies, layout, editor }) {
    (findNode(layout, "files").content as LayoutNode).mod = "files";
    if (editor) exact(copies.files as Copy, DEFAULT_EDITOR, `const EDITOR = ${JSON.stringify({ name: editor.name, argv: editor.argv })};`);
  },
};
