import type { ReactNode } from 'react';
import { arrowOffset } from '../alignment';
import { clamp, formatValue, getSeriesStyle, TEXT_FONTS } from '../chart';
import { pictographLayout, pictographSymbolAt } from '../pictograph';
import type { ChartDocument, ChartEdit, Datum, PictographStyle, Selection } from '../types';
import PictographIcon, { PICTOGRAPH_ICON_LICENSE } from './PictographIcon';

function Symbol({ name, color, size, x, y, fraction = 1, vertical, outline, colored }: {
  name: PictographStyle['symbol']; color: string; size: number; x: number; y: number;
  fraction?: number; vertical?: boolean; outline: boolean; colored: boolean;
}) {
  const artwork = <PictographIcon name={name} color={color} colored={colored} outline={outline} />;
  const scale = size / 24;
  if (fraction === 1) return <g transform={`translate(${x} ${y}) scale(${scale})`} data-pictograph-symbol="">{artwork}</g>;
  const trim = vertical ? (1 - fraction) * size : 0;
  return (
    <svg x={x} y={y + trim} width={vertical ? size : size * fraction} height={vertical ? size * fraction : size}
      overflow="hidden" data-pictograph-fraction={fraction}>
      <g transform={`translate(0 ${-trim}) scale(${scale})`}>{artwork}</g>
    </svg>
  );
}

export default function PictographGraphic({ chart, selection, editable, eraseData, onSelect, onEdit, onEditLegend, renderDatum, renderCategory }: {
  chart: ChartDocument; selection: Selection | null; editable: boolean; eraseData: boolean;
  onSelect?: (selection: Selection | null) => void; onEdit?: ChartEdit;
  onEditLegend?: () => void;
  renderDatum: (datum: Datum, value: number | null, children: ReactNode) => ReactNode;
  renderCategory: (index: number, x: number, y: number, maxWidth: number, anchor: 'middle' | 'end', size: number) => ReactNode;
}) {
  const { style, series, seriesIndex, vertical, counts, capacity, span, overflow, negative, legend, plot, warningY } = pictographLayout(chart);
  const selected = selection?.kind === 'data' ? selection.datum : undefined;
  const legendSelected = editable && selection?.kind === 'pictograph-legend';
  const colored = style.colorMode === 'color';
  const showValues = getSeriesStyle(series, chart.style).showLabels;
  const { top, bottom, left, right, symbolLeft } = plot;
  const thickness = (vertical ? right - left : bottom - top) / chart.categories.length;
  const distance = vertical ? bottom - top : right - symbolLeft - 79;
  const gap = Math.min(style.symbolGap, distance / span / 4);
  const size = Math.min(style.symbolSize, thickness * 0.72, (distance - (span - 1) * gap) / span);
  const step = size + gap;
  const categorySize = Math.min(16, Math.max(5, thickness / (vertical ? 2 : 1.65)));
  const categoryEvery = Math.ceil(chart.categories.length / (vertical ? 24 : 30));
  const frameTop = vertical ? top - 22 : top;
  const frameBottom = vertical ? bottom + 35 : bottom;
  const frameColor = style.frameColor ?? '#bfc9d9';
  const footerMessage = [
    negative && '负值未绘制图符',
    overflow && '图符数量超出显示容量，请提高每个图符代表的数量',
  ].filter(Boolean).join('；');

  return (
    <g aria-label="象形图">
      {colored && <metadata>{PICTOGRAPH_ICON_LICENSE}</metadata>}
      {style.frame && <g pointerEvents="none">
        <rect x={left} y={frameTop} width={right - left} height={frameBottom - frameTop} fill="none" stroke={frameColor} />
        {!vertical && <line x1={symbolLeft - 7} y1={frameTop} x2={symbolLeft - 7} y2={frameBottom} stroke={frameColor} />}
      </g>}
      {chart.categories.map((_, index) => {
        const edge = (vertical ? left : top) + index * thickness;
        const center = edge + thickness / 2;
        const count = counts[index];
        const tooMany = count > capacity;
        const value = series.values[index];
        const filled = tooMany ? 0 : Math.floor(count);
        const fraction = tooMany ? 0 : count - filled;
        const datum = { series: seriesIndex, index };
        const active = selected?.series === seriesIndex && selected.index === index;
        const hit = vertical ? { x: edge, y: top - 22, width: thickness, height: bottom - top + 22 }
          : { x: left, y: edge, width: right - left, height: thickness };
        const countText = value === null ? '—' : formatValue(value);
        const cells = filled + Number(fraction > 0);
        const numberY = vertical ? bottom - (cells ? (cells - 1) * step + size : 0) - 9 : center + 5;
        const categoryVisible = index % categoryEvery === 0 && !chart.hiddenCategoryLabels?.includes(index);
        const name = pictographSymbolAt(chart, index);
        return (
          <g key={index}>
            {style.guides && vertical && index === 0 && <line x1={left} y1={bottom + 1} x2={right} y2={bottom + 1}
              stroke={style.frame || style.frameColor ? frameColor : '#dfe5ef'} pointerEvents="none" />}
            {style.guides && vertical && style.frame && index > 0 && <line x1={edge} y1={frameTop} x2={edge} y2={frameBottom}
              stroke={frameColor} pointerEvents="none" />}
            {style.guides && !vertical && index > 0 && <line x1={left} y1={edge} x2={right} y2={edge}
              stroke={style.frame || style.frameColor ? frameColor : '#e8ecf3'} pointerEvents="none" />}
            {renderDatum(datum, value, <>
              {(editable || eraseData) && <rect {...hit} rx={4} fill={active ? '#ecf1ff' : 'transparent'} data-editor-only="" />}
              {Array.from({ length: cells }, (_, cell) => (
                <g key={cell}>
                  <Symbol name={name} outline={style.outline} color={series.color} colored={colored} size={size} vertical={vertical}
                    x={vertical ? center - size / 2 : symbolLeft + cell * step}
                    y={vertical ? bottom - size - cell * step : center - size / 2}
                    fraction={cell < filled ? 1 : fraction} />
                </g>
              ))}
              {(tooMany || value < 0 || showValues && index % categoryEvery === 0) && (
                <text x={vertical ? center : right - 6} y={numberY} textAnchor={vertical ? 'middle' : 'end'}
                  fontSize={vertical ? Math.min(14, categorySize) : categorySize} fill="#485861" data-custom-size="">
                  {tooMany ? `${countText} ·…` : countText}
                </text>
              )}
            </>)}
            {categoryVisible && (vertical
              ? renderCategory(index, center, bottom + 23, thickness - 5, 'middle', categorySize)
              : renderCategory(index, symbolLeft - 14, center + categorySize / 3, symbolLeft - left - 20, 'end', categorySize))}
          </g>
        );
      })}
      {style.showKey && <g aria-label={`图符图例：${legend.label}`} data-pictograph-legend=""
        transform={`translate(${legend.position.x} ${legend.position.y})`}
        role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        aria-keyshortcuts={editable ? 'Enter ArrowLeft ArrowRight ArrowUp ArrowDown' : undefined}
        onFocus={editable ? () => onSelect?.({ kind: 'pictograph-legend' }) : undefined}
        onKeyDown={editable ? event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEditLegend?.();
            return;
          }
          const offset = arrowOffset(event.key, event.shiftKey);
          if (!offset) return;
          event.preventDefault();
          const { position, bounds } = legend;
          const x = clamp(position.x + offset.x, ...bounds.x);
          const y = clamp(position.y + offset.y, ...bounds.y);
          if (x !== position.x || y !== position.y) onEdit?.(current => ({ ...current, pictographLegendPosition: { x, y } }));
        } : undefined}>
        {editable && <rect x={-4} y={-4} width={legend.width + 8} height={legend.height + 8} rx={4}
          fill={legendSelected ? '#ecf1ff' : 'transparent'} stroke={legendSelected ? '#8999c8' : 'none'} data-editor-only="" />}
        {legend.iconSize > 0 && <Symbol name={pictographSymbolAt(chart, 0)} outline={style.outline} color={series.color}
          colored={colored} size={legend.iconSize} x={0} y={legend.iconY} />}
        <text x={legend.textX} y={legend.textY} fontSize={style.legendFontSize} fill={style.legendColor} data-custom-size=""
          fontFamily={TEXT_FONTS[style.legendFont].family} fontWeight={style.legendBold ? 700 : 500} data-pictograph-key="">
          {legend.lines.map((line, index) => <tspan key={index} x={legend.textX} y={legend.textY + index * legend.lineHeight}>{line}</tspan>)}
        </text>
      </g>}
      {footerMessage && <text x={left} y={warningY} fontSize={15} fill="#84591d">{footerMessage}</text>}
    </g>
  );
}
