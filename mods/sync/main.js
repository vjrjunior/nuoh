import { View, div } from "gpui-kit";
import { checking, exec, notify, props, updates } from "herdr";

const APPLY_TIMEOUT = 120000;

export default class Sync extends View {
  init(_props, cx) {
    const { built, repo, bun } = props() ?? {};
    if (checking() || !built) return;
    const version = updates().app.version;
    if (version !== built) this.rebuild(cx, { built, repo, bun, version });
  }

  rebuild(cx, { built, repo, bun, version }) {
    cx.spawn(async () => {
      const result = await exec(bun, ["scripts/layout.ts", "apply", "--herdr-version", version], { cwd: repo, timeout: APPLY_TIMEOUT }).catch((error) => ({
        code: 1,
        stderr: String(error),
      }));
      if (result.code === 0) return;
      const reason = result.stderr.trim().split("\n")[0].replace(/^error: /, "");
      notify({
        title: `nuoh stayed on ${built}`,
        body: `Run bun run apply-layout in ${repo}. ${reason}`,
        level: "warning",
        timeout: 15000,
      });
    });
  }

  render() {
    return div();
  }
}
