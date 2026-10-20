// Split-pane layouts: a tree of rows/columns whose leaves are terminal tab ids.

import type { PaneNode, SplitDir } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function leaf(id: string): PaneNode {
  return { type: 'leaf', id };
}

export function leafIds(node: PaneNode | undefined): string[] {
  if (!node) return [];
  if (node.type === 'leaf') return [node.id];
  return node.children.flatMap(leafIds);
}

/**
 * Splits the pane `target` and puts `newId` to its right ('row') or below it
 * ('col'), or to its left / above it with `before`.
 */
export function splitLeaf(node: PaneNode, target: string, newId: string, dir: SplitDir, before = false): PaneNode {
  if (node.type === 'leaf') {
    if (node.id !== target) return node;
    return { type: 'split', dir, children: before ? [leaf(newId), node] : [node, leaf(newId)], sizes: [0.5, 0.5] };
  }
  const idx = node.children.findIndex((c) => c.type === 'leaf' && c.id === target);
  if (idx !== -1 && node.dir === dir) {
    // same direction: add a sibling and share the target's space with it
    const children = [...node.children];
    children.splice(before ? idx : idx + 1, 0, leaf(newId));
    const sizes = [...node.sizes];
    const half = sizes[idx] / 2;
    sizes.splice(idx, 1, half, half);
    return { ...node, children, sizes };
  }
  return { ...node, children: node.children.map((c) => splitLeaf(c, target, newId, dir, before)) };
}

/** Removes a pane; a split left with one child collapses into it. */
export function removeLeaf(node: PaneNode, id: string): PaneNode | null {
  if (node.type === 'leaf') return node.id === id ? null : node;
  const kept: { child: PaneNode; size: number }[] = [];
  node.children.forEach((c, i) => {
    const next = removeLeaf(c, id);
    if (next) kept.push({ child: next, size: node.sizes[i] });
  });
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0].child;
  const total = kept.reduce((a, k) => a + k.size, 0) || 1;
  return { ...node, children: kept.map((k) => k.child), sizes: kept.map((k) => k.size / total) };
}

/** Fractional rectangles (0..1) of every pane. */
export function paneRects(node: PaneNode, r: Rect = { x: 0, y: 0, w: 1, h: 1 }): Record<string, Rect> {
  if (node.type === 'leaf') return { [node.id]: r };
  const out: Record<string, Rect> = {};
  let offset = 0;
  node.children.forEach((c, i) => {
    const size = node.sizes[i];
    const sub =
      node.dir === 'row'
        ? { x: r.x + offset * r.w, y: r.y, w: size * r.w, h: r.h }
        : { x: r.x, y: r.y + offset * r.h, w: r.w, h: size * r.h };
    offset += size;
    Object.assign(out, paneRects(c, sub));
  });
  return out;
}

export interface Divider {
  /** path of child indexes from the root to the split node */
  path: number[];
  /** the divider sits after child `index` */
  index: number;
  dir: SplitDir;
  /** the split node's rectangle */
  area: Rect;
  /** position of the divider (fraction of the split node) */
  at: number;
}

export function dividers(node: PaneNode, r: Rect = { x: 0, y: 0, w: 1, h: 1 }, path: number[] = []): Divider[] {
  if (node.type === 'leaf') return [];
  const out: Divider[] = [];
  let offset = 0;
  node.children.forEach((c, i) => {
    const size = node.sizes[i];
    const sub =
      node.dir === 'row'
        ? { x: r.x + offset * r.w, y: r.y, w: size * r.w, h: r.h }
        : { x: r.x, y: r.y + offset * r.h, w: r.w, h: size * r.h };
    offset += size;
    if (i < node.children.length - 1) out.push({ path, index: i, dir: node.dir, area: r, at: offset });
    out.push(...dividers(c, sub, [...path, i]));
  });
  return out;
}

/** Moves the divider after child `index` of the split at `path` to `at` (fraction of that split). */
export function resizeAt(node: PaneNode, path: number[], index: number, at: number, min = 0.08): PaneNode {
  if (node.type === 'leaf') return node;
  if (path.length) {
    const [head, ...rest] = path;
    return { ...node, children: node.children.map((c, i) => (i === head ? resizeAt(c, rest, index, at, min) : c)) };
  }
  const sizes = [...node.sizes];
  const before = sizes.slice(0, index).reduce((a, b) => a + b, 0);
  const pair = sizes[index] + sizes[index + 1];
  const first = Math.min(pair - min, Math.max(min, at - before));
  sizes[index] = first;
  sizes[index + 1] = pair - first;
  return { ...node, sizes };
}

/** The pane next to `id` in a direction, by geometry. */
export function neighbor(node: PaneNode, id: string, dir: 'left' | 'right' | 'up' | 'down'): string | null {
  const rects = paneRects(node);
  const cur = rects[id];
  if (!cur) return null;
  const eps = 0.001;
  let best: { id: string; dist: number } | null = null;
  for (const [other, r] of Object.entries(rects)) {
    if (other === id) continue;
    let ok = false;
    let dist = 0;
    if (dir === 'left' || dir === 'right') {
      const overlap = Math.min(cur.y + cur.h, r.y + r.h) - Math.max(cur.y, r.y);
      ok = overlap > eps && (dir === 'left' ? r.x + r.w <= cur.x + eps : r.x >= cur.x + cur.w - eps);
      dist = dir === 'left' ? cur.x - (r.x + r.w) : r.x - (cur.x + cur.w);
      dist += Math.abs(r.y + r.h / 2 - (cur.y + cur.h / 2)) * 0.01;
    } else {
      const overlap = Math.min(cur.x + cur.w, r.x + r.w) - Math.max(cur.x, r.x);
      ok = overlap > eps && (dir === 'up' ? r.y + r.h <= cur.y + eps : r.y >= cur.y + cur.h - eps);
      dist = dir === 'up' ? cur.y - (r.y + r.h) : r.y - (cur.y + cur.h);
      dist += Math.abs(r.x + r.w / 2 - (cur.x + cur.w / 2)) * 0.01;
    }
    if (ok && (!best || dist < best.dist)) best = { id: other, dist };
  }
  return best ? best.id : null;
}

/** Gives every split equal sizes again. */
export function equalize(node: PaneNode): PaneNode {
  if (node.type === 'leaf') return node;
  return { ...node, sizes: node.children.map(() => 1 / node.children.length), children: node.children.map(equalize) };
}
