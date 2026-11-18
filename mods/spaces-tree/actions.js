import { spaces, openOverlay, shared, setShared, props } from "herdr";
import { accepts, DRAG_GRACE, dropTarget } from "./tree.js";
import { canMoveFolder, fileUnit, folderOf, moveFolder, toggleFolder, togglePin } from "./folders.js";
import { FOLDER_MENU, movePopupHeight, readPinned, readState, saveState } from "./popups.js";

export const DRAG = "move-tab.drag";
const REQUEST = "move-tab.request";

export const withActions = (Base) =>
  class extends Base {
    endDrag() {
      if (shared(DRAG) != null) setShared(DRAG, null);
    }

    forgetOldDrag() {
      const drag = shared(DRAG);
      if (drag != null && !(Date.now() - drag.at <= DRAG_GRACE)) setShared(DRAG, null);
    }

    dropFor(entry, row) {
      return dropTarget(entry, row, row.space ? this.looks[this.lastPlaces[row.space.id]] : null);
    }

    taking(target, row) {
      const drag = shared(DRAG);
      const source = typeof drag?.space === "string" ? (this.looks[this.lastPlaces[drag.space]]?.common ?? null) : null;
      return accepts(drag, target, row, source, Date.now()) ? drag : null;
    }

    dropping(target, row) {
      return this.dropOver === row.key && Boolean(this.taking(target, row));
    }

    hinting(target, row) {
      return shared(DRAG)?.moving === true && Boolean(this.taking(target, row));
    }

    dragOver(target, row, on, cx) {
      const over = on && this.taking(target, row) ? row.key : this.dropOver === row.key ? null : this.dropOver;
      if (over === this.dropOver) return;
      this.dropOver = over;
      cx.notify();
    }

    drop(target, row) {
      const lit = this.dropOver === row.key;
      const drag = this.taking(target, row);
      this.dropOver = null;
      if (!lit || !drag) return false;
      const time = Date.now();
      setShared(REQUEST, { id: String(time), tab: drag.tab, space: drag.space, to: target.path, toSpace: row.space?.id ?? null, at: time });
      setShared(DRAG, null);
      return true;
    }

    pointer(el, row, target, t, events = {}) {
      return el
        .when(this.dropping(target, row), (el) => el.border_1().border_color(t.accent))
        .when(!this.dropping(target, row) && this.hinting(target, row), (el) => el.border_1().border_dashed().border_color(t.accent))
        .on_hover((on, cx) => {
          events.hover?.(on, cx);
          this.dragOver(target, row, on, cx);
        })
        .on_mouse_move((_e, cx) => {
          events.move?.(cx);
          this.dragOver(target, row, true, cx);
        })
        .on_mouse_down("left", () => {
          this.endDrag();
          events.down?.();
        })
        .on_mouse_up("left", (_e, cx) => {
          if (this.drop(target, row)) cx.notify();
          else events.up?.(cx);
        });
    }

    pinned(key) {
      return readPinned().includes(key);
    }

    menu(space, entry) {
      const state = readState();
      const pins = readPinned();
      const name = entry.kind === "repo" ? entry.main.name : entry.row.name;
      const height = movePopupHeight(state.folders.length, folderOf(state, entry.key) != null);
      const folder = { unit: entry.key, name, height, pinned: pins.includes(entry.key), pins: togglePin(pins, entry.key) };
      openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: space.id }, folder } });
    }

    folderMenu(folder) {
      openOverlay({ mod: "spaces-tree", kind: "popup", width: FOLDER_MENU.width, height: FOLDER_MENU.height, props: { role: "folder", folder: folder.id } });
    }

    toggleFolder(id) {
      const state = readState();
      saveState(state, toggleFolder(state, id));
    }

    dropOnEntry(entry) {
      const unit = this.dragUnit;
      if (!unit || unit === entry.key || this.pinned(unit) || this.pinned(entry.key)) return;
      const state = readState();
      const into = folderOf(state, entry.key);
      if (folderOf(state, unit) !== into) saveState(state, fileUnit(state, unit, into));
    }

    dropOnFolder(folder) {
      const unit = this.dragUnit;
      const lit = this.overFolder === folder.id;
      this.dragUnit = null;
      this.overFolder = null;
      this.pressed = null;
      this.over = null;
      if (!unit || !lit || this.pinned(unit)) return false;
      const state = readState();
      if (folderOf(state, unit) !== folder.id) saveState(state, fileUnit(state, unit, folder.id));
      return true;
    }

    overFolderRow(folder, on, cx) {
      const over = on && this.dragUnit != null && !this.pinned(this.dragUnit) ? folder.id : this.overFolder === folder.id ? null : this.overFolder;
      if (over === this.overFolder) return;
      this.overFolder = over;
      if (over) this.over = null;
      cx.notify();
    }

    pressFolder(folder) {
      this.movingFolder = folder.id;
      this.overMove = folder.id;
    }

    overFolderMove(folder, cx) {
      if (this.movingFolder == null) return;
      const over = this.movingFolder === folder.id || canMoveFolder(readState(), this.movingFolder, folder.id) ? folder.id : null;
      if (over === this.overMove) return;
      this.overMove = over;
      cx.notify();
    }

    leaveFolder(folder, cx) {
      if (this.overMove !== folder.id) return;
      this.overMove = null;
      cx.notify();
    }

    landFolder() {
      const from = this.movingFolder;
      const to = this.overMove;
      this.movingFolder = null;
      this.overMove = null;
      if (from == null || to == null || from === to) return;
      const state = readState();
      saveState(state, moveFolder(state, from, to));
    }

    foldOnRelease(folder) {
      if (this.movingFolder !== folder.id || this.overMove !== folder.id) return false;
      this.movingFolder = null;
      this.overMove = null;
      this.toggleFolder(folder.id);
      return true;
    }

    newWorktree(entry) {
      const props = entry.main.space ? { space: entry.main.space.id, action: "new" } : { folder: entry.main.path, action: "new" };
      openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props });
    }

    toggleFold(key) {
      const folded = this.folded();
      if (!folded.delete(key)) folded.add(key);
      setShared("spaces.folded", [...folded]);
    }

    hover(key, on, cx) {
      if (on) this.hovered = key;
      else if (this.hovered === key) this.hovered = null;
      cx.notify();
    }

    hoverKid(key, on, cx) {
      if (on) this.kidHover = key;
      else if (this.kidHover === key) this.kidHover = null;
      cx.notify();
    }
  };
