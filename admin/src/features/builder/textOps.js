import { uid } from '@shared/engine/defaults.js';

/** Mutating helpers for an array of text elements (call inside immer recipes). */
export const textOps = {
  patch(list, id, patch) {
    const t = list.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  },
  /** Pass `newId` from outside the recipe so it is stable if the recipe runs twice. */
  duplicate(list, id, newId = uid('txt')) {
    const t = list.find((x) => x.id === id);
    if (!t) return null;
    const copy = { ...JSON.parse(JSON.stringify(t)), id: newId, positionX: t.positionX + 0.02, positionY: t.positionY + 0.03 };
    copy.zIndex = Math.max(0, ...list.map((x) => x.zIndex ?? 1)) + 1;
    list.push(copy);
    return copy.id;
  },
  remove(list, id) {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list.splice(i, 1);
  },
  /** Move one layer up/down by swapping zIndex with its neighbour in stacking order. */
  layer(list, id, dir) {
    const sorted = [...list].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
    sorted.forEach((t, i) => { t.zIndex = i + 1; });
    const i = sorted.findIndex((x) => x.id === id);
    const j = dir === 'up' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    [sorted[i].zIndex, sorted[j].zIndex] = [sorted[j].zIndex, sorted[i].zIndex];
  },
  nextZ(list) {
    return Math.max(0, ...list.map((x) => x.zIndex ?? 1)) + 1;
  },
};
