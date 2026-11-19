import { clamp, HEIGHT, WIDTH } from './chart';
import type { Point } from './types';

export type Guides = Partial<Point>;
export interface SnapTargets { x: number[]; y: number[] }
type Limits = Record<keyof Point, [number, number]>;
const PAPER_LIMITS: Limits = { x: [0, WIDTH], y: [0, HEIGHT] };

export function arrowOffset(key: string, accelerated: boolean): Point | null {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!direction) return null;
  const step = accelerated ? 10 : 1;
  return { x: direction[0] * step, y: direction[1] * step };
}

function nearest(
  anchors: number[], targets: number[], tolerance: number, min = -Infinity, max = Infinity,
) {
  let delta = 0;
  let guide: number | undefined;
  let distance = tolerance;
  for (const target of targets) {
    for (const anchor of anchors) {
      const offset = target - anchor;
      if (Math.abs(offset) > distance || offset < min || offset > max) continue;
      distance = Math.abs(offset);
      delta = offset;
      guide = target;
    }
  }
  return { delta, guide };
}

export function snapPoint(point: Point, targets: SnapTargets, tolerance: number, limits = PAPER_LIMITS) {
  const x = nearest([point.x], targets.x, tolerance, limits.x[0] - point.x, limits.x[1] - point.x);
  const y = nearest([point.y], targets.y, tolerance, limits.y[0] - point.y, limits.y[1] - point.y);
  return {
    point: { x: clamp(point.x + x.delta, ...limits.x), y: clamp(point.y + y.delta, ...limits.y) },
    guides: { x: x.guide, y: y.guide },
  };
}

export function snapEndpoint(fixed: Point, pointer: Point, targets: SnapTargets, tolerance: number, shift: boolean) {
  const dx = pointer.x - fixed.x;
  const dy = pointer.y - fixed.y;
  if (shift && (dx || dy)) {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const unitX = Math.round(Math.cos(angle * Math.PI / 4));
    const unitY = Math.round(Math.sin(angle * Math.PI / 4));
    if (unitX && unitY) {
      const distance = Math.min((Math.abs(dx) + Math.abs(dy)) / 2,
        unitX > 0 ? WIDTH - fixed.x : fixed.x, unitY > 0 ? HEIGHT - fixed.y : fixed.y);
      return { point: { x: fixed.x + unitX * distance, y: fixed.y + unitY * distance }, guides: {} };
    }
    return snapEndpoint(fixed, {
      x: unitX ? pointer.x : fixed.x, y: unitY ? pointer.y : fixed.y,
    }, targets, tolerance, false);
  }

  const lockY = dx !== 0 && Math.abs(dy) <= Math.min(tolerance * 1.5, Math.abs(dx) * 0.16);
  const lockX = !lockY && dy !== 0 && Math.abs(dx) <= Math.min(tolerance, Math.abs(dy) * 0.16);
  const snapped = snapPoint(pointer, targets, tolerance);
  if (lockY) {
    snapped.point.y = fixed.y;
    snapped.guides.y = fixed.y;
  } else if (lockX) {
    snapped.point.x = fixed.x;
    snapped.guides.x = fixed.x;
  }
  return snapped;
}

export function translateLine(points: Point[], offset: Point, targets: SnapTargets, tolerance: number) {
  const move = (axis: keyof Point, limit: number) => {
    let a = Infinity;
    let b = -Infinity;
    for (const point of points) {
      a = Math.min(a, point[axis]);
      b = Math.max(b, point[axis]);
    }
    const min = -Math.min(a, b);
    const max = limit - Math.max(a, b);
    const delta = clamp(offset[axis], min, max);
    const snapped = nearest([a + delta, b + delta, (a + b) / 2 + delta], targets[axis], tolerance, min - delta, max - delta);
    return { delta: delta + snapped.delta, guide: snapped.guide };
  };
  const x = move('x', WIDTH);
  const y = move('y', HEIGHT);
  return {
    points: points.map(point => ({ x: point.x + x.delta, y: point.y + y.delta })),
    guides: { x: x.guide, y: y.guide },
  };
}

export const NO_TARGETS: SnapTargets = { x: [], y: [] };
