import { View, div } from "gpui-kit";
import { checking, exec, notify, props, updates } from "herdr";

const APPLY_TIMEOUT = 120000;

export default class VjrSync extends View {
  init(_props, cx) {
    const { built, repo, bun } = props() ?? {};
    this.repo = repo;
    this.bun = bun;
    if (checking() || !built) return;
    const version = updates().app.version;
    if (version !== built) this.rebuild(cx, ["--herdr-version", version], `VJR layout stayed on ${built}`);
  }

  rebuild(cx, flags, title) {
    cx.spawn(async () => {
      const result = await exec(this.bun, ["scripts/layout.ts", "apply", ...flags], { cwd: this.repo, timeout: APPLY_TIMEOUT }).catch((error) => ({
        code: 1,
        stderr: String(error),
      }));
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
