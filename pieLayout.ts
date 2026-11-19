import { clamp, estimateTextWidth, formatShare, formatValue, getSeriesStyle, HEIGHT, pieSlices, pieStyle, shorten, WIDTH } from './chart';
import type { ChartDocument, PieStyle, Point } from './types';

function labelDetails(mode: PieStyle['legendContent'], value: number, percentage: string) {
  if (mode === 'value') return formatValue(value);
  if (mode === 'percent') return percentage;
  if (mode === 'both') return `${formatValue(value)} · ${percentage}`;
  return '';
}

export function pieLayout(chart: ChartDocument) {
  const style = pieStyle(chart.style);
  const series = chart.series[chart.pieSeries ?? 0];
  const slices = pieSlices(series.values, style.order);
  const showLabels = getSeriesStyle(series, chart.style).showLabels;
  const showLegend = chart.style.legend !== false && slices.length > 0;
  const { radius, legendFontSize, legendMarkerSize, legendMarkerGap, legendRowGap } = style;
  const rowHeight = Math.max(legendFontSize + 2, legendMarkerSize) + legendRowGap;
  const limit = Math.floor(388 / rowHeight);
  const remaining = showLegend ? Math.max(0, slices.length - limit) : 0;
  const legendMode = style.legendContent === 'follow' ? showLabels ? style.labelMode : 'category' : style.legendContent;
  const labelX = legendMarkerSize + legendMarkerGap;
  const rows = showLegend ? slices.slice(0, limit).map(({ index, value, share }) => {
    const category = chart.categories[index] || `类别 ${index + 1}`;
    const detail = labelDetails(legendMode, value, formatShare(share, style.percentageDigits));
    const detailWidth = detail ? 7 + estimateTextWidth(detail, legendFontSize) : 0;
    const name = shorten(category, Math.max(3, Math.min(22, Math.floor((255 - labelX - detailWidth) / legendFontSize))));
    return { index, category, name, detail, width: labelX + estimateTextWidth(name, legendFontSize) + detailWidth };
  }) : [];
  const summary = `另有 ${remaining} 个类别`;
  const width = Math.ceil(Math.max(remaining ? estimateTextWidth(summary, legendFontSize) : 0, ...rows.map(row => row.width))) + 2;
  const height = Math.max(0, (rows.length + Number(remaining > 0)) * rowHeight - legendRowGap);
  const defaultOffset = { x: style.legendSide === 'right' ? radius + 26 : -radius - 26 - width, y: -height / 2 };
  const attached = chart.pieLegendPosition === undefined;
  const edge = radius + 8;
  const requestedOffset = chart.pieLegendOffset ?? defaultOffset;
  const offset = { x: clamp(requestedOffset.x, 8 - (WIDTH - edge), WIDTH - width - 8 - edge),
    y: clamp(requestedOffset.y, 8 - (HEIGHT - edge), HEIGHT - height - 8 - edge) };
  const bounds = { x: [edge, WIDTH - edge] as [number, number], y: [edge, HEIGHT - edge] as [number, number] };
  if (attached && showLegend) {
    bounds.x = [Math.max(edge, 8 - offset.x), Math.min(WIDTH - edge, WIDTH - 8 - width - offset.x)];
    bounds.y = [Math.max(edge, 8 - offset.y), Math.min(HEIGHT - edge, HEIGHT - 8 - height - offset.y)];
  }
  const desiredCenter = chart.piePosition ?? { x: WIDTH / 2, y: 268 };
  const center = { x: clamp(desiredCenter.x, ...bounds.x), y: clamp(desiredCenter.y, ...bounds.y) };
  const naturalPosition = { x: center.x + defaultOffset.x, y: center.y + defaultOffset.y };
  const desiredLegend = chart.pieLegendPosition ?? { x: center.x + offset.x, y: center.y + offset.y };
  const position = { x: clamp(desiredLegend.x, 8, WIDTH - width - 8), y: clamp(desiredLegend.y, 8, HEIGHT - height - 8) };
  return { style, slices, showLabels, center, bounds, showLegend,
    legend: { attached, height, labelX, naturalPosition, position, remaining, rowHeight, rows, summary, width } };
}

export function movePie(chart: ChartDocument, position?: Point): ChartDocument {
  const layout = pieLayout(chart);
  const from = layout.center;
  const desired = position ?? pieLayout({ ...chart, piePosition: undefined }).center;
  const bounds = pieMoveBounds(chart, layout);
  const to = { x: clamp(desired.x, ...bounds.x), y: clamp(desired.y, ...bounds.y) };
  if (position && to.x === from.x && to.y === from.y) return chart;
  const reset = !position && desired.x === to.x && desired.y === to.y;
  return { ...chart, piePosition: reset ? undefined : to, notes: chart.notes.map(note => note.pieAttached && !note.exerciseQuestion ? {
    ...note, position: { x: note.position.x + to.x - from.x, y: note.position.y + to.y - from.y },
  } : note) };
}

export function pieMoveBounds(chart: ChartDocument, { center, bounds }: ReturnType<typeof pieLayout>) {
  const x: [number, number] = [...bounds.x];
  const y: [number, number] = [...bounds.y];
  for (const note of chart.notes) {
    if (!note.pieAttached || note.exerciseQuestion) continue;
    x[0] = Math.max(x[0], Math.min(center.x, center.x + 6 - note.position.x));
    x[1] = Math.min(x[1], Math.max(center.x, center.x + WIDTH - 6 - note.position.x));
    y[0] = Math.max(y[0], Math.min(center.y, center.y + 18 - note.position.y));
    y[1] = Math.min(y[1], Math.max(center.y, center.y + HEIGHT - 8 - note.position.y));
  }
  return { x, y };
}

export function resetPieLegend(chart: ChartDocument): ChartDocument {
  return { ...chart, pieLegendPosition: undefined, pieLegendOffset: undefined };
}

export function togglePieLegendAttachment(chart: ChartDocument): ChartDocument {
  const { center, legend } = pieLayout(chart);
  return legend.attached ? { ...resetPieLegend(chart), pieLegendPosition: legend.position }
    : { ...resetPieLegend(chart), pieLegendOffset: { x: legend.position.x - center.x, y: legend.position.y - center.y } };
}
