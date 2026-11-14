import { type Copy, exact, type Recipe } from "./recipe";

export const DEFAULT_EDITOR = 'const EDITOR = { name: "Open", argv: ["open"] };';

export const markdown: Recipe = {
  name: "markdown",
  mods: [{ name: "markdown", from: "repo" }],
  apply({ copies, editor }) {
    if (editor) exact(copies.markdown as Copy, DEFAULT_EDITOR, `const EDITOR = ${JSON.stringify({ name: editor.name, argv: editor.argv })};`);
  },
};
