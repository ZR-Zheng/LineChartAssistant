import { arrowheadLength } from '../chart';
import type { ArrowPlacement, AxisArrowhead, LineKind, Point } from '../types';

function StyledLine({ start, end, kind, color, width, arrows = 'end', arrowhead = 'open' }: {
  start: Point; end: Point; kind: LineKind; color: string; width: number; arrows?: ArrowPlacement; arrowhead?: AxisArrowhead;
}) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const drawArrows = kind === 'arrow' && distance >= 3;

  function arrow(tip: Point, other: Point) {
    const head = Math.min(distance * (arrows === 'both' ? 0.45 : 0.65), arrowheadLength(width));
    const ux = (tip.x - other.x) / distance;
    const uy = (tip.y - other.y) / distance;
    const baseX = tip.x - ux * head;
    const baseY = tip.y - uy * head;
    const wing = head * 0.47;
    const path = `M ${baseX - uy * wing} ${baseY + ux * wing} L ${tip.x} ${tip.y} L ${baseX + uy * wing} ${baseY - ux * wing}`;
    const fill = arrowhead === 'outline' ? '#fff' : arrowhead === 'filled' ? color : undefined;
    return <path d={fill ? `${path} Z` : path} fill={fill} data-arrowhead={arrowhead} />;
  }

  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
        strokeDasharray={kind === 'dashed' ? `${Math.max(5, width * 2.5)} ${Math.max(4, width * 1.8)}` : undefined} />
      {drawArrows && arrows !== 'start' && arrow(end, start)}
      {drawArrows && arrows !== 'end' && arrow(start, end)}
    </g>
  );
}

export default StyledLine;
