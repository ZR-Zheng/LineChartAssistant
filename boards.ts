import { blankChart, clamp, sampleChart } from './chart';
import type { ChartDocument } from './types';

interface History {
  chart: ChartDocument;
  past: ChartDocument[];
  future: ChartDocument[];
}

export interface Board extends History {
  id: number;
  zoom: number;
}

interface Workspace {
  boards: Board[];
  activeId: number;
  nextId: number;
  deleted: { board: Board; index: number; replacement?: Board }[];
}

type Action =
  | { type: 'add'; chart?: ChartDocument }
  | { type: 'duplicate' }
  | { type: 'restore' }
  | { type: 'delete'; id: number }
  | { type: 'select'; id: number }
  | { type: 'zoom'; id: number; value: number; relative?: boolean }
  | { type: 'undo' | 'redo'; id: number }
  | { type: 'edit'; id: number; update: (chart: ChartDocument) => ChartDocument };

function newBoard(id: number, chart: ChartDocument): Board {
  return { id, chart, past: [], future: [], zoom: 100 };
}

export function initialWorkspace(): Workspace {
  return { boards: [newBoard(1, sampleChart())], activeId: 1, nextId: 2, deleted: [] };
}

export function boardReducer(workspace: Workspace, action: Action): Workspace {
  if (action.type === 'add' || action.type === 'duplicate') {
    const current = workspace.boards.find(board => board.id === workspace.activeId);
    const id = workspace.nextId;
    const chart = action.type === 'duplicate' ? structuredClone(current.chart) : action.chart ?? blankChart(current.chart.kind);
    return { ...workspace, boards: [...workspace.boards, newBoard(id, chart)], activeId: id, nextId: id + 1 };
  }
  if (action.type === 'delete') {
    const index = workspace.boards.findIndex(board => board.id === action.id);
    if (index < 0) return workspace;
    const board = workspace.boards[index];
    const boards = workspace.boards.filter(item => item.id !== board.id);
    const replacement = boards.length === 0 ? newBoard(workspace.nextId, blankChart(board.chart.kind)) : undefined;
    if (replacement) boards.push(replacement);
    const activeId = workspace.activeId === board.id ? boards[Math.min(index, boards.length - 1)].id : workspace.activeId;
    return {
      ...workspace, boards, activeId,
      nextId: workspace.nextId + Number(Boolean(replacement)),
      deleted: [...workspace.deleted, { board, index, replacement }],
    };
  }
  if (action.type === 'restore') {
    const entry = workspace.deleted.at(-1);
    if (!entry) return workspace;
    const boards = workspace.boards.filter(board => board !== entry.replacement);
    boards.splice(entry.index, 0, entry.board);
    return { ...workspace, boards, activeId: entry.board.id, deleted: workspace.deleted.slice(0, -1) };
  }
  if (action.type === 'select') {
    if (!workspace.boards.some(board => board.id === action.id)) return workspace;
    return { ...workspace, activeId: action.id };
  }
  if (!('id' in action)) return workspace;

  const boards = workspace.boards.map(board => {
    if (board.id !== action.id) return board;
    const { chart, past, future } = board;
    if (action.type === 'zoom') {
      const zoom = clamp(action.value + (action.relative ? board.zoom : 0), 50, 200);
      return zoom === board.zoom ? board : { ...board, zoom };
    }
    if (action.type === 'edit') {
      const next = action.update(chart);
      return next === chart ? board : { ...board, chart: next, past: [...past.slice(-99), chart], future: [] };
    }
    if (action.type === 'undo' && past.length) {
      return { ...board, chart: past.at(-1), past: past.slice(0, -1), future: [chart, ...future] };
    }
    if (action.type === 'redo' && future.length) {
      return { ...board, chart: future[0], past: [...past, chart], future: future.slice(1) };
    }
    return board;
  });
  return boards.every((board, index) => board === workspace.boards[index]) ? workspace : { ...workspace, boards };
}
