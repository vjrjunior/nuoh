import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXISTING,
  folderOf,
  LOOKUP,
  linkTarget,
  mentions,
  missingNames,
  nameOf,
  onScreen,
  parseExisting,
  parseLookup,
  parseRepoMarkdown,
  pickerRows,
  REPO_MARKDOWN,
  shortFolder,
  stripFrontMatter,
  where,
} from "../mods/markdown/logic.js";
import { removeTempDirs, tempDir } from "./helpers";

const FILE = "/w/app/abc-1234/NOTES.md";

describe("front matter", () => {
  test("a YAML block at the top is hidden", () => {
    expect(stripFrontMatter("---\ntitle: Plan\ntags: [a]\n---\n# Plan\n\nBody\n")).toBe("# Plan\n\nBody\n");
  });

  test("a block closed with three dots is hidden too", () => {
    expect(stripFrontMatter("---\ntitle: Plan\n...\nBody")).toBe("Body");
  });

  test("a rule further down stays", () => {
    const text = "# Plan\n\n---\n\nMore";
    expect(stripFrontMatter(text)).toBe(text);
  });

  test("an unclosed block stays as it is", () => {
    const text = "---\ntitle: Plan\nBody";
    expect(stripFrontMatter(text)).toBe(text);
  });

  test("Windows line endings work", () => {
    expect(stripFrontMatter("---\r\ntitle: Plan\r\n---\r\nBody")).toBe("Body");
  });
});

describe("links", () => {
  test("web addresses open in the browser", () => {
    expect(linkTarget(FILE, "https://example.com/t/86")).toEqual({ kind: "web", url: "https://example.com/t/86" });
    expect(linkTarget(FILE, "mailto:a@b.co")).toEqual({ kind: "web", url: "mailto:a@b.co" });
  });

  test("a relative markdown file opens next to the current one", () => {
    expect(linkTarget(FILE, "docs/plan.md")).toEqual({ kind: "markdown", path: "/w/app/abc-1234/docs/plan.md" });
    expect(linkTarget(FILE, "../README.MD")).toEqual({ kind: "markdown", path: "/w/app/README.MD" });
    expect(linkTarget(FILE, "./notes/../plan.markdown#steps")).toEqual({ kind: "markdown", path: "/w/app/abc-1234/plan.markdown" });
  });

  test("absolute paths and file URLs are read as paths", () => {
    expect(linkTarget(FILE, "/tmp/other.md")).toEqual({ kind: "markdown", path: "/tmp/other.md" });
    expect(linkTarget(FILE, "file:///tmp/My%20Notes.md")).toEqual({ kind: "markdown", path: "/tmp/My Notes.md" });
  });

  test("other files open in their own app", () => {
    expect(linkTarget(FILE, "shots/01-home.png")).toEqual({ kind: "file", path: "/w/app/abc-1234/shots/01-home.png" });
  });

  test("an anchor on the same page does nothing", () => {
    expect(linkTarget(FILE, "#plan")).toEqual({ kind: "none" });
    expect(linkTarget(FILE, "")).toEqual({ kind: "none" });
  });

  test("a path cannot climb above the root", () => {
    expect(linkTarget("/a.md", "../../b.md")).toEqual({ kind: "markdown", path: "/b.md" });
  });
});

describe("names", () => {
  test("the header shows the file name and its folder from home", () => {
    expect(nameOf(FILE)).toBe("NOTES.md");
    expect(folderOf(FILE)).toBe("/w/app/abc-1234");
    expect(shortFolder("/Users/me/work/app", "/Users/me")).toBe("~/work/app");
    expect(shortFolder("/Users/me", "/Users/me")).toBe("~");
    expect(shortFolder("/Users/meg/app", "/Users/me")).toBe("/Users/meg/app");
  });
});

afterEach(removeTempDirs);

describe("mentions", () => {
  test("paths come from the bottom of the screen up, each once", () => {
    const text = ["● Wrote docs/plans/old.md", "  Then README.md and docs/plans/new.md", "  README.md again"].join("\n");
    expect(mentions(text)).toEqual(["README.md", "docs/plans/new.md", "docs/plans/old.md"]);
  });

  test("absolute, home and relative paths keep their form", () => {
    expect(mentions("/Users/me/w/PLAN.md ~/notes/today.md ./a/b.markdown ../c.mdx")).toEqual(["../c.mdx", "./a/b.markdown", "~/notes/today.md", "/Users/me/w/PLAN.md"]);
  });

  test("the marks agents put around a path are not part of it", () => {
    expect(mentions("⎿ Read(docs/x.md) `y.md` 'z.md' \"w.md\" [v.md] @u.md **t.md**")).toEqual(["t.md", "u.md", "v.md", "w.md", "z.md", "y.md", "docs/x.md"]);
  });

  test("a line, a column or an anchor after the path is dropped", () => {
    expect(mentions("docs/a.md:12 docs/b.md:12:3 docs/c.md#L4 docs/d.md#setup")).toEqual(["docs/d.md", "docs/c.md", "docs/b.md", "docs/a.md"]);
  });

  test("a path cut across two lines is tried whole", () => {
    expect(mentions("  ⎿ Updated docs/plans/2026-11-19-fil\n    es-and-markdown.md with 3 lines")).toContain("docs/plans/2026-11-19-files-and-markdown.md");
  });

  test("web links are skipped and file URLs read as paths", () => {
    expect(mentions("https://example.com/README.md file:///tmp/My%20Notes.md")).toEqual(["/tmp/My Notes.md"]);
  });

  test("a word glued to the path by a colon is dropped", () => {
    expect(mentions("plan:docs/z.markdown.")).toEqual(["docs/z.markdown"]);
  });

  test("other files and bare extensions are not mentions", () => {
    expect(mentions("src/main.ts notes.mdown .md package.md-lock")).toEqual([]);
  });
});

describe("which mentions exist", () => {
  function repo() {
    const top = tempDir();
    execFileSync("git", ["init", "-q", top]);
    mkdirSync(join(top, "docs/plans"), { recursive: true });
    for (const file of ["README.md", "docs/plans/a.md", "docs/RECIPE.md", "src.ts"]) writeFileSync(join(top, file), "x");
    mkdirSync(join(top, "docs/sub"), { recursive: true });
    writeFileSync(join(top, "docs/sub/RECIPE.md"), "x");
    writeFileSync(join(top, "docs/sub/more.md"), "x");
    return top;
  }

  test("relative paths are read from the terminal's folder, and only files that exist come back", () => {
    const top = repo();
    const stdout = execFileSync("sh", ["-c", EXISTING, "sh", join(top, "docs"), "plans/a.md", "../README.md", "nope.md", "plans"]).toString();
    const found = parseExisting(stdout);
    expect([...found.entries()]).toEqual([
      ["plans/a.md", `${top}/docs/plans/a.md`],
      ["../README.md", `${top}/README.md`],
    ]);
  });

  test("a bare name that isn't in the folder is looked up in the repository, two at most", () => {
    const top = repo();
    const found = new Map();
    expect(missingNames(["RECIPE.md", "docs/gone.md", "more.md", "RECIPE.md"], found)).toEqual(["RECIPE.md", "more.md"]);
    const byName = parseLookup(execFileSync("sh", ["-c", LOOKUP, "sh", "RECIPE.md", "more.md"], { cwd: join(top, "docs/plans") }).toString());
    expect(byName.get("RECIPE.md")).toHaveLength(2);
    expect(byName.get("more.md")).toEqual([`${top}/docs/sub/more.md`]);
  });

  test("outside a repository the lookup finds nothing", () => {
    const folder = tempDir();
    expect(parseLookup(execFileSync("sh", ["-c", LOOKUP, "sh", "x.md"], { cwd: folder }).toString()).size).toBe(0);
  });

  test("the screen's order holds after the lookup, without repeats", () => {
    const found = new Map([["a.md", "/r/a.md"], ["../r/a.md", "/r/a.md"]]);
    const byName = new Map([["RECIPE.md", ["/r/x/RECIPE.md", "/r/y/RECIPE.md"]]]);
    expect(onScreen(["RECIPE.md", "a.md", "../r/a.md", "gone.md"], found, byName)).toEqual(["/r/x/RECIPE.md", "/r/y/RECIPE.md", "/r/a.md"]);
  });

  test("the repository's Markdown files come newest first, only Markdown", () => {
    const top = repo();
    execFileSync("touch", ["-t", "202001010000", join(top, "README.md")]);
    const listed = parseRepoMarkdown(execFileSync("sh", ["-c", REPO_MARKDOWN], { cwd: join(top, "docs") }).toString());
    expect(listed.top).toBe(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: top }).toString().trim());
    expect(listed.files.at(-1)).toBe(`${listed.top}/README.md`);
    expect(listed.files).toHaveLength(5);
    expect(parseRepoMarkdown("/r\nsrc/x.ts\nb.md\n").files).toEqual(["/r/b.md"]);
    expect(parseRepoMarkdown("")).toEqual({ top: null, files: [] });
  });
});

describe("picker rows", () => {
  const home = "/Users/me";
  const top = "/Users/me/w/app";

  test("each row has the file's name and its folder in the repository", () => {
    expect(where(`${top}/docs/plans/a.md`, top, home)).toBe("docs/plans");
    expect(where(`${top}/README.md`, top, home)).toBe("app");
    expect(where("/Users/me/notes/a.md", top, home)).toBe("~/notes");
    expect(where(`${top}/one/two/three/four/five/six/seven/eight/a.md`, top, home)).toBe("…/three/four/five/six/seven/eight");
    expect(where(`${top}/a-rather-long-folder-name/and-another-long-one/plans/a.md`, top, home)).toBe("…/and-another-long-one/plans");
  });

  test("the screen's files come first and the repository's skip them", () => {
    const rows = pickerRows([`${top}/b.md`], [`${top}/a.md`, `${top}/b.md`], "", { top, home });
    expect(rows.screen.map((row) => row.name)).toEqual(["b.md"]);
    expect(rows.repo.map((row) => row.name)).toEqual(["a.md"]);
  });

  test("the filter matches the path in the repository, names before folders", () => {
    const repo = [`${top}/plans/x.md`, `${top}/docs/plans.md`, `${top}/other.md`];
    expect(pickerRows([], repo, "PLANS", { top, home }).repo.map((row) => row.path)).toEqual([`${top}/docs/plans.md`, `${top}/plans/x.md`]);
  });

  test("the repository's list stops at the limit", () => {
    const repo = Array.from({ length: 5 }, (_, index) => `${top}/${index}.md`);
    expect(pickerRows([], repo, "", { top, home, limit: 3 }).repo).toHaveLength(3);
  });
});
