import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recipesWith } from "../recipes/order";
import { loadExtras, readLocalConfig } from "../scripts/config";
import { generate } from "../scripts/generate-layout";
import { copyRepo, makeHomes, removeTempDirs, repo, run, tempDir } from "./helpers";
import { makeHerdrHome } from "./herdr-home";

afterEach(removeTempDirs);

const EXTRA = join(repo, "tests/fixtures/extra");

function generateWith(options: Record<string, unknown> = {}) {
  const home = tempDir();
  makeHerdrHome(home);
  const extras = loadExtras([{ path: EXTRA, options }]);
  return generate(extras.recipes, { home, version: "0.1.10", repo, bun: "/bin/bun" });
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
  test("an extra's recipe lands in the layout, with the layout's prefix and its options", () => {
    const generated = generateWith({ greeting: "hi" });
    expect(Object.keys(generated.mods)).toContain("nuoh-hello");
    expect(JSON.parse(generated.layoutText).floating).toContainEqual({ id: "hello", content: { mod: "nuoh-hello", props: { greeting: "hi" } }, edge: "left", align: "end" });
  });

  test("an extra's mod gets the layout's kit, icons and all", () => {
    const { mods } = generateWith();
    expect(mods["nuoh-hello"]?.["main.js"]).toContain('from "./kit.js"');
    expect(mods["nuoh-hello"]?.["kit.js"]).toContain('export const KIT = { name: "nuoh-kit" };');
    expect(Object.keys(mods["nuoh-kit"] ?? {})).toContain("icons/plus.svg");
    expect(Object.keys(mods["nuoh-kit"] ?? {}).filter((name) => name.startsWith("icons/")).sort()).toEqual(readdirSync(join(repo, "kit/icons")).filter((name) => name.endsWith(".svg")).map((name) => `icons/${name}`).sort());
  });

  test("an extra can't take a recipe name that exists", () => {
    const [recipe] = loadExtras([{ path: EXTRA, options: {} }]).recipes;
    expect(() => recipesWith([{ ...recipe!, name: "markdown" }])).toThrow(/markdown, which is taken/);
    expect(() => recipesWith([recipe!, recipe!])).toThrow(/hello, which is taken/);
    for (const name of ["rail", "rail-keys", "nuoh-frame", "nuoh-cards"]) expect(() => recipesWith([{ ...recipe!, name }])).toThrow(`${name}, which is taken`);
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
    const mods = () => readdirSync(join(homes.herdrApp, "mods")).filter((name) => name.startsWith("nuoh-"));
    return { homes, config, mods, apply: () => run(root, "layout.ts", ["apply"], env) };
  }

  test("without a config nothing extra is installed", () => {
    const { apply, mods } = setup();
    expect(apply().code).toBe(0);
    expect(mods()).not.toContain("nuoh-hello");
  });

  test("an extra in the config is installed, and leaves when it leaves the config", () => {
    const { apply, mods, config } = setup();
    writeFileSync(config, JSON.stringify({ extras: [EXTRA] }));
    expect(apply().stdout).toContain("applied");
    expect(mods()).toContain("nuoh-hello");
    expect(apply().stdout).toContain("unchanged");
    writeFileSync(config, "{}");
    expect(apply().stdout).toContain("applied");
    expect(mods()).not.toContain("nuoh-hello");
  });

  test("an extra that doesn't load installs nothing and says which folder", () => {
    const { apply, homes, config } = setup();
    writeFileSync(config, JSON.stringify({ extras: ["/nowhere/at/all"] }));
    const result = apply();
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("extra /nowhere/at/all: recipes/index.ts not found");
    expect(existsSync(join(homes.herdrApp, "layouts/nuoh.json"))).toBe(false);
  });

  test("the configured editor names the Markdown viewer's button and runs its command", () => {
    const { apply, homes, config } = setup();
    expect(apply().code).toBe(0);
    const viewer = () => readFileSync(join(homes.herdrApp, "mods/nuoh-markdown/main.js"), "utf8");
    expect(viewer()).toContain('const EDITOR = { name: "Open", argv: ["open"] };');
    writeFileSync(config, JSON.stringify({ editor: { name: "Zed", argv: ["zed", "-n"] } }));
    expect(apply().code).toBe(0);
    expect(viewer()).toContain('const EDITOR = {"name":"Zed","argv":["zed","-n"]};');
  });
});

describe("the repo stays anyone's", () => {
  test("no tracked file names one person's tools, paths or team workflow", () => {
    const words = [["pp", "stack"], ["pp", "ship"], ["pp", "lane"], ["vjr", "task"], ["vjr", "ac"], ["click", "up"], ["command", "center"], ["orb", "ita/"], ["g", "stack"]].map((parts) => parts.join("[-_ ]?"));
    const banned = new RegExp(words.join("|"), "i");
    const brandIcon = new RegExp(`"${"click" + "up"}"|${"click" + "up"}\\.svg`, "g");
    const found = Bun.spawnSync(["git", "grep", "-n", "-i", "-E", words.join("|")], { cwd: repo })
      .stdout.toString()
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.startsWith("kit/") || banned.test(line.split(":").slice(2).join(":").replace(brandIcon, "")));
    expect(found).toEqual([]);
  });
});
