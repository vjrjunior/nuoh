import { View, div } from "gpui-kit";
import { checking, exec, notify, props, setShared, shared, updates } from "herdr";

const APPLY_TIMEOUT = 120000;
const SQUARE_KEY = "vjr.square";
const LOOK_EVERY = 500;

export default class VjrSync extends View {
  init(_props, cx) {
    const { built, repo, bun, square } = props() ?? {};
    this.repo = repo;
    this.bun = bun;
    this.square = square === true;
    this.busy = false;
    if (checking() || !built) return;
    if ((shared(SQUARE_KEY) === true) !== this.square) setShared(SQUARE_KEY, this.square);
    const version = updates().app.version;
    if (version !== built) this.rebuild(cx, ["--herdr-version", version], `VJR layout stayed on ${built}`);
    cx.timer.every(LOOK_EVERY, (cx) => this.followLook(cx));
  }

  followLook(cx) {
    const wanted = shared(SQUARE_KEY) === true;
    if (this.busy || wanted === this.square) return;
    notify({ title: wanted ? "Squaring the corners" : "Rounding the corners", body: "The layout rebuilds in a few seconds.", timeout: 4000 });
    this.rebuild(cx, ["--square", wanted ? "on" : "off"], "VJR layout kept its corners", (applied) => {
      if (applied) this.square = wanted;
      else setShared(SQUARE_KEY, this.square);
    });
  }

  rebuild(cx, flags, title, after) {
    this.busy = true;
    cx.spawn(async () => {
      const result = await exec(this.bun, ["scripts/layout.ts", "apply", ...flags], { cwd: this.repo, timeout: APPLY_TIMEOUT }).catch((error) => ({
        code: 1,
        stderr: String(error),
      }));
      this.busy = false;
      const applied = result.code === 0 && (result.stdout ?? "").trim() !== "busy";
      after?.(applied);
      if (result.code === 0) return;
      const reason = result.stderr.trim().split("\n")[0].replace(/^error: /, "");
      notify({
        title,
        body: `Run bun run apply-layout in ${this.repo}. ${reason}`,
        level: "warning",
        timeout: 15000,
      });
    });
  }

  render() {
    return div();
  }
}
