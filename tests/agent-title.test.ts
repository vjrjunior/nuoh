import { describe, expect, test } from "bun:test";
import { cleanTitle, tellingTitle } from "../lib/agent-title.js";

describe("cleanTitle", () => {
  test("drops the status glyph and the separator an agent puts before its title", () => {
    expect(cleanTitle("✳ Fix login")).toBe("Fix login");
    expect(cleanTitle("⠋ - Thinking")).toBe("Thinking");
    expect(cleanTitle("[ ! ] Review the diff")).toBe("Review the diff");
    expect(cleanTitle("✋ Waiting for you")).toBe("Waiting for you");
    expect(cleanTitle("⏳ Building")).toBe("Building");
  });

  test("keeps a title that opens with a bracket, an emoji or a path", () => {
    expect(cleanTitle("[web] login")).toBe("[web] login");
    expect(cleanTitle("🔴 login")).toBe("🔴 login");
    expect(cleanTitle("~/code/app")).toBe("~/code/app");
    expect(cleanTitle("#42 checkout")).toBe("#42 checkout");
    expect(cleanTitle(null)).toBe("");
  });
});

describe("tellingTitle", () => {
  test("a title that says what runs tells", () => {
    expect(tellingTitle("Fix login")).toBe(true);
    expect(tellingTitle("vim README.md")).toBe(true);
  });

  test("a shell's place, a path or user@host, tells nothing", () => {
    expect(tellingTitle("~/code/app")).toBe(false);
    expect(tellingTitle("/private/tmp/app")).toBe(false);
    expect(tellingTitle("C:\\Users\\me")).toBe(false);
    expect(tellingTitle("me@laptop:~/code/app")).toBe(false);
    expect(tellingTitle("")).toBe(false);
  });
});
