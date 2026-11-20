import { useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export default function CanvasViewport({ viewportRef, zoom, fitWidth, panMode, children }: {
  viewportRef: RefObject<HTMLDivElement>; zoom: number; fitWidth: boolean; panMode: boolean; children: ReactNode;
}) {
  const drag = useRef<{ x: number; y: number; left: number; top: number }>(null);

  return <div ref={viewportRef} className="desk" data-zoomed={zoom > 100 || undefined}
    data-fit-width={fitWidth || undefined} data-pan-mode={panMode || undefined}
    style={{ '--paper-zoom': zoom / 100 } as CSSProperties}
    role={panMode ? 'group' : undefined} aria-label={panMode ? '画布视图' : undefined}
    aria-describedby={panMode ? 'canvas-tool-hint' : undefined} tabIndex={panMode ? 0 : undefined}
    onPointerDown={panMode ? event => {
      if (!event.isPrimary || event.button !== 0 || event.pointerType === 'touch') return;
      if ((event.target as Element).closest('button, input, textarea, select, a')) return;
      const viewport = event.currentTarget;
      drag.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
      viewport.focus({ preventScroll: true });
    } : undefined}
    onPointerMove={panMode ? event => {
      const viewport = event.currentTarget;
      const start = drag.current;
      if (!start || !viewport.hasPointerCapture(event.pointerId)) return;
      viewport.scrollTo(start.left + start.x - event.clientX, start.top + start.y - event.clientY);
    } : undefined}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={panMode ? event => {
      const direction = DIRECTIONS[event.key];
      if (!direction || event.target !== event.currentTarget) return;
      event.preventDefault();
      const step = event.shiftKey ? 180 : 48;
      event.currentTarget.scrollBy(direction[0] * step, direction[1] * step);
    } : undefined}>
    {children}
  </div>;
}
