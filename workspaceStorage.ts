import { initialWorkspace } from './boards';
import type { Board, Workspace } from './boards';
import { AXIS_LENGTHS, isAxisArrowhead, isAxisBreak, TEXT_FONTS } from './chart';
import type { ChartDocument } from './types';

const STORAGE_KEY = 'lineChartWorkspace';
const VERSION = 1;

type SavedBoard = Pick<Board, 'id' | 'chart' | 'zoom'>;
type SavedWorkspace = {
  version: number;
  boards: SavedBoard[];
  activeId: number;
  nextId: number;
  deleted: { board: SavedBoard; index: number; replacementId?: number }[];
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string';
const bool = (value: unknown): value is boolean => typeof value === 'boolean';
const color = (value: unknown) => text(value) && /^#[0-9a-f]{6}$/i.test(value);
const id = (value: unknown): value is number => number(value) && Number.isSafeInteger(value) && value > 0;
const point = (value: unknown) => object(value) && number(value.x) && number(value.y);
const positive = (value: unknown) => number(value) && value > 0;
const oneOf = (value: unknown, ...choices: unknown[]) => choices.includes(value);

function axisStyle(axis: 'x' | 'y', value: unknown): boolean {
  const range = AXIS_LENGTHS[axis];
  return object(value) && oneOf(value.line, 'solid', 'dashed', 'arrow') && color(value.color) && positive(value.width)
    && number(value.length) && value.length >= range.min && value.length <= range.max
    && number(value.tickLength) && value.tickLength >= 0 && oneOf(value.tickPosition, 'outside', 'inside', 'cross')
    && oneOf(value.tickMode, 'auto', 'all', 'interval') && positive(value.interval)
    && (axis === 'y' || Number.isSafeInteger(value.interval))
    && (value.maximum === undefined || number(value.maximum) && value.maximum >= 0)
    && (value.omitted === undefined || axis === 'y' && isAxisBreak(value.omitted)
      && (value.maximum === undefined || number(value.maximum) && value.omitted.to <= value.maximum))
    && (value.visible === undefined || bool(value.visible)) && bool(value.showValues) && bool(value.showLabel)
    && oneOf(value.titlePlacement, 'end', 'center', 'start');
}

function validChart(value: unknown): value is ChartDocument {
  if (!object(value) || !oneOf(value.kind, 'line', 'bar') || !text(value.title) || !text(value.xLabel) || !text(value.yLabel)) return false;
  const { categories, series, style, marks, notes, textStyles, plotOffset, labelPositions, scaleExtent, hiddenCategoryLabels } = value;
  return Array.isArray(categories) && categories.length > 0 && categories.every(text)
    && (hiddenCategoryLabels === undefined || Array.isArray(hiddenCategoryLabels)
      && hiddenCategoryLabels.every(index => Number.isSafeInteger(index) && index >= 0 && index < categories.length))
    && Array.isArray(series) && series.length > 0 && series.every(item => object(item) && text(item.name) && color(item.color)
      && Array.isArray(item.values) && item.values.length === categories.length && item.values.every(v => v === null || number(v))
      && (item.style === undefined || object(item.style)
        && ['strokeWidth', 'dotSize', 'columnWidth'].every(key => item.style[key] === undefined || positive(item.style[key]))
        && ['dots', 'showLabels', 'roundedColumns'].every(key => item.style[key] === undefined || bool(item.style[key]))
        && oneOf(item.style.dotShape, undefined, 'circle', 'square', 'diamond')
        && oneOf(item.style.dotFill, undefined, 'hollow', 'solid')))
    && object(style) && bool(style.grid) && bool(style.dots) && bool(style.showLabels) && bool(style.showOrigin)
    && oneOf(style.legend, true, false, 'auto') && (style.showTitle === undefined || bool(style.showTitle))
    && (style.axisArrowhead === undefined || isAxisArrowhead(style.axisArrowhead))
    && positive(style.strokeWidth) && positive(style.dotSize) && object(style.axes) && axisStyle('x', style.axes.x) && axisStyle('y', style.axes.y)
    && Array.isArray(marks) && marks.every(mark => object(mark) && oneOf(mark.type, 'line', 'pen') && color(mark.color)
      && Array.isArray(mark.points) && mark.points.length >= (mark.type === 'line' ? 2 : 1) && mark.points.every(point)
      && (mark.width === undefined || positive(mark.width)) && (mark.opacity === undefined || number(mark.opacity))
      && (mark.referenceValue === undefined || number(mark.referenceValue))
      && oneOf(mark.lineKind, undefined, 'solid', 'dashed', 'arrow') && oneOf(mark.arrows, undefined, 'start', 'end', 'both'))
    && Array.isArray(notes) && notes.every(note => object(note) && text(note.id) && /^note:\d+$/.test(note.id) && text(note.text) && point(note.position))
    && point(plotOffset) && object(labelPositions) && Object.values(labelPositions).every(point)
    && object(textStyles) && Object.values(textStyles).every(item => object(item)
      && (item.font === undefined || text(item.font) && Object.hasOwn(TEXT_FONTS, item.font))
      && (item.size === undefined || positive(item.size)) && (item.color === undefined || color(item.color))
      && ['bold', 'italic', 'underline'].every(key => item[key] === undefined || bool(item[key]))
      && oneOf(item.alignment, undefined, 'start', 'middle', 'end'))
    && (scaleExtent === null || object(scaleExtent) && number(scaleExtent.min) && number(scaleExtent.max)
      && scaleExtent.min <= 0 && scaleExtent.max >= 0);
}

function validBoard(value: unknown): value is SavedBoard {
  return object(value) && id(value.id) && number(value.zoom) && value.zoom >= 50 && value.zoom <= 200 && validChart(value.chart);
}

export function serializeWorkspace(workspace: Workspace) {
  const stripHistory = ({ id, zoom, chart }: Board): SavedBoard => ({ id, zoom, chart });
  const allBoards = new Set([...workspace.boards, ...workspace.deleted.map(entry => entry.board)]);
  const snapshot: SavedWorkspace = {
    version: VERSION, boards: workspace.boards.map(stripHistory), activeId: workspace.activeId, nextId: workspace.nextId,
    deleted: workspace.deleted.map(({ board, index, replacement }) => ({ board: stripHistory(board), index,
      ...(allBoards.has(replacement) && { replacementId: replacement.id }) })),
  };
  return JSON.stringify(snapshot);
}

export function parseWorkspace(source: string): Workspace {
  const data: unknown = JSON.parse(source);
  if (!object(data) || data.version !== VERSION || !Array.isArray(data.boards) || !data.boards.length
    || !data.boards.every(validBoard) || !id(data.activeId) || !id(data.nextId) || !Array.isArray(data.deleted)
    || !data.deleted.every(entry => object(entry) && validBoard(entry.board) && number(entry.index)
      && Number.isSafeInteger(entry.index) && entry.index >= 0 && (entry.replacementId === undefined || id(entry.replacementId)))) {
    throw new Error('项目文件格式有误。');
  }
  const snapshot = data as SavedWorkspace;
  const withHistory = (board: SavedBoard): Board => ({ ...board, past: [], future: [] });
  const boards = snapshot.boards.map(withHistory);
  const removed = snapshot.deleted.map(entry => withHistory(entry.board));
  const lookup = new Map([...boards, ...removed].map(board => [board.id, board]));
  if (lookup.size !== boards.length + removed.length || !boards.some(board => board.id === snapshot.activeId)
    || [...lookup.keys()].some(key => key >= snapshot.nextId)) throw new Error('项目画布列表有误。');
  return {
    boards, activeId: snapshot.activeId, nextId: snapshot.nextId,
    deleted: snapshot.deleted.map((entry, i) => ({ board: removed[i], index: entry.index, replacement: lookup.get(entry.replacementId) })),
  };
}

export function loadWorkspace(): Workspace {
  try {
    const source = localStorage.getItem(STORAGE_KEY);
    if (source) return parseWorkspace(source);
  } catch {
    // A missing or unreadable snapshot starts with the example canvas.
  }
  return initialWorkspace();
}

export function saveWorkspace(workspace: Workspace) {
  localStorage.setItem(STORAGE_KEY, serializeWorkspace(workspace));
}
