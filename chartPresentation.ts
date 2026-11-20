import { chartSheetHeight, displayedSeries, estimateTextWidth, getPlot, hasChartAxes, HEIGHT } from './chart';
import type { ChartDocument } from './types';

export const LEGEND_LINE_HEIGHT = 17;
export const LEGEND_FONT_SIZE = 13;
export const VALUE_FONT_SIZE = 14;

export function layoutSeriesLegend(chart: ChartDocument, plot = getPlot(chart.style, chart.plotOffset)) {
  const { legend, axes: { x: axis } } = chart.style;
  const sheetHeight = chartSheetHeight(chart);
  const series = displayedSeries(chart);
  if (!hasChartAxes(chart.kind) || legend !== true && (legend !== 'auto' || series.length < 2)) {
    return { sheetHeight, entries: [] };
  }

  const width = plot.right - plot.left;
  const textWidth = Math.min(236, width - 24);
  const rows = [];
  let rowWidth = 0;
  let rowHeight = 0;
  let row: { series: typeof series[number]; name: string; lines: string[]; x: number }[] = [];
  for (const [index, item] of series.entries()) {
    const name = item.name.trim() || `系列 ${index + 1}`;
    const lines: string[] = [];
    let line = '';
    let lineWidth = 0;
    let widestLine = 0;
    for (const character of name) {
      const advance = estimateTextWidth(character, LEGEND_FONT_SIZE) * 1.08;
      if (line && lineWidth + advance > textWidth) {
        lines.push(line);
        widestLine = Math.max(widestLine, lineWidth);
        line = '';
        lineWidth = 0;
      }
      line += character;
      lineWidth += advance;
    }
    lines.push(line);
    const itemWidth = 22 + Math.ceil(Math.max(widestLine, lineWidth));
    if (rowWidth && rowWidth + 14 + itemWidth > width) {
      rows.push({ row, width: rowWidth, height: rowHeight });
      row = [];
      rowWidth = 0;
      rowHeight = 0;
    }
    const x = rowWidth ? rowWidth + 14 : 0;
    row.push({ series: item, name, lines, x });
    rowWidth = x + itemWidth;
    rowHeight = Math.max(rowHeight, lines.length * LEGEND_LINE_HEIGHT);
  }
  if (row.length) rows.push({ row, width: rowWidth, height: rowHeight });
  if (!rows.length) return { sheetHeight, entries: [] };

  const height = rows.reduce((total, item) => total + item.height + 4, -4);
  const labelBottom = axis.visible === false ? 18 : axis.showLabel ? 94 : axis.showValues ? 80 : 24;
  const preferredTop = Math.max(plot.bottom + labelBottom,
    axis.visible !== false && axis.showLabel && chart.labelPositions.xLabel ? chart.labelPositions.xLabel.y + 12 : 0);
  let top = preferredTop + height + 8 <= HEIGHT ? preferredTop : sheetHeight + 12;
  const entries = rows.flatMap(({ row, width: rowWidth, height: rowHeight }) => {
    const y = top + LEGEND_FONT_SIZE;
    top += rowHeight + 4;
    const left = plot.left + (width - rowWidth) / 2;
    return row.map(entry => ({ ...entry, x: left + entry.x, y }));
  });
  return { sheetHeight: Math.max(sheetHeight, top + 4), entries };
}

export function spacedTickLabels(ticks: number[], position: (value: number) => number, showOrigin: boolean,
  omission?: { from: number; to: number } | null) {
  const gap = 18 - 1e-6;
  const reserved = showOrigin ? [position(0)] : [];
  const priority = new Set<number>();
  for (const tick of [omission?.from, omission?.to, ticks.at(-1)]) {
    if (tick === undefined || !ticks.includes(tick)) continue;
    const y = position(tick);
    if (reserved.some(other => Math.abs(y - other) < gap)) continue;
    priority.add(tick);
    reserved.push(y);
  }

  const labels = new Set<number>();
  let previous = Infinity;
  for (const tick of ticks) {
    const y = position(tick);
    if (!priority.has(tick) && (Math.abs(y - previous) < gap || reserved.some(other => Math.abs(y - other) < gap))) continue;
    labels.add(tick);
    previous = y;
  }
  return labels;
}

interface ValueLabel {
  x: number;
  y: number;
  text: string;
  offset?: number;
}

function labelBox({ x, y, text }: ValueLabel) {
  const halfWidth = estimateTextWidth(text, VALUE_FONT_SIZE) / 2 + 3;
  return { left: x - halfWidth, right: x + halfWidth, top: y - 14, bottom: y + 5 };
}

export function placeValueLabels<T extends ValueLabel>(labels: T[], reserved: ValueLabel[], width: number, bottom: number) {
  const boxes = reserved.map(labelBox);
  const placed: T[] = [];
  for (const label of labels) {
    for (const offset of label.offset ? [0, label.offset] : [0]) {
      const positioned = { ...label, y: label.y + offset };
      const box = labelBox(positioned);
      if (box.left < 4 || box.right > width - 4 || box.top < 4 || box.bottom > bottom) continue;
      if (boxes.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      boxes.push(box);
      placed.push(positioned);
      break;
    }
  }
  return placed;
}
