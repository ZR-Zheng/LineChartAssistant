import type { ReactNode } from 'react';
import { arrowOffset } from '../alignment';
import { clamp, dataLabelStyle, dataLabelTextAttributes, estimateTextWidth, formatValue, getSeriesStyle, TEXT_FONTS } from '../chart';
import { pictographLayout, pictographSymbolAt, resizePictographTable, setPictographCategoryShare } from '../pictograph';
import type { ChartDocument, ChartEdit, DataHighlight, Datum, PictographStyle, Selection } from '../types';
import PictographIcon from './PictographIcon';
import type { CanvasObjectProps } from './canvasInteraction';

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

export default function PictographGraphic({ chart, selection, highlight, editable, eraseData, onSelect, onEdit, onEditLegend, canvasObject, renderDatum, renderCategory }: {
  chart: ChartDocument; selection: Selection | null; highlight?: DataHighlight | null; editable: boolean; eraseData: boolean;
  onSelect?: (selection: Selection | null) => void; onEdit?: ChartEdit;
  onEditLegend?: () => void;
  canvasObject: CanvasObjectProps;
  renderDatum: (datum: Datum, value: number | null, children: ReactNode) => ReactNode;
  renderCategory: (index: number, x: number, y: number, maxWidth: number, anchor: 'middle' | 'end', size: number, cellHeight?: number) => ReactNode;
}) {
  const { style, series, seriesIndex, vertical, counts, capacity, span, overflow, negative, legend, plot, table, warningY } = pictographLayout(chart);
  const selected = selection?.kind === 'data' ? selection.datum : undefined;
  const legendSelected = editable && selection?.kind === 'pictograph-legend';
  const colored = style.colorMode === 'color';
  const symbols = chart.categories.map((_, index) => pictographSymbolAt(chart, index));
  const showValues = getSeriesStyle(series, chart.style).showLabels;
  const numberStyle = dataLabelStyle(chart.style, series);
  const typography = dataLabelTextAttributes(numberStyle, 400);
  const { top, bottom, left, right, symbolLeft } = plot;
  const thickness = (vertical ? right - left : bottom - top) / chart.categories.length;
  const distance = vertical ? bottom - top : right - symbolLeft - 79;
  const gap = Math.min(style.symbolGap, distance / span / 4);
  const size = Math.min(style.symbolSize, thickness * 0.72, (distance - (span - 1) * gap) / span);
  const step = size + gap;
  const categorySize = Math.min(16, Math.max(5, thickness / (vertical ? 2 : 1.65)));
  const numberSize = numberStyle.size === undefined ? (vertical ? Math.min(14, categorySize) : categorySize)
    : Math.min(numberStyle.size, Math.max(5, thickness * (vertical ? 1.25 : 0.76)));
  const numberWidth = vertical ? Math.max(1, thickness - 4) : 69;
  const categoryEvery = Math.ceil(chart.categories.length / (vertical ? 24 : 30));
  const frameColor = style.frameColor ?? '#bfc9d9';
  const divider = vertical
    ? { x1: left, y1: table.labelDivider, x2: right, y2: table.labelDivider }
    : { x1: table.labelDivider, y1: table.top, x2: table.labelDivider, y2: table.bottom };
  const dividerCenter = { x: (divider.x1 + divider.x2) / 2, y: (divider.y1 + divider.y2) / 2 };
  const handleWidth = vertical ? 18 : 8;
  const handleHeight = vertical ? 8 : 18;
  const footerMessage = [
    negative && '负值未绘制图标',
    overflow && '图标数量超出显示容量，请提高每个图标代表的数量',
  ].filter(Boolean).join('；');

  return (
    <g aria-label="象形图">
      {style.frame && <g pointerEvents="none">
        <rect x={left} y={table.top} width={table.width} height={table.height} fill="none" stroke={frameColor} data-pictograph-table="" />
        <line {...divider} stroke={frameColor} data-pictograph-category-divider="" />
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
        const highlighted = highlight?.series === seriesIndex && (highlight.index === undefined || highlight.index === index);
        const hit = vertical ? { x: edge, y: top - 22, width: thickness, height: bottom - top + 22 }
          : { x: left, y: edge, width: right - left, height: thickness };
        const countText = value === null ? '—' : formatValue(value);
        const cells = filled + Number(fraction > 0);
        const numberY = vertical ? bottom - (cells ? (cells - 1) * step + size : 0) - 9
          : center + (numberStyle.size === undefined ? 5 : numberSize / 3);
        const numberText = tooMany ? `${countText} ·…` : countText;
        const fitNumber = numberStyle.size !== undefined && estimateTextWidth(numberText, numberSize) > numberWidth;
        const categoryVisible = index % categoryEvery === 0 && !chart.hiddenCategoryLabels?.includes(index);
        const categoryX = vertical ? center : style.frame ? (left + table.labelDivider) / 2 : symbolLeft - 14;
        const categoryY = vertical ? style.frame ? (table.labelDivider + table.bottom) / 2 : bottom + 23
          : style.frame ? center : center + categorySize / 3;
        const categoryWidth = vertical ? thickness - 5 : style.frame ? table.labelDivider - left - 12 : symbolLeft - left - 20;
        const cellHeight = style.frame ? vertical ? table.category.size : thickness : undefined;
        const name = symbols[index];
        return (
          <g key={index}>
            {style.guides && !style.frame && vertical && index === 0 && <line x1={left} y1={bottom + 1} x2={right} y2={bottom + 1}
              stroke={style.frameColor ?? '#dfe5ef'} pointerEvents="none" />}
            {style.guides && vertical && style.frame && index > 0 && <line x1={edge} y1={table.top} x2={edge} y2={table.bottom}
              stroke={frameColor} pointerEvents="none" />}
            {style.guides && !vertical && index > 0 && <line x1={left} y1={edge} x2={right} y2={edge}
              stroke={style.frame || style.frameColor ? frameColor : '#e8ecf3'} pointerEvents="none" />}
            {renderDatum(datum, value, <>
              {(editable || eraseData) && <rect {...hit} rx={4} fill={active ? '#ecf1ff' : 'transparent'} data-editor-only="" />}
              {highlighted && <rect {...hit} rx={4} fill="#ecf1ff" stroke="#506fe7" strokeWidth="2" opacity="0.8"
                pointerEvents="none" data-editor-only="" data-value-highlight="" />}
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
                  fontSize={numberSize} {...typography} fill={numberStyle.color ?? '#485861'} data-custom-size="" data-value-label=""
                  textLength={fitNumber ? numberWidth : undefined} lengthAdjust={fitNumber ? 'spacingAndGlyphs' : undefined}>
                  {numberText}
                </text>
              )}
            </>)}
            {categoryVisible && renderCategory(index, categoryX, categoryY, categoryWidth,
              vertical || style.frame ? 'middle' : 'end', categorySize, cellHeight)}
          </g>
        );
      })}
      {style.showKey && <g aria-label={`图标图例：${legend.label}`} data-pictograph-legend=""
        transform={`translate(${legend.position.x} ${legend.position.y})`}
        role={editable ? 'button' : undefined} {...(editable ? canvasObject('pictograph:legend') : {})}
        aria-keyshortcuts={editable ? 'Enter Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown' : undefined}
        onFocus={editable ? () => onSelect?.({ kind: 'pictograph-legend' }) : undefined}
        onKeyDown={editable ? event => {
          if (event.key === 'Enter' || event.key === ' ') {
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
        {legend.iconSize > 0 && <Symbol name={symbols[0]} outline={style.outline} color={series.color}
          colored={colored} size={legend.iconSize} x={0} y={legend.iconY} />}
        <text x={legend.textX} y={legend.textY} fontSize={style.legendFontSize} fill={style.legendColor} data-custom-size=""
          fontFamily={TEXT_FONTS[style.legendFont].family} fontWeight={style.legendBold ? 700 : 500} data-pictograph-key="">
          {legend.lines.map((line, index) => <tspan key={index} x={legend.textX} y={legend.textY + index * legend.lineHeight}>{line}</tspan>)}
        </text>
      </g>}
      {footerMessage && <text x={left} y={warningY} fontSize={15} fill="#84591d">{footerMessage}</text>}
      {style.frame && editable && table.category.min < table.category.max && (
        <g className="pictograph-category-handle" data-pictograph-category-resize="" data-editor-only=""
          role="slider" {...canvasObject('pictograph:category', true)} aria-label={vertical ? '调整类别行占比' : '调整类别列占比'}
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
          aria-valuemin={table.category.min} aria-valuemax={table.category.max} aria-valuenow={Math.round(table.category.percent * 10) / 10}
          onFocus={() => onSelect?.(null)} onKeyDown={event => {
            const { percent, min, max } = table.category;
            const offset = arrowOffset(event.key, event.shiftKey);
            const change = offset ? vertical ? -offset.y : offset.x : 0;
            const next = event.key === 'Home' ? min : event.key === 'End' ? max : percent + change;
            if (offset || event.key === 'Home' || event.key === 'End') event.preventDefault();
            if (next === percent) return;
            onEdit?.(current => setPictographCategoryShare(current, next));
          }}>
          <title>拖动调整类别单元格占比</title>
          <line {...divider} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />
          <rect x={dividerCenter.x - handleWidth / 2} y={dividerCenter.y - handleHeight / 2}
            width={handleWidth} height={handleHeight} rx={3} className="axis-handle" />
        </g>
      )}
      {style.frame && editable && (
        <g className="pictograph-table-handle" data-pictograph-table-resize="" data-editor-only=""
          role="button" {...canvasObject('pictograph:table', true)} aria-label="调整表格大小"
          onFocus={() => onSelect?.(null)} onKeyDown={event => {
            const offset = arrowOffset(event.key, event.shiftKey);
            if (!offset) return;
            event.preventDefault();
            onEdit?.(current => resizePictographTable(current, { width: table.width + offset.x, height: table.height + offset.y }));
          }}>
          <title>拖动调整表格宽度和高度</title>
          <rect x={right - 5} y={table.bottom - 5} width={10} height={10} rx={2} className="axis-handle" />
        </g>
      )}
    </g>
  );
}
