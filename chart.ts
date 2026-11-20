import type { Axis, AxisArrowhead, AxisStyle, ChartDocument, ChartKind, ChartStyle, Mark, NoteTarget, PieStyle, Point, Series, SeriesStyle,
  Statistic, TextFont, TextNote, TextStyle, TextTarget } from './types';

export const WIDTH = 920;
export const HEIGHT = 560;
const DEFAULT_PLOT = { left: 100, right: 836, top: 124, bottom: 410 };
export const EXERCISE_POSITION = { x: DEFAULT_PLOT.left, y: HEIGHT + 32 };
export type Plot = typeof DEFAULT_PLOT;
export const AXIS_LENGTHS = { x: { min: 240, max: 770 }, y: { min: 150, max: 318 } } as const;
export const SERIES_COLORS = ['#3455c5', '#b95030', '#087e77', '#8354a3', '#8a660c', '#a73f63'];
const PIE_PALETTES: Record<PieStyle['palette'], string[]> = {
  classic: [...SERIES_COLORS, '#56804a', '#186b93', '#d28b22', '#b5448a', '#6b688a', '#964b41'],
  pastel: ['#a8bce7', '#efb59d', '#99caba', '#d1b1df', '#f2ce80', '#dfa7be', '#b8ce93', '#9ecbdd'],
  ocean: ['#17416e', '#087e77', '#4393b2', '#4155a1', '#69b5bb', '#466f8b', '#70a99b', '#a7c4e9'],
  monochrome: ['#314059', '#52617a', '#76839a', '#a1acbc', '#bfc8d5', '#d9e1eb', '#eef1f6', '#49546a'],
};
export const PIE_PALETTE_NAMES: Record<PieStyle['palette'], string> = { classic: '经典', pastel: '柔和', ocean: '海蓝', monochrome: '灰蓝' };
export const PIE_PRESETS = {
  classic: { label: '经典扇形', style: { holeRatio: 0, palette: 'classic', separatorWidth: 2, separatorColor: '#ffffff' } },
  donut: { label: '海蓝环形', style: { holeRatio: 0.5, palette: 'ocean', separatorWidth: 2, separatorColor: '#ffffff' } },
  pastel: { label: '柔和扁平', style: { holeRatio: 0, palette: 'pastel', separatorWidth: 0, separatorColor: '#ffffff' } },
  outline: { label: '灰蓝描边', style: { holeRatio: 0, palette: 'monochrome', separatorWidth: 2, separatorColor: '#334155' } },
} as const;
export const DEFAULT_GROUP_WIDTH = 0.72;
export const DEFAULT_PIE_STYLE: PieStyle = {
  ...PIE_PRESETS.classic.style, radius: 155, startAngle: 0, clockwise: true, order: 'data', labelMode: 'percent',
  percentageDigits: 1, labelFont: 'system', labelFontSize: 15, labelPlacement: 'middle', legendSide: 'right',
  legendFont: 'system', legendFontSize: 14, legendColor: '#485861', legendRowGap: 6, legendMarker: 'square',
  legendMarkerSize: 12, legendMarkerGap: 5, legendContent: 'follow',
};

export function isGroupWidth(value: unknown): value is number {
  return typeof value === 'number' && value >= 0.5 && value <= 0.92;
}

export function isPieStyle(value: unknown): value is Partial<PieStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const style = value as Partial<PieStyle>;
  const integer = (value: unknown, min: number, max: number) => value === undefined
    || typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  const choices = (value: unknown, ...options: string[]) => value === undefined || options.includes(value as string);
  const color = (value: unknown) => value === undefined || typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const font = (value: unknown) => value === undefined || typeof value === 'string' && Object.hasOwn(TEXT_FONTS, value);
  return integer(style.radius, 125, 176) && integer(style.startAngle, 0, 359) && integer(style.separatorWidth, 0, 4)
    && integer(style.percentageDigits, 0, 2) && integer(style.labelFontSize, 10, 22)
    && integer(style.legendFontSize, 10, 22) && integer(style.legendRowGap, 2, 14)
    && integer(style.legendMarkerSize, 7, 18) && integer(style.legendMarkerGap, 2, 12)
    && (style.holeRatio === undefined || typeof style.holeRatio === 'number' && style.holeRatio >= 0 && style.holeRatio <= 0.68)
    && (style.clockwise === undefined || typeof style.clockwise === 'boolean')
    && choices(style.palette, ...Object.keys(PIE_PALETTES)) && choices(style.order, 'data', 'desc', 'asc')
    && choices(style.labelMode, 'percent', 'value', 'both') && choices(style.labelPlacement, 'middle', 'rim')
    && choices(style.legendSide, 'left', 'right') && choices(style.legendMarker, 'square', 'circle', 'line')
    && choices(style.legendContent, 'follow', 'category', 'percent', 'value', 'both')
    && color(style.separatorColor) && color(style.labelColor) && color(style.legendColor) && font(style.labelFont) && font(style.legendFont);
}
export const FONT = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';
export const TEXT_SIZE = { min: 8, max: 56 };
export const TEXT_FONTS: Record<TextFont, { label: string; family: string }> = {
  system: { label: '系统默认', family: FONT },
  sans: { label: '黑体', family: '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif' },
  serif: { label: '宋体', family: '"SimSun", "Songti SC", "Noto Serif CJK SC", serif' },
  kai: { label: '楷体', family: '"KaiTi", "Kaiti SC", "STKaiti", serif' },
  mono: { label: '等宽', family: '"Consolas", "Menlo", monospace' },
};
export const DEFAULT_TICK_LABEL = { font: 'system', size: 15 } as const;
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
  tickPosition: 'inside',
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

export function blankChart(kind: ChartDocument['kind'] = 'line', groupedColumns = false): ChartDocument {
  return {
    kind,
    ...(kind === 'bar' && { groupedColumns }),
    title: '未命名统计图',
    xLabel: '类别',
    yLabel: '数量',
    categories: ['A', 'B', 'C', 'D', 'E', 'F'],
    series: Array.from({ length: kind === 'bar' && groupedColumns ? 2 : 1 }, (_, index) => ({
      name: `数据 ${index + 1}`, color: SERIES_COLORS[index], values: Array(6).fill(null),
    })),
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

export function appendCategory(chart: ChartDocument): ChartDocument {
  return {
    ...chart,
    categories: [...chart.categories, `类别 ${chart.categories.length + 1}`],
    series: chart.series.map(series => ({ ...series, values: [...series.values, null] })),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function shorten(text: string, max: number) {
  const letters = Array.from(text);
  return letters.length > max ? letters.slice(0, max - 1).join('') + '…' : text;
}

export function estimateTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((width, letter) => width + (letter.codePointAt(0) <= 127 ? 0.66 : 1), 0) * fontSize;
}

export function isLightColor(color: string) {
  const rgb = Number.parseInt(color.slice(1), 16);
  const red = (rgb >> 16) & 255;
  const green = (rgb >> 8) & 255;
  const blue = rgb & 255;
  return red * 0.299 + green * 0.587 + blue * 0.114 > 155;
}

export function tickOffsets({ tickLength, tickPosition }: AxisStyle): [number, number] {
  if (tickPosition === 'cross') return [-tickLength / 2, tickLength / 2];
  if (tickPosition === 'inside') return [-tickLength, 0];
  return [0, tickLength];
}

type PlotLayout = Pick<ChartDocument, 'style' | 'categories' | 'textStyles' | 'plotOffset'>;

function plotLayout(source: ChartStyle | PlotLayout): PlotLayout {
  return 'style' in source ? source : { style: source, categories: [], textStyles: {}, plotOffset: { x: 0, y: 0 } };
}

export function categoryTickLayout(chart: Pick<PlotLayout, 'style' | 'categories'>) {
  const axis = chart.style.axes.x;
  const count = Math.max(1, chart.categories.length);
  const automatic = Math.ceil(count / Math.max(1, Math.floor(axis.length / 58)));
  const step = axis.tickMode === 'all' ? 1 : axis.tickMode === 'interval' ? axis.interval : automatic;
  const band = axis.length / count * Math.min(step, count);
  const size = axis.tickLabelSize ?? DEFAULT_TICK_LABEL.size;
  const angled = band < 44 && chart.categories.some((category, index) =>
    index % step === 0 && Array.from(category).length * size > band - 6);
  const [, outside] = tickOffsets(axis);
  return {
    step, band, angled,
    width: angled ? 44 : Math.max(8, band - 4),
    labelOffset: angled ? Math.max(18, outside + 12) : Math.max(28, outside + 18),
  };
}

function xTitleOffset(axis: AxisStyle) {
  return axis.titlePlacement === 'start' || axis.titlePlacement === 'center' ? 65 : 28;
}

function plotBottomInset(chart: PlotLayout) {
  const { x, y } = chart.style.axes;
  let extent = chart.style.showOrigin || y.visible !== false && y.showValues
    ? (y.tickLabelSize ?? DEFAULT_TICK_LABEL.size) / 2 : 0;
  if (x.visible !== false) {
    extent = Math.max(extent, tickOffsets(x)[1]);
    if (x.showLabel) extent = Math.max(extent, xTitleOffset(x) + getTextStyle(chart, 'xLabel').size * 0.3);
    if (x.showValues) {
      const { step, angled, width, labelOffset } = categoryTickLayout(chart);
      let size = x.tickLabelSize ?? DEFAULT_TICK_LABEL.size;
      for (const [target, style] of Object.entries(chart.textStyles)) {
        if (/^\d+$/.test(target) && Number(target) < chart.categories.length && Number(target) % step === 0) {
          size = Math.max(size, style.size ?? 0);
        }
      }
      const descent = size * 0.3;
      extent = Math.max(extent, labelOffset + descent + (angled ? Math.max(width, size) * Math.sin(Math.PI / 3) : 0));
    }
  }
  return Math.ceil(extent) + 12;
}

export function constrainPlotOffset(source: ChartStyle | PlotLayout, offset: Point) {
  const chart = plotLayout(source);
  const { x, y } = chart.style.axes;
  const minY = 84 - (DEFAULT_PLOT.bottom - y.length);
  const maxY = Math.max(minY, HEIGHT - DEFAULT_PLOT.bottom - plotBottomInset(chart));
  return {
    x: clamp(offset.x, 62 - DEFAULT_PLOT.left, WIDTH - DEFAULT_PLOT.left - x.length - 20),
    y: clamp(offset.y, minY, maxY),
  };
}

export function getPlot(source: ChartStyle | PlotLayout, offset?: Point): Plot {
  const chart = plotLayout(source);
  const { x, y } = constrainPlotOffset(chart, offset ?? chart.plotOffset);
  const { axes } = chart.style;
  return {
    left: DEFAULT_PLOT.left + x,
    right: DEFAULT_PLOT.left + x + axes.x.length,
    top: DEFAULT_PLOT.bottom + y - axes.y.length,
    bottom: DEFAULT_PLOT.bottom + y,
  };
}

export function movePlot(chart: ChartDocument, offset: Point): ChartDocument {
  const from = constrainPlotOffset(chart, chart.plotOffset);
  const plotOffset = constrainPlotOffset(chart, offset);
  if (from.x === plotOffset.x && from.y === plotOffset.y) return chart;
  const labelPositions = { ...chart.labelPositions };
  for (const label of ['xLabel', 'yLabel'] as const) {
    const position = labelPositions[label];
    if (position) labelPositions[label] = {
      x: clamp(position.x + plotOffset.x - from.x, 6, WIDTH - 6),
      y: clamp(position.y + plotOffset.y - from.y, 18, HEIGHT - Math.ceil(getTextStyle(chart, label).size * 0.3) - 6),
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
    return { point: { x: fits ? x : WIDTH - 6, y: zero + xTitleOffset(chart.style.axes.x) },
      anchor: fits ? 'start' as const : 'end' as const, rotation: 0 };
  }
  const anchor = placement === 'center' ? 'middle' as const : 'start' as const;
  const center = (plot.left + plot.right) / 2;
  const y = axis === 'x' ? plot.bottom + xTitleOffset(chart.style.axes.x) : placement === 'center' ? (plot.top + plot.bottom) / 2
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
    pieColors: chart.pieColors?.filter((_, i) => i !== index),
    pictographSymbols: chart.pictographSymbols?.filter((_, i) => i !== index),
    categories: chart.categories.filter((_, i) => i !== index),
    series: chart.series.map(item => ({ ...item, values: item.values.filter((_, i) => i !== index) })),
  };
}

export function removeSeries(chart: ChartDocument, index: number): ChartDocument {
  if (chart.series.length <= 1 || !chart.series[index]) return chart;
  const updateIndex = (selected?: number) => selected === undefined ? undefined
    : clamp(selected - Number(index < selected), 0, chart.series.length - 2);
  return { ...chart, pieSeries: updateIndex(chart.pieSeries), barSeries: updateIndex(chart.barSeries),
    pictographSeries: updateIndex(chart.pictographSeries),
    scaleExtent: null, series: chart.series.filter((_, i) => i !== index) };
}

export function displayedSeriesField(chart: ChartDocument) {
  if (chart.kind === 'pie') return 'pieSeries' as const;
  if (chart.kind === 'pictograph') return 'pictographSeries' as const;
  if (chart.kind === 'bar' && !chart.groupedColumns) return 'barSeries' as const;
  return null;
}

export function hasChartAxes(kind?: ChartKind) {
  return kind !== 'pie' && kind !== 'pictograph';
}

export function displayedSeries(chart: ChartDocument) {
  const field = displayedSeriesField(chart);
  return field ? [chart.series[chart[field] ?? 0]] : chart.series;
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

export function getTextStyle(chart: Pick<ChartDocument, 'textStyles'> & Partial<Pick<ChartDocument, 'kind' | 'style'>>,
  target: TextTarget): TextStyle {
  const title = target === 'title';
  const axisTitle = target === 'xLabel' || target === 'yLabel';
  const categoryAxis = typeof target === 'number' && hasChartAxes(chart.kind) ? chart.style?.axes.x : undefined;
  const defaultSize = title ? 29 : axisTitle ? 15 : isNote(target) ? 18 : categoryAxis ? DEFAULT_TICK_LABEL.size : 14;
  return {
    font: categoryAxis?.tickLabelFont ?? DEFAULT_TICK_LABEL.font,
    size: categoryAxis?.tickLabelSize ?? defaultSize,
    color: title ? '#1c2540' : '#485861',
    bold: title || axisTitle,
    italic: false,
    underline: false,
    alignment: 'start',
    ...chart.textStyles?.[target],
  };
}

export function exerciseNoteLayout(chart: ChartDocument, note: TextNote) {
  const { size, alignment } = getTextStyle(chart, note.id);
  const x = note.position.x;
  const space = alignment === 'start' ? WIDTH - 8 - x : alignment === 'end' ? x - 8 : 2 * Math.min(x - 8, WIDTH - 8 - x);
  const charactersPerLine = Math.max(1, Math.floor(space / size));
  const letters = Array.from(note.text);
  const lines: string[] = [];
  for (let index = 0; index < letters.length; index += charactersPerLine) {
    lines.push(letters.slice(index, index + charactersPerLine).join(''));
  }
  return { x, y: Math.max(HEIGHT + size + 12, EXERCISE_POSITION.y), lines, lineHeight: Math.ceil(size * 1.3) };
}

export function chartSheetHeight(chart: ChartDocument) {
  return chart.notes.reduce((height, note) => {
    if (!note.exerciseQuestion) return height;
    const { y, lines, lineHeight } = exerciseNoteLayout(chart, note);
    return Math.max(height, y + lineHeight * Math.max(0, lines.length - 1) + Math.max(20, lineHeight / 2));
  }, HEIGHT);
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

function offsetValue(value: number, change: number) {
  const next = clamp(value + change, -Number.MAX_VALUE, Number.MAX_VALUE);
  if (next === value) return value;
  const rounded = round(next);
  return Math.sign(rounded - value) === Math.sign(change) ? rounded : next;
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
  const orderedTicks = [...ticks].sort((a, b) => a - b);
  const snapTicks = [0, ...orderedTicks];

  function yForValue(value: number) {
    if (!split || value <= split.from) return plot.bottom - (value / unit - lower) / drawnSpan * drawHeight;
    if (value >= split.to) return gapTop - (value / unit - breakTo) / drawnSpan * drawHeight;
    return gapBottom - (value / unit - breakFrom) / (breakTo - breakFrom) * gap;
  }

  function valueForPosition(y: number) {
    const band = split && y <= gapTop ? bands[1] : bands[0];
    if (split && y >= gapTop && y <= gapBottom) {
      return { band, value: y - gapTop <= gapBottom - y ? split.to : split.from, boundary: true };
    }
    const ratio = clamp((plot.bottom - y - (band === bands[1] ? gap : 0)) / drawHeight, 0, 1);
    if (ratio === 1 && axis.maximum !== undefined) return { band, value: axis.maximum, boundary: true };
    const normalized = band === bands[1] ? breakTo + (gapTop - Math.max(y, plot.top)) / drawHeight * drawnSpan
      : lower + ratio * drawnSpan;
    return { band, value: fromNormalized(normalized), boundary: false };
  }

  return {
    extent: { min, max },
    limit,
    ticks: orderedTicks,
    bands,
    inBreak,
    omission: split ? { ...split, top: gapTop, bottom: gapBottom } : null,
    tooManyTicks,
    tickSpacing: drawHeight * (visibleStep / drawnSpan),
    includes(value: number) {
      return value >= lowerValue && value <= upperValue && !inBreak(value);
    },
    y: yForValue,
    valueAt(y: number, snapToTick = false) {
      const { band, value, boundary } = valueForPosition(y);
      if (boundary) return value;
      if (snapToTick) {
        let nearest: number | undefined;
        let distance = Infinity;
        for (const tick of snapTicks) {
          if (tick < band.min || tick > band.max) continue;
          const delta = Math.abs(y - yForValue(tick));
          if (delta >= distance) continue;
          nearest = tick;
          distance = delta;
        }
        if (nearest !== undefined) return nearest;
      }
      return increment > 0 ? clamp(round(Math.round(value / increment) * increment),
        band.min, band.max) : clamp(value, band.min, band.max);
    },
    drag(value: number, deltaY: number) {
      if (!deltaY) return value;
      const visible = Math.min(value, limit);
      const anchored = yForValue(visible);
      const { value: before } = valueForPosition(anchored);
      const { value: after, boundary } = valueForPosition(anchored + deltaY);
      if (before === after) return value;
      return boundary && visible === value ? after : offsetValue(value, after - before);
    },
    nudge(value: number, direction: number) {
      const next = offsetValue(value, (increment || Number.MIN_VALUE) * direction);
      if (split && (inBreak(next) || direction > 0 && value === split.from && next === value
        || direction < 0 && value === split.to && next === value)) return direction > 0 ? split.to : split.from;
      return next;
    },
  };
}

export function chartDataWarnings(chart: ChartDocument, scale?: ReturnType<typeof getScale> | null) {
  const limit = hasChartAxes(chart.kind) ? chart.style.axes.y.maximum ?? Infinity : Infinity;
  if (!Number.isFinite(limit) && !scale?.omission && chart.kind !== 'pie') return { clipped: 0, messages: [] };
  const series = displayedSeries(chart);
  let clipped = 0;
  let omitted = 0;
  let negative = 0;
  for (const { values } of series) {
    for (const value of values) {
      if (value === null) continue;
      if (value > limit) clipped++;
      if (scale?.inBreak(value)) omitted++;
      if (chart.kind === 'pie' && value < 0) negative++;
    }
  }
  const messages = [
    clipped ? `${clipped} 个数据值超出纵轴上限 ${formatValue(limit)}，超出部分未显示。` : '',
    omitted && scale?.omission
      ? `${omitted} 个数据值位于断轴省略区间（${formatValue(scale.omission.from)} 至 ${formatValue(scale.omission.to)}）。` : '',
    negative ? `${negative} 个负值未绘制，占比按正数计算。` : '',
  ].filter(Boolean);
  return { clipped, messages };
}

export function categoryX(index: number, count: number, plot: Plot) {
  return plot.left + (plot.right - plot.left) * (index + 0.5) / count;
}

export function visibleMark(mark: Mark, plot: Plot, scale: ReturnType<typeof getScale>, kind?: ChartKind): Mark | null {
  if (mark.referenceValue === undefined) return mark;
  if (!hasChartAxes(kind) || !scale.includes(mark.referenceValue)) return null;
  const y = scale.y(mark.referenceValue);
  return { ...mark, points: [{ x: plot.left, y }, { x: plot.right, y }] };
}

export function pieStyle(style: ChartStyle): PieStyle {
  return { ...DEFAULT_PIE_STYLE, ...style.pie };
}

export function pieColor(chart: ChartDocument, index: number) {
  const palette = PIE_PALETTES[chart.style.pie?.palette ?? DEFAULT_PIE_STYLE.palette];
  return chart.pieColors?.[index] ?? palette[index % palette.length];
}

export function pieSlices(values: (number | null)[], order: PieStyle['order'] = 'data') {
  const maximum = values.reduce((max, value) => Math.max(max, value ?? 0), 0);
  if (!maximum) return [];
  const sectors = values.flatMap((value, index) => value > 0 ? [{ index, value, weight: value / maximum }] : []);
  const total = sectors.reduce((sum, sector) => sum + sector.weight, 0);
  if (order !== 'data') sectors.sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value);
  const turn = Math.PI * 2;
  let cumulative = 0;
  return sectors.map(({ index, value, weight }) => {
    const start = cumulative / total * turn;
    cumulative += weight;
    const end = cumulative / total * turn;
    return { index, start, end, share: weight / total, value };
  });
}

const percentFormatters = [0, 1, 2].map(maximumFractionDigits => new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits }));

export function formatShare(share: number, digits = 1) {
  const threshold = 10 ** -digits;
  return share < threshold / 100 ? `<${threshold}%` : percentFormatters[digits].format(share);
}

export function markPath(points: Point[]) {
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} L ${rest.length ? rest.map(point => `${point.x} ${point.y}`).join(' ') : `${first.x + 0.01} ${first.y}`}`;
}
