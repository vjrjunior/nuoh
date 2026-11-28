import { openMarkdown } from "../../lib/open-markdown.js";

export function handleLink({ link, source }) {
  if (link.kind !== "file" || !link.path) return "pass";
  openMarkdown(link.path, { pane: source.pane });
  return "handled";
}
