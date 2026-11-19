import { clamp, estimateTextWidth, HEIGHT, shorten, TEXT_FONTS, WIDTH } from './chart';
import { isPictographSymbol } from './pictographSymbols';
import type { ChartDocument, PictographStyle, Point } from './types';

export const DEFAULT_PICTOGRAPH_SHAPE = {
  symbol: 'circle', symbolMode: 'shared', colorMode: 'color', outline: false, frame: false, frameColor: undefined,
  direction: 'horizontal', symbolSize: 26, symbolGap: 5, guides: true,
  unit: undefined, unitLabel: undefined,
} as const;

export const DEFAULT_PICTOGRAPH_LEGEND = {
  showKey: true, legendText: undefined, legendAlignment: 'auto', legendFont: 'system', legendFontSize: 16,
  legendColor: '#485861', legendBold: false, legendIcon: 'auto',
} as const;

export const DEFAULT_PICTOGRAPH_STYLE: PictographStyle = { ...DEFAULT_PICTOGRAPH_SHAPE, ...DEFAULT_PICTOGRAPH_LEGEND };

export const PICTOGRAPH_PRESETS = {
  circles: { label: '竖排圆圈', style: { direction: 'vertical', symbol: 'circle', symbolMode: 'shared', outline: true, frame: false, guides: true } },
  categories: { label: '按类别排图符', style: { direction: 'vertical', symbolMode: 'category', outline: true, frame: false, guides: true } },
  table: { label: '横向对照表', style: { direction: 'horizontal', symbolMode: 'shared', outline: false, frame: true, guides: true } },
} as const satisfies Record<string, { label: string; style: Partial<PictographStyle> }>;

const CATEGORY_SYMBOLS = ['circle', 'triangle', 'square', 'diamond', 'star', 'heart'] as const;
const keyFormatter = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 16 });
export const PICTOGRAPH_LEGEND_LIMIT = 180;
const LEGEND_PARAGRAPHS = 5;

export function pictographSymbolAt(chart: ChartDocument, index: number): PictographStyle['symbol'] {
  return chart.style.pictograph?.symbolMode === 'category'
    ? chart.pictographSymbols?.[index] ?? CATEGORY_SYMBOLS[index % CATEGORY_SYMBOLS.length]
    : chart.style.pictograph?.symbol ?? DEFAULT_PICTOGRAPH_STYLE.symbol;
}

export function isPictographStyle(value: unknown): value is Partial<PictographStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const style = value as Record<string, unknown>;
  const inRange = (item: unknown, min: number, max: number) => item === undefined
    || typeof item === 'number' && Number.isFinite(item) && item >= min && item <= max;
  const option = (item: unknown, values: string[]) => item === undefined || values.includes(item as string);
  const color = (item: unknown) => item === undefined || typeof item === 'string' && /^#[0-9a-f]{6}$/i.test(item);
  return (style.symbol === undefined || isPictographSymbol(style.symbol))
    && (style.symbolMode === undefined || style.symbolMode === 'shared' || style.symbolMode === 'category')
    && (style.colorMode === undefined || style.colorMode === 'single' || style.colorMode === 'color')
    && (style.direction === undefined || style.direction === 'horizontal' || style.direction === 'vertical')
    && inRange(style.unit, Number.MIN_VALUE, Number.MAX_VALUE)
    && (style.unitLabel === undefined || typeof style.unitLabel === 'string' && style.unitLabel.length <= 24)
    && inRange(style.symbolSize, 14, 38) && inRange(style.symbolGap, 0, 12)
    && inRange(style.legendFontSize, 12, 24)
    && color(style.frameColor) && color(style.legendColor)
    && option(style.legendAlignment, ['auto', 'start', 'center', 'end'])
    && option(style.legendIcon, ['auto', 'show', 'hide'])
    && option(style.legendFont, Object.keys(TEXT_FONTS))
    && (style.legendText === undefined || typeof style.legendText === 'string' && style.legendText.length <= PICTOGRAPH_LEGEND_LIMIT)
    && [style.guides, style.showKey, style.frame, style.outline, style.legendBold]
      .every(flag => flag === undefined || typeof flag === 'boolean');
}

export function updatePictographStyle(chart: ChartDocument, changes: Partial<PictographStyle>): ChartDocument {
  const previous = { ...DEFAULT_PICTOGRAPH_STYLE, ...chart.style.pictograph };
  const reflow = (['direction', 'frame', 'legendAlignment', 'symbolMode'] as const)
    .some(key => Object.hasOwn(changes, key) && previous[key] !== changes[key]);
  const next = { ...chart, style: { ...chart.style, pictograph: { ...chart.style.pictograph, ...changes } } };
  return reflow ? resetPictographLegend(next) : next;
}

export function savePictographLegendText(chart: ChartDocument, text: string): ChartDocument {
  const legendText = text.replace(/\r\n?/g, '\n').trim().slice(0, PICTOGRAPH_LEGEND_LIMIT) || undefined;
  if (legendText === chart.style.pictograph?.legendText) return chart;
  return updatePictographStyle(chart, { legendText });
}

function automaticUnit(maximum: number, targetCount: number) {
  if (maximum <= 0) return 1;
  const target = maximum / targetCount;
  const magnitude = 10 ** Math.max(-323, Math.floor(Math.log10(target)));
  return ([1, 2, 5, 10].map(step => step * magnitude).find(step => step >= target) ?? magnitude) || Number.MIN_VALUE;
}

function symbolCount(value: number, unit: number) {
  const count = value > 0 ? value / unit : 0;
  const rounded = Math.round(count);
  return rounded > 0 && Math.abs(count - rounded) <= Number.EPSILON * rounded * 4 ? rounded : count;
}

export function pictographLayout(chart: ChartDocument) {
  const style = { ...DEFAULT_PICTOGRAPH_STYLE, ...chart.style.pictograph };
  const seriesIndex = chart.pictographSeries ?? 0;
  const series = chart.series[seriesIndex];
  const vertical = style.direction === 'vertical';
  const maximum = series.values.reduce((max, value) => Math.max(max, value ?? 0), 0);
  const fractional = series.values.some(value => value > 0 && !Number.isInteger(value));
  const automatic = automaticUnit(maximum, vertical ? 8 : 12);
  const unit = style.unit ?? (fractional ? automatic : Math.max(1, automatic));
  const unitLabel = style.unitLabel ?? shorten(chart.yLabel.match(/[（(]([^()（）]+)[）)]\s*$/)?.[1] ?? '', 24);
  const capacity = vertical ? 18 : 36;
  const counts = series.values.map(value => symbolCount(value ?? 0, unit));
  const span = counts.reduce((max, count) => count <= capacity ? Math.max(max, Math.ceil(count)) : max, 1);
  const overflow = counts.some(count => count > capacity);
  const negative = series.values.some(value => value < 0);
  const { legend, plot, warningY } = pictographGeometry(style, chart.pictographLegendPosition, unit, unitLabel, overflow || negative);
  return { style, series, seriesIndex, unit, unitLabel, vertical, capacity, counts, span, overflow, negative, legend, plot, warningY };
}

function wrapLegend(text: string, maxWidth: number, size: number) {
  const paragraphs = text.split('\n');
  const limited = [...paragraphs.slice(0, LEGEND_PARAGRAPHS - 1), paragraphs.slice(LEGEND_PARAGRAPHS - 1).join(' ')].filter(line => line.trim());
  return limited.flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    let width = 0;
    for (const char of paragraph) {
      const nextWidth = estimateTextWidth(char, size);
      if (line && width + nextWidth > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
        width = 0;
      }
      if (!line && char === ' ') continue;
      line += char;
      width += nextWidth;
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  });
}

function pictographGeometry(style: PictographStyle, desired: Point | undefined, unit: number, unitLabel: string, warning: boolean) {
  const vertical = style.direction === 'vertical';
  const left = vertical ? 55 : 50;
  const right = WIDTH - 50;
  const top = vertical ? 132 : 105;
  const naturalBottom = vertical ? 433 : 469;
  const symbolLeft = 192;
  const categorySpace = vertical ? 35 : 0;
  const amount = unit >= 1e12 || unit < 1e-5 ? String(unit) : keyFormatter.format(unit);
  const text = `表示 ${amount}${unitLabel ? ` ${unitLabel}` : ''}`;
  const automaticText = style.symbolMode === 'category' ? `每个图符都${text}` : `每个图符${text}`;
  const label = style.legendText?.replaceAll('{数量}', () => amount).replaceAll('{单位}', () => unitLabel).trim() || automaticText;
  const showIcon = style.legendIcon === 'show' || style.legendIcon === 'auto' && style.symbolMode === 'shared';
  const iconSize = showIcon ? Math.round(style.legendFontSize * 1.375) : 0;
  const textX = showIcon ? iconSize + 7 : 0;
  const alignment = style.legendAlignment === 'auto' ? vertical ? 'center' : 'start' : style.legendAlignment;
  const start = !vertical && style.legendAlignment === 'auto' ? symbolLeft : left;
  const measureSize = style.legendFontSize * (style.legendBold ? 1.05 : 1);
  const lines = wrapLegend(shorten(label, PICTOGRAPH_LEGEND_LIMIT), right - start - textX - 8, measureSize);
  const lineHeight = Math.ceil(style.legendFontSize * 1.3);
  const firstRowHeight = Math.max(lineHeight, iconSize);
  const height = firstRowHeight + Math.max(0, lines.length - 1) * lineHeight;
  const width = Math.ceil(textX + Math.max(0, ...lines.map(line => estimateTextWidth(line, measureSize))));
  const x = alignment === 'start' ? start : alignment === 'end' ? right - width : (left + right - width) / 2;
  const maxLegendBottom = HEIGHT - (warning ? 42 : 18);
  const bottom = style.showKey ? Math.min(naturalBottom, maxLegendBottom - height - categorySpace - 15) : naturalBottom;
  const naturalPosition = { x, y: bottom + categorySpace + 15 };
  const bounds = { x: [9, WIDTH - width - 9] as [number, number], y: [9, HEIGHT - height - 9] as [number, number] };
  const requested = desired ?? naturalPosition;
  const position = { x: clamp(requested.x, ...bounds.x), y: clamp(requested.y, ...bounds.y) };
  return { plot: { top, bottom, left, right, symbolLeft }, warningY: HEIGHT - 15, legend: {
    automaticText, label, lines, position, naturalPosition, width, height, bounds, textX, lineHeight, iconSize,
    textY: (firstRowHeight - lineHeight) / 2 + style.legendFontSize, iconY: (firstRowHeight - iconSize) / 2,
  } };
}

export function resetPictographLegend(chart: ChartDocument): ChartDocument {
  return chart.pictographLegendPosition ? { ...chart, pictographLegendPosition: undefined } : chart;
}
