import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_FILES,
  changedRows,
  clampEntries,
  fileIcon,
  folderOf,
  GIT_STATE,
  isIgnored,
  kindOfFile,
  LIST,
  languageOf,
  letterOf,
  matches,
  menuItems,
  parseAllFiles,
  parseEntries,
  parseGitState,
  PER_FOLDER,
  previewText,
  rollUp,
  statusOf,
  TOTAL,
  treeRows,
} from "../mods/files/logic.js";
import { removeTempDirs, tempDir } from "./helpers";

afterEach(removeTempDirs);

const sh = (script: string, args: string[] = [], cwd?: string) => execFileSync("sh", ["-c", script, "sh", ...args], { cwd }).toString();
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd }).toString();

function repo() {
  const top = tempDir();
  git(top, "init", "-q");
  mkdirSync(join(top, "src/deep"), { recursive: true });
  mkdirSync(join(top, "node_modules/pkg"), { recursive: true });
  writeFileSync(join(top, ".gitignore"), "node_modules/\n*.log\n");
  writeFileSync(join(top, "README.md"), "# App\n");
  writeFileSync(join(top, "src/a.ts"), "a\n");
  writeFileSync(join(top, "src/deep/b.ts"), "b\n");
  writeFileSync(join(top, "gone.txt"), "x\n");
  writeFileSync(join(top, "node_modules/pkg/index.js"), "x\n");
  git(top, "add", "-A");
  git(top, "commit", "-qm", "init");
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: top }).toString().trim();
}

describe("listing a folder", () => {
  test("folders come first, then files, by name, with dot files and without .git", () => {
    const top = repo();
    writeFileSync(join(top, "file10.txt"), "");
    writeFileSync(join(top, "file9.txt"), "");
    const names = parseEntries(sh(LIST, [top])).map((entry) => `${entry.dir ? "d" : "f"} ${entry.name}`);
    expect(names).toEqual(["d node_modules", "d src", "f .gitignore", "f file9.txt", "f file10.txt", "f gone.txt", "f README.md"]);
  });

  test("a link to a folder is a folder, a broken link a file", () => {
    const top = repo();
    symlinkSync(join(top, "src"), join(top, "linked"));
    symlinkSync(join(top, "missing"), join(top, "broken"));
    const entries = parseEntries(sh(LIST, [top]));
    expect(entries.find((entry) => entry.name === "linked")?.dir).toBe(true);
    expect(entries.find((entry) => entry.name === "broken")?.dir).toBe(false);
  });

  test("a folder that is gone fails", () => {
    expect(() => sh(LIST, ["/no/such/folder"])).toThrow();
  });

  test("a folder keeps at most 500 entries and the tree 5,000", () => {
    const many = Array.from({ length: PER_FOLDER + 2 }, (_, index) => ({ name: `f${index}`, dir: false }));
    expect(clampEntries(many, 0)).toMatchObject({ limited: true });
    expect(clampEntries(many, 0).kept).toHaveLength(PER_FOLDER);
    expect(clampEntries(many.slice(0, 10), TOTAL - 4).kept).toHaveLength(4);
    expect(clampEntries(many.slice(0, 3), 0)).toEqual({ kept: many.slice(0, 3), limited: false });
  });
});

describe("git state", () => {
  test("changes, untracked files, deletions and ignored folders are read from the repository's top", () => {
    const top = repo();
    writeFileSync(join(top, "src/a.ts"), "changed\n");
    writeFileSync(join(top, "src/deep/new.ts"), "new\n");
    writeFileSync(join(top, "debug.log"), "x\n");
    execFileSync("rm", [join(top, "gone.txt")]);
    const state = parseGitState(sh(GIT_STATE, [], join(top, "src")));
    expect(state.top).toBe(top);
    expect([...state.marks.entries()].sort()).toEqual([
      ["gone.txt", "deleted"],
      ["src/a.ts", "modified"],
      ["src/deep/new.ts", "added"],
    ]);
    expect([...state.ignored].sort()).toEqual(["debug.log", "node_modules"]);
  });

  test("outside a repository there is no state", () => {
    expect(parseGitState(sh(GIT_STATE, [], tempDir()))).toMatchObject({ top: null });
  });

  test("conflicts, staged additions and deletions get their kind", () => {
    const state = parseGitState(["/r", "UU both.ts", "A  staged.ts", " D removed.ts", "AA added-twice.ts", "MM twice.ts", ""].join("\0"));
    expect(Object.fromEntries(state.marks)).toEqual({ "both.ts": "conflict", "staged.ts": "added", "removed.ts": "deleted", "added-twice.ts": "conflict", "twice.ts": "modified" });
  });

  test("a folder takes the worst change below it", () => {
    const folders = rollUp(
      new Map([
        ["a/b/new.ts", "added"],
        ["a/b/c/old.ts", "deleted"],
        ["a/x.ts", "modified"],
        ["z/fight.ts", "conflict"],
      ]),
    );
    expect(Object.fromEntries(folders)).toEqual({ "a/b/c": "deleted", "a/b": "deleted", a: "modified", z: "conflict" });
  });

  test("files show their own change and a letter, folders the rolled-up one", () => {
    const state = parseGitState(["/r", " M src/a.ts", ""].join("\0"));
    expect(statusOf("src/a.ts", false, state)).toBe("modified");
    expect(statusOf("src", true, state)).toBe("modified");
    expect(statusOf("src", false, state)).toBeNull();
    expect(statusOf("x", false, null)).toBeNull();
    expect(["added", "modified", "deleted", "conflict", null].map(letterOf)).toEqual(["A", "M", "D", "C", ""]);
  });

  test("anything under an ignored folder is ignored", () => {
    const state = parseGitState(["/r", ":ignored:", "node_modules/", "debug.log", ""].join("\0"));
    expect(isIgnored("node_modules/pkg/index.js", state)).toBe(true);
    expect(isIgnored("debug.log", state)).toBe(true);
    expect(isIgnored("src/a.ts", state)).toBe(false);
    expect(isIgnored("src/a.ts", null)).toBe(false);
  });
});

describe("the tree", () => {
  const entries = new Map([
    ["", [{ name: "src", dir: true }, { name: "README.md", dir: false }]],
    ["src", [{ name: "deep", dir: true }, { name: "a.ts", dir: false }]],
    ["src/deep", [{ name: "b.ts", dir: false }]],
  ]);

  test("open folders show what they hold, one level deeper", () => {
    const { rows } = treeRows(entries, new Set(["src"]));
    expect(rows.map((row) => `${row.depth} ${row.path}${row.open ? " open" : ""}`)).toEqual(["0 src open", "1 src/deep", "1 src/a.ts", "0 README.md"]);
  });

  test("a folder open under a closed one stays hidden", () => {
    expect(treeRows(entries, new Set(["src/deep"])).rows.map((row) => row.path)).toEqual(["src", "README.md"]);
  });

  test("changed only lists the changed files under their folders, all open", () => {
    const state = parseGitState(["/r", " M src/deep/b.ts", "?? notes.md", " D src/old.ts", ""].join("\0"));
    expect(changedRows(state).map((row) => `${row.depth} ${row.path}${row.open ? " open" : ""}`)).toEqual([
      "0 src open",
      "1 src/deep open",
      "2 src/deep/b.ts",
      "1 src/old.ts",
      "0 notes.md",
    ]);
    expect(changedRows(null)).toEqual([]);
  });
});

describe("filtering by name", () => {
  const files = ["docs/plans/files.md", "mods/files/main.js", "mods/files/logic.js", "tests/files.test.ts", "README.md", "src/profile.ts"];

  test("names that start with the text come first, then names that hold it, then folders", () => {
    expect(matches(files, "files")).toEqual(["docs/plans/files.md", "tests/files.test.ts", "mods/files/main.js", "mods/files/logic.js"]);
  });

  test("every word must be in the path, in any case", () => {
    expect(matches(files, "MODS logic")).toEqual(["mods/files/logic.js"]);
  });

  test("an empty filter matches nothing, and the list stops at the limit", () => {
    expect(matches(files, "  ")).toEqual([]);
    expect(matches(files, "s", 2)).toHaveLength(2);
  });

  test("every file of the repository is listed from its top, untracked ones too, ignored ones not", () => {
    const top = repo();
    writeFileSync(join(top, "src/untracked.ts"), "");
    const listed = parseAllFiles(sh(ALL_FILES, [], join(top, "src")));
    expect(listed.root).toBe(top);
    expect(listed.files.sort()).toEqual([".gitignore", "README.md", "gone.txt", "src/a.ts", "src/deep/b.ts", "src/untracked.ts"]);
  });

  test("outside a repository the folder is searched, without node_modules", () => {
    const folder = tempDir();
    mkdirSync(join(folder, "a/node_modules"), { recursive: true });
    writeFileSync(join(folder, "a/x.md"), "");
    writeFileSync(join(folder, "a/node_modules/y.js"), "");
    const listed = parseAllFiles(sh(ALL_FILES, [], folder));
    expect(listed.files).toEqual(["a/x.md"]);
  });
});

describe("what a file is", () => {
  test("Markdown opens in the viewer, pictures and documents in their app, the rest as text", () => {
    expect(["PLAN.md", "a.markdown", "b.mdx", "shot.PNG", "logo.svg", "spec.pdf", "a.zip", "main.ts", "Makefile"].map(kindOfFile)).toEqual([
      "markdown",
      "markdown",
      "markdown",
      "image",
      "image",
      "document",
      "document",
      "text",
      "text",
    ]);
  });

  test("each file and folder gets its type's icon from Files' own icons", () => {
    expect(fileIcon("src/a.ts")).toBe("mods/files/icons/typescript.svg");
    expect(fileIcon("README.md")).toBe("mods/files/icons/readme.svg");
    expect(fileIcon("notes.unknownext")).toBe("mods/files/icons/file.svg");
    expect(fileIcon("src", { dir: true })).toBe("mods/files/icons/folder-src.svg");
    expect(fileIcon("src", { dir: true, open: true })).toBe("mods/files/icons/folder-src-open.svg");
    expect(fileIcon("Cargo.toml", { light: true })).toBe("mods/files/icons/toml_light.svg");
  });

  test("the code view gets a language it knows", () => {
    expect(["a.ts", "b.tsx", "c.json", "d.toml", "e.rs", "Makefile", ".env"].map(languageOf)).toEqual(["js", "js", "json", "yaml", "rs", "text", "text"]);
  });

  test("binary text has no preview and long text is cut", () => {
    expect(previewText("a\0b")).toBeNull();
    expect(previewText("short")).toBe("short");
    expect(previewText("x".repeat(400001))).toEndWith("\n… (file truncated)");
  });

  test("a relative path's folder is what comes before its name", () => {
    expect(folderOf("a/b.ts")).toBe("a");
    expect(folderOf("b.ts")).toBe("");
  });
});

describe("the row menu", () => {
  test("a Markdown file opens beside, then the editor, Finder and the paths", () => {
    expect(menuItems({ dir: false, markdown: true, editor: "Zed" }).map((item) => item.label)).toEqual(["Open beside", "Open in Zed", "Reveal in Finder", "Copy path", "Copy relative path"]);
  });

  test("another file has no Open beside, and without an editor the default app opens it", () => {
    expect(menuItems({ dir: false, markdown: false, editor: null }).map((item) => item.label)).toEqual(["Open with default app", "Reveal in Finder", "Copy path", "Copy relative path"]);
  });

  test("a folder can start a terminal", () => {
    expect(menuItems({ dir: true, markdown: false, editor: null }).map((item) => item.id)).toEqual(["editor", "terminal", "reveal", "copy", "copy-relative"]);
  });
});
