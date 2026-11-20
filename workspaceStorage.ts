import { initialWorkspace } from './boards';
import type { Board, Workspace } from './boards';
import { AXIS_LENGTHS, EXERCISE_POSITION, isAxisArrowhead, isAxisBreak, isGroupWidth, isPieStyle, TEXT_FONTS, TEXT_SIZE } from './chart';
import { isPictographStyle } from './pictograph';
import { isPictographSymbol } from './pictographSymbols';
import type { ChartDocument } from './types';

export const STORAGE_KEY = 'lineChartWorkspace';
const CHECKPOINT_KEY = 'lineChartWorkspaceCheckpoint';
const ARCHIVE_KEY = 'lineChartWorkspaceUnreadable';
const VIEW_KEY = 'lineChartWorkspaceView';
const VERSION = 1;

type SavedChart = Omit<ChartDocument, 'kind'> & { kind: ChartDocument['kind'] | 'grouped' | 'horizontal' };
type SavedBoard = Pick<Board, 'id' | 'zoom'> & { chart: SavedChart };
type SavedWorkspace = {
  version: number;
  revision?: string;
  boards: SavedBoard[];
  activeId: number;
  nextId: number;
  deleted: { board: SavedBoard; index: number; replacementId?: number }[];
};

export interface WorkspaceSnapshot {
  source: string | null;
  revision: string | null;
}

export type WorkspaceLoadResult =
  | { status: 'loaded' | 'empty'; workspace: Workspace; snapshot: WorkspaceSnapshot }
  | { status: 'unavailable'; workspace: Workspace }
  | { status: 'invalid'; workspace: Workspace; source: string };

export class WorkspaceConflict extends Error {}

export interface WorkspaceCheckpoint {
  source: string;
  workspace: Workspace | null;
}

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
    && (value.tickLabelFont === undefined || text(value.tickLabelFont) && Object.hasOwn(TEXT_FONTS, value.tickLabelFont))
    && (value.tickLabelSize === undefined || number(value.tickLabelSize) && Number.isInteger(value.tickLabelSize)
      && value.tickLabelSize >= TEXT_SIZE.min && value.tickLabelSize <= TEXT_SIZE.max)
    && oneOf(value.tickMode, 'auto', 'all', 'interval') && positive(value.interval)
    && (axis === 'y' || Number.isSafeInteger(value.interval))
    && (value.maximum === undefined || number(value.maximum) && value.maximum >= 0)
    && (value.omitted === undefined || axis === 'y' && isAxisBreak(value.omitted)
      && (value.maximum === undefined || number(value.maximum) && value.omitted.to <= value.maximum))
    && (value.visible === undefined || bool(value.visible)) && bool(value.showValues) && bool(value.showLabel)
    && oneOf(value.titlePlacement, 'end', 'center', 'start');
}

function validChart(value: unknown): value is SavedChart {
  if (!object(value) || !oneOf(value.kind, 'line', 'bar', 'grouped', 'horizontal', 'pie', 'pictograph') || !text(value.title) || !text(value.xLabel) || !text(value.yLabel)) return false;
  const { categories, series, style, marks, notes, textStyles, plotOffset, labelPositions, scaleExtent, hiddenCategoryLabels,
    groupedColumns, barSeries, pieColors, pieSeries, piePosition, pieLegendPosition, pieLegendOffset,
    pictographSeries, pictographSymbols, pictographLegendPosition } = value;
  return Array.isArray(categories) && categories.length > 0 && categories.every(text)
    && (hiddenCategoryLabels === undefined || Array.isArray(hiddenCategoryLabels)
      && hiddenCategoryLabels.every(index => Number.isSafeInteger(index) && index >= 0 && index < categories.length))
    && (pieColors === undefined || Array.isArray(pieColors) && pieColors.length <= categories.length
      && pieColors.every(item => item === null || color(item)))
    && (pictographSymbols === undefined || Array.isArray(pictographSymbols) && pictographSymbols.length <= categories.length
      && pictographSymbols.every(item => item === null || isPictographSymbol(item)))
    && Array.isArray(series) && series.length > 0 && series.every(item => object(item) && text(item.name) && color(item.color)
      && Array.isArray(item.values) && item.values.length === categories.length && item.values.every(v => v === null || number(v))
      && (item.style === undefined || object(item.style)
        && ['strokeWidth', 'dotSize', 'columnWidth'].every(key => item.style[key] === undefined || positive(item.style[key]))
        && ['dots', 'showLabels', 'roundedColumns'].every(key => item.style[key] === undefined || bool(item.style[key]))
        && oneOf(item.style.dotShape, undefined, 'circle', 'square', 'diamond')
        && oneOf(item.style.dotFill, undefined, 'hollow', 'solid')
        && (item.style.columnIcon === undefined || object(item.style.columnIcon)
          && isPictographSymbol(item.style.columnIcon.symbol) && oneOf(item.style.columnIcon.colorMode, 'single', 'color'))))
    && [pieSeries, barSeries, pictographSeries].every(index => index === undefined
      || number(index) && Number.isSafeInteger(index) && index >= 0 && index < series.length)
    && (groupedColumns === undefined || bool(groupedColumns))
    && (piePosition === undefined || point(piePosition))
    && (pieLegendPosition === undefined || point(pieLegendPosition))
    && (pieLegendOffset === undefined || point(pieLegendOffset))
    && (pictographLegendPosition === undefined || point(pictographLegendPosition))
    && object(style) && bool(style.grid) && bool(style.dots) && bool(style.showLabels) && bool(style.showOrigin)
    && oneOf(style.legend, true, false, 'auto') && (style.showTitle === undefined || bool(style.showTitle))
    && (style.axisArrowhead === undefined || isAxisArrowhead(style.axisArrowhead))
    && (style.groupWidth === undefined || isGroupWidth(style.groupWidth)) && (style.pie === undefined || isPieStyle(style.pie))
    && (style.pictograph === undefined || isPictographStyle(style.pictograph))
    && positive(style.strokeWidth) && positive(style.dotSize) && object(style.axes) && axisStyle('x', style.axes.x) && axisStyle('y', style.axes.y)
    && Array.isArray(marks) && marks.every(mark => object(mark) && oneOf(mark.type, 'line', 'pen') && color(mark.color)
      && Array.isArray(mark.points) && mark.points.length >= (mark.type === 'line' ? 2 : 1) && mark.points.every(point)
      && (mark.width === undefined || positive(mark.width)) && (mark.opacity === undefined || number(mark.opacity))
      && (mark.referenceValue === undefined || number(mark.referenceValue))
      && oneOf(mark.lineKind, undefined, 'solid', 'dashed', 'arrow') && oneOf(mark.arrows, undefined, 'start', 'end', 'both'))
    && Array.isArray(notes) && notes.every(note => object(note) && text(note.id) && /^note:\d+$/.test(note.id) && text(note.text) && point(note.position)
      && (note.pieAttached === undefined || bool(note.pieAttached))
      && (note.exerciseQuestion === undefined || bool(note.exerciseQuestion)))
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

export function serializeWorkspace(workspace: Workspace, revision?: string) {
  const stripHistory = ({ id, zoom, chart }: Board): SavedBoard => ({ id, zoom, chart });
  const allBoards = new Set([...workspace.boards, ...workspace.deleted.map(entry => entry.board)]);
  const snapshot: SavedWorkspace = {
    version: VERSION, revision, boards: workspace.boards.map(stripHistory), activeId: workspace.activeId, nextId: workspace.nextId,
    deleted: workspace.deleted.map(({ board, index, replacement }) => ({ board: stripHistory(board), index,
      ...(allBoards.has(replacement) && { replacementId: replacement.id }) })),
  };
  return JSON.stringify(snapshot);
}

export function parseWorkspace(source: string): Workspace {
  return parseWorkspaceData(JSON.parse(source));
}

function parseWorkspaceData(data: unknown): Workspace {
  if (!object(data) || data.version !== VERSION || !Array.isArray(data.boards) || !data.boards.length
    || !data.boards.every(validBoard) || !id(data.activeId) || !id(data.nextId) || !Array.isArray(data.deleted)
    || !data.deleted.every(entry => object(entry) && validBoard(entry.board) && number(entry.index)
      && Number.isSafeInteger(entry.index) && entry.index >= 0 && (entry.replacementId === undefined || id(entry.replacementId)))) {
    throw new Error('项目文件格式有误。');
  }
  const snapshot = data as SavedWorkspace;
  const withHistory = (board: SavedBoard): Board => {
    const { kind, ...chart } = board.chart;
    const legacyGrouped = kind === 'horizontal' || kind === 'grouped';
    const normalizedKind = legacyGrouped ? 'bar' : kind;
    const groupedColumns = legacyGrouped ? true : chart.groupedColumns ?? (kind === 'bar' ? chart.series.length > 1 : undefined);
    const notes = chart.notes.map(note => note.exerciseQuestion === undefined && !note.pieAttached
      && note.id === 'note:1' && note.text.startsWith('问题：') && note.position.x === EXERCISE_POSITION.x && [513, 534].includes(note.position.y)
      ? { ...note, position: EXERCISE_POSITION, exerciseQuestion: true } : note);
    return { ...board, chart: { ...chart, kind: normalizedKind, groupedColumns, notes }, past: [], future: [] };
  };
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

export function loadWorkspace(): WorkspaceLoadResult {
  let source: string | null;
  try {
    source = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable', workspace: initialWorkspace() };
  }
  if (source === null) return { status: 'empty', workspace: initialWorkspace(), snapshot: { source, revision: null } };
  try {
    const data: unknown = JSON.parse(source);
    const workspace = parseWorkspaceData(data);
    const revision = object(data) && text(data.revision) ? data.revision : null;
    return { status: 'loaded', workspace: loadWorkspaceView(workspace, revision), snapshot: { source, revision } };
  } catch {
    return { status: 'invalid', workspace: initialWorkspace(), source };
  }
}

export function workspaceChanged(expected: string | null) {
  return localStorage.getItem(STORAGE_KEY) !== expected;
}

function checkWorkspace(expected: string | null) {
  if (workspaceChanged(expected)) throw new WorkspaceConflict('本机项目已在另一个标签页更新。');
}

export async function withWorkspaceLock<T>(write: () => T): Promise<T> {
  // Each write checks its original snapshot, including when Web Locks is unavailable.
  return globalThis.navigator?.locks ? navigator.locks.request(STORAGE_KEY, write) : write();
}

function writeWorkspace(workspace: Workspace): WorkspaceSnapshot {
  const revision = crypto.getRandomValues(new Uint32Array(4)).join('-');
  const source = serializeWorkspace(workspace, revision);
  localStorage.setItem(STORAGE_KEY, source);
  return { source, revision };
}

export function saveWorkspace(workspace: Workspace, expected: string | null) {
  checkWorkspace(expected);
  return writeWorkspace(workspace);
}

export function sameWorkspaceContent(previous: Workspace, next: Workspace) {
  return previous.nextId === next.nextId && previous.deleted === next.deleted && previous.boards.length === next.boards.length
    && previous.boards.every((board, index) => board.id === next.boards[index].id && board.chart === next.boards[index].chart);
}

function loadWorkspaceView(workspace: Workspace, revision: string | null): Workspace {
  try {
    const view: unknown = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (!object(view) || view.revision !== revision || !object(view.zooms)) return workspace;
    const zooms = view.zooms;
    return {
      ...workspace,
      activeId: workspace.boards.some(board => board.id === view.activeId) ? Number(view.activeId) : workspace.activeId,
      boards: workspace.boards.map(board => {
        const zoom = zooms[board.id];
        return number(zoom) && zoom >= 50 && zoom <= 200 ? { ...board, zoom } : board;
      }),
    };
  } catch {
    return workspace;
  }
}

export function saveWorkspaceView(workspace: Workspace, snapshot: WorkspaceSnapshot) {
  checkWorkspace(snapshot.source);
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({
      revision: snapshot.revision,
      activeId: workspace.activeId,
      zooms: Object.fromEntries(workspace.boards.map(({ id, zoom }) => [id, zoom])),
    }));
  } catch {}
}

function parseCheckpoint(source: string | null): WorkspaceCheckpoint | null {
  if (source === null) return null;
  try {
    return { source, workspace: parseWorkspace(source) };
  } catch {
    return { source, workspace: null };
  }
}

export function loadWorkspaceCheckpoint(): WorkspaceCheckpoint | null {
  try {
    return parseCheckpoint(localStorage.getItem(CHECKPOINT_KEY));
  } catch {
    return null;
  }
}

export function saveWorkspaceCheckpoint(workspace: Workspace): WorkspaceCheckpoint {
  const source = serializeWorkspace(workspace);
  localStorage.setItem(CHECKPOINT_KEY, source);
  return { source, workspace };
}

function readWorkspaceArchive(): string[] {
  const source = localStorage.getItem(ARCHIVE_KEY);
  if (source === null) return [];
  const snapshots: unknown = JSON.parse(source);
  if (!Array.isArray(snapshots) || !snapshots.every(text)) throw new Error('本机原项目备份格式有误。');
  return snapshots;
}

export function loadWorkspaceArchive(): string[] {
  try { return readWorkspaceArchive(); } catch { return []; }
}

export function archiveWorkspaceSource(source: string) {
  const snapshots = readWorkspaceArchive();
  if (!snapshots.includes(source)) localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...snapshots, source]));
}

export function replaceStoredWorkspace(next: Workspace, previous: Workspace, expected: string | null, unreadable = false) {
  checkWorkspace(expected);
  const checkpoint = parseCheckpoint(localStorage.getItem(CHECKPOINT_KEY));
  if (unreadable && expected !== null) {
    archiveWorkspaceSource(expected);
    return { snapshot: writeWorkspace(next), checkpoint };
  }

  if (checkpoint && !checkpoint.workspace) archiveWorkspaceSource(checkpoint.source);
  const replacementCheckpoint = saveWorkspaceCheckpoint(previous);
  try {
    return { snapshot: writeWorkspace(next), checkpoint: replacementCheckpoint };
  } catch (error) {
    if (checkpoint) localStorage.setItem(CHECKPOINT_KEY, checkpoint.source);
    else localStorage.removeItem(CHECKPOINT_KEY);
    throw error;
  }
}
