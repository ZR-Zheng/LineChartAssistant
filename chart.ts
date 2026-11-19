import type { Axis, AxisArrowhead, AxisStyle, ChartDocument, ChartStyle, Mark, NoteTarget, Point, Series, SeriesStyle,
  Statistic, TextFont, TextStyle, TextTarget } from './types';

export const WIDTH = 920;
export const HEIGHT = 560;
const DEFAULT_PLOT = { left: 100, right: 836, top: 124, bottom: 410 };
export type Plot = typeof DEFAULT_PLOT;
export const AXIS_LENGTHS = { x: { min: 240, max: 770 }, y: { min: 150, max: 318 } } as const;
export const SERIES_COLORS = ['#3455c5', '#b95030', '#087e77', '#8354a3', '#8a660c', '#a73f63'];
export const FONT = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';
export const TEXT_SIZE = { min: 8, max: 56 };
export const TEXT_FONTS: Record<TextFont, { label: string; family: string }> = {
  system: { label: '系统默认', family: FONT },
  sans: { label: '黑体', family: '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif' },
  serif: { label: '宋体', family: '"SimSun", "Songti SC", "Noto Serif CJK SC", serif' },
  kai: { label: '楷体', family: '"KaiTi", "Kaiti SC", "STKaiti", serif' },
  mono: { label: '等宽', family: '"Consolas", "Menlo", monospace' },
};
export const MAX_MANUAL_TICKS = 500;
export const STATISTIC_LABELS: Record<Statistic, string> = { max: '最大值', min: '最小值', mean: '平均值' };
export const AXIS_TITLE_PLACEMENTS = {
  x: { end: '轴端右下方', center: '下方居中', start: '左下方' },
  y: { end: '轴顶上方居中', center: '左侧居中（旋转）', start: '左上方' },
} as const;
export const AXIS_ARROWHEADS: Record<AxisArrowhead, string> = { open: '简式', outline: '空心三角', filled: '实心三角' };
export const DEFAULT_AXIS_ARROWHEAD: AxisArrowhead = 'filled';

export function isAxisArrowhead(value: unknown): value is AxisArrowhead {
  return typeof value === 'string' && Object.hasOwn(AXIS_ARROWHEADS, value);
}

export function arrowheadLength(width: number) {
  return Math.max(8, width * 3.6);
}

export function verticalAxisExtension({ line, width }: AxisStyle) {
  return line === 'arrow' ? Math.max(18, Math.ceil(arrowheadLength(width) + width / 2 + 6)) : 8;
}

const BASE_AXIS: AxisStyle = {
  line: 'arrow',
  color: '#526079',
  width: 1.6,
  length: DEFAULT_PLOT.right - DEFAULT_PLOT.left,
  tickLength: 5,
  tickPosition: 'outside',
  tickMode: 'auto',
  interval: 1,
  showValues: true,
  showLabel: true,
  titlePlacement: 'end',
};

export const DEFAULT_STYLE: ChartStyle = {
  grid: true,
  showLabels: true,
  dots: true,
  showOrigin: true,
  dotSize: 5,
  strokeWidth: 3,
  axes: { x: BASE_AXIS, y: { ...BASE_AXIS, length: DEFAULT_PLOT.bottom - DEFAULT_PLOT.top } },
  axisArrowhead: DEFAULT_AXIS_ARROWHEAD,
  legend: 'auto',
};

export function blankChart(kind: ChartDocument['kind'] = 'line'): ChartDocument {
  return {
    kind,
    title: '未命名统计图',
    xLabel: '类别',
    yLabel: '数量',
    categories: ['A', 'B', 'C', 'D', 'E', 'F'],
    series: [{ name: '数据 1', color: SERIES_COLORS[0], values: Array(6).fill(null) }],
    marks: [],
    notes: [],
    plotOffset: { x: 0, y: 0 },
    style: DEFAULT_STYLE,
    textStyles: {},
    labelPositions: {},
    scaleExtent: null,
  };
}

export function sampleChart(): ChartDocument {
  return {
    ...blankChart(),
    title: '一周图书借阅量',
    xLabel: '日期',
    yLabel: '借阅量（本）',
    categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    series: [{ name: '借阅量', color: SERIES_COLORS[0], values: [12, 18, 15, 24, 21, 27, 23] }],
  };
}

export function setChartValue(document: ChartDocument, seriesIndex: number, index: number, value: number | null) {
  const series = document.series[seriesIndex];
  if (series?.values[index] === undefined || series.values[index] === value) return document;
  const values = series.values.map((previous, i) => i === index ? value : previous);
  const extent = document.scaleExtent;
  return {
    ...document,
    series: document.series.map((previous, i) => i === seriesIndex ? { ...series, values } : previous),
    scaleExtent: extent && value !== null && !getScale([], extent).includes(value) ? null : extent,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function constrainPlotOffset(style: ChartStyle, offset: Point) {
  return {
    x: clamp(offset.x, 62 - DEFAULT_PLOT.left, WIDTH - DEFAULT_PLOT.left - style.axes.x.length - 20),
    y: clamp(offset.y, 84 - (DEFAULT_PLOT.bottom - style.axes.y.length), HEIGHT - DEFAULT_PLOT.bottom - 118),
  };
}

export function getPlot(style: ChartStyle, offset: Point = { x: 0, y: 0 }): Plot {
  const { x, y } = constrainPlotOffset(style, offset);
  return {
    left: DEFAULT_PLOT.left + x,
    right: DEFAULT_PLOT.left + x + style.axes.x.length,
    top: DEFAULT_PLOT.bottom + y - style.axes.y.length,
    bottom: DEFAULT_PLOT.bottom + y,
  };
}

export function movePlot(chart: ChartDocument, offset: Point): ChartDocument {
  const from = constrainPlotOffset(chart.style, chart.plotOffset);
  const plotOffset = constrainPlotOffset(chart.style, offset);
  if (from.x === plotOffset.x && from.y === plotOffset.y) return chart;
  const labelPositions = { ...chart.labelPositions };
  for (const label of ['xLabel', 'yLabel'] as const) {
    const position = labelPositions[label];
    if (position) labelPositions[label] = {
      x: clamp(position.x + plotOffset.x - from.x, 6, WIDTH - 6),
      y: clamp(position.y + plotOffset.y - from.y, 18, HEIGHT - 8),
    };
  }
  return { ...chart, plotOffset, labelPositions };
}

export function axisTitleLayout(axis: Axis, plot: Plot, chart: ChartDocument, zero = plot.bottom) {
  const placement = chart.style.axes[axis].titlePlacement ?? 'end';
  if (placement === 'end' && axis === 'y') {
    const offset = Math.max(34, verticalAxisExtension(chart.style.axes.y) + 10);
    return { point: { x: plot.left, y: plot.top - offset }, anchor: 'middle' as const, rotation: 0 };
  }
  if (placement === 'end' && axis === 'x') {
    const x = plot.right + 20;
    const width = Math.min(25, Array.from(chart.xLabel || '横轴标题').length) * getTextStyle(chart, 'xLabel').size;
    const fits = x + width <= WIDTH - 6;
    return { point: { x: fits ? x : WIDTH - 6, y: zero + 28 }, anchor: fits ? 'start' as const : 'end' as const, rotation: 0 };
  }
  const anchor = placement === 'center' ? 'middle' as const : 'start' as const;
  const center = (plot.left + plot.right) / 2;
  const y = axis === 'x' ? plot.bottom + 65 : placement === 'center' ? (plot.top + plot.bottom) / 2
    : plot.top - Math.max(22, verticalAxisExtension(chart.style.axes.y) + 8);
  const x = axis === 'x' ? (placement === 'start' ? plot.left : center)
    : placement === 'center' ? Math.max(15, plot.left - 69) : plot.left - 45;
  return { point: { x, y }, anchor,
    rotation: axis === 'y' && placement === 'center' ? -90 : 0 };
}

export function isNote(target: TextTarget): target is NoteTarget {
  return typeof target === 'string' && target.startsWith('note:');
}

export function textValue(chart: ChartDocument, target: TextTarget) {
  if (isNote(target)) return chart.notes.find(note => note.id === target)?.text ?? '';
  return typeof target === 'number' ? chart.categories[target] ?? '' : chart[target];
}

export function removeNote(chart: ChartDocument, id: NoteTarget): ChartDocument {
  const textStyles = { ...chart.textStyles };
  delete textStyles[id];
  return { ...chart, textStyles, notes: chart.notes.filter(note => note.id !== id) };
}

export function setCategoryLabelVisible(chart: ChartDocument, index: number, visible: boolean): ChartDocument {
  const hidden = chart.hiddenCategoryLabels ?? [];
  return { ...chart, hiddenCategoryLabels: visible ? hidden.filter(item => item !== index) : [...new Set([...hidden, index])] };
}

export function hideText(chart: ChartDocument, target: TextTarget): ChartDocument {
  if (isNote(target)) return removeNote(chart, target);
  if (typeof target === 'number') return setCategoryLabelVisible(chart, target, false);
  if (target === 'title') return { ...chart, style: { ...chart.style, showTitle: false } };
  const axis = target === 'xLabel' ? 'x' : 'y';
  const { axes } = chart.style;
  return { ...chart, style: { ...chart.style, axes: { ...axes, [axis]: { ...axes[axis], showLabel: false } } } };
}

export function removeCategory(chart: ChartDocument, index: number): ChartDocument {
  if (chart.categories.length <= 1 || chart.categories[index] === undefined) return chart;
  const textStyles = { ...chart.textStyles };
  for (let i = index; i < chart.categories.length - 1; i++) {
    if (textStyles[i + 1]) textStyles[i] = textStyles[i + 1];
    else delete textStyles[i];
  }
  delete textStyles[chart.categories.length - 1];
  return {
    ...chart, textStyles, scaleExtent: null,
    hiddenCategoryLabels: chart.hiddenCategoryLabels?.filter(i => i !== index).map(i => i > index ? i - 1 : i),
    categories: chart.categories.filter((_, i) => i !== index),
    series: chart.series.map(item => ({ ...item, values: item.values.filter((_, i) => i !== index) })),
  };
}

export function removeSeries(chart: ChartDocument, index: number): ChartDocument {
  if (chart.series.length <= 1 || !chart.series[index]) return chart;
  return { ...chart, scaleExtent: null, series: chart.series.filter((_, i) => i !== index) };
}

export function statistics(values: (number | null)[]): Record<Statistic, number> | null {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const value of values) {
    if (value === null) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    count++;
  }
  if (!count) return null;
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  const sum = magnitude ? values.reduce((total, value) => total + (value ?? 0) / magnitude, 0) : 0;
  return { max, min, mean: magnitude ? clamp(sum / count * magnitude, min, max) : 0 };
}

export function getTextStyle(chart: ChartDocument, target: TextTarget): TextStyle {
  const title = target === 'title';
  return {
    font: 'system',
    size: title ? 29 : isNote(target) ? 18 : 14,
    color: title ? '#1c2540' : '#485861',
    bold: title,
    italic: false,
    underline: false,
    alignment: 'start',
    ...chart.textStyles?.[target],
  };
}

export function getSeriesStyle(series: Series, chartStyle: ChartStyle): SeriesStyle {
  return {
    strokeWidth: chartStyle.strokeWidth,
    dotSize: chartStyle.dotSize,
    dotShape: 'circle',
    dotFill: 'hollow',
    dots: chartStyle.dots,
    showLabels: chartStyle.showLabels,
    columnWidth: 0.86,
    roundedColumns: true,
    ...series.style,
  };
}

function round(value: number) {
  const rounded = Number(value.toPrecision(14));
  return Number.isFinite(rounded) ? rounded : value;
}

const formatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6 });
const compactFormatter = new Intl.NumberFormat('zh-CN', { notation: 'scientific', maximumFractionDigits: 4 });

export function formatValue(value: number) {
  const magnitude = Math.abs(value);
  return magnitude >= 1e8 || (magnitude > 0 && magnitude < 1e-4)
    ? compactFormatter.format(value)
    : formatter.format(value);
}

export function parseValue(value: string): number | null {
  const input = value.trim();
  if (!input) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input) || !Number.isFinite(Number(input))) {
    throw new Error('请输入有效数字，或留空表示缺失数据。');
  }
  return Number(input);
}

export function isAxisBreak(value: unknown): value is import('./types').AxisBreak {
  if (!value || typeof value !== 'object' || !('from' in value) || !('to' in value)) return false;
  const { from, to } = value;
  return typeof from === 'number' && typeof to === 'number' && Number.isFinite(from) && Number.isFinite(to)
    && from < to && (from >= 0 || to <= 0);
}

export function getScale(
  series: ChartDocument['series'],
  extent: ChartDocument['scaleExtent'] = null,
  plot: Plot = DEFAULT_PLOT,
  axis: Pick<AxisStyle, 'tickMode' | 'interval' | 'maximum' | 'omitted'> = BASE_AXIS,
) {
  const limit = axis.maximum ?? Infinity;
  const omitted = isAxisBreak(axis.omitted) && axis.omitted.to <= limit ? axis.omitted : null;
  let min = extent?.min ?? 0;
  let max = axis.maximum ?? extent?.max ?? 0;
  for (const item of extent ? [] : series) {
    for (const value of item.values) {
      if (value === null) continue;
      min = Math.min(min, value);
      if (axis.maximum === undefined) max = Math.max(max, value);
    }
  }

  if (omitted) {
    min = Math.min(min, omitted.from);
    max = Math.max(max, omitted.to);
    if (min === omitted.from && max === omitted.to) {
      const pad = (omitted.to - omitted.from) / 10 || 1;
      if (axis.maximum === undefined && max < Number.MAX_VALUE) max = Math.min(Number.MAX_VALUE, max + pad);
      else min = Math.max(-Number.MAX_VALUE, min - pad);
    }
  }

  if (min === max) {
    if (axis.maximum === 0) min = -10;
    else max = 10;
  }
  const magnitude = Math.max(max, -min);
  const exponent = Math.floor(Math.log10(magnitude));
  const unit = 10 ** clamp(exponent, -300, 300);
  const low = min / unit;
  const high = max / unit;
  const breakFrom = omitted ? omitted.from / unit : 0;
  const breakTo = omitted ? omitted.to / unit : 0;
  const split = omitted && breakTo > breakFrom && (breakFrom > low || breakTo < high) ? omitted : null;
  const span = split ? breakFrom - low + (high - breakTo) : high - low;
  const target = Math.max(Number.MIN_VALUE, span / 6);
  const base = Math.max(Number.MIN_VALUE, 10 ** Math.floor(Math.log10(target)));
  const step = ([1, 2, 2.5, 5, 10].find(factor => factor * base >= target) ?? 10) * base;
  const bottomTick = Math.floor(round(low / step));
  const topTick = Math.ceil(round(high / step));
  const bound = Number.MAX_VALUE / unit;
  const lower = Math.min(low, Math.max(bottomTick * step, -bound));
  const upper = axis.maximum === undefined ? Math.max(high, Math.min(topTick * step, bound)) : high;
  const increment = step * unit >= 1 ? Math.max(1, step * unit / 5) : step * unit / 5;
  const fromNormalized = (normalized: number) => Math.abs(normalized) >= bound
    ? Math.sign(normalized) * Number.MAX_VALUE : round(normalized * unit);
  const lowerValue = Math.min(min, fromNormalized(lower));
  const upperValue = axis.maximum ?? Math.max(max, fromNormalized(upper));
  const ranges = split ? [[lower, breakFrom], [breakTo, upper]] : [[lower, upper]];
  const bands = split ? [{ min: lowerValue, max: split.from }, { min: split.to, max: upperValue }]
    : [{ min: lowerValue, max: upperValue }];
  const height = plot.bottom - plot.top;
  const gap = split ? Math.min(18, height / 5) : 0;
  const drawnSpan = split ? breakFrom - lower + (upper - breakTo) : upper - lower;
  const drawHeight = height - gap;
  const gapBottom = split ? plot.bottom - (breakFrom - lower) / drawnSpan * drawHeight : plot.bottom;
  const gapTop = gapBottom - gap;
  const inBreak = (value: number) => Boolean(split && value > split.from && value < split.to);
  const manual = axis.tickMode === 'all' || axis.tickMode === 'interval';
  const allStep = magnitude < 1 ? Math.max(10 ** exponent, Number.MIN_VALUE) : 1;
  const requestedStep = (axis.tickMode === 'all' ? allStep : axis.interval) / unit;
  function tickRange(start: number, end: number, spacing: number) {
    return [Math.ceil(round(start / spacing)), Math.floor(round(end / spacing))];
  }
  const manualRanges = ranges.map(([start, end]) => tickRange(start, end, requestedStep));
  const manualTickCount = manualRanges.reduce((sum, [start, end]) => sum + Math.max(0, end - start + 1), 0);
  const tooManyTicks = manual && (requestedStep <= 0 || !Number.isFinite(manualTickCount) || manualTickCount > MAX_MANUAL_TICKS
    || manualRanges.some(pair => pair.some(index => !Number.isSafeInteger(index))));
  const visibleStep = manual && !tooManyTicks ? requestedStep : step;
  const ticks = new Set<number>();
  for (const [start, end] of ranges) {
    const [first, last] = tickRange(start, end, visibleStep);
    if (Number.isSafeInteger(first) && Number.isSafeInteger(last)) {
      for (let index = first; index <= last && index - first <= MAX_MANUAL_TICKS; index++) {
        const value = fromNormalized(index * visibleStep);
        if (value !== 0 && value <= limit && !inBreak(value)) ticks.add(value);
      }
    }
  }
  if (split) {
    if (split.from !== 0) ticks.add(split.from);
    if (split.to !== 0) ticks.add(split.to);
  }

  return {
    extent: { min, max },
    limit,
    ticks: [...ticks].sort((a, b) => a - b),
    bands,
    inBreak,
    omission: split ? { ...split, top: gapTop, bottom: gapBottom } : null,
    tooManyTicks,
    tickSpacing: drawHeight * (visibleStep / drawnSpan),
    includes(value: number) {
      return value >= lowerValue && value <= upperValue && !inBreak(value);
    },
    y(value: number) {
      if (!split || value <= split.from) return plot.bottom - (value / unit - lower) / drawnSpan * drawHeight;
      if (value >= split.to) return gapTop - (value / unit - breakTo) / drawnSpan * drawHeight;
      return gapBottom - (value / unit - breakFrom) / (breakTo - breakFrom) * gap;
    },
    valueAt(y: number) {
      const band = split && y <= gapTop ? bands[1] : bands[0];
      if (split && y >= gapTop && y <= gapBottom) return y - gapTop <= gapBottom - y ? split.to : split.from;
      const ratio = clamp((plot.bottom - y - (band === bands[1] ? gap : 0)) / drawHeight, 0, 1);
      if (ratio === 1 && axis.maximum !== undefined) return axis.maximum;
      const normalized = band === bands[1] ? breakTo + (gapTop - Math.max(y, plot.top)) / drawHeight * drawnSpan
        : lower + ratio * drawnSpan;
      const value = fromNormalized(normalized);
      return increment > 0 ? clamp(round(Math.round(value / increment) * increment),
        band.min, band.max) : clamp(value, band.min, band.max);
    },
    nudge(value: number, direction: number) {
      const next = round(clamp(value + (increment || Number.MIN_VALUE) * direction, -Number.MAX_VALUE, Number.MAX_VALUE));
      if (split && (inBreak(next) || direction > 0 && value === split.from && next === value
        || direction < 0 && value === split.to && next === value)) return direction > 0 ? split.to : split.from;
      return Math.min(next, limit);
    },
  };
}

export function categoryX(index: number, count: number, plot: Plot) {
  return plot.left + (plot.right - plot.left) * (index + 0.5) / count;
}

export function visibleMark(mark: Mark, plot: Plot, scale: ReturnType<typeof getScale>): Mark | null {
  if (mark.referenceValue === undefined) return mark;
  if (!scale.includes(mark.referenceValue)) return null;
  const y = scale.y(mark.referenceValue);
  return { ...mark, points: [{ x: plot.left, y }, { x: plot.right, y }] };
}

export function markPath(points: Point[]) {
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} L ${rest.length ? rest.map(point => `${point.x} ${point.y}`).join(' ') : `${first.x + 0.01} ${first.y}`}`;
}
