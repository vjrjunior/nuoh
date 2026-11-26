import { PALETTE } from "../../lib/space-colors.js";
import { holdsActive, leastUsed, mostUrgent, rowsOf } from "./tree.js";

const NEEDS = new Set(["blocked", "done"]);

export function readFolders(value) {
  const folders = [];
  for (const folder of Array.isArray(value?.folders) ? value.folders : []) {
    if (typeof folder?.id !== "string" || !folder.id || typeof folder.name !== "string") continue;
    if (folders.some((known) => known.id === folder.id)) continue;
    folders.push({ id: folder.id, name: folder.name, color: PALETTE.includes(folder.color) ? folder.color : PALETTE[0], folded: folder.folded === true, pinned: folder.pinned === true });
  }
  const ids = new Set(folders.map((folder) => folder.id));
  const given = value?.members && typeof value.members === "object" && !Array.isArray(value.members) ? value.members : {};
  const members = Object.fromEntries(Object.entries(given).filter(([, id]) => typeof id === "string" && ids.has(id)));
  return { folders, members };
}

export function readPins(value) {
  return Array.isArray(value) ? [...new Set(value.filter((key) => typeof key === "string" && key))] : [];
}

export function togglePin(pins, key) {
  return pins.includes(key) ? pins.filter((known) => known !== key) : [...pins, key];
}

export function folderOrder(state) {
  return [...state.folders.filter((folder) => folder.pinned), ...state.folders.filter((folder) => !folder.pinned)];
}

export function arrange(entries, state, pins = []) {
  const held = new Set(pins);
  const inside = new Map(state.folders.map((folder) => [folder.id, []]));
  const pinned = [];
  const loose = [];
  for (const entry of entries) {
    const holder = inside.get(state.members[entry.key]);
    if (held.has(entry.key)) pinned.push(entry);
    else if (holder) holder.push(entry);
    else loose.push(entry);
  }
  return { pinned, folders: folderOrder(state).map((folder) => ({ folder, entries: inside.get(folder.id) })), loose };
}

export function folderOf(state, unit) {
  const id = state.members[unit];
  return state.folders.some((folder) => folder.id === id) ? id : null;
}

export function fileUnit(state, unit, folderId) {
  const members = { ...state.members };
  if (folderId && state.folders.some((folder) => folder.id === folderId)) members[unit] = folderId;
  else delete members[unit];
  return { ...state, members };
}

export function newFolderId(time) {
  return `f${time.toString(36)}`;
}

export function nextColor(state) {
  return leastUsed(state.folders.map((folder) => folder.color));
}

export function createFolder(state, { id, name, color, unit }) {
  const folders = [...state.folders, { id, name: name.trim(), color: PALETTE.includes(color) ? color : nextColor(state), folded: false, pinned: false }];
  return { folders, members: unit ? { ...state.members, [unit]: id } : state.members };
}

function change(state, id, edit) {
  return { ...state, folders: state.folders.map((folder) => (folder.id === id ? { ...folder, ...edit } : folder)) };
}

export function renameFolder(state, id, name) {
  const trimmed = name.trim();
  return trimmed ? change(state, id, { name: trimmed }) : state;
}

export function recolorFolder(state, id, color) {
  return PALETTE.includes(color) ? change(state, id, { color }) : state;
}

export function toggleFolder(state, id) {
  const folder = state.folders.find((known) => known.id === id);
  return folder ? change(state, id, { folded: !folder.folded }) : state;
}

export function pinFolder(state, id) {
  const folder = state.folders.find((known) => known.id === id);
  return folder ? change(state, id, { pinned: !folder.pinned }) : state;
}

export function canMoveFolder(state, from, to) {
  const source = state.folders.find((folder) => folder.id === from);
  const target = state.folders.find((folder) => folder.id === to);
  return Boolean(source && target && from !== to && source.pinned === target.pinned);
}

export function moveFolder(state, from, to) {
  if (!canMoveFolder(state, from, to)) return state;
  const folders = [...state.folders];
  const at = folders.findIndex((folder) => folder.id === to);
  folders.splice(at, 0, ...folders.splice(folders.findIndex((folder) => folder.id === from), 1));
  return { ...state, folders };
}

export function deleteFolder(state, id) {
  return {
    folders: state.folders.filter((folder) => folder.id !== id),
    members: Object.fromEntries(Object.entries(state.members).filter(([, owner]) => owner !== id)),
  };
}

export function revealFor(state, unit, pins = []) {
  if (pins.includes(unit)) return state;
  const id = folderOf(state, unit);
  const folder = state.folders.find((known) => known.id === id);
  return folder?.folded ? change(state, id, { folded: false }) : state;
}

export function entryOfSpace(entries, spaceId) {
  return entries.find((entry) => rowsOf(entry).some((row) => row.space?.id === spaceId)) ?? null;
}

export function activeChild({ pinned = [], folders, loose }, narrow) {
  if (!narrow) {
    const top = pinned.findIndex(holdsActive);
    if (top >= 0) return { at: top, folded: false };
    const card = folders.findIndex(({ entries }) => entries.some(holdsActive));
    if (card >= 0) return { at: pinned.length + card, folded: folders[card].folder.folded };
    const free = loose.findIndex(holdsActive);
    return { at: free < 0 ? -1 : pinned.length + folders.length + free, folded: false };
  }
  const spacesOf = (entries) => entries.flatMap(rowsOf).filter((row) => row.space);
  const top = spacesOf(pinned);
  const first = top.findIndex((row) => row.space.active);
  if (first >= 0) return { at: first, folded: false };
  let at = top.length;
  for (const { folder, entries } of folders) {
    const inside = spacesOf(entries).findIndex((row) => row.space.active);
    if (inside >= 0) return { at: folder.folded ? at : at + 1 + inside, folded: folder.folded };
    at += 1 + (folder.folded ? 0 : spacesOf(entries).length);
  }
  const free = spacesOf(loose).findIndex((row) => row.space.active);
  return { at: free < 0 ? -1 : at + free, folded: false };
}

export function folderTail(entries, agents) {
  const rows = entries.flatMap(rowsOf);
  const ids = new Set(rows.map((row) => row.space?.id).filter(Boolean));
  const needs = agents.filter((agent) => ids.has(agent.space) && NEEDS.has(agent.status)).length;
  return { needs, status: mostUrgent(rows.map((row) => row.status)) };
}
