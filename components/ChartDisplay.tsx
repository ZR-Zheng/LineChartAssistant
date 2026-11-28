import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, PointerEvent, ReactNode, RefObject } from 'react';
import { AXIS_LENGTHS, axisTitleLayout, categoryTickLayout, categoryX, chartDataWarnings, clamp, constrainPlotOffset, DEFAULT_AXIS_ARROWHEAD, DEFAULT_GROUP_WIDTH,
  dataLabelStyle, dataLabelTextAttributes, DEFAULT_TICK_LABEL, displayedSeries, estimateTextWidth, exerciseNoteLayout, FONT, formatValue, getPlot, getScale, getSeriesStyle, getTextStyle, hasChartAxes, HEIGHT,
  hideText, isLightColor, isNote, markPath, movePlot, removeNote, setChartValue, shorten,
  STATISTIC_LABELS, TEXT_FONTS, textValue, tickOffsets, verticalAxisExtension, visibleMark, WIDTH } from '../chart';
import type { Plot } from '../chart';
import { columnIconRows, formatValueLabels, layoutSeriesLegend, LEGEND_FONT_SIZE, LEGEND_LINE_HEIGHT, placeValueLabels,
  spacedTickLabels, VALUE_FONT_SIZE } from '../chartPresentation';
import { arrowOffset, NO_TARGETS, snapEndpoint, snapPoint, translateLine } from '../alignment';
import type { Guides, SnapTargets } from '../alignment';
import { movePie, pieLayout, pieMoveBounds, resetPieLegend } from '../pieLayout';
import { pictographLayout, resetPictographLegend, resizePictographTable, setPictographCategoryShare } from '../pictograph';
import type { ArrowPlacement, Axis, AxisLabel, ChartDocument, ChartEdit, DataHighlight, Datum, EraseScope, LineKind, Mark, NoteTarget, Point,
  Selection, SeriesStyle, Statistic, TextStyle, TextTarget, Tool } from '../types';
import StyledLine from './StyledLine';
import PieGraphic from './PieGraphic';
import PictographGraphic from './PictographGraphic';
import PictographIcon from './PictographIcon';
import type { CanvasObjectProps } from './canvasInteraction';
import './canvasInteraction.css';

type Scale = ReturnType<typeof getScale>;
type MovableText = AxisLabel | NoteTarget;
type NewNote = { id: NoteTarget; position: Point; style?: Partial<TextStyle> };
const NO_GUIDES: Guides = {};
type Gesture = {
  pointer: number;
  start: Point;
  base: ChartDocument;
  tolerance: number;
  targets: SnapTargets;
} & (
  | { type: 'data'; datum: Datum; value: number | null; scale: Scale; moved: boolean }
  | { type: 'draw'; mark: Mark; statistic?: Statistic }
  | { type: 'line'; index: number; endpoint: 0 | 1 | null; mark: Mark }
  | { type: 'label'; label: MovableText; position: Point; defaultPosition?: Point;
    boundsX: [number, number]; boundsY: [number, number]; moved: boolean; pieTarget?: { center: Point; radius: number } }
  | { type: 'legend'; legend: 'pie-legend' | 'pictograph-legend';
    position: Point; boundsX: [number, number]; boundsY: [number, number]; moved: boolean; defaultPosition?: Point }
  | { type: 'pie-plot'; datum: Datum | null; position: Point; boundsX: [number, number]; boundsY: [number, number]; moved: boolean }
  | { type: 'axis'; axis: Axis }
  | { type: 'plot'; axis: Axis | 'both'; offset: Point }
  | { type: 'pictograph-table'; width: number; height: number }
  | { type: 'pictograph-category'; percent: number; length: number; vertical: boolean }
  | { type: 'newText' }
);

interface Props {
  document: ChartDocument;
  tool?: Tool | 'preview';
  ink?: string;
  inkWidth?: number;
  inkOpacity?: number;
  inkArrows?: ArrowPlacement;
  lineKind?: LineKind;
  eraseScope?: EraseScope;
  newTextStyle?: Partial<TextStyle>;
  snap?: boolean;
  snapAddedPoint?: boolean;
  selection?: Selection | null;
  onSelect?: (selection: Selection | null) => void;
  highlight?: DataHighlight | null;
  onOccupiedDataPoint?: () => void;
  activeSeries?: number;
  onSelectSeries?: (index: number) => void;
  stats?: Record<Statistic, number> | null;
  onAddStatistic?: (statistic: Statistic) => void;
  onEditPictographLegend?: () => void;
  onEditObject?: (selection: Selection, trigger: SVGElement) => void;
  onEdit?: ChartEdit;
  svgRef?: RefObject<SVGSVGElement | null>;
}

function withinPlot({ x, y }: Point, plot: Plot) {
  return x >= plot.left && x <= plot.right && y >= plot.top && y <= plot.bottom;
}

function resizeAxis(chart: ChartDocument, axis: Axis, delta: number) {
  const previous = chart.style.axes[axis];
  const { min, max } = AXIS_LENGTHS[axis];
  const length = clamp(Math.round(previous.length + delta), min, max);
  return length === previous.length ? chart
    : { ...chart, style: { ...chart.style, axes: { ...chart.style.axes, [axis]: { ...previous, length } } } };
}

function pieNoteTargets(center: Point, radius: number): SnapTargets {
  return { x: [center.x - radius, center.x, center.x + radius], y: [center.y - radius, center.y, center.y + radius] };
}

function SeriesDot({ x, y, size, color, width, shape, fill }: {
  x: number; y: number; size: number; color: string; width: number; shape: SeriesStyle['dotShape']; fill: SeriesStyle['dotFill'];
}) {
  const paint = { fill: fill === 'solid' ? color : '#fff', stroke: color, strokeWidth: width, strokeLinejoin: 'round' as const };
  if (shape === 'square') return <rect x={x - size} y={y - size} width={2 * size} height={2 * size} {...paint} />;
  if (shape === 'diamond') return <path d={`M ${x} ${y - size} l ${size} ${size} -${size} ${size} -${size} -${size} Z`} {...paint} />;
  return <circle cx={x} cy={y} r={size} {...paint} />;
}

function ColumnIcons({ symbolId, x, top, bottom, maxSize, rows }: {
  symbolId: string; x: number; top: number; bottom: number; maxSize: number; rows: ReturnType<typeof columnIconRows>;
}) {
  return <g data-column-icons="" aria-hidden="true">
    {rows.map(row => {
      const start = Math.max(top, row.top);
      const end = Math.min(bottom, row.bottom);
      if (end - start <= 1e-6) return null;
      const size = Math.min(maxSize, (end - start) * 0.86);
      return <use key={row.top} href={`#${symbolId}`} x={x - size / 2} y={(start + end - size) / 2} width={size} height={size} />;
    })}
  </g>;
}

function linePath(values: (number | null)[], scale: Scale, plot: Plot) {
  return scale.bands.map(({ min, max }) => values.map((value, index) => {
    if (value === null) return '';
    const before = values[index - 1] ?? null;
    const inside = value >= min && value <= max;
    const x = categoryX(index, values.length, plot);
    if (before === null) return inside ? `M${x},${scale.y(value)}` : '';
    if (Math.max(before, value) < min || Math.min(before, value) > max) return '';
    if (inside && before >= min && before <= max) return `L${x},${scale.y(value)}`;

    const previousX = categoryX(index - 1, values.length, plot);
    const difference = value - before;
    const crossing = (edge: number) => {
      const fraction = Number.isFinite(difference) ? (edge - before) / difference
        : (edge / 2 - before / 2) / (value / 2 - before / 2);
      return `${previousX + (x - previousX) * fraction},${scale.y(edge)}`;
    };
    const start = before < min || before > max ? `M${crossing(clamp(before, min, max))} ` : '';
    return `${start}L${inside ? `${x},${scale.y(value)}` : crossing(clamp(value, min, max))}`;
  }).join(' ')).join(' ');
}

function hasLineNeighbor(value: number, neighbor: number | null | undefined, bands: Scale['bands']) {
  return neighbor != null && bands.some(({ min, max }) => value >= min && value <= max
    && (neighbor >= min || value > min) && (neighbor <= max || value < max));
}

function textBounds(element: SVGGraphicsElement, canvasMatrix: DOMMatrix) {
  const box = element.getBBox();
  const transform = canvasMatrix.inverse().multiply(element.getScreenCTM() ?? canvasMatrix);
  const corners = [
    new DOMPoint(box.x, box.y), new DOMPoint(box.x + box.width, box.y),
    new DOMPoint(box.x, box.y + box.height), new DOMPoint(box.x + box.width, box.y + box.height),
  ].map(point => point.matrixTransform(transform));
  return {
    left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)),
    top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)),
  };
}

function alignmentTargets(document: ChartDocument, plot: Plot, scale: Scale, skipLine?: number, skipLabel?: MovableText) {
  const { left, right, top, bottom } = plot;
  const x = [left, right, (left + right) / 2, WIDTH / 2];
  const y = [top, bottom, (top + bottom) / 2, HEIGHT / 2];
  if (hasChartAxes(document.kind)) {
    y.push(scale.y(0), ...scale.ticks.map(value => scale.y(value)));
    for (let i = 0; i < document.categories.length; i++) x.push(categoryX(i, document.categories.length, plot));
  }
  document.marks.forEach((item, index) => {
    if (item.type !== 'line' || index === skipLine) return;
    const mark = visibleMark(item, plot, scale, document.kind);
    if (!mark) return;
    const [start, end] = mark.points;
    x.push(start.x, end.x, (start.x + end.x) / 2);
    y.push(start.y, end.y, (start.y + end.y) / 2);
  });
  for (const label of ['xLabel', 'yLabel'] as const) {
    const axis = label === 'xLabel' ? 'x' : 'y';
    if (!hasChartAxes(document.kind) || document.style.axes[axis].visible === false || !document.style.axes[axis].showLabel) continue;
    const anchor = axisTitleLayout(axis, plot, document, scale.y(0)).point;
    const position = label === skipLabel ? anchor : document.labelPositions[label] ?? anchor;
    x.push(position.x);
    y.push(position.y);
  }
  for (const note of document.notes) {
    if (note.id === skipLabel || note.exerciseQuestion) continue;
    x.push(note.position.x);
    y.push(note.position.y);
  }
  return { x, y };
}

function ChartDisplay({
  document, tool = 'preview', ink = '#cb552e', inkWidth = 3.5, inkOpacity = 1, inkArrows = 'end', lineKind = 'solid',
  eraseScope = 'marks', newTextStyle, snap = true, snapAddedPoint = false,
  selection = null, highlight, onSelect, activeSeries = 0, onSelectSeries, onOccupiedDataPoint, stats, onAddStatistic,
  onEditPictographLegend, onEditObject, onEdit, svgRef,
}: Props) {
  const columnSymbolPrefix = `column-icon-${useId().replace(/[^a-z\d_-]/gi, '')}`;
  const selectedLine = selection?.kind === 'mark' ? selection.index : null;
  const selectedText = selection?.kind === 'text' ? selection.target : null;
  const eraseMarks = tool === 'eraser' && eraseScope !== 'data';
  const eraseData = tool === 'eraser' && eraseScope !== 'marks';
  const gesture = useRef<Gesture | null>(null);
  const lastLegendClick = useRef<{ time: number; x: number; y: number } | null>(null);
  const draftRef = useRef<ChartDocument | null>(null);
  const guidesRef = useRef<Guides>(NO_GUIDES);
  const pendingMove = useRef<globalThis.PointerEvent | null>(null);
  const previewFrame = useRef<number | null>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const editorTrigger = useRef<SVGElement>(null);
  const skipTextBlur = useRef(false);
  const nextNoteNumber = useRef(1);
  const focusedNode = useRef<SVGElement>(null);
  const [draft, setDraft] = useState<ChartDocument | null>(null);
  const [editing, setEditing] = useState<TextTarget | null>(null);
  const [newNote, setNewNote] = useState<NewNote | null>(null);
  const [guides, setGuides] = useState<Guides>(NO_GUIDES);
  const [focusedObject, setFocusedObject] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const attachCanvas = useCallback((node: SVGSVGElement | null) => {
    canvasRef.current = node;
    if (svgRef) svgRef.current = node;
  }, [svgRef]);

  const canvasObject: CanvasObjectProps = (key, adjustable = false) => ({
    'data-canvas-object': key,
    'data-canvas-adjustable': adjustable ? '' : undefined,
    'data-canvas-adjusting': adjusting && focusedObject === key ? '' : undefined,
    'aria-description': adjustable ? adjusting && focusedObject === key
      ? '方向键调节，按 Escape 结束。' : '按 Enter 启用调节，或按 Alt 和方向键微调。' : undefined,
    tabIndex: focusedObject === key ? 0 : -1,
  });

  const stopGesture = () => {
    if (previewFrame.current !== null) cancelAnimationFrame(previewFrame.current);
    previewFrame.current = null;
    pendingMove.current = null;
    gesture.current = null;
    draftRef.current = null;
    guidesRef.current = NO_GUIDES;
    setDraft(null);
    setGuides(NO_GUIDES);
  };

  useEffect(() => () => {
    if (previewFrame.current !== null) cancelAnimationFrame(previewFrame.current);
  }, []);

  useEffect(() => {
    if (tool === 'preview') return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) stopGesture();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [tool]);

  useEffect(() => {
    if (tool !== 'preview') stopGesture();
  }, [document, tool]);

  useEffect(() => {
    if (selectedText === null) setEditing(null);
  }, [selectedText]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!focusedObject || !canvas || canvas.querySelector(`[data-canvas-object="${CSS.escape(focusedObject)}"]`)) return;
    setFocusedObject(null);
    setAdjusting(false);
    if (focusedNode.current && !focusedNode.current.isConnected && canvas.ownerDocument.activeElement === canvas.ownerDocument.body) {
      canvas.focus({ preventScroll: true });
    }
  }, [focusedObject, document, tool, selection]);

  function focusCanvasObject(event: FocusEvent<SVGSVGElement>) {
    const object = (event.target as Element).closest<SVGElement>('[data-canvas-object]');
    if (!object || object.dataset.canvasObject === focusedObject) return;
    focusedNode.current = object;
    setFocusedObject(object.dataset.canvasObject);
    setAdjusting(false);
  }

  function navigateCanvas(event: KeyboardEvent<SVGSVGElement>) {
    const target = event.target as Element;
    if (target.closest('foreignObject') || event.isComposing || event.ctrlKey || event.metaKey) return;
    const object = target.closest<SVGElement>('[data-canvas-object]');
    if (object?.hasAttribute('data-canvas-adjustable') && !event.altKey &&
      (event.key === 'Enter' || event.key === ' ' || adjusting && event.key === 'Escape')) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) setAdjusting(!adjusting);
      return;
    }
    if (event.altKey || adjusting || !arrowOffset(event.key, false)) return;
    const canvas: SVGSVGElement = event.currentTarget;
    const objects = Array.from(canvas.querySelectorAll<SVGElement>('[data-canvas-object]'));
    if (!objects.length) return;
    if (selectedLine !== null && objects.at(-1)?.dataset.endpoint !== undefined) {
      const endpoints = objects.splice(-2);
      const line = objects.findIndex(item => item.dataset.canvasObject === `mark:${selectedLine}`);
      objects.splice(line < 0 ? objects.length : line + 1, 0, ...endpoints);
    }
    event.preventDefault();
    event.stopPropagation();
    const index = object ? objects.indexOf(object) : -1;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = index < 0 ? direction === 1 ? 0 : objects.length - 1 : (index + direction + objects.length) % objects.length;
    objects[next].focus();
  }

  function activateCanvasObject(event: KeyboardEvent<SVGElement>, next: Selection) {
    if (event.key !== 'Enter' && event.key !== ' ') return false;
    event.preventDefault();
    onSelect?.(next);
    onEditObject?.(next, event.currentTarget);
    return true;
  }

  function setPreview(preview: ChartDocument) {
    draftRef.current = preview;
  }

  function pointerPosition(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Point | null {
    const matrix = canvasRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(point.x, 0, WIDTH), y: clamp(point.y, 0, HEIGHT) };
  }

  function startGesture(event: PointerEvent<SVGSVGElement>) {
    if (tool === 'preview' || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const element = event.target as Element;
    if (element.closest('foreignObject')) return;
    const target = element.closest<SVGElement>('[data-datum], [data-mark], [data-editable], [data-move-text], [data-note], [data-axis-end], [data-axis-target], [data-stat], [data-pie-legend], [data-pictograph-legend], [data-pictograph-table-resize], [data-pictograph-category-resize], [data-pie-move]');
    if (!target?.hasAttribute('data-pictograph-legend')) lastLegendClick.current = null;
    const movingText = target?.dataset.moveText as MovableText | undefined;
    if (target?.hasAttribute('data-editable') && !movingText) return;

    const point = pointerPosition(event);
    if (!point) return;
    if (editorRef.current !== event.currentTarget.ownerDocument.activeElement) {
      event.currentTarget.focus({ preventScroll: true });
    }
    const plot = getPlot(document);
    const hasAxes = hasChartAxes(document.kind);
    const scale = hasAxes ? getScale(displayedSeries(document), document.scaleExtent, plot, document.style.axes.y) : getScale([]);
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const tolerance = clamp(7 / Math.hypot(matrix.a, matrix.b), 4, 19);
    const indexOfMark = target?.hasAttribute('data-mark') ? Number(target.dataset.mark) : undefined;
    const datum = target?.hasAttribute('data-datum')
      ? { series: Number(target.dataset.series), index: Number(target.dataset.index) }
      : null;

    if (tool === 'eraser') {
      if (eraseMarks && indexOfMark !== undefined) {
        onSelect?.(null);
        onEdit(current => ({ ...current, marks: current.marks.filter((_, i) => indexOfMark !== i) }));
      } else if (eraseMarks && target?.dataset.note) {
        onEdit(current => removeNote(current, target.dataset.note as NoteTarget));
      } else if (eraseData && datum) {
        onEdit(current => setChartValue(current, datum.series, datum.index, null));
      }
      return;
    }

    const base = {
      pointer: event.pointerId, start: point, base: document, tolerance,
      targets: NO_TARGETS,
    };
    if (tool === 'select' && target?.hasAttribute('data-pictograph-table-resize')) {
      const { table } = pictographLayout(document);
      gesture.current = { ...base, type: 'pictograph-table', width: table.width, height: table.height };
    } else if (tool === 'select' && target?.hasAttribute('data-pictograph-category-resize')) {
      const { table, vertical } = pictographLayout(document);
      gesture.current = { ...base, type: 'pictograph-category', percent: table.category.percent, length: table.category.length, vertical };
    } else if (tool === 'select' && target?.hasAttribute('data-pie-legend')) {
      const group = target as SVGGElement;
      const transform = group.transform.baseVal.getItem(0).matrix;
      const position = { x: transform.e, y: transform.f };
      const box = textBounds(group, matrix);
      gesture.current = { ...base, type: 'legend', legend: 'pie-legend', position, moved: false,
        boundsX: [position.x - box.left + 5, WIDTH - (box.right - position.x) - 5],
        boundsY: [position.y - box.top + 5, HEIGHT - (box.bottom - position.y) - 5],
        targets: alignmentTargets(document, plot, scale) };
    } else if (tool === 'select' && target?.hasAttribute('data-pictograph-legend')) {
      const { legend } = pictographLayout(document);
      const targets = alignmentTargets(document, plot, scale);
      targets.x.push(legend.naturalPosition.x);
      targets.y.push(legend.naturalPosition.y);
      gesture.current = { ...base, type: 'legend', legend: 'pictograph-legend', position: legend.position, moved: false,
        boundsX: legend.bounds.x, boundsY: legend.bounds.y, targets, defaultPosition: legend.naturalPosition };
    } else if (movingText) {
      const note = isNote(movingText) ? document.notes.find(note => note.id === movingText) : null;
      const exercise = note?.exerciseQuestion ? exerciseNoteLayout(document, note) : null;
      const defaultPosition = isNote(movingText) ? undefined
        : axisTitleLayout(movingText === 'xLabel' ? 'x' : 'y', plot, document, scale.y(0)).point;
      const position = isNote(movingText) ? exercise ?? note.position
        : document.labelPositions[movingText] ?? defaultPosition;
      const box = textBounds(target as SVGGraphicsElement, matrix);
      const targets = exercise ? NO_TARGETS : alignmentTargets(document, plot, scale, undefined, movingText);
      const pieChart = document.kind === 'pie' && note && !exercise ? pieLayout(document) : null;
      const pieTarget = pieChart && { center: pieChart.center, radius: pieChart.style.radius };
      if (pieTarget) {
        const guides = pieNoteTargets(pieTarget.center, pieTarget.radius);
        targets.x.push(...guides.x);
        targets.y.push(...guides.y);
      }
      gesture.current = {
        ...base, type: 'label', label: movingText, position, defaultPosition, moved: false,
        boundsX: [position.x - box.left + 5, WIDTH - (box.right - position.x) - 5],
        boundsY: exercise ? [exercise.y, exercise.y] : [position.y - box.top + 5, HEIGHT - (box.bottom - position.y) - 5],
        targets, pieTarget,
      };
    } else if (target?.hasAttribute('data-axis-end')) {
      gesture.current = { ...base, type: 'axis', axis: target.dataset.axisEnd as Axis };
    } else if (target?.hasAttribute('data-axis-target')) {
      gesture.current = { ...base, type: 'plot', axis: target.dataset.axisTarget as Axis | 'both',
        offset: constrainPlotOffset(document, document.plotOffset) };
    } else if (indexOfMark !== undefined && (tool === 'line' || tool === 'select')) {
      const endpoint = target.dataset.endpoint === undefined ? null : Number(target.dataset.endpoint) as 0 | 1;
      const mark = visibleMark(document.marks[indexOfMark], plot, scale, document.kind);
      if (!mark) return;
      gesture.current = {
        ...base, type: 'line', index: indexOfMark, endpoint, mark,
        targets: alignmentTargets(document, plot, scale, indexOfMark),
      };
    } else if (tool === 'select' && document.kind === 'pie') {
      if (!datum && !target?.hasAttribute('data-pie-move')) {
        editorRef.current?.blur();
        onSelect(null);
        return;
      }
      const layout = pieLayout(document);
      const bounds = pieMoveBounds(document, layout);
      gesture.current = { ...base, type: 'pie-plot', datum, position: layout.center, moved: false,
        boundsX: bounds.x, boundsY: bounds.y, targets: alignmentTargets(document, plot, scale) };
    } else if (tool === 'select' && document.kind === 'pictograph') {
      editorRef.current?.blur();
      onSelect(datum ? { kind: 'data', datum } : null);
      return;
    } else if (tool === 'select' || tool === 'add-data') {
      const adding = tool === 'add-data';
      if (adding ? !hasAxes || !withinPlot(point, plot) : !datum) {
        editorRef.current?.blur();
        onSelect?.(null);
        return;
      }
      const index = Math.floor((point.x - plot.left) / (plot.right - plot.left) * document.categories.length);
      const selected = adding ? { series: activeSeries, index: clamp(index, 0, document.categories.length - 1) } : datum;
      const value = document.series[selected.series].values[selected.index];
      if (adding && value !== null) {
        onOccupiedDataPoint?.();
        return;
      }
      gesture.current = { ...base, type: 'data', datum: selected, scale, value, moved: adding };
      onSelectSeries(selected.series);
      if (adding) setPreview(setChartValue(document, selected.series, selected.index, scale.valueAt(point.y, snapAddedPoint && !event.altKey)));
    } else if (tool === 'text') {
      gesture.current = { ...base, type: 'newText' };
    } else {
      const targets = tool === 'line' ? alignmentTargets(document, plot, scale) : NO_TARGETS;
      if (tool === 'line' && stats && hasAxes) {
        for (const value of Object.values(stats)) if (scale.includes(value)) targets.y.push(scale.y(value));
      }
      const start = tool === 'line' && snap && !event.altKey ? snapPoint(point, targets, tolerance).point : point;
      const mark: Mark = {
        type: tool, color: ink, width: inkWidth, opacity: inkOpacity, points: tool === 'line' ? [start, start] : [start],
        ...(tool === 'line' && { lineKind, arrows: inkArrows }),
      };
      gesture.current = { ...base, type: 'draw', mark, targets,
        statistic: target?.dataset.stat as Statistic | undefined };
      if (tool === 'pen') setPreview({ ...document, marks: [...document.marks, mark] });
    }
    if (draftRef.current) setDraft(draftRef.current);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: globalThis.PointerEvent, finish = false) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    const point = pointerPosition(event);
    if (!point) return;
    const offset = { x: point.x - current.start.x, y: point.y - current.start.y };
    const distance = Math.hypot(offset.x, offset.y);
    const threshold = Math.max(2, current.tolerance * 0.35);
    const targets = snap && !event.altKey ? current.targets : NO_TARGETS;
    const tolerance = snap && !event.altKey ? current.tolerance : 0;

    if (current.type === 'newText') return;

    if (current.type === 'data') {
      if (!current.moved && Math.abs(offset.y) < threshold) return;
      current.moved = true;
      const { datum, scale, value } = current;
      const next = value === null ? scale.valueAt(point.y, snapAddedPoint && !event.altKey) : scale.drag(value, offset.y);
      setPreview(setChartValue(current.base, datum.series, datum.index, next));
      return;
    }

    if (current.type === 'plot') {
      if (distance < threshold && !draftRef.current) return;
      setPreview(movePlot(current.base, { x: current.offset.x + offset.x, y: current.offset.y + offset.y }));
      return;
    }

    if (current.type === 'pictograph-table') {
      if (distance < threshold && !draftRef.current) return;
      setPreview(resizePictographTable(current.base, {
        width: current.width + 2 * offset.x,
        height: current.height + offset.y,
      }));
      return;
    }

    if (current.type === 'pictograph-category') {
      const change = current.vertical ? -offset.y : offset.x;
      if (Math.abs(change) < threshold && !draftRef.current) return;
      setPreview(setPictographCategoryShare(current.base, current.percent + change / current.length * 100));
      return;
    }

    if (current.type === 'axis') {
      if (distance < threshold && !draftRef.current) return;
      const { axis } = current;
      setPreview(resizeAxis(current.base, axis, axis === 'x' ? offset.x : -offset.y));
      return;
    }

    if (current.type === 'label' || current.type === 'legend' || current.type === 'pie-plot') {
      if (!current.moved && distance < threshold) return;
      current.moved = true;
      const { position } = current;
      const { point, guides } = snapPoint(
        { x: position.x + offset.x, y: position.y + offset.y }, targets, tolerance,
        { x: current.boundsX, y: current.boundsY },
      );
      guidesRef.current = guides;
      const base = current.base;
      if (point.x === position.x && point.y === position.y) setPreview(base);
      else if (current.type === 'legend') {
        if (current.legend === 'pictograph-legend') {
          const { defaultPosition } = current;
          setPreview(point.x === defaultPosition.x && point.y === defaultPosition.y ? resetPictographLegend(base)
            : { ...base, pictographLegendPosition: point });
        } else {
          const { legend } = pieLayout(base);
          const attached = tolerance > 0 && Math.hypot(position.x + offset.x - legend.naturalPosition.x,
            position.y + offset.y - legend.naturalPosition.y) <= tolerance;
          if (attached) guidesRef.current = legend.naturalPosition;
          setPreview(attached ? resetPieLegend(base) : { ...resetPieLegend(base), pieLegendPosition: point });
        }
      } else if (current.type === 'pie-plot') {
        setPreview(movePie(base, point));
      } else if (isNote(current.label)) {
        const pie = current.pieTarget;
        const anchors = pie && pieNoteTargets(pie.center, pie.radius);
        const attached = pie && tolerance > 0
          && (anchors.x.includes(guides.x) || anchors.y.includes(guides.y))
          && Math.abs(point.x - pie.center.x) <= pie.radius + 55 && Math.abs(point.y - pie.center.y) <= pie.radius + 55;
        setPreview({ ...base, notes: base.notes.map(note => note.id === current.label ? {
          ...note, position: point, pieAttached: pie ? attached || undefined : note.pieAttached,
        } : note) });
      } else {
        const { defaultPosition, label } = current;
        const labelPositions = { ...base.labelPositions, [label]: point };
        if (point.x === defaultPosition.x && point.y === defaultPosition.y) delete labelPositions[label];
        setPreview({ ...base, labelPositions });
      }
      return;
    }

    if (current.type === 'line') {
      if (distance < threshold && !draftRef.current) return;
      const { mark } = current;
      const endpoint = current.endpoint;
      let points: Point[];
      if (endpoint === null) {
        const aligned = translateLine(mark.points, offset, targets, tolerance);
        points = aligned.points;
        guidesRef.current = tolerance > 0 ? aligned.guides : NO_GUIDES;
      } else {
        const fixed = mark.points[1 - endpoint];
        const initial = mark.points[endpoint];
        const aimed = { x: clamp(initial.x + offset.x, 0, WIDTH), y: clamp(initial.y + offset.y, 0, HEIGHT) };
        const aligned = snapEndpoint(fixed, aimed, targets, tolerance, event.shiftKey);
        if (Math.hypot(fixed.x - aligned.point.x, fixed.y - aligned.point.y) < 4) return;
        points = mark.points.map((point, i) => endpoint === i ? aligned.point : point);
        guidesRef.current = tolerance > 0 || event.shiftKey ? aligned.guides : NO_GUIDES;
      }
      const changed = points.some((point, i) => point.x !== mark.points[i].x || point.y !== mark.points[i].y);
      setPreview(changed ? {
        ...current.base, marks: current.base.marks.map((item, i) =>
          i === current.index ? { ...mark, points, referenceValue: undefined } : item),
      } : current.base);
      return;
    }

    const { mark } = current;
    if (mark.type === 'line') {
      if (distance < threshold && !draftRef.current) return;
      const start = mark.points[0];
      const end = snapEndpoint(start, point, targets, tolerance, event.shiftKey);
      current.mark = { ...mark, points: [start, end.point] };
      guidesRef.current = tolerance > 0 || event.shiftKey ? end.guides : NO_GUIDES;
      setPreview({ ...current.base, marks: [...current.base.marks, current.mark] });
      return;
    }
    const last = mark.points[mark.points.length - 1];
    const distinct = point.x !== last.x || point.y !== last.y;
    if (!distinct || !finish && Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
    const points = [...mark.points, point];
    current.mark = { ...mark, points };
    setPreview({ ...current.base, marks: [...current.base.marks, current.mark] });
  }

  function flushPointerMove() {
    const event = pendingMove.current;
    pendingMove.current = null;
    if (event) moveGesture(event);
  }

  function queuePointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId || current.type === 'newText') return;
    // A pen stroke needs each sample, while a drag needs the latest position.
    if (current.type === 'draw' && current.mark.type === 'pen') moveGesture(event.nativeEvent);
    else pendingMove.current = event.nativeEvent;
    if (previewFrame.current !== null) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = null;
      flushPointerMove();
      setDraft(draftRef.current);
      setGuides(guidesRef.current);
    });
  }

  function finishGesture(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    flushPointerMove();
    moveGesture(event.nativeEvent, true);
    const preview = draftRef.current;
    const newLine = current.type === 'draw' && current.mark.type === 'line';
    stopGesture();
    const validLine = !newLine || Math.hypot(current.mark.points[1].x - current.mark.points[0].x,
      current.mark.points[1].y - current.mark.points[0].y) >= 4;
    if (current.type === 'newText') {
      const halfWidth = newTextStyle?.size ?? 18;
      const alignment = newTextStyle?.alignment ?? 'start';
      const left = alignment === 'end' ? halfWidth * 2 + 6 : alignment === 'middle' ? halfWidth + 6 : 10;
      const right = alignment === 'start' ? WIDTH - halfWidth * 2 - 6 : alignment === 'middle' ? WIDTH - halfWidth - 6 : WIDTH - 10;
      const position = { x: clamp(current.start.x, left, right), y: clamp(current.start.y, halfWidth + 8, HEIGHT - 8) };
      editorRef.current?.blur();
      const usedIds = new Set(document.notes.map(note => note.id));
      while (usedIds.has(`note:${nextNoteNumber.current}`)) nextNoteNumber.current++;
      const id: NoteTarget = `note:${nextNoteNumber.current++}`;
      onSelect(null);
      setNewNote({ id, position, style: newTextStyle });
      return;
    }
    if (current.type === 'draw' && current.statistic && !preview) {
      onAddStatistic?.(current.statistic);
      return;
    }
    if (preview && preview !== current.base && validLine) {
      const next = current.type === 'data' ? { ...preview, scaleExtent: current.scale.extent } : preview;
      onEdit(latest => latest === current.base ? next : latest);
    }
    if (current.type === 'label' && !current.moved) startTextEditing(current.label);
    else {
      editorRef.current?.blur();
      if (current.type === 'label') onSelect({ kind: 'text', target: current.label });
      else if (current.type === 'legend') {
        onSelect({ kind: current.legend });
        const previous = lastLegendClick.current;
        lastLegendClick.current = null;
        if (current.legend === 'pictograph-legend' && !current.moved) {
          const { timeStamp: time, clientX: x, clientY: y } = event;
          if (previous && time - previous.time <= 500 && Math.hypot(x - previous.x, y - previous.y) <= 8) {
            onEditPictographLegend?.();
          } else lastLegendClick.current = { time, x, y };
        }
      }
      else if (current.type === 'pie-plot') onSelect(!current.moved && current.datum ? { kind: 'data', datum: current.datum } : null);
      else if (current.type === 'data') onSelect({ kind: 'data', datum: current.datum });
      else if (current.type === 'axis' || current.type === 'plot') onSelect({ kind: 'axis', axis: current.axis });
      else if (current.type === 'pictograph-table' || current.type === 'pictograph-category') onSelect(null);
      else if (current.type === 'line') onSelect({ kind: 'mark', index: current.index });
      else if (preview && validLine) onSelect({ kind: 'mark', index: preview.marks.length - 1 });
    }
  }

  function cancelGesture(event: PointerEvent<SVGSVGElement>) {
    if (gesture.current?.pointer === event.pointerId) stopGesture();
  }

  function startTextEditing(target: TextTarget, trigger?: SVGElement) {
    if (editing !== target) editorRef.current?.blur();
    editorTrigger.current = trigger ?? null;
    onSelect({ kind: 'text', target });
    setEditing(target);
  }

  function editText(target: TextTarget, value: string) {
    editorTrigger.current = null;
    setEditing(null);
    const text = value.trim();
    if (newNote?.id === target) {
      const { id, position, style } = newNote;
      setNewNote(null);
      if (!text) return;
      onEdit(chart => ({
        ...chart, notes: [...chart.notes, { id, position, text }],
        textStyles: style ? { ...chart.textStyles, [id]: style } : chart.textStyles,
      }));
      onSelect({ kind: 'text', target: id });
      return;
    }
    if (!text) {
      onEdit(current => hideText(current, target));
      onSelect(null);
      return;
    }
    onEdit(current => {
      if (isNote(target)) {
        if (text === textValue(current, target)) return current;
        return { ...current, notes: current.notes.map(note => note.id === target ? { ...note, text } : note) };
      }
      if (typeof target !== 'number') return current[target] === text ? current : { ...current, [target]: text };
      if (current.categories[target] === text) return current;
      return { ...current, categories: current.categories.map((category, i) => i === target ? text : category) };
    });
  }

  const chart = draft ?? document;
  const pie = chart.kind === 'pie';
  const pictograph = chart.kind === 'pictograph';
  const hasAxes = hasChartAxes(chart.kind);
  const pieChart = pie ? pieLayout(chart) : null;
  const columns = chart.kind === 'bar';
  const singleBar = columns && !chart.groupedColumns;
  const visibleSeries = useMemo(() => displayedSeries(chart),
    [chart.kind, chart.groupedColumns, chart.series, chart.barSeries, chart.pieSeries, chart.pictographSeries]);
  const plot = useMemo(() => getPlot(chart), [chart.style, chart.plotOffset, chart.categories, chart.textStyles]);
  const { sheetHeight, entries: legend } = layoutSeriesLegend(chart, plot);
  const dragScale = gesture.current?.type === 'data' ? gesture.current.scale : null;
  const scale = useMemo(() => dragScale ?? (hasAxes ? getScale(visibleSeries, chart.scaleExtent, plot, chart.style.axes.y) : getScale([])),
    [dragScale, hasAxes, visibleSeries, chart.scaleExtent, plot, chart.style.axes.y]);
  const iconRows = useMemo(() => columns ? columnIconRows(scale) : [], [columns, scale]);
  const preview = tool === 'preview';
  const exportWarnings = useMemo(() => preview ? [] : chartDataWarnings(chart, scale).messages, [preview, chart, scale]);
  const count = chart.categories.length;
  const spacing = (plot.right - plot.left) / count;
  const groupWidth = columns && chart.groupedColumns ? spacing * (chart.style.groupWidth ?? DEFAULT_GROUP_WIDTH)
    : Math.min(spacing * DEFAULT_GROUP_WIDTH, 54 * visibleSeries.length);
  const barWidth = groupWidth / visibleSeries.length;
  const valueEvery = Math.max(1, Math.ceil(30 / spacing));
  const zero = scale.y(0);
  const { style } = chart;
  const valueLabelTexts = useMemo(() => formatValueLabels(hasAxes ? visibleSeries.flatMap(series => {
    const { showLabels } = getSeriesStyle(series, style);
    return series.values.filter((value, index): value is number => value !== null && !scale.inBreak(value)
      && (value > scale.limit ? columns : showLabels && index % valueEvery === 0));
  }) : []), [hasAxes, visibleSeries, style, scale, columns, valueEvery]);
  const { x: xAxis, y: yAxis } = style.axes;
  const axisArrowhead = style.axisArrowhead ?? DEFAULT_AXIS_ARROWHEAD;
  const { omission } = scale;
  const showX = hasAxes && xAxis.visible !== false;
  const showY = hasAxes && yAxis.visible !== false;
  const { step: xTickEvery, band: categoryBand, angled: angledCategories, width: categoryLabelWidth, labelOffset: categoryLabelOffset } =
    useMemo(() => categoryTickLayout(chart), [xAxis, chart.categories]);
  const yTickSize = yAxis.tickLabelSize ?? DEFAULT_TICK_LABEL.size;
  const yTickFont = TEXT_FONTS[yAxis.tickLabelFont ?? DEFAULT_TICK_LABEL.font].family;
  const yTickLabels = showY && yAxis.showValues ? spacedTickLabels(scale.ticks, scale.y, style.showOrigin, omission, yTickSize) : null;
  const xEnd = { x: plot.right + 10, y: zero };
  const yEnd = { x: plot.left, y: plot.top - verticalAxisExtension(yAxis) };
  const xTitle = axisTitleLayout('x', plot, chart, zero);
  const yTitle = axisTitleLayout('y', plot, chart);
  const xLabel = chart.labelPositions.xLabel ?? xTitle.point;
  const yLabel = chart.labelPositions.yLabel ?? yTitle.point;

  function handleDatumKey(event: KeyboardEvent<SVGGElement>, series: number, index: number, value: number | null) {
    if (activateCanvasObject(event, { kind: 'data', datum: { series, index } })) return;
    const clearing = event.key === 'Delete' || event.key === 'Backspace';
    if (!clearing && (pie || !['ArrowUp', 'ArrowDown'].includes(event.key))) return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const next = clearing ? null : pictograph ? Math.max(0, (value ?? 0) + direction * pictographLayout(chart).unit) : scale.nudge(value, direction);
    if (next !== null && !Number.isFinite(next)) return;
    onEdit(current => setChartValue(current, series, index, next));
    if (next === null) onSelect(null);
  }

  function handleAxisKey(event: KeyboardEvent<SVGGElement>, axis: Axis | 'both') {
    if (activateCanvasObject(event, { kind: 'axis', axis })) return;
    const offset = arrowOffset(event.key, event.shiftKey);
    if (!offset) return;
    event.preventDefault();
    onEdit(current => {
      if (axis !== 'both') return resizeAxis(current, axis, axis === 'x' ? offset.x : -offset.y);
      const currentOffset = constrainPlotOffset(current, current.plotOffset);
      return movePlot(current, { x: currentOffset.x + offset.x, y: currentOffset.y + offset.y });
    });
  }

  function handleMarkKey(event: KeyboardEvent<SVGElement>, index: number, mark: Mark, endpoint?: number) {
    if (activateCanvasObject(event, { kind: 'mark', index })) return;
    const offset = arrowOffset(event.key, event.shiftKey);
    if (!offset) return;
    event.preventDefault();
    const points = endpoint === undefined ? translateLine(mark.points, offset, NO_TARGETS, 0).points
      : mark.points.map((point, i) => endpoint === i
        ? { x: clamp(point.x + offset.x, 0, WIDTH), y: clamp(point.y + offset.y, 0, HEIGHT) }
        : point);
    if (points.every((point, i) => point.x === mark.points[i].x && point.y === mark.points[i].y)) return;
    if (endpoint !== undefined && Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) < 4) return;
    onEdit(current => ({ ...current, marks: current.marks.map((item, i) => i === index
      ? { ...mark, points, referenceValue: undefined } : item) }));
  }

  function chartText(target: TextTarget, x: number, y: number, fallback: string, options: {
    anchor?: 'start' | 'middle' | 'end';
    width?: number;
    max?: number;
    maxWidth?: number;
    rotation?: number;
    autoSize?: number;
    cellHeight?: number;
    exercise?: ReturnType<typeof exerciseNoteLayout>;
    pending?: NewNote;
  } = {}) {
    const { width = 160, max = 12, maxWidth = Infinity, rotation = 0, autoSize, cellHeight, exercise, pending } = options;
    const textStyle = { ...getTextStyle(chart, target), ...pending?.style };
    const customStyle = chart.textStyles?.[target];
    const { color, bold, italic, underline } = textStyle;
    const fontFamily = TEXT_FONTS[textStyle.font].family;
    const text = pending ? '' : textValue(chart, target);
    const axisLabel = target === 'xLabel' || target === 'yLabel' ? target : undefined;
    const note = isNote(target) ? target : undefined;
    const anchor = note ? textStyle.alignment : options.anchor ?? 'middle';
    const fontStyle = italic ? 'italic' : undefined;
    const textDecoration = underline ? 'underline' : undefined;
    const canEdit = tool === 'select' || (tool === 'text' && Boolean(note));
    const isSelected = selectedText === target;
    const showPlaceholder = !text && canEdit;
    const editorX = clamp(x - width / 2, 6, WIDTH - width - 6);
    const activate = canEdit ? () => startTextEditing(target) : undefined;
    const horizontalSpace = anchor === 'start' ? WIDTH - 6 - x : anchor === 'end' ? x - 6 : 2 * Math.min(x - 6, WIDTH - 6 - x);
    const available = Math.max(8, Math.min(maxWidth,
      rotation === -90 ? 2 * Math.min(y - 6, HEIGHT - 6 - y) : horizontalSpace));
    const preferredSize = typeof target === 'number' && customStyle?.size === undefined
      && (!hasAxes || xAxis.tickLabelSize === undefined)
      ? Math.min(autoSize ?? textStyle.size, Math.max(5, rotation ? categoryBand * 0.85 : available / 2))
      : textStyle.size;
    const inCell = cellHeight !== undefined;
    const size = inCell ? Math.min(preferredSize, available, Math.max(1, cellHeight * 0.85)) : preferredSize;
    const display = shorten(text || fallback, Math.max(1, Math.min(max, Math.floor(available / size))));
    const editorHeight = size + 22;
    return (
      <g key={target}>
        {!pending && (text || showPlaceholder) && (
          <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={showPlaceholder ? '#687780' : color}
            dominantBaseline={inCell ? 'central' : undefined}
            fontFamily={fontFamily} fontWeight={bold ? 700 : 500} fontStyle={fontStyle}
            style={underline ? { textDecoration } : undefined}
            pointerEvents={tool === 'eraser' && !eraseMarks ? 'none' : undefined}
            transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}
            data-editor={showPlaceholder ? '' : undefined}
            className={activate ? axisLabel || note ? 'canvas-text axis-label' : 'canvas-text' : undefined}
            data-text-selected={isSelected ? '' : undefined}
            data-custom-size={exercise || customStyle?.size !== undefined || typeof target === 'number' ? '' : undefined}
            data-editable={activate ? '' : undefined} role={activate ? 'button' : undefined}
            data-axis-label={activate ? axisLabel : undefined}
            data-note={note}
            data-move-text={activate ? axisLabel ?? note : undefined}
            {...(activate ? canvasObject(`text:${target}`) : {})}
            aria-label={activate ? `编辑${fallback}${text ? `：${text}` : ''}` : undefined}
            onFocus={activate ? () => onSelect({ kind: 'text', target }) : undefined}
            onClick={axisLabel || note ? undefined : activate} onKeyDown={activate ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                startTextEditing(target, event.currentTarget);
              }
            } : undefined}>
            {text && display !== text && !exercise && <title>{text}</title>}
            {exercise && text ? exercise.lines.map((line, index) => (
              <tspan key={index} x={x} y={y + index * exercise.lineHeight}>{line}</tspan>
            )) : display}
          </text>
        )}
        {(pending || editing === target) && (
          <foreignObject x={editorX}
            y={clamp(inCell ? y - editorHeight / 2 : y - size - 8, 2, (exercise ? sheetHeight : HEIGHT) - editorHeight - 2)}
            width={width} height={editorHeight} data-editor="">
            <input ref={editorRef} className="canvas-input" aria-label={fallback} defaultValue={text} placeholder={pending ? '输入文字' : undefined}
              style={{ fontFamily, fontSize: Math.max(16, size), fontWeight: bold ? 700 : 500, color, fontStyle, textDecoration }}
              autoFocus onFocus={event => event.currentTarget.select()}
              onBlur={event => {
                if (!skipTextBlur.current) editText(target, event.currentTarget.value);
              }}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                const input = event.currentTarget;
                if (event.key === 'Delete' && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
                  event.preventDefault();
                  input.value = '';
                  input.blur();
                }
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.preventDefault();
                  const trigger = editorTrigger.current;
                  if (event.key === 'Escape') {
                    skipTextBlur.current = true;
                    editorTrigger.current = null;
                    setEditing(null);
                    if (pending) setNewNote(null);
                  }
                  input.blur();
                  skipTextBlur.current = false;
                  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
                  else {
                    canvasRef.current?.focus({ preventScroll: true });
                    if (event.key === 'Escape') onSelect(null);
                  }
                }
              }} />
          </foreignObject>
        )}
      </g>
    );
  }

  function datumNode(datum: Datum, value: number | null, children: ReactNode, share?: string) {
    const { series, index } = datum;
    const editable = tool === 'select';
    const description = `${chart.categories[index] || `类别 ${index + 1}`}，${chart.series[series].name}，${value === null ? '无数据' : formatValue(value)}${share ? `，占 ${share}` : ''}`;
    return (
      <g key={`datum:${index}`} data-datum="" data-index={index} data-series={series}
        className={editable || eraseData ? 'chart-datum' : undefined}
        role={editable ? 'button' : undefined} {...(editable ? canvasObject(`datum:${series}:${index}`) : {})}
        aria-label={editable ? description : undefined}
        onFocus={editable ? () => onSelect({ kind: 'data', datum }) : undefined}
        onKeyDown={editable ? event => handleDatumKey(event, series, index, value) : undefined}>
        <title>{description}</title>
        {children}
      </g>
    );
  }

  const valueLabels: { key: string; x: number; y: number; text: string; size: number; offset: number; fill: string; halo: boolean;
    typography: ReturnType<typeof dataLabelTextAttributes> }[] = [];
  const clippedLabels: { x: number; y: number; text: string; size: number }[] = [];
  const dataGraphics: ReactNode[] = !hasAxes ? [] : chart.series.map((series, seriesIndex) => {
    if (singleBar && seriesIndex !== (chart.barSeries ?? 0)) return null;
    const seriesStyle = getSeriesStyle(series, style);
    const numberStyle = dataLabelStyle(style, series);
    const labelSize = numberStyle.size ?? VALUE_FONT_SIZE;
    const typography = dataLabelTextAttributes(numberStyle);
    const columnWidth = barWidth * seriesStyle.columnWidth;
    const columnIcon = columns ? seriesStyle.columnIcon : undefined;
    const symbolId = `${columnSymbolPrefix}-${seriesIndex}`;
    const iconSize = Math.min(48, columnWidth);
    const lightColor = isLightColor(series.color);
    const flashing = highlight?.series === seriesIndex;
    const line = chart.kind === 'line' ? linePath(series.values, scale, plot) : null;
    return (
    <g key={seriesIndex}>
      {columnIcon && <defs>
        <symbol id={symbolId} viewBox="0 0 24 24">
          <PictographIcon name={columnIcon.symbol} color={series.color} colored={columnIcon.colorMode === 'color'} outline={false} />
        </symbol>
      </defs>}
      {line !== null && flashing && highlight.index === undefined && <path d={line} fill="none" stroke="#819bff"
        strokeWidth={seriesStyle.strokeWidth + 7} opacity="0.58" strokeLinecap="round" strokeLinejoin="round"
        pointerEvents="none" data-editor-only="" data-value-highlight="" />}
      {line !== null && (
        <path d={line} fill="none" stroke={series.color} strokeWidth={seriesStyle.strokeWidth}
          strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
      )}
      {series.values.map((value, index) => {
        if (value === null || scale.inBreak(value)) return null;
        const clipped = value > scale.limit;
        if (clipped && chart.kind === 'line') return null;
        const center = categoryX(index, count, plot);
        const x = columns && !singleBar ? center - groupWidth / 2 + (seriesIndex + 0.5) * barWidth : center;
        const y = scale.y(Math.min(value, scale.limit));
        const columnBands = columns ? scale.bands.flatMap(({ min, max }) => {
          const start = Math.max(min, Math.min(0, value));
          const end = Math.min(max, Math.max(0, value));
          return start < end || value === 0 && start === end ? [{ top: scale.y(end), bottom: scale.y(start) }] : [];
        }) : [];
        const negativeBar = value < 0 && columns;
        const labelBelow = negativeBar && y + labelSize + 6 < plot.bottom;
        const labelInside = negativeBar && !labelBelow && y - zero >= labelSize + 10 && barWidth >= labelSize + 16;
        const labelGap = chart.kind === 'line' ? Math.max(13, seriesStyle.dotSize + 7) : 13;
        const labelY = labelInside ? y - 7 : labelBelow ? y + labelSize + 3 : y - labelGap;
        const valueText = valueLabelTexts.get(value) ?? String(value);
        if (clipped) clippedLabels.push({ x, y: labelY, text: valueText, size: labelSize });
        else if (seriesStyle.showLabels && index % valueEvery === 0) {
          valueLabels.push({
            key: `${seriesIndex}:${index}`, x, y: labelY, text: valueText, size: labelSize, typography,
            offset: labelInside ? 0 : (labelBelow ? 1 : -1) * Math.max(20, labelSize + 6),
            fill: numberStyle.color ?? (columnIcon?.colorMode === 'color' || lightColor ? '#26334c' : labelInside && !columnIcon ? '#fff' : series.color),
            halo: !columns || Boolean(labelInside && columnIcon),
          });
        }
        const editable = tool === 'select';
        const description = editable ? `${chart.categories[index]}，${series.name}，${value}` : undefined;
        const activeDatum = editable || eraseData;
        const isSelected = selection?.kind === 'data' && selection.datum.series === seriesIndex && selection.datum.index === index;
        const isHighlighted = flashing && (highlight.index === index || highlight.index === undefined);
        return (
          <g key={index} data-datum="" data-series={seriesIndex} data-index={index}
            className={activeDatum ? 'chart-datum' : undefined}
            role={editable ? 'button' : undefined} {...(editable ? canvasObject(`datum:${seriesIndex}:${index}`) : {})}
            aria-label={description}
            onFocus={editable ? () => onSelect({ kind: 'data', datum: { series: seriesIndex, index } }) : undefined}
            onKeyDown={editable ? event => handleDatumKey(event, seriesIndex, index, value) : undefined}>
            {description && <title>{description}</title>}
            {columns ? (
              <>
                {columnBands.map(({ top, bottom }) => {
                  const height = bottom - top;
                  // Keep the baseline mark for zero and a visible mark for very short bands.
                  const showIcon = columnIcon && value !== 0 && height >= iconSize * 0.2;
                  return <g key={top}>
                    {showIcon
                      ? <ColumnIcons symbolId={symbolId} x={x} top={top} bottom={bottom}
                          maxSize={iconSize} rows={iconRows} />
                      : <rect x={x - columnWidth / 2} y={top - (value === 0 ? 1.5 : 0)} width={columnWidth}
                          height={Math.max(1.5, height)}
                          rx={seriesStyle.roundedColumns ? Math.min(4, barWidth * 0.1) : undefined} fill={series.color} />}
                    {(isHighlighted || isSelected && columnIcon) && <rect x={x - columnWidth / 2 - 3} y={top - 3} width={columnWidth + 6}
                      height={height + 6} rx="3" fill="none" stroke="#506fe7" strokeWidth="3"
                      pointerEvents="none" data-editor-only="" data-value-highlight={isHighlighted ? '' : undefined} />}
                    {activeDatum && <rect x={x - barWidth / 2} y={top - 6} width={barWidth}
                      height={height + 12} fill="transparent" data-editor-only="" />}
                  </g>;
                })}
              </>
            ) : (
              <>
                {(seriesStyle.dots || !hasLineNeighbor(value, series.values[index - 1], scale.bands)
                  && !hasLineNeighbor(value, series.values[index + 1], scale.bands)) && (
                  <SeriesDot x={x} y={y} size={seriesStyle.dotSize} width={seriesStyle.strokeWidth}
                    shape={seriesStyle.dotShape} fill={seriesStyle.dotFill} color={series.color} />
                )}
                {activeDatum && <circle cx={x} cy={y} r={Math.max(12, seriesStyle.dotSize + 4)} fill="transparent" data-editor-only="" />}
              </>
            )}
            {clipped && <g data-clipped-value={value} pointerEvents="none">
              <path d={`M ${x - Math.min(6, columnWidth / 2)} ${y + 4} L ${x} ${y - 3} L ${x + Math.min(6, columnWidth / 2)} ${y + 4}`}
                fill="#fff" stroke="#84591d" strokeWidth="1.5" strokeLinejoin="round" />
              <text x={x} y={labelY} textAnchor="middle" fontSize={labelSize} {...typography} data-custom-size="" fill={numberStyle.color ?? '#77511d'}>
                {valueText}
              </text>
            </g>}
            {clipped && !columnBands.length && activeDatum && <rect x={x - barWidth / 2} y={y - 7} width={barWidth}
              height={14} fill="transparent" data-editor-only="" />}
            {isSelected && !columnIcon && <circle cx={x} cy={y} r={chart.kind === 'line' ? Math.max(9, seriesStyle.dotSize + 4) : 9}
              fill="none" stroke="#6983ef" strokeWidth="2"
              pointerEvents="none" data-editor-only="" />}
            {!columns && isHighlighted && <circle cx={x} cy={y} r={Math.max(13, seriesStyle.dotSize + 7)}
              fill="none" stroke="#506fe7" strokeWidth="3" pointerEvents="none" data-editor-only="" data-value-highlight="" />}
          </g>
        );
      })}
    </g>
    );
  });
  const placedValues = placeValueLabels(valueLabels, clippedLabels, WIDTH, plot.bottom + 5);

  const [xTickFrom, xTickTo] = tickOffsets(xAxis);
  const [yTickFrom, yTickTo] = tickOffsets(yAxis);
  const xTickDirection = zero - plot.top < 1e-6 ? -1 : 1;

  function yValueLabel(value: number, origin = false) {
    const label = formatValue(value);
    const x = plot.left - yTickTo - 8;
    const length = Math.max(1, x - 6);
    const fit = estimateTextWidth(label, yTickSize) > length;
    return <text x={x} y={scale.y(value)} textAnchor="end" dominantBaseline="central"
      fontSize={yTickSize} fontFamily={yTickFont} fontWeight={yAxis.tickLabelBold ? 700 : undefined}
      fontStyle={yAxis.tickLabelItalic ? 'italic' : undefined} textDecoration={yAxis.tickLabelUnderline ? 'underline' : undefined}
      data-custom-size="" fill="#4e5b73"
      data-origin={origin ? '' : undefined} data-tick-label={origin ? undefined : 'y'}
      textLength={fit ? length : undefined} lengthAdjust={fit ? 'spacingAndGlyphs' : undefined}>{label}</text>;
  }
  const markEditing = tool === 'select' || tool === 'line';
  const marks = chart.marks.map(mark => visibleMark(mark, plot, scale, chart.kind));
  const selectedMark = selectedLine === null ? null : marks[selectedLine];
  const statisticGuides = new Map<number, Statistic[]>();
  if (tool === 'line' && stats && hasAxes) {
    const entries = Object.entries(stats) as [Statistic, number][];
    for (const [key, value] of entries) {
      if (scale.includes(value)) statisticGuides.set(value, [...(statisticGuides.get(value) ?? []), key]);
    }
  }

  return (
    <svg ref={attachCanvas} className={`chart-sheet tool-${tool}`} viewBox={`0 0 ${WIDTH} ${sheetHeight}`} data-chart-kind={chart.kind}
      tabIndex={tool === 'preview' ? undefined : focusedObject ? -1 : 0}
      role={tool === 'preview' ? undefined : 'group'} aria-label={tool === 'preview' ? undefined : '统计图画布'}
      aria-description={tool === 'preview' ? undefined : '方向键切换对象，按 Enter 或空格编辑。按 Alt 和方向键微调数据和可移动对象。'}
      aria-hidden={tool === 'preview' || undefined} fontFamily={FONT} style={{ fontSynthesis: 'weight style' }}
      onFocus={tool === 'preview' ? undefined : focusCanvasObject} onKeyDownCapture={tool === 'preview' ? undefined : navigateCanvas}
      onBlur={tool === 'preview' ? undefined : event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setAdjusting(false);
      }}
      onPointerDown={startGesture} onPointerMove={queuePointerMove}
      onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>
      <rect width={WIDTH} height={sheetHeight} fill="#fff" data-paper="" />
      {exportWarnings.length > 0 && <g data-export-note="" display="none" aria-hidden="true" fill="#77511d" fontSize="15">
        {exportWarnings.map((message, index) => <text key={message} x={32} y={sheetHeight + 20 + index * 20}>{message}</text>)}
      </g>}
      {style.showTitle !== false && chartText('title', pieChart?.center.x ?? (hasAxes ? (plot.left + plot.right) / 2 : WIDTH / 2), 63,
        '图表标题', { width: 440, max: 27 })}
      {pieChart && <PieGraphic chart={chart} layout={pieChart} selection={selection} highlight={highlight} editable={tool === 'select'} onEdit={onEdit} onSelect={onSelect}
        canvasObject={canvasObject} onEditObject={onEditObject} renderDatum={datumNode} />}
      {pictograph && <PictographGraphic chart={chart} selection={selection} highlight={highlight}
        editable={tool === 'select'} eraseData={eraseData} onSelect={onSelect} onEdit={onEdit}
        canvasObject={canvasObject} onEditLegend={onEditPictographLegend} renderDatum={datumNode}
        renderCategory={(index, x, y, maxWidth, anchor, autoSize, cellHeight) => (
          chartText(index, x, y, '类别', { maxWidth, anchor, autoSize, cellHeight })
        )} />}
      {hasAxes && scale.ticks.map(value => {
        const y = scale.y(value);
        return (
          <g key={value} pointerEvents="none">
            {style.grid && <line x1={plot.left} y1={y} x2={plot.right} y2={y} stroke="#e2e7f1" />}
            {showY && yAxis.tickLength > 0 && <line x1={plot.left - yTickFrom} x2={plot.left - yTickTo} y1={y} y2={y}
              stroke={yAxis.color} data-axis-tick="y" data-tick-value={value} />}
            {yTickLabels?.has(value) && yValueLabel(value)}
          </g>
        );
      })}
      {columns && dataGraphics}
      <g pointerEvents="none">
        {showX && <g data-axis="x"><StyledLine start={{ x: plot.left, y: zero }} end={xEnd}
          kind={xAxis.line} color={xAxis.color} width={xAxis.width} arrowhead={axisArrowhead} /></g>}
        {showY && <g data-axis="y">
          <StyledLine start={{ x: plot.left, y: omission?.top ?? plot.bottom }} end={yEnd}
            kind={yAxis.line} color={yAxis.color} width={yAxis.width} arrowhead={axisArrowhead} />
          {omission && <g data-axis-break="y">
            <title>{`纵轴省略 ${formatValue(omission.from)} 至 ${formatValue(omission.to)}`}</title>
            {omission.bottom < plot.bottom && <StyledLine start={{ x: plot.left, y: plot.bottom }} end={{ x: plot.left, y: omission.bottom }}
              kind={yAxis.line === 'dashed' ? 'dashed' : 'solid'} color={yAxis.color} width={yAxis.width} />}
            {[omission.top, omission.bottom].map(y => <line key={y} x1={plot.left - 5} x2={plot.left + 5}
              y1={y + 3} y2={y - 3} stroke={yAxis.color} strokeWidth={yAxis.width} strokeLinecap="round" />)}
          </g>}
        </g>}
      </g>
      {tool === 'select' && (
        <g data-editor-only="" className="axis-targets">
          {showX && <line x1={plot.left} y1={zero} x2={xEnd.x} y2={zero} data-axis-target="x" />}
          {showY && <line x1={plot.left} y1={plot.bottom} x2={plot.left} y2={yEnd.y} data-axis-target="y" />}
        </g>
      )}
      {hasAxes && style.showOrigin && yValueLabel(0, true)}
      {showX && chart.categories.map((_, index) => {
        if (index % xTickEvery !== 0) return null;
        const x = categoryX(index, count, plot);
        return (
          <g key={index}>
            {xAxis.tickLength > 0 && <line x1={x} y1={zero + xTickFrom * xTickDirection} x2={x} y2={zero + xTickTo * xTickDirection}
              stroke={xAxis.color} data-axis-tick="x" />}
            {xAxis.showValues && !chart.hiddenCategoryLabels?.includes(index) &&
              chartText(index, x, plot.bottom + categoryLabelOffset, '类别', {
                width: 100, maxWidth: categoryLabelWidth,
                anchor: angledCategories ? 'end' : 'middle', rotation: angledCategories ? -60 : 0,
              })}
          </g>
        );
      })}
      {chart.kind === 'line' && dataGraphics}
      {placedValues.length > 0 && <g pointerEvents="none">
        {placedValues.map(({ key, x, y, text, fill, halo, size, typography }) => (
          <text key={key} x={x} y={y} textAnchor="middle" fontSize={size} {...typography} data-custom-size=""
            data-value-label="" fill={fill} stroke={halo ? '#fff' : undefined} strokeWidth={halo ? 3 : undefined}
            paintOrder="stroke" strokeLinejoin="round">{text}</text>
        ))}
      </g>}
      {legend.length > 0 && (
        <g aria-label="图例">
          {legend.map(({ series, name, lines, x, y }, index) => {
            const icon = columns ? series.style?.columnIcon : undefined;
            return (
              <g key={index} data-series-legend-entry="">
                <title>{name}</title>
                {icon
                  ? <g transform={`translate(${x} ${y - 12})`}>
                      <PictographIcon name={icon.symbol} color={series.color} colored={icon.colorMode === 'color'} outline={false} size={14} />
                    </g>
                  : <rect x={x} y={y - 9} width="12" height="7" rx="2" fill={series.color} />}
                <text x={x + 18} y={y} fontSize={LEGEND_FONT_SIZE} data-custom-size="" fill="#485861">
                  {lines.map((line, lineIndex) => <tspan key={lineIndex} x={x + 18} y={y + lineIndex * LEGEND_LINE_HEIGHT}>{line}</tspan>)}
                </text>
              </g>
            );
          })}
        </g>
      )}
      {showX && xAxis.showLabel && chartText('xLabel', xLabel.x, xLabel.y, '横轴标题', { anchor: xTitle.anchor, max: 25 })}
      {showY && yAxis.showLabel && chartText('yLabel', yLabel.x, yLabel.y, '纵轴标题', { anchor: yTitle.anchor, rotation: yTitle.rotation, max: 25 })}
      {statisticGuides.size > 0 && (
        <g data-editor-only="" className="statistic-guides">
          {[...statisticGuides].map(([value, keys]) => {
            const y = scale.y(value);
            const label = keys.map(key => STATISTIC_LABELS[key]).join(' / ') + ' ' + formatValue(value);
            return (
              <g key={value} data-stat={keys[0]} role="button" {...canvasObject(`statistic:${value}`)} aria-label={`添加${label}参考线`}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAddStatistic(keys[0]); }
                }}>
                <line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#7688d4" strokeDasharray="5 5" strokeOpacity=".7" />
                <line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="transparent" strokeWidth="12" />
                <text x={plot.right} y={y - 5} textAnchor="end" fontSize="12" fill="#465a9f"
                  stroke="#fff" strokeWidth="4" paintOrder="stroke">{label}</text>
              </g>
            );
          })}
        </g>
      )}
      {marks.map((mark, index) => {
        if (!mark) return null;
        const canSelect = (tool === 'select' || (markEditing && mark.type === 'line')) &&
          !(gesture.current?.type === 'draw' && index === chart.marks.length - 1);
        const selected = canSelect && selectedLine === index;
        const path = markPath(mark.points);
        return (
          <g key={index} className="chart-mark" data-mark-type={mark.type}>
            {selected && <path d={path} stroke="#6983ef" strokeWidth={(mark.width ?? 3.5) + 7} strokeOpacity=".28"
              strokeLinecap="round" fill="none" pointerEvents="none" data-editor-only="" />}
            <g pointerEvents="none" opacity={mark.opacity}>
              {mark.type === 'line' ? <StyledLine start={mark.points[0]} end={mark.points[1]} kind={mark.lineKind ?? 'solid'}
                color={mark.color} width={mark.width ?? 3.5} arrows={mark.arrows} /> : <path d={path} fill="none" stroke={mark.color}
                strokeWidth={mark.width ?? 3.5} strokeLinecap="round" strokeLinejoin="round" />}
            </g>
            {(canSelect || eraseMarks) && <path d={path} fill="none" stroke="transparent"
              strokeWidth={Math.max(14, (mark.width ?? 3.5) + 9)} strokeLinecap="round" strokeLinejoin="round"
              className={canSelect ? 'line-hit' : undefined} role={canSelect ? 'button' : undefined}
              {...(canSelect ? canvasObject(`mark:${index}`) : {})} aria-label={canSelect ? `选择线条 ${index + 1}` : undefined}
              onFocus={canSelect ? () => onSelect({ kind: 'mark', index }) : undefined}
              onKeyDown={canSelect ? event => handleMarkKey(event, index, mark) : undefined} data-mark={index} data-editor-only="" />}
          </g>
        );
      })}
      {chart.notes.map(note => {
        const exercise = note.exerciseQuestion ? exerciseNoteLayout(chart, note) : undefined;
        const { x, y } = exercise ?? note.position;
        return chartText(note.id, x, y, exercise ? '问题' : '文字标注', { anchor: 'start', width: exercise ? 600 : 280, max: 90, exercise });
      })}
      {newNote && tool === 'text' && chartText(newNote.id, newNote.position.x, newNote.position.y, '文字标注',
        { width: 280, max: 90, pending: newNote })}
      <g data-editor-only="">
        {tool === 'select' && (showX || showY) && <g className="plot-handle" data-axis-target="both" role="button"
          {...canvasObject('axis:origin', true)} aria-label="移动坐标系"
          onFocus={() => onSelect({ kind: 'axis', axis: 'both' })} onKeyDown={event => handleAxisKey(event, 'both')}>
          <title>拖动原点移动坐标系</title>
          <circle cx={plot.left} cy={zero} r={6} className="axis-handle" />
        </g>}
        {tool === 'select' && ([['x', xEnd, showX], ['y', yEnd, showY]] as const).filter(([, , shown]) => shown).map(([axis, end]) => (
          <g key={axis} data-axis-end={axis} role="button" {...canvasObject(`axis:${axis}`, true)}
            aria-label={`调整${axis === 'x' ? '横轴' : '纵轴'}长度`}
            onFocus={() => onSelect({ kind: 'axis', axis })} onKeyDown={event => handleAxisKey(event, axis)}>
            <title>{`拖动调整${axis === 'x' ? '横轴' : '纵轴'}长度`}</title>
            <circle cx={end.x} cy={end.y} r={6} className={`axis-handle handle-${axis}`} />
          </g>
        ))}
        {markEditing && selectedMark?.type === 'line' &&
          selectedMark.points.slice(0, 2).map((point, index) => (
            <g key={index} data-mark={selectedLine} data-endpoint={index} role="button"
              {...canvasObject(`mark:${selectedLine}:${index}`, true)} aria-label={index === 0 ? '移动标注线起点' : '移动标注线终点'}
              onKeyDown={event => handleMarkKey(event, selectedLine, selectedMark, index)}>
              <title>{index === 0 ? '起点' : '终点'}</title>
              <circle cx={point.x} cy={point.y} r={7} className="line-handle" />
            </g>
          ))}
        <g stroke="#526fea" strokeDasharray="5 5" strokeWidth="1" pointerEvents="none" className="alignment-guides">
          {guides.x !== undefined && <line x1={guides.x} y1="0" x2={guides.x} y2={HEIGHT} />}
          {guides.y !== undefined && <line x1="0" y1={guides.y} x2={WIDTH} y2={guides.y} />}
        </g>
      </g>
    </svg>
  );
}

export default ChartDisplay;
