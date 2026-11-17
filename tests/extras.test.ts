import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { variantWith } from "../recipes/variants";
import { loadExtras, readLocalConfig } from "../scripts/config";
import { generateVariant } from "../scripts/generate-layout";
import { bothLooks, copyRepo, makeHomes, removeTempDirs, repo, run, tempDir } from "./helpers";
import { makeHerdrHome } from "./herdr-home";

afterEach(removeTempDirs);

const EXTRA = join(repo, "tests/fixtures/extra");

function generateWith(options: Record<string, unknown> = {}) {
  const home = tempDir();
  makeHerdrHome(home);
  const extras = loadExtras([{ path: EXTRA, options }]);
  return bothLooks(extras.recipes).map((variant) => generateVariant(variant, { home, version: "0.1.10", repo, bun: "/bin/bun", icons: extras.icons }));
}

function configFile(text: string): string {
  const file = join(tempDir(), "config.json");
  writeFileSync(file, text);
  return file;
}

describe("the local config", () => {
  test("no file means no extras and no editor", () => {
    expect(readLocalConfig(join(tempDir(), "missing.json"))).toEqual({ extras: [] });
  });

  test("an extra is a path or a path with options, and ~ is the home folder", () => {
    const config = readLocalConfig(configFile(JSON.stringify({ extras: ["/x/one", { path: "~/two", options: { greeting: "hi" } }], editor: { name: "Zed", argv: ["zed"] } })));
    expect(config.extras[0]).toEqual({ path: "/x/one", options: {} });
    expect(config.extras[1]?.path).toBe(join(process.env.HOME ?? "", "two"));
    expect(config.extras[1]?.options).toEqual({ greeting: "hi" });
    expect(config.editor).toEqual({ name: "Zed", argv: ["zed"] });
  });

  test("a broken file names itself", () => {
    const file = configFile("{ nope");
    expect(() => readLocalConfig(file)).toThrow(file);
    expect(() => readLocalConfig(configFile(JSON.stringify({ extras: "x" })))).toThrow(/extras is a list/);
    expect(() => readLocalConfig(configFile(JSON.stringify({ extras: [{}] })))).toThrow(/folder path/);
    expect(() => readLocalConfig(configFile(JSON.stringify({ editor: { name: "Zed" } })))).toThrow(/editor is/);
  });
});

describe("extras", () => {
  test("an extra's recipe lands in both looks, with the layout's prefix and its options", () => {
    for (const look of generateWith({ greeting: "hi" })) {
      expect(Object.keys(look.mods)).toContain("vjr-hello");
      expect(JSON.parse(look.layoutText).floating).toContainEqual({ id: "hello", content: { mod: "vjr-hello", props: { greeting: "hi" } }, edge: "left", align: "end" });
    }
  });

  test("square corners square an extra's mod and frame its popup", () => {
    const [round, square] = generateWith();
    expect(round?.mods["vjr-hello"]?.["main.js"]).toContain(".bg(t.popover).rounded(6)");
    expect(square?.mods["vjr-hello"]?.["main.js"]).toContain(".bg(t.popover).border_1().border_color(t.border).rounded(0)");
    expect(JSON.parse(square?.mods["vjr-hello"]?.["mod.json"] ?? "{}").overlay).toEqual({ frame: "none" });
  });

  test("an extra's mod gets the kit, and its icons join the kit's", () => {
    const [round] = generateWith();
    expect(round?.mods["vjr-hello"]?.["main.js"]).toContain('from "./kit.js"');
    expect(round?.mods["vjr-hello"]?.["kit.js"]).toContain('export const KIT = { name: "vjr-kit" };');
    expect(Object.keys(round?.mods["vjr-kit"] ?? {})).toContain("icons/hello.svg");
    expect(Object.keys(round?.mods["vjr-kit"] ?? {})).toContain("icons/plus.svg");
  });

  test("an extra can't take a recipe name that exists", () => {
    const [recipe] = loadExtras([{ path: EXTRA, options: {} }]).recipes;
    expect(() => variantWith([{ ...recipe!, name: "markdown" }], false)).toThrow(/markdown, which is taken/);
    expect(() => variantWith([recipe!, recipe!], false)).toThrow(/hello, which is taken/);
  });

  test("a folder without recipes/index.ts, or one that exports no recipes, names the folder", () => {
    const empty = tempDir();
    expect(() => loadExtras([{ path: empty, options: {} }])).toThrow(`extra ${empty}: recipes/index.ts not found`);
    mkdirSync(join(empty, "recipes"));
    writeFileSync(join(empty, "recipes/index.ts"), "export const recipes = 3;\n");
    expect(() => loadExtras([{ path: empty, options: {} }])).toThrow(`extra ${empty}: recipes/index.ts must export recipes`);
  });
});

describe("apply with a local config", () => {
  function setup() {
    const homes = makeHomes();
    makeHerdrHome(homes.herdrApp);
    const root = copyRepo();
    const env = { ...homes.env, PATH: `${join(repo, "tests/fixtures/fake-herdr-app")}:${homes.env.PATH}`, FAKE_HERDR_LOG: join(homes.base, "fake.log") };
    const config = join(homes.env.XDG_CONFIG_HOME as string, "vjr-herdr/config.json");
    mkdirSync(join(config, ".."), { recursive: true });
    const mods = () => readdirSync(join(homes.herdrApp, "mods")).filter((name) => name.startsWith("vjr-"));
    return { homes, config, mods, apply: () => run(root, "layout.ts", ["apply"], env) };
  }

  test("without a config nothing extra is installed", () => {
    const { apply, mods } = setup();
    expect(apply().code).toBe(0);
    expect(mods()).not.toContain("vjr-hello");
  });

  test("an extra in the config is installed, and leaves when it leaves the config", () => {
    const { apply, mods, config } = setup();
    writeFileSync(config, JSON.stringify({ extras: [EXTRA] }));
    expect(apply().stdout).toContain("applied");
    expect(mods()).toContain("vjr-hello");
    expect(apply().stdout).toContain("unchanged");
    writeFileSync(config, "{}");
    expect(apply().stdout).toContain("applied");
    expect(mods()).not.toContain("vjr-hello");
  });

  test("an extra that doesn't load installs nothing and says which folder", () => {
    const { apply, homes, config } = setup();
    writeFileSync(config, JSON.stringify({ extras: ["/nowhere/at/all"] }));
    const result = apply();
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("extra /nowhere/at/all: recipes/index.ts not found");
    expect(existsSync(join(homes.herdrApp, "layouts/vjr-desk.json"))).toBe(false);
  });

  test("the configured editor names the Markdown viewer's button and runs its command", () => {
    const { apply, homes, config } = setup();
    expect(apply().code).toBe(0);
    const viewer = () => readFileSync(join(homes.herdrApp, "mods/vjr-markdown/main.js"), "utf8");
    expect(viewer()).toContain('const EDITOR = { name: "Open", argv: ["open"] };');
    writeFileSync(config, JSON.stringify({ editor: { name: "Zed", argv: ["zed", "-n"] } }));
    expect(apply().code).toBe(0);
    expect(viewer()).toContain('const EDITOR = {"name":"Zed","argv":["zed","-n"]};');
  });
});

describe("the repo stays anyone's", () => {
  test("no tracked file names one person's tools, paths or team workflow", () => {
    const words = [["pp", "stack"], ["pp", "ship"], ["pp", "lane"], ["vjr", "task"], ["vjr", "ac"], ["click", "up"], ["command", "center"], ["orb", "ita/"], ["g", "stack"]].map((parts) => parts.join("[-_ ]?"));
    const found = Bun.spawnSync(["git", "grep", "-n", "-i", "-E", words.join("|")], { cwd: repo }).stdout.toString();
    expect(found).toBe("");
  });
});
