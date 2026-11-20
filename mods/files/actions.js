import { exec, run } from "herdr";

const EDITOR = null;

export const editorName = () => EDITOR?.name ?? null;

export function openInEditor(path) {
  const [command, ...rest] = EDITOR?.argv ?? ["open"];
  exec(command, [...rest, path]).catch(() => {});
}

export function openWithApp(path) {
  exec("open", [path]).catch(() => {});
}

export function reveal(path) {
  exec("open", ["-R", path]).catch(() => {});
}

export function newTerminal(folder) {
  run("terminal.open", { folder, place: "tab" });
}
