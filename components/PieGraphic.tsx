import type { ReactNode } from 'react';
import { clamp, estimateTextWidth, formatShare, formatValue, HEIGHT, isLightColor, pieColor, TEXT_FONTS, WIDTH } from '../chart';
import { arrowOffset } from '../alignment';
import { movePie, pieLayout, resetPieLegend } from '../pieLayout';
import type { ChartDocument, ChartEdit, Datum, Point, Selection } from '../types';

const TURN = Math.PI * 2;

function sectorPath(center: Point, radius: number, inner: number, start: number, end: number, clockwise: boolean, at: (theta: number, radius: number) => Point) {
  const sweep = clockwise ? 1 : 0;
  if (end - start >= TURN - 1e-12) {
    const circle = (r: number) => `M ${center.x} ${center.y - r} a ${r} ${r} 0 1 ${sweep} 0 ${r * 2} a ${r} ${r} 0 1 ${sweep} 0 ${-r * 2} Z`;
    return inner ? `${circle(radius)} ${circle(inner)}` : circle(radius);
  }
  const first = at(start, radius);
  const last = at(end, radius);
  const flag = end - start > Math.PI ? 1 : 0;
  const outer = `M ${first.x} ${first.y} A ${radius} ${radius} 0 ${flag} ${sweep} ${last.x} ${last.y}`;
  if (!inner) return `${outer} L ${center.x} ${center.y} Z`;
  const insideLast = at(end, inner);
  const insideFirst = at(start, inner);
  return `${outer} L ${insideLast.x} ${insideLast.y} A ${inner} ${inner} 0 ${flag} ${1 - sweep} ${insideFirst.x} ${insideFirst.y} Z`;
}

function labelDistance(direction: Point, halfAngle: number, preferred: number, outer: number, inner: number, width: number, height: number) {
  let minimum = 0;
  let maximum = outer;
  for (const x of [-width / 2, width / 2]) {
    for (const y of [-height / 2, height / 2]) {
      const radial = direction.x * x + direction.y * y;
      const across = Math.abs(direction.x * y - direction.y * x);
      if (across >= outer) return null;
      maximum = Math.min(maximum, Math.sqrt(outer ** 2 - across ** 2) - radial);
      if (halfAngle < Math.PI / 2) minimum = Math.max(minimum, across / Math.tan(halfAngle) - radial);
    }
  }
  if (maximum < minimum) return null;
  const distance = clamp(preferred, minimum, maximum);
  const nearest = (r: number) => Math.hypot(Math.max(0, Math.abs(direction.x * r) - width / 2), Math.max(0, Math.abs(direction.y * r) - height / 2));
  if (!inner || nearest(distance) >= inner) return distance;
  if (nearest(maximum) < inner) return null;
  let start = distance;
  let end = maximum;
  for (let i = 0; i < 12; i++) {
    const middle = (start + end) / 2;
    if (nearest(middle) < inner) start = middle;
    else end = middle;
  }
  return end;
}

interface Props {
  chart: ChartDocument;
  layout: ReturnType<typeof pieLayout>;
  selection: Selection | null;
  editable: boolean;
  onEdit?: ChartEdit;
  onSelect?: (selection: Selection | null) => void;
  renderDatum: (datum: Datum, value: number, children: ReactNode, share?: string) => ReactNode;
}

export default function PieGraphic({ chart, layout, selection, editable, onEdit, onSelect, renderDatum }: Props) {
  const { style, slices, center, showLabels, showLegend, legend } = layout;
  const seriesIndex = chart.pieSeries ?? 0;
  if (!slices.length) return <text x={WIDTH / 2} y={264} textAnchor="middle" fill="#55637c" fontSize="17" data-editor-only="">
    在数据表中输入正数，生成扇形图
  </text>;

  const { radius, startAngle, holeRatio, clockwise, labelFontSize, labelMode, legendFontSize, legendMarkerSize } = style;
  const inner = radius * holeRatio;
  const rotation = startAngle / 180 * Math.PI;
  const at = (theta: number, distance: number) => {
    const angle = rotation + (clockwise ? theta : -theta);
    return { x: center.x + Math.sin(angle) * distance, y: center.y - Math.cos(angle) * distance };
  };

  const { height: legendHeight, width: legendWidth, position: legendPosition, labelX, rowHeight, rows, remaining, summary } = legend;
  const legendSelected = selection?.kind === 'pie-legend';

  return (
    <g data-pie="">
      {slices.map(({ index, start, end, share, value }) => {
        if (end <= start) return null;
        const color = pieColor(chart, index);
        const percentage = formatShare(share, style.percentageDigits);
        const arc = sectorPath(center, radius, inner, start, end, clockwise, at);
        const selected = selection?.kind === 'data' && selection.datum.index === index && selection.datum.series === seriesIndex;
        const both = labelMode === 'both';
        const number = formatValue(value);
        const firstLine = labelMode === 'value' ? number : percentage;
        const lineHeight = labelFontSize + 2;
        const middle = (start + end) / 2;
        const unit = at(middle, 1);
        const direction = { x: unit.x - center.x, y: unit.y - center.y };
        const preferred = inner + (radius - inner) * (style.labelPlacement === 'rim' ? 0.78 : holeRatio ? 0.5 : 0.66);
        const padding = style.separatorWidth / 2 + 3;
        const width = estimateTextWidth(both && number.length > firstLine.length ? number : firstLine, labelFontSize) + 2;
        const distance = end - start >= TURN - 1e-12 && !inner ? 0
          : labelDistance(direction, (end - start) / 2, preferred, radius - padding, inner ? inner + padding : 0, width, lineHeight * (both ? 2 : 1));
        const spot = distance === null ? null : at(middle, distance);
        return renderDatum({ series: seriesIndex, index }, value, <>
          <path d={arc} fill={color} fillRule="evenodd" stroke={style.separatorColor} strokeWidth={style.separatorWidth} data-sector="" />
          {selected && <path d={arc} fill="none" stroke="#243869" strokeWidth="3" pointerEvents="none" data-editor-only="" />}
          {showLabels && spot && <text x={spot.x} y={spot.y - (both ? lineHeight / 2 : 0)}
            textAnchor="middle" dominantBaseline="central" pointerEvents="none" fill={style.labelColor ?? (isLightColor(color) ? '#26334c' : '#fff')}
            fontSize={labelFontSize} fontFamily={TEXT_FONTS[style.labelFont].family} fontWeight="650">
            {firstLine}{both && <tspan x={spot.x} dy={lineHeight}>{number}</tspan>}
          </text>}
        </>, percentage);
      })}
      {editable && <g data-pie-move="" data-editor-only="" transform={`translate(${center.x} ${center.y})`}
        role="group" tabIndex={0} aria-label="移动扇形图" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
        onFocus={() => onSelect(null)} onKeyDown={event => {
          const offset = arrowOffset(event.key, event.shiftKey);
          if (!offset) return;
          event.preventDefault();
          onEdit(current => {
            const { center } = pieLayout(current);
            return movePie(current, { x: center.x + offset.x, y: center.y + offset.y });
          });
        }}>
        <title>拖动中心手柄移动扇形图</title>
        <circle r="8" className="axis-handle" />
        <path d="M -3 0 H 3 M 0 -3 V 3" stroke="#6279c8" strokeLinecap="round" pointerEvents="none" />
      </g>}
      {showLegend && <g data-pie-legend="" transform={`translate(${legendPosition.x} ${legendPosition.y})`}
        aria-label="扇形图图例" role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        onFocus={editable ? () => onSelect({ kind: 'pie-legend' }) : undefined}
        onKeyDown={editable ? event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect({ kind: 'pie-legend' });
            return;
          }
          const offset = arrowOffset(event.key, event.shiftKey);
          if (!offset) return;
          event.preventDefault();
          const x = clamp(legendPosition.x + offset.x, 8, WIDTH - legendWidth - 8);
          const y = clamp(legendPosition.y + offset.y, 8, HEIGHT - legendHeight - 8);
          if (x !== legendPosition.x || y !== legendPosition.y) onEdit(current => ({ ...resetPieLegend(current), pieLegendPosition: { x, y } }));
        } : undefined}
        fontFamily={TEXT_FONTS[style.legendFont].family} fontSize={legendFontSize} fill={style.legendColor}>
        {editable && <rect x="-3" y="-3" width={legendWidth + 6} height={legendHeight + 6} rx="4" fill="transparent"
          stroke={legendSelected ? '#6983ef' : undefined} strokeDasharray="4 3" data-editor-only="" />}
        {rows.map(({ index, category, name, detail }, row) => {
          const y = row * rowHeight + (rowHeight - style.legendRowGap) / 2;
          const middle = legendMarkerSize / 2;
          const color = pieColor(chart, index);
          return <g key={index}>
            <title>{category}{detail ? ` · ${detail}` : ''}</title>
            {style.legendMarker === 'circle' ? <circle cx={middle} cy={y} r={middle} fill={color} />
              : style.legendMarker === 'line' ? <line x1="1" x2={legendMarkerSize - 1} y1={y} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
                : <rect y={y - middle} width={legendMarkerSize} height={legendMarkerSize} rx="2" fill={color} />}
            <text x={labelX} y={y} dominantBaseline="central">{name}{detail && <tspan dx="7">{detail}</tspan>}</text>
          </g>;
        })}
        {remaining > 0 && <text y={rows.length * rowHeight + (rowHeight - style.legendRowGap) / 2} dominantBaseline="central">{summary}</text>}
      </g>}
    </g>
  );
}
