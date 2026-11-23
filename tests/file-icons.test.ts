import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import table from "../mods/files/file-icons.js";
import { iconFor, openIcon } from "../mods/files/icon-rules.js";
import { iconsOf, iconTable, LICENSE_FILE, type Manifest, PACKAGE, tableModule, VERSION, writeIcons } from "../scripts/file-icons";
import { removeTempDirs, tempDir } from "./helpers";

afterEach(removeTempDirs);

const ICONS = join(import.meta.dir, "../mods/files/icons");
const icon = (path: string, options: { dir?: boolean; open?: boolean; light?: boolean } = {}) => iconFor(table, path, options);

describe("the icons in the repo", () => {
  test("every icon the table names is in the icons folder, and nothing else is", () => {
    const svgs = readdirSync(ICONS).filter((name) => name.endsWith(".svg"));
    expect(svgs.map((name) => name.slice(0, -4)).sort()).toEqual(iconsOf(table));
    expect(svgs).toHaveLength(1184);
  });

  test("they come from the pinned release, with its license beside them", () => {
    expect(table.version).toBe(VERSION);
    expect(readFileSync(join(ICONS, LICENSE_FILE), "utf8")).toContain("MIT License");
  });

  test("every folder icon has its open icon", () => {
    for (const closed of [table.folder, ...Object.values(table.folderNames), ...Object.values(table.light.folderNames)]) {
      expect(existsSync(join(ICONS, `${openIcon(closed)}.svg`))).toBe(true);
    }
  });

  test("the table's keys are lower case", () => {
    for (const names of [table.fileNames, table.fileExtensions, table.folderNames, ...Object.values(table.light)]) {
      for (const key of Object.keys(names)) expect(key).toBe(key.toLowerCase());
    }
  });
});

describe("which icon a file gets", () => {
  test("its name first, in any case", () => {
    expect(icon("package.json")).toBe("nodejs");
    expect(icon("Dockerfile")).toBe("docker");
    expect(icon("README.MD")).toBe("readme");
    expect(icon("LICENSE")).toBe("license");
    expect(icon(".gitignore")).toBe("git");
  });

  test("then its longest extension", () => {
    expect(icon("src/main.ts")).toBe("typescript");
    expect(icon("src/main.spec.ts")).toBe("test-ts");
    expect(icon("notes.draft.md")).toBe("markdown");
    expect(icon(".env.local")).toBe("tune");
  });

  test("then the plain file", () => {
    expect(icon("notes.unknownext")).toBe("file");
    expect(icon("constructor")).toBe("file");
  });

  test("a rule for its folder beats its name", () => {
    expect(icon(".config/graphqlrc")).toBe(table.fileNames[".config/graphqlrc"]);
    expect(icon("app/.config/graphqlrc")).toBe(table.fileNames[".config/graphqlrc"]);
    expect(icon("graphqlrc")).not.toBe(table.fileNames[".config/graphqlrc"]);
  });

  test("a light appearance takes the light icon where there is one", () => {
    expect(icon("Cargo.toml", { light: true })).toBe("toml_light");
    expect(icon("main.ts", { light: true })).toBe("typescript");
  });
});

describe("which icon a folder gets", () => {
  test("its name, open or shut", () => {
    expect(icon("src", { dir: true })).toBe("folder-src");
    expect(icon("src", { dir: true, open: true })).toBe("folder-src-open");
    expect(icon(".github", { dir: true })).toBe("folder-github");
  });

  test("other spellings of a known name", () => {
    for (const name of ["tests", "__tests__", "_tests", "-tests", ".tests"]) expect(icon(name, { dir: true })).toBe("folder-test");
  });

  test("a rule for its path beats its name, wherever it sits", () => {
    expect(icon(".github/workflows", { dir: true })).toBe("folder-gh-workflows");
    expect(icon("repo/.github/workflows", { dir: true, open: true })).toBe("folder-gh-workflows-open");
  });

  test("an unknown one gets the plain folder", () => {
    expect(icon("whatever", { dir: true })).toBe("folder");
    expect(icon("whatever", { dir: true, open: true })).toBe("folder-open");
  });

  test("a light appearance opens to the light open icon", () => {
    expect(icon("jinja", { dir: true, light: true, open: true })).toBe("folder-jinja-open_light");
  });
});

const definitions = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { iconPath: `./../icons/${id}.svg` }]));

const manifest = (changes: Partial<Manifest> = {}): Manifest => ({
  iconDefinitions: definitions(["file", "folder", "folder-open", "typescript", "folder-src", "folder-src-open"]),
  file: "file",
  folder: "folder",
  folderExpanded: "folder-open",
  fileNames: {},
  fileExtensions: { TS: "typescript" },
  folderNames: { src: "folder-src", ".src": "folder-src", __src__: "folder-src" },
  folderNamesExpanded: { src: "folder-src-open", ".src": "folder-src-open", __src__: "folder-src-open" },
  light: {},
  ...changes,
});

describe("building the table", () => {
  test("keys are lowered, and spellings a folder's bare name already gives are dropped", () => {
    const built = iconTable(manifest(), "1.0.0");
    expect(built.fileExtensions).toEqual({ ts: "typescript" });
    expect(built.folderNames).toEqual({ src: "folder-src" });
    expect(iconFor(built, "__src__", { dir: true })).toBe("folder-src");
  });

  test("a spelling with an icon of its own is kept", () => {
    const built = iconTable(
      manifest({ folderNames: { src: "folder-src", ".src": "folder" }, folderNamesExpanded: { src: "folder-src-open", ".src": "folder-open" } }),
      "1.0.0",
    );
    expect(built.folderNames).toEqual({ ".src": "folder", src: "folder-src" });
  });

  test("two spellings of one key with different icons fail", () => {
    expect(() => iconTable(manifest({ fileExtensions: { ts: "typescript", TS: "file" } }), "1.0.0")).toThrow("TS clashes");
  });

  test("a folder that doesn't open as its open icon fails", () => {
    expect(() => iconTable(manifest({ folderNamesExpanded: { src: "folder-open" } }), "1.0.0")).toThrow("src opens as folder-open");
  });

  test("a rule longer than the resolver reads fails", () => {
    expect(() => iconTable(manifest({ fileNames: { "a/b/c": "typescript" } }), "1.0.0")).toThrow("more than 2 parts");
  });

  test("the module exports the table", () => {
    const built = iconTable(manifest(), "1.0.0");
    expect(tableModule(built)).toBe(`export default ${JSON.stringify(built, null, 1)};\n`);
  });
});

describe("writing the icons", () => {
  function fakePackage(version = VERSION) {
    const dir = tempDir();
    mkdirSync(join(dir, "dist"), { recursive: true });
    mkdirSync(join(dir, "icons"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: PACKAGE, version }));
    writeFileSync(join(dir, "LICENSE"), "The MIT License (MIT)\n");
    const base = manifest();
    base.iconDefinitions.typescript = { iconPath: "./../icons/typescript.clone.svg" };
    writeFileSync(join(dir, "dist/material-icons.json"), JSON.stringify(base));
    for (const name of ["file", "folder", "folder-open", "typescript.clone", "folder-src", "folder-src-open", "unused"]) {
      writeFileSync(join(dir, "icons", `${name}.svg`), `<svg id="${name}"/>`);
    }
    return dir;
  }

  test("copies the icons the table names under their names, the license and the table", () => {
    const out = tempDir();
    writeIcons(fakePackage(), out);
    expect(readdirSync(join(out, "icons")).sort()).toEqual([LICENSE_FILE, "file.svg", "folder-open.svg", "folder-src-open.svg", "folder-src.svg", "folder.svg", "typescript.svg"]);
    expect(readFileSync(join(out, "icons/typescript.svg"), "utf8")).toBe('<svg id="typescript.clone"/>');
    expect(readFileSync(join(out, "file-icons.js"), "utf8")).toContain('"ts": "typescript"');
  });

  test("replaces icons a previous release left", () => {
    const out = tempDir();
    mkdirSync(join(out, "icons"), { recursive: true });
    writeFileSync(join(out, "icons/gone.svg"), "<svg/>");
    writeIcons(fakePackage(), out);
    expect(existsSync(join(out, "icons/gone.svg"))).toBe(false);
  });

  test("refuses another release", () => {
    expect(() => writeIcons(fakePackage("9.9.9"), tempDir())).toThrow(`expected ${PACKAGE} ${VERSION}, found ${PACKAGE} 9.9.9`);
  });
});
