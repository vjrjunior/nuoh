import { type Copy, exact, type Recipe } from "./recipe";

const DEFAULT_EDITOR = 'const EDITOR = { name: "Open", argv: ["open"] };';
const CLOSE_PANE = '        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),';
const CHOOSE = 'if (it[1] === "worktree")';
const MENU_ICON = "function menuIcon(command, args) {";
const SHORTCUT = "function shortcut(name, args) {";
const PICKER = { width: 560, height: 420 };

export const markdown: Recipe = {
  name: "markdown",
  square: { popupRoots: { markdown: 1 }, frameless: ["markdown"] },
  mods: [
    { name: "markdown", from: "repo" },
    { name: "menu", from: "mods" },
  ],
  apply({ copies, editor, layout, keys }) {
    const viewer = copies.markdown as Copy;
    const menu = copies.menu as Copy;
    if (editor) exact(viewer, DEFAULT_EDITOR, `const EDITOR = ${JSON.stringify({ name: editor.name, argv: editor.argv })};`);
    exact(menu, CLOSE_PANE, `        ...(term ? [["Open Markdown…", "markdown-picker", { terminal: term.address, pane: tg.pane }]] : []),\n${CLOSE_PANE}`);
    exact(
      menu,
      CHOOSE,
      `if (it[1] === "markdown-picker") openOverlay({ mod: "markdown", kind: "popup", width: ${PICKER.width}, height: ${PICKER.height}, props: it[2] });\n    else ${CHOOSE}`,
    );
    exact(menu, MENU_ICON, `const MARKDOWN_PICKER = { name: "markdown" };\n\n${MENU_ICON}\n  if (command === "markdown-picker") return "mods/workspace-chrome/file-text.svg";`);
    exact(menu, SHORTCUT, `${SHORTCUT}\n  if (name === "markdown-picker") return keys().find((b) => b.action === \`mod.open:\${MARKDOWN_PICKER.name}\`)?.keys ?? "";`);
    layout.terminal_menu = "menu";
    keys["cmd-shift-o"] = "markdown";
  },
};
