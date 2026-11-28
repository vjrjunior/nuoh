import { div, PathBuilder } from "gpui-kit";
import { h_flex, Input, v_flex } from "gpui-base";
import {
  addNodeMenu,
  agentPicker,
  branchRow,
  button,
  canvasBar,
  nodeCheck,
  edgeBadge,
  edgeLook,
  emptyState,
  heading,
  icon,
  iconButton,
  input,
  menuItem,
  minimap,
  nodeButton,
  nodeField,
  nodeResult,
  nodeShell,
  nodeToolbar,
  port,
  refusal,
  TEXT,
  taskRow,
  textareaField,
  toneColor,
  zoomBar,
} from "../../kit/kit.js";
import { graphOf, loopKey, nodeKind } from "../../lib/workflow.js";
import { edgeRoutes, gridLines, inPort, minimapOf, NODE_W, outPort, toScreen } from "./canvas.js";
import { ADD_KINDS } from "./editor.js";
import { agentLabel, edgeState, nodeMeta, resultOf, RUN_LOOK, runLine } from "./logic.js";

const MONO = "JetBrains Mono";
const TOOLBAR_W = 104;
const MENU_W = 260;

function card(el, t) {
  return el.rounded(10).bg(t.raised).border_1().border_color(t.foreground + "1F").shadow_lg();
}

function screenSegments(segments, camera) {
  return segments.map((seg) => ({
    line: seg.line,
    from: toScreen(seg.from, camera),
    to: toScreen(seg.to, camera),
    c1: seg.c1 ? toScreen(seg.c1, camera) : null,
    c2: seg.c2 ? toScreen(seg.c2, camera) : null,
  }));
}

function paintPaths(groups) {
  return Object.entries(groups)
    .filter(([, group]) => group.segments.length)
    .map(([key, group]) => {
      let builder = PathBuilder.stroke(group.look.width * group.z);
      if (group.look.dash) builder = builder.dash_array(group.look.dash.map((one) => one * group.z));
      for (const seg of group.segments) {
        builder = builder.move_to(seg.from.x, seg.from.y);
        builder = seg.line ? builder.line_to(seg.to.x, seg.to.y) : builder.cubic_bezier_to(seg.to.x, seg.to.y, seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y);
      }
      const painted = window.paint_path(builder.build(), group.look.color).absolute().left(0).top(0).size_full();
      return key === "running" ? painted.loop("opacity", { from: 0.45, to: 1, period: 1200 }) : painted;
    });
}

export function gridLayer(viewport, camera, t) {
  const grid = gridLines(viewport, camera);
  if (!grid.rows.length || !viewport.width) return null;
  let builder = PathBuilder.stroke(1.6).dash_array([1.6, grid.spacing - 1.6]);
  for (const y of grid.rows) builder = builder.move_to(grid.startX - 0.8, y).line_to(viewport.width, y);
  return window.paint_path(builder.build(), t.foreground + "1C").absolute().left(0).top(0).size_full();
}

function loopLabel(route, run) {
  const taken = run?.loops?.[loopKey(route.edge)] ?? 0;
  return run && taken ? `back ${taken} of ${route.edge.max ?? "?"}` : `up to ${route.edge.max ?? "?"}×`;
}

export function edgesLayer(view, scene, t) {
  const { workflow, camera, run, status, places, heights } = scene;
  const graph = graphOf(workflow);
  const routes = edgeRoutes(workflow, places, heights);
  const groups = {};
  const badges = [];
  for (const route of routes) {
    const index = route.edge.index;
    const selected = view.sel.edge === index;
    const state = selected ? "selected" : view.hotEdges?.has(index) ? "delete" : edgeState(graph, run, route.edge, status);
    const look = edgeLook(state, t);
    const key = state === "running" ? "running" : `${look.color}|${look.width}|${look.dash ? 1 : 0}`;
    (groups[key] ??= { look, z: camera.z, segments: [] }).segments.push(...screenSegments(route.segments, camera));
    if (!route.loop) continue;
    const at = toScreen(route.badge, camera);
    badges.push(
      h_flex()
        .id(`workflows-loop-${index}`)
        .absolute()
        .left(at.x - 50 * camera.z - (selected ? 30 : 0))
        .top(at.y - 11 * camera.z)
        .gap(4)
        .items_center()
        .on_mouse_down("left", (_e, cx) => {
          cx.stop_propagation();
          view.selectEdge(index, cx);
        })
        .when(selected, (el) => el.child(iconButton(`workflows-loop-less-${index}`, { icon: "minus", tooltip: "Fewer times back", size: "sm", stop: true, onClick: (cx) => view.loopMax(index, -1, cx) }, t)))
        .child(edgeBadge(`workflows-loop-badge-${index}`, { label: loopLabel(route, run) }, t, camera.z))
        .when(selected, (el) => el.child(iconButton(`workflows-loop-more-${index}`, { icon: "plus", tooltip: "More times back", size: "sm", stop: true, onClick: (cx) => view.loopMax(index, 1, cx) }, t))),
    );
  }
  if (view.pull) {
    const from = toScreen(view.pull.start, camera);
    const to = view.pull.point;
    const bend = Math.max(48, Math.abs(to.x - from.x) / 2);
    groups.pull = { look: edgeLook(view.pull.refused ? "refused" : "pulling", t), z: camera.z, segments: [{ from, c1: { x: from.x + bend, y: from.y }, c2: { x: to.x - bend, y: to.y }, to }] };
  }
  return { paths: paintPaths(groups), badges, routes };
}

function holdField(view, id, el) {
  return el.on_mouse_down("left", (_e, cx) => {
    cx.stop_propagation();
    view.pressField(id, cx);
  });
}

function fieldFor(view, id, field, t, z, options) {
  const state = view.field(id, field);
  const focused = view.typing === `${id}:${field}`;
  const content = !state ? nodeField(options.text ?? "", t, { z, ...options }) : options.line ? nodeField(Input.new(state), t, { z, focused, ...options }) : textareaField(state, t, { z, focused, ...options });
  return holdField(view, id, div().id(`workflows-field-${id}-${field}`).w_full()).child(content);
}

function stepButton(view, id, scene, t, z) {
  return nodeButton(`workflows-step-${id}`, { label: "Run step", icon: "play", disabled: !scene.valid, loading: view.busy === `only:${id}`, onClick: (cx) => view.runNode(id, "only", cx) }, t, z);
}

function nodeBody(view, node, scene, nodeView, t) {
  const z = scene.camera.z;
  const kind = nodeKind(node);
  const id = node.id;
  const body = [];
  let actions = null;
  const busy = ["running", "waiting"].includes(nodeView.state) && !nodeView.cut;
  if (kind === "start") {
    for (const [name, one] of Object.entries(scene.workflow.inputs ?? {})) {
      const label = `${one.label ?? name}${one.required ? " · required" : ""}`;
      body.push(nodeField(one.default ? `${label}: ${one.default}` : label, t, { z, rows: 1 }));
    }
    actions = nodeButton(`workflows-start-${id}`, { label: "Run workflow", icon: "play", variant: "primary", disabled: !scene.valid, onClick: () => view.openRun() }, t, z);
  } else if (kind === "agent" || kind === "continue") {
    body.push(fieldFor(view, id, "task", t, z, { rows: 3, text: node.task ?? "" }));
    const label = agentLabel(node, scene.workflow, view.agents);
    const modelState = kind === "agent" ? view.field(id, "model") : null;
    const model = kind === "agent" ? (modelState ? Input.new(modelState) : (label.model ?? "default")) : null;
    body.push(
      holdField(view, id, h_flex().id(`workflows-agent-row-${id}`).w_full().gap(6 * z).items_center())
        .child(agentPicker(`workflows-agent-${id}`, { program: label.program, name: label.name, model, open: view.menu?.kind === "agent" && view.menu.node === id, onClick: (cx) => view.openMenu({ kind: "agent", node: id }, cx) }, t, z))
        .child(div().flex_1())
        .when(node.answer != null, (el) => el.child(div().flex_none().text_size(TEXT.sm * z).text_color(t.dim).child(Object.keys(node.answer).join(" · ")))),
    );
    if (!busy) actions = stepButton(view, id, scene, t, z);
    else if (view.liveAgent(id, scene)) actions = nodeButton(`workflows-show-${id}`, { label: "Show agent", icon: "terminal", onClick: () => view.showAgent(id) }, t, z);
  } else if (kind === "run") {
    body.push(fieldFor(view, id, "run", t, z, { rows: 1, line: true, mono: MONO, text: (node.run ?? []).join(" ") }));
    body.push(nodeCheck(`workflows-allow-${id}`, { label: "Goes on when it fails", checked: Boolean(node.allowFail), onClick: (cx) => view.edit(id, "allowFail", !node.allowFail, cx) }, t, z));
    if (!busy) actions = stepButton(view, id, scene, t, z);
  } else if (kind === "condition") {
    body.push(fieldFor(view, id, "condition", t, z, { rows: 1, line: true, mono: MONO, text: node.condition ?? "" }));
    const branch = nodeView.record?.status === "done" ? nodeView.record.output : null;
    body.push(branchRow(`workflows-yes-${id}`, { label: branch === "yes" ? "Yes · taken" : "Yes", taken: branch ? branch === "yes" : null }, t, z));
    body.push(branchRow(`workflows-no-${id}`, { label: branch === "no" ? "No · taken" : "No", taken: branch ? branch === "no" : null }, t, z));
  } else if (kind === "approve") {
    body.push(fieldFor(view, id, "approve", t, z, { rows: 1, line: true, text: node.approve ?? "" }));
    if (node.show != null) body.push(fieldFor(view, id, "show", t, z, { rows: 1, line: true, text: node.show }));
    if (nodeView.state === "waiting" && !nodeView.cut)
      actions = [
        nodeButton(`workflows-approve-${id}`, { label: "Approve", icon: "check", variant: "primary", loading: view.busy === `approve:${id}`, onClick: (cx) => view.decide("approve", id, cx) }, t, z),
        nodeButton(`workflows-reject-${id}`, { label: "Reject", icon: "x", variant: "danger", loading: view.busy === `reject:${id}`, onClick: (cx) => view.decide("reject", id, cx) }, t, z),
      ];
  }
  return { body, actions };
}

export function nodeLayer(view, scene, t) {
  const z = scene.camera.z;
  return (scene.workflow.nodes ?? []).map((node) => {
    const id = node.id;
    const place = view.dragging(id) ?? scene.places[id];
    const at = toScreen(place, scene.camera);
    const nodeView = scene.views[id];
    const state = view.sel.node === id && ["idle", "done", "skipped"].includes(nodeView.state) ? "selected" : nodeView.state;
    const { body, actions } = nodeBody(view, node, scene, nodeView, t);
    const result = resultOf(node, nodeView);
    const name = view.renaming === id ? div().w(160 * z).child(input(view.renameState, t, { height: 18 * z })) : id;
    return div()
      .id(`workflows-place-${id}`)
      .absolute()
      .left(at.x)
      .top(at.y)
      .on_hover((on, cx) => view.hoverNode(id, on, cx))
      .on_mouse_down("left", (event, cx) => {
        cx.stop_propagation();
        view.pressNode(id, event, cx);
      })
      .on_mouse_down("right", (event, cx) => {
        cx.stop_propagation();
        view.openMenu({ kind: "context", node: id, at: view.local(event) }, cx);
      })
      .child(
        nodeShell(
          `workflows-node-${id}`,
          {
            kind: nodeKind(node),
            name,
            meta: nodeMeta(scene.run, id, nodeView, scene.now),
            state,
            body,
            result: result ? nodeResult({ head: result.fields ? "ANSWER" : "RESULT", text: result.text, color: result.tone ? t[result.tone] : null, fields: result.fields ?? null }, t, z) : null,
            actions,
          },
          t,
          z,
        ),
      );
  });
}

function portAt(key, point, state, handlers, z, t) {
  const half = 11 * Math.max(1, Math.min(z, 2));
  return div()
    .id(`workflows-port-${key}`)
    .absolute()
    .left(point.x - half)
    .top(point.y - half)
    .child(port(`workflows-port-dot-${key}`, { state, ...handlers }, t, z));
}

export function portLayer(view, scene, t) {
  const z = scene.camera.z;
  const graph = graphOf(scene.workflow);
  const out = [];
  for (const node of scene.workflow.nodes ?? []) {
    const id = node.id;
    const kind = nodeKind(node);
    const place = view.dragging(id) ?? scene.places[id];
    const near = view.hover === id || view.sel.node === id;
    if (kind !== "start") {
      const connected = (graph.forwardIn.get(id) ?? []).length + (graph.loopIn.get(id) ?? []).length > 0;
      let state = connected ? "connected" : near ? "idle" : "hidden";
      if (view.pull) state = view.pull.target === id ? (view.pull.refused ? "refused" : "under") : view.pull.from === id ? "dimmed" : "target";
      out.push(portAt(`${id}-in`, toScreen(inPort(node, place), scene.camera), state, {}, z, t));
    }
    for (const branch of kind === "condition" ? ["yes", "no"] : [null]) {
      const connected = (scene.workflow.edges ?? []).some((edge) => edge.from === id && (edge.branch ?? null) === branch);
      let state = connected ? "connected" : near ? "idle" : "hidden";
      if (view.pull?.from === id && view.pull.branch === branch) state = "target";
      const onMouseDown = (event, cx) => {
        cx.stop_propagation();
        view.startPull(id, branch, event, cx);
      };
      out.push(portAt(`${id}-out${branch ? `-${branch}` : ""}`, toScreen(outPort(node, place, branch), scene.camera), state, { onMouseDown }, z, t));
    }
  }
  return out;
}

export function toolbarLayer(view, scene, t) {
  const id = view.sel.node;
  const node = id ? (scene.workflow.nodes ?? []).find((one) => one.id === id) : null;
  if (!node || view.drag?.moved || view.renaming || nodeKind(node) === "start") return null;
  const at = toScreen(scene.places[id], scene.camera);
  const kind = nodeKind(node);
  return div()
    .id("workflows-toolbar")
    .absolute()
    .left(at.x + (NODE_W * scene.camera.z) / 2 - TOOLBAR_W / 2)
    .top(Math.max(8, at.y - 44))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .child(
      nodeToolbar(
        "workflows-node-toolbar",
        {
          answer: kind === "agent" || kind === "continue",
          hot: view.deleteHot,
          onAnswer: (cx) => view.openMenu({ kind: "answer", node: id }, cx),
          onDuplicate: (cx) => view.duplicate(cx),
          onDelete: (cx) => view.remove(cx),
          onDeleteHover: (on, cx) => view.hotDelete(on, cx),
        },
        t,
      ),
    );
}

function menuBox(id, at, viewport, width, height, child) {
  const x = Math.max(8, Math.min(at.x, viewport.width - width - 8));
  const y = Math.max(8, Math.min(at.y, viewport.height - height - 8));
  return div()
    .id(id)
    .absolute()
    .left(x)
    .top(y)
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_scroll_wheel((_e, cx) => cx.stop_propagation())
    .child(child);
}

function listBox(t, width, items, empty) {
  return card(v_flex().w(width).p(4).gap(1), t).children(items.length ? items : [div().p(8).text_size(TEXT.base).text_color(t.unknown).child(empty)]);
}

function matches(node, query) {
  return [node.id, node.task, node.condition, node.approve, node.show, ...(node.run ?? [])].filter(Boolean).join(" ").toLowerCase().includes(query);
}

const FIND_ICON = { start: "play", agent: "bot", continue: "bot", run: "terminal", condition: "git-fork", approve: "flag" };

export function menuLayer(view, scene, t) {
  const menu = view.menu;
  if (!menu) return null;
  const anchor = menu.at ?? view.nodeAnchor(menu.node, scene);
  if (menu.kind === "add") {
    const query = (view.addSearch.value() ?? "").trim().toLowerCase();
    const kinds = ADD_KINDS.filter((entry) => !query || entry.label.toLowerCase().includes(query) || entry.kind.includes(query));
    const groups = ["Steps", "Flow"].map((label) => ({
      label,
      items: kinds.filter((entry) => entry.group === label).map((entry) => ({ id: entry.kind, icon: entry.icon, label: entry.label, note: entry.note, selected: entry === kinds[0], onClick: (cx) => view.add(entry.kind, cx) })),
    }));
    return menuBox("workflows-add-menu", anchor, scene.viewport, MENU_W, 250, addNodeMenu("workflows-add", { search: view.addSearch, groups }, t));
  }
  if (menu.kind === "find") {
    const query = (view.findState.value() ?? "").trim().toLowerCase();
    const found = (scene.workflow.nodes ?? []).filter((node) => !query || matches(node, query)).slice(0, 8);
    const items = found.map((node) => menuItem(`workflows-found-${node.id}`, { icon: FIND_ICON[nodeKind(node)] ?? "bot", label: node.id, onClick: (cx) => view.find(node.id, cx) }, t));
    return menuBox(
      "workflows-find-menu",
      anchor,
      scene.viewport,
      MENU_W,
      300,
      card(v_flex().w(MENU_W).p(6).gap(4), t)
        .child(input(view.findState, t, { kind: "search", height: 30 }))
        .child(v_flex().gap(1).children(items.length ? items : [div().p(8).text_size(TEXT.base).text_color(t.unknown).child("No step matches")])),
    );
  }
  if (menu.kind === "agent") {
    const node = scene.workflow.nodes.find((one) => one.id === menu.node);
    if (!node) return null;
    const items =
      nodeKind(node) === "continue"
        ? scene.workflow.nodes
            .filter((one) => one.id !== node.id && ["agent", "continue"].includes(nodeKind(one)))
            .map((one) => menuItem(`workflows-pick-${one.id}`, { icon: "bot", label: `Same agent as ${one.id}`, check: node.continue === one.id, onClick: (cx) => view.edit(node.id, "continue", one.id, cx, true) }, t))
        : (view.agents ?? []).map((agent) => menuItem(`workflows-pick-${agent.name}`, { icon: "bot", label: agent.name, detail: agent.installed ? "" : "not installed", check: (node.agent?.[0] ?? "") === agent.run?.[0], onClick: (cx) => view.pickAgent(node.id, agent.run, cx) }, t));
    return menuBox("workflows-agent-menu", anchor, scene.viewport, MENU_W, 16 + Math.max(items.length, 1) * 30, listBox(t, MENU_W, items, "No agent found"));
  }
  if (menu.kind === "answer") {
    return menuBox(
      "workflows-answer-menu",
      anchor,
      scene.viewport,
      320,
      150,
      card(v_flex().w(320).p(10).gap(6), t)
        .child(heading("Answer fields", t))
        .child(div().text_size(TEXT.sm).text_color(t.unknown).child("name: type, … with text, number, boolean or a|b|c, and ? when optional. Empty for a plain answer."))
        .child(input(view.answerState, t, { height: 30, font: MONO }))
        .when(view.answerProblem != null, (el) => el.child(div().text_size(TEXT.sm).text_color(t.blocked).child(view.answerProblem)))
        .child(
          h_flex()
            .justify_end()
            .gap(6)
            .child(button("workflows-answer-cancel", { label: "Cancel", variant: "ghost", size: "sm", onClick: (cx) => view.closeMenu(cx) }, t))
            .child(button("workflows-answer-save", { label: "Save", variant: "primary", size: "sm", onClick: (cx) => view.saveAnswer(cx) }, t)),
        ),
    );
  }
  if (menu.kind === "context") {
    const node = scene.workflow.nodes.find((one) => one.id === menu.node);
    if (!node) return null;
    const items =
      nodeKind(node) === "start"
        ? [menuItem("workflows-ctx-run", { icon: "play", label: "Run workflow", onClick: () => view.openRun() }, t)]
        : [
            menuItem("workflows-ctx-step", { icon: "play", label: "Run step", onClick: (cx) => view.runNode(node.id, "only", cx) }, t),
            menuItem("workflows-ctx-from", { icon: "play", label: "Run from here", onClick: (cx) => view.runNode(node.id, "from", cx) }, t),
            menuItem("workflows-ctx-rename", { icon: "file-text", label: "Rename", onClick: (cx) => view.startRename(node.id, cx) }, t),
            menuItem("workflows-ctx-duplicate", { icon: "copy-plus", label: "Duplicate", detail: "⌘D", onClick: (cx) => view.duplicate(cx, node.id) }, t),
            menuItem("workflows-ctx-delete", { icon: "trash-2", label: "Delete", detail: "⌫", danger: true, onClick: (cx) => view.remove(cx, node.id) }, t),
          ];
    return menuBox("workflows-context-menu", anchor, scene.viewport, 220, 12 + items.length * 30, listBox(t, 220, items, ""));
  }
  return null;
}

function mapBlocks(view, scene, map, t) {
  return (scene.workflow.nodes ?? []).map((node) => {
    const place = scene.places[node.id];
    const state = scene.views[node.id].state;
    const color = view.sel.node === node.id ? t.accent : state === "done" ? t.done + "99" : state === "running" ? t.working : state === "waiting" || state === "failed" ? t.blocked : t.muted + "66";
    return { x: place.x * map.scale + map.offset.x, y: place.y * map.scale + map.offset.y, w: NODE_W * map.scale, h: (scene.heights[node.id] ?? 100) * map.scale, color };
  });
}

export function barsLayer(view, scene, t) {
  const items = [
    div()
      .id("workflows-zoom")
      .absolute()
      .left(16)
      .bottom(16)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(
        zoomBar(
          "workflows-zoom-bar",
          {
            percent: scene.camera.z * 100,
            minimap: view.showMap,
            onOut: (cx) => view.zoomBy(1 / 1.2, cx),
            onIn: (cx) => view.zoomBy(1.2, cx),
            onPercent: (cx) => view.fitView(cx),
            onFit: (cx) => view.fitView(cx),
            onTidy: (cx) => view.tidyUp(cx),
            onMinimap: (cx) => view.toggleMap(cx),
          },
          t,
        ),
      ),
    h_flex()
      .id("workflows-bar-row")
      .absolute()
      .left(0)
      .right(0)
      .bottom(16)
      .justify_center()
      .child(
        div()
          .id("workflows-bar-hold")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(
            canvasBar(
              "workflows-canvas-bar",
              {
                tool: view.tool,
                onSelect: (cx) => view.setTool("select", cx),
                onHand: (cx) => view.setTool("hand", cx),
                onSearch: (cx) => view.openMenu({ kind: "find", at: { x: scene.viewport.width / 2 - MENU_W / 2, y: scene.viewport.height - 370 } }, cx),
                onAdd: (cx) => view.openMenu({ kind: "add", fromBar: true, at: { x: scene.viewport.width / 2 - MENU_W / 2, y: scene.viewport.height - 320 } }, cx),
              },
              t,
            ),
          ),
      ),
  ];
  if (view.showMap && scene.box) {
    const map = minimapOf(scene.box, scene.viewport, scene.camera);
    items.push(div().id("workflows-map").absolute().left(16).bottom(58).child(minimap("workflows-minimap", { blocks: mapBlocks(view, scene, map, t), view: map.view, onClick: (event, cx) => view.mapClick(event, map, cx) }, t)));
  }
  if (view.refusal) items.push(div().id("workflows-refusal").absolute().left(view.refusal.at.x + 14).top(view.refusal.at.y + 10).child(refusal(view.refusal.text, t)));
  return items;
}

export function noticesLayer(view, scene, t) {
  const notes = [];
  if (scene.problems.length) notes.push({ id: "problems", color: t.blocked, text: scene.problems[0] + (scene.problems.length > 1 ? `  (+${scene.problems.length - 1} more)` : "") });
  for (const [index, warning] of scene.warnings.entries()) notes.push({ id: `warning-${index}`, color: t.working, text: warning });
  if (view.doc?.conflict) {
    notes.push({
      id: "conflict",
      color: t.working,
      text: "The file changed outside while you were editing.",
      actions: [button("workflows-keep-mine", { label: "Keep mine", size: "sm", onClick: (cx) => view.keepMine(cx) }, t), button("workflows-take-file", { label: "Take the file's", size: "sm", onClick: (cx) => view.takeFile(cx) }, t)],
    });
  }
  if (view.saveError) notes.push({ id: "save", color: t.blocked, text: view.saveError });
  if (!notes.length) return null;
  return v_flex()
    .id("workflows-notices")
    .absolute()
    .left(16)
    .top(12)
    .max_w(560)
    .gap(6)
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .children(
      notes.map((note) =>
        h_flex()
          .id(`workflows-note-${note.id}`)
          .gap(8)
          .px(10)
          .py(6)
          .items_center()
          .rounded(8)
          .bg(t.raised)
          .border_1()
          .border_color(note.color + "66")
          .child(icon("exclamation", { size: 12, color: note.color }))
          .child(div().min_w(0).flex_1().text_size(TEXT.base).text_color(note.color).child(note.text))
          .children(note.actions ?? []),
      ),
    );
}

export function drawerLayer(view, scene, t) {
  if (!view.selection().drawer) return null;
  const rows = scene.runs.map((one) => {
    const status = view.statusOf(one, scene);
    const look = RUN_LOOK[status] ?? RUN_LOOK.running;
    return taskRow(`workflows-run-${one.id}`, { ring: toneColor(look.tone, t), title: `#${one.number} · ${look.label}`, code: view.spaceName(one.space), meta: runLine(one, status, scene.now), hovered: one.id === scene.run?.id, onClick: () => view.chooseRun(one.id) }, t);
  });
  return card(v_flex().id("workflows-drawer").absolute().top(12).right(12).bottom(12).w(300), t)
    .rounded(14)
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_scroll_wheel((_e, cx) => cx.stop_propagation())
    .child(
      h_flex()
        .h(40)
        .flex_none()
        .pl(14)
        .pr(8)
        .gap(8)
        .items_center()
        .child(icon("activity", { size: 14, color: t.muted }))
        .child(div().text_size(TEXT.xl).font_medium().text_color(t.muted).child("Runs"))
        .child(div().text_size(TEXT.base).text_color(t.dim).child(String(scene.runs.length)))
        .child(div().flex_1())
        .child(iconButton("workflows-drawer-close", { icon: "x", tooltip: "Close", size: "sm", onClick: () => view.toggleDrawer() }, t)),
    )
    .child(
      v_flex()
        .id("workflows-drawer-rows")
        .flex_1()
        .min_h(0)
        .px(6)
        .pb(6)
        .gap(1)
        .overflow_y_scrollbar()
        .when(!rows.length, (el) => el.child(emptyState({ icon: "play", title: "No runs yet", detail: "Run workflow starts one in a new tab of a space." }, t)))
        .children(rows),
    );
}
