import type { ArrowPlacement, LineKind, Point } from '../types';

function StyledLine({ start, end, kind, color, width, arrows = 'end' }: {
  start: Point; end: Point; kind: LineKind; color: string; width: number; arrows?: ArrowPlacement;
}) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const drawArrows = kind === 'arrow' && distance >= 3;

  function arrow(tip: Point, other: Point) {
    const head = Math.min(distance * (arrows === 'both' ? 0.45 : 0.65), Math.max(8, width * 3.6));
    const ux = (tip.x - other.x) / distance;
    const uy = (tip.y - other.y) / distance;
    const baseX = tip.x - ux * head;
    const baseY = tip.y - uy * head;
    const wing = head * 0.47;
    return `M ${baseX - uy * wing} ${baseY + ux * wing} L ${tip.x} ${tip.y} L ${baseX + uy * wing} ${baseY - ux * wing}`;
  }

  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
        strokeDasharray={kind === 'dashed' ? `${Math.max(5, width * 2.5)} ${Math.max(4, width * 1.8)}` : undefined} />
      {drawArrows && arrows !== 'start' && <path d={arrow(end, start)} />}
      {drawArrows && arrows !== 'end' && <path d={arrow(start, end)} />}
    </g>
  );
}

export default StyledLine;
