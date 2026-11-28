import { Fragment, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ChartNoAxesCombined, CirclePlus, Eraser, Grid2X2, Info, Magnet, Minus,
  Layers, List, MousePointer2, MoveRight, MoveUpRight, PanelTop, Pencil, Plus, Redo2, RotateCcw, SlidersHorizontal, Table2, Tags, Trash2, TriangleAlert, Type, Undo2, X,
} from 'lucide-react';
import AxisPanel from './components/AxisPanel';
import BoardSidebar from './components/BoardSidebar';
import ChartDisplay from './components/ChartDisplay';
import ChartKindPicker, { CHART_KIND_ICONS } from './components/ChartKindPicker';
import ColumnIconField from './components/ColumnIconField';
import ColorPicker from './components/ColorPicker';
import DataLabelStyleControl from './components/DataLabelStyleControl';
import DataPanel from './components/DataPanel';
import ExportControls from './components/ExportControls';
import RandomChartControls from './components/RandomChartControls';
import PieSettings from './components/PieSettings';
import type { PieSettingsTab } from './components/PieSettings';
import PictographSettings from './components/PictographSettings';
import type { PictographSettingsTab } from './components/PictographSettings';
import { AxisSelectionToolbar, DataSelectionToolbar, GroupWidthField } from './components/SelectionToolbar';
import TextToolbar from './components/TextToolbar';
import ToolbarStrip from './components/ToolbarStrip';
import { boardReducer } from './boards';
import type { Workspace } from './boards';
import { CHART_KIND_LABELS } from './chartKindLabels';
import { appendCategory, chartDataWarnings, clamp, displayedSeries, displayedSeriesField, formatValue, getPlot, getScale, getSeriesStyle, getTextStyle, hasChartAxes, hideText, isNote, MAX_MANUAL_TICKS,
  removeCategory, removeSeries, SERIES_COLORS, setChartValue, STATISTIC_LABELS, statistics, visibleMark } from './chart';
import { download, exportChartImage, exportChartSvg } from './downloads';
import { NO_TARGETS, translateLine } from './alignment';
import { createExerciseGenerator, exerciseTypes, randomChart } from './randomChart';
import type { ExerciseTopic, ExerciseType } from './randomChart';
import { movePie, resetPieLegend, togglePieLegendAttachment } from './pieLayout';
import { resetPictographLegend } from './pictograph';
import { replaceTable } from './tabular';
import { loadWorkspace, loadWorkspaceArchive, loadWorkspaceCheckpoint, parseWorkspace, replaceStoredWorkspace,
  sameWorkspaceContent, saveWorkspace, saveWorkspaceView, serializeWorkspace, STORAGE_KEY, withWorkspaceLock,
  workspaceChanged, WorkspaceConflict } from './workspaceStorage';
import type { WorkspaceSnapshot } from './workspaceStorage';
import { workspaceShortcutScope } from './workspaceShortcuts';
import type { ArrowPlacement, Axis, ChartEdit, ChartKind, DataHighlight, EraseScope, LineKind, Mark, Selection, Statistic, TextStyle, TitlePlacement, Tool } from './types';

const TOOLS = [
  { id: 'select', key: '1', label: '选择', icon: MousePointer2, hint: '点击对象可编辑，拖动数据点可调整数值。' },
  { id: 'add-data', key: '6', label: '添加数据点', icon: CirclePlus, hint: '在绘图区点击尚未填写的类别，按点击高度添加数值。' },
  { id: 'line', key: '2', label: '标注线', icon: MoveUpRight, hint: '拖动绘制标注线，或点击最大值、最小值和平均值参考线。' },
  { id: 'pen', key: '3', label: '画笔', icon: Pencil, hint: '在画布上按住并拖动，自由绘制线条。' },
  { id: 'eraser', key: '4', label: '橡皮', icon: Eraser, hint: '点击画布上的标注即可擦除。' },
  { id: 'text', key: '5', label: '文字', icon: Type, hint: '点击画布添加文字，输入后按 Enter 确认。' },
] as const;
const LINE_KINDS = [
  { id: 'solid', label: '实线' }, { id: 'dashed', label: '虚线' }, { id: 'arrow', label: '箭头线' },
] as const;
const STATISTICS = ['max', 'min', 'mean'] as const;
const ERASER_OPTIONS = [
  { id: 'marks', label: '仅标注' }, { id: 'data', label: '仅数据' }, { id: 'all', label: '标注和数据' },
] as const;
const TOOLBAR_PREFERENCE = 'chartToolbarVisible';
const DATA_PANEL_PREFERENCE = 'chartDataPanelOpen';
const WIDE_WORKSPACE = '(min-width: 1200px)';
const PANEL_WIDTH = { min: 280, max: 440, initial: 322 };
// Leave room for the tool rail, desk padding, and 480px of paper.
const MIN_CANVAS_WIDTH = 77 + 56 + 480 + 2;
type EditorPanel = 'data' | 'axes' | 'pie' | 'pictograph';

function initialPanel(firstVisit: boolean, compact: boolean): EditorPanel | null {
  if (compact) return null;
  try {
    const preference = localStorage.getItem(DATA_PANEL_PREFERENCE);
    if (preference !== null) return preference === 'true' ? 'data' : null;
  } catch {}
  return firstVisit ? 'data' : null;
}

function axisForSelection(selection: Selection | null): Axis | null {
  if (selection?.kind === 'axis') return selection.axis === 'both' ? null : selection.axis;
  if (selection?.kind === 'text') {
    if (selection.target === 'xLabel') return 'x';
    if (selection.target === 'yLabel') return 'y';
  }
  return null;
}

function App() {
  const [startup] = useState(loadWorkspace);
  const [workspace, dispatch] = useReducer(boardReducer, startup.workspace);
  const [loadFailure, setLoadFailure] = useState(() => startup.status === 'invalid' || startup.status === 'unavailable' ? startup : null);
  const [checkpoint, setCheckpoint] = useState(loadWorkspaceCheckpoint);
  const [archivedSources, setArchivedSources] = useState(loadWorkspaceArchive);
  const currentProject = useRef({ workspace, loadFailure });
  const lastSavedWorkspace = useRef(startup.status === 'loaded' ? workspace : null);
  const savedSnapshot = useRef<WorkspaceSnapshot>('snapshot' in startup ? startup.snapshot : { source: null, revision: null });
  const replacingProject = useRef(false);
  const [projectRevision, setProjectRevision] = useState(0);
  const board = workspace.boards.find(item => item.id === workspace.activeId);
  const { chart, id, past, future, zoom } = board;
  const [tool, setTool] = useState<Tool>('select');
  const [ink, setInk] = useState('#cb552e');
  const [inkWidth, setInkWidth] = useState(3.5);
  const [inkOpacity, setInkOpacity] = useState(1);
  const [inkArrows, setInkArrows] = useState<ArrowPlacement>('end');
  const [lineKind, setLineKind] = useState<LineKind>('solid');
  const [newTextStyle, setNewTextStyle] = useState<TextStyle>(() => getTextStyle(chart, 'note:0'));
  const [eraseScope, setEraseScope] = useState<EraseScope>('marks');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [highlight, setHighlight] = useState<DataHighlight | null>(null);
  const [occupiedDataPoint, setOccupiedDataPoint] = useState(false);
  const [snap, setSnap] = useState(true);
  const [snapAddedPoint, setSnapAddedPoint] = useState(false);
  const [toolbar, setToolbar] = useState(() => {
    try { return localStorage.getItem(TOOLBAR_PREFERENCE) !== 'false'; } catch { return true; }
  });
  const [compact, setCompact] = useState(() => !matchMedia(WIDE_WORKSPACE).matches);
  const [panel, setPanel] = useState<EditorPanel | null>(() => initialPanel(startup.status === 'empty', compact));
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH.initial);
  const [workspaceWidth, setWorkspaceWidth] = useState<number | null>(null);
  const [boardSidebarOpen, setBoardSidebarOpen] = useState(true);
  const [boardDrawerOpen, setBoardDrawerOpen] = useState(false);
  const [importRequest, setImportRequest] = useState(0);
  const [panelFocusRequest, setPanelFocusRequest] = useState(0);
  const [objectFocusRequest, setObjectFocusRequest] = useState(0);
  const [axisTab, setAxisTab] = useState<Axis>('x');
  const [pieTab, setPieTab] = useState<PieSettingsTab>('shape');
  const [pictographTab, setPictographTab] = useState<PictographSettingsTab>('shape');
  const [selectedSeries, setSelectedSeries] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [topic, setTopic] = useState<ExerciseTopic>('all');
  const [exercise, setExercise] = useState<ExerciseType>('chart');
  const [generateExercise] = useState(() => createExerciseGenerator());
  const projectFile = useRef<HTMLInputElement>(null);
  const pictographLegendInput = useRef<HTMLTextAreaElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const desk = useRef<HTMLDivElement>(null);
  const canvasObject = useRef<SVGElement>(null);
  const appShell = useRef<HTMLDivElement>(null);
  const appHeader = useRef<HTMLElement>(null);
  const workspaceSection = useRef<HTMLElement>(null);
  const workspaceTools = useRef<HTMLDivElement>(null);
  const toolRail = useRef<HTMLElement>(null);
  const dataButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const boardButton = useRef<HTMLButtonElement>(null);
  const panelTrigger = useRef<HTMLElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const panelResize = useRef<{ x: number; width: number }>(null);

  const pie = chart.kind === 'pie';
  const pictograph = chart.kind === 'pictograph';
  const hasAxes = hasChartAxes(chart.kind);
  const grouped = chart.kind === 'bar' && !!chart.groupedColumns;
  const seriesField = displayedSeriesField(chart);
  const visibleSeries = useMemo(() => displayedSeries(chart),
    [chart.kind, chart.groupedColumns, chart.series, chart.barSeries, chart.pieSeries, chart.pictographSeries]);
  const activeSeries = seriesField ? chart[seriesField] ?? 0 : Math.min(selectedSeries, chart.series.length - 1);
  const settingsPanel = pie ? 'pie' : pictograph ? 'pictograph' : 'axes';
  const settingsId = pie ? 'pie-panel' : pictograph ? 'pictograph-panel' : 'axis-panel';
  const openPanel = panel === 'data' || panel === settingsPanel ? panel : null;
  const boardListVisible = compact ? boardDrawerOpen : boardSidebarOpen;
  const availablePanelWidth = workspaceWidth === null ? PANEL_WIDTH.max : Math.floor(workspaceWidth - MIN_CANVAS_WIDTH);
  const narrowPanelLayout = availablePanelWidth < PANEL_WIDTH.min || (compact && openPanel !== 'axes');
  const maxPanelWidth = clamp(availablePanelWidth, PANEL_WIDTH.min, PANEL_WIDTH.max);
  const effectivePanelWidth = Math.min(panelWidth, maxPanelWidth);
  const dataView = narrowPanelLayout && openPanel === 'data';
  const stackedAxes = narrowPanelLayout && openPanel === 'axes';
  const inlinePanel = openPanel && (!narrowPanelLayout || dataView || stackedAxes);
  const drawerContent = compact && boardDrawerOpen ? 'boards'
    : openPanel && !inlinePanel ? 'settings' : null;
  const ChartIcon = CHART_KIND_ICONS[chart.kind];
  const availableExercises = exerciseTypes(chart.kind, grouped);
  const currentExercise = availableExercises.includes(exercise) ? exercise : 'chart';
  const values = chart.series[activeSeries].values;
  const stats = useMemo(() => statistics(values), [values]);
  const emptyPointCount = useMemo(() => tool === 'add-data'
    ? values.reduce((count, value) => count + (value === null ? 1 : 0), 0) : 0, [tool, values]);
  const onEdit: ChartEdit = update => dispatch({ type: 'edit', id, update });
  const { hint } = TOOLS.find(item => item.id === tool);
  const dataPanelOpen = panel === 'data';
  const pieHint = tool === 'select' ? '拖动扇形可移动图形和吸附的图注。点击扇区可改数值和颜色。' : tool === 'line' ? '拖动绘制标注线。' : hint;
  const pictographHint = tool === 'select' ? '点击一行或一列可编辑图标和数值，也可直接拖动图例。' : tool === 'line' ? '拖动绘制标注线。' : hint;
  const chartHint = occupiedDataPoint ? '此处已有数值。可用「选择」拖动数据点，或在表格中修改。'
    : tool === 'add-data' && emptyPointCount === 0 ? '当前系列已经填满。可先添加类别，再在画布上放置新点。'
      : tool === 'eraser' && eraseScope !== 'marks' ? '点击当前范围内的对象即可擦除。'
        : pie ? pieHint : pictograph ? pictographHint : hint;
  const { pointCount, otherDrawableSeries, hasEnteredData } = useMemo(() => {
    const canPlot = (value: number | null) => hasAxes ? value !== null : value > 0;
    let count = 0;
    for (const item of visibleSeries) {
      for (const value of item.values) if (canPlot(value)) count++;
    }
    return {
      pointCount: count,
      otherDrawableSeries: seriesField && count === 0 ? chart.series.findIndex(series => series.values.some(canPlot)) : -1,
      hasEnteredData: count > 0 || chart.series.some(series => series.values.some(value => value !== null)),
    };
  }, [chart.series, hasAxes, seriesField, visibleSeries]);
  const hasDrawableData = pointCount > 0;
  const markIndex = selection?.kind === 'mark' ? selection.index : undefined;
  const mark = markIndex === undefined ? undefined : chart.marks[markIndex];
  const text = selection?.kind === 'text' ? selection.target : null;
  const datum = selection?.kind === 'data' ? selection.datum : null;
  const axis = selection?.kind === 'axis' ? selection.axis : null;
  const activeText = text === 'xLabel' && (!chart.style.axes.x.showLabel || chart.style.axes.x.visible === false)
    || text === 'yLabel' && (!chart.style.axes.y.showLabel || chart.style.axes.y.visible === false)
    || text === 'title' && chart.style.showTitle === false
    || text !== null && isNote(text) && !chart.notes.some(note => note.id === text)
    || typeof text === 'number' && (text >= chart.categories.length || chart.hiddenCategoryLabels?.includes(text)) ? null : text;
  const activeDatum = datum && chart.series[datum.series]?.values[datum.index] !== undefined ? datum : null;
  const currentInk = mark?.color ?? ink;
  const currentWidth = mark?.width ?? (mark ? 3.5 : inkWidth);
  const currentOpacity = mark?.opacity ?? (mark ? 1 : inkOpacity);
  const currentArrows = mark?.arrows ?? (mark ? 'end' : inkArrows);
  const currentLineKind = mark ? mark.lineKind ?? 'solid' : lineKind;
  const showDataLabels = visibleSeries.some(series => getSeriesStyle(series, chart.style).showLabels);
  const showLegend = pictograph ? chart.style.pictograph?.showKey !== false
    : chart.style.legend === true || chart.style.legend === 'auto' && (pie || visibleSeries.length > 1);
  const legendSelected = showLegend && (pie && selection?.kind === 'pie-legend'
    || pictograph && selection?.kind === 'pictograph-legend');
  const selectedObject = Boolean(mark || activeText !== null || activeDatum || axis || legendSelected);
  const showObjectToolbar = !dataView && (tool !== 'select' || toolbar || selectedObject);
  const axisToolbar = !!axis && tool !== 'add-data' && tool !== 'text';
  const closeObjectToolbar = (axisToolbar || activeDatum && tool !== 'add-data' && tool !== 'text') ? () => choose(null) : undefined;
  const yAxis = chart.style.axes.y;
  const needScale = yAxis.tickMode !== 'auto' || tool === 'line' || mark?.referenceValue !== undefined || yAxis.omitted;
  const plot = useMemo(() => getPlot(chart), [chart.style, chart.plotOffset, chart.categories, chart.textStyles]);
  const scale = useMemo(() => hasAxes && needScale ? getScale(visibleSeries, chart.scaleExtent, plot, yAxis) : null,
    [hasAxes, needScale, visibleSeries, chart.scaleExtent, plot, yAxis]);
  const { clipped, messages: dataWarnings } = useMemo(() => chartDataWarnings(chart, scale), [chart, scale]);
  const notice = [
    scale?.tooManyTicks ? `纵轴超过 ${MAX_MANUAL_TICKS} 个刻度，暂用自动刻度。` : '',
    ...dataWarnings,
  ].filter(Boolean).join(' ');

  useEffect(() => {
    try { localStorage.setItem(TOOLBAR_PREFERENCE, String(toolbar)); } catch {}
  }, [toolbar]);

  useEffect(() => {
    const media = matchMedia(WIDE_WORKSPACE);
    const update = () => {
      const boardHadFocus = document.activeElement?.closest('#board-list-panel');
      setCompact(!media.matches);
      if (media.matches) setBoardDrawerOpen(false);
      if (boardHadFocus) requestAnimationFrame(() => boardButton.current?.focus({ preventScroll: true }));
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const shell = appShell.current;
    const header = appHeader.current;
    const section = workspaceSection.current;
    const tools = workspaceTools.current;
    const rail = toolRail.current;
    if (!shell || !header || !section || !tools || !rail) return;
    const heights = [
      [header, '--app-header-height'], [tools, '--workspace-tools-height'], [rail, '--tool-rail-height'],
    ] as const;
    function measure() {
      setWorkspaceWidth(section.clientWidth);
      const measurements = heights.map(([element, property]) => [property, element.getBoundingClientRect().height] as const);
      for (const [property, height] of measurements) {
        shell.style.setProperty(property, `${height}px`);
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    for (const [element] of heights) observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (compact) return;
    try { localStorage.setItem(DATA_PANEL_PREFERENCE, String(dataPanelOpen)); } catch {}
  }, [compact, dataPanelOpen]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 1300);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  useLayoutEffect(() => {
    currentProject.current = { workspace, loadFailure };
  }, [workspace, loadFailure]);

  useEffect(() => {
    const previous = lastSavedWorkspace.current;
    if (loadFailure || saveConflict || previous === workspace) return;
    let stopped = false;
    void withWorkspaceLock(() => {
      if (stopped || workspace !== currentProject.current.workspace || previous !== lastSavedWorkspace.current) return;
      if (!previous || !sameWorkspaceContent(previous, workspace)) {
        savedSnapshot.current = saveWorkspace(workspace, savedSnapshot.current.source);
      }
      saveWorkspaceView(workspace, savedSnapshot.current);
      lastSavedWorkspace.current = workspace;
      setSaveFailed(false);
    }).catch(error => {
      if (stopped) return;
      if (error instanceof WorkspaceConflict) setSaveConflict(true);
      else setSaveFailed(true);
    });
    return () => { stopped = true; };
  }, [workspace, loadFailure, saveConflict]);

  useEffect(() => {
    function checkChange(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const failure = currentProject.current.loadFailure;
      if (failure?.status === 'unavailable') return;
      try {
        const expected = failure?.status === 'invalid' ? failure.source : savedSnapshot.current.source;
        if (workspaceChanged(expected)) setSaveConflict(true);
      } catch {
        setSaveFailed(true);
      }
    }
    window.addEventListener('storage', checkChange);
    return () => window.removeEventListener('storage', checkChange);
  }, []);

  useLayoutEffect(() => {
    const dialog = drawer.current;
    if (!drawerContent || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [drawerContent]);

  useLayoutEffect(() => {
    if (openPanel === 'axes' && !stackedAxes) document.getElementById('axis-panel')?.scrollTo(0, 0);
  }, [openPanel, stackedAxes, axisTab]);

  useLayoutEffect(() => {
    if (!panelFocusRequest || !openPanel) return;
    const section = workspaceSection.current;
    const headerBottom = Math.max(0, appHeader.current?.getBoundingClientRect().bottom ?? 0);
    if (dataView && section && section.getBoundingClientRect().top < headerBottom) section.scrollIntoView({ block: 'start' });
    if (openPanel === 'pictograph' && pictographTab === 'legend') {
      pictographLegendInput.current?.focus({ preventScroll: true });
    } else {
      const editor = document.getElementById(openPanel === 'data' ? 'data-panel' : settingsId);
      if (stackedAxes) editor?.scrollIntoView({ block: 'start' });
      editor?.querySelector<HTMLElement>('.panel-heading button')?.focus({ preventScroll: true });
    }
  }, [panelFocusRequest, openPanel]);

  useLayoutEffect(() => {
    if (!objectFocusRequest || !canvasObject.current) return;
    const toolbar = workspaceSection.current?.querySelector('.toolbar-strip');
    const value = toolbar?.querySelector<HTMLInputElement>('.datum-toolbar-primary input');
    const control = value ?? toolbar?.querySelector<HTMLElement>('.drawing-toolbar :is(button:not(:disabled), input, select, summary)');
    control?.focus();
    value?.select();
  }, [objectFocusRequest]);

  useEffect(() => {
    const viewport = desk.current;
    function wheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.deltaY) return;
      event.preventDefault();
      dispatch({ type: 'zoom', id, value: -Math.sign(event.deltaY) * 10, relative: true });
    }
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [id]);

  function choose(next: Selection | null) {
    canvasObject.current = null;
    setSelection(next);
    setHighlight(null);
    setOccupiedDataPoint(false);
    if (next?.kind === 'data') setSelectedSeries(next.datum.series);
    const nextAxis = axisForSelection(next);
    if (nextAxis) setAxisTab(nextAxis);
  }

  function editCanvasObject(next: Selection, trigger: SVGElement) {
    choose(next);
    canvasObject.current = trigger;
    setObjectFocusRequest(request => request + 1);
  }

  function returnToCanvas(event: ReactKeyboardEvent<HTMLDivElement>) {
    const trigger = canvasObject.current;
    if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing
        || (!trigger && !(event.target instanceof HTMLInputElement))) return;
    if (document.querySelector('.datum-delete-menu:popover-open, .pictograph-symbol-popover:popover-open, .data-label-style-menu:popover-open')) return;
    event.preventDefault();
    canvasObject.current = null;
    if (trigger?.isConnected) trigger.focus();
    else svg.current?.focus();
  }

  function resetCanvasZoom() {
    dispatch({ type: 'zoom', id, value: 100 });
    desk.current?.scrollTo(0, 0);
  }

  function changeTool(next: Tool) {
    if (next === 'add-data' && !hasAxes) return;
    choose(null);
    setTool(next);
    if (next === 'eraser') setEraseScope('marks');
  }

  function openEditorPanel(next: EditorPanel, trigger?: HTMLElement, importTable = false) {
    panelTrigger.current = trigger ?? (next === 'data' ? dataButton.current : settingsButton.current);
    if (compact) setBoardDrawerOpen(false);
    setImportRequest(request => importTable ? request + 1 : 0);
    setPanel(next);
    setPanelFocusRequest(request => request + 1);
  }

  function loadExample() {
    const { categories, series, xLabel, yLabel } = randomChart(chart.kind, Math.random, 'all', 'chart', grouped);
    onEdit(current => replaceTable(current, { categories, series, xLabel, yLabel }));
    dataButton.current?.focus({ preventScroll: true });
  }

  function closeEditorPanel() {
    const trigger = panelTrigger.current;
    const fallback = openPanel === 'data' ? dataButton.current : settingsButton.current;
    setPanel(null);
    setImportRequest(0);
    requestAnimationFrame(() => {
      (trigger?.isConnected && trigger.getClientRects().length ? trigger : fallback)?.focus({ preventScroll: true });
    });
  }

  function closeBoardList() {
    setBoardDrawerOpen(false);
    requestAnimationFrame(() => boardButton.current?.focus({ preventScroll: true }));
  }

  function changeKind(kind: ChartKind) {
    if (kind === chart.kind) return;
    choose(null);
    if (tool === 'add-data' && !hasChartAxes(kind)) setTool('select');
    if (panel !== 'data') setPanel(null);
    onEdit(current => ({ ...current, kind, scaleExtent: null,
      ...(kind === 'bar' && { groupedColumns: current.groupedColumns ?? false }) }));
  }

  function toggleGroupedColumns() {
    const enabled = !grouped;
    choose(null);
    setSelectedSeries(activeSeries);
    if (enabled) openEditorPanel('data');
    onEdit(current => ({ ...current, groupedColumns: enabled, barSeries: activeSeries, scaleExtent: null,
      series: enabled && current.series.length === 1 ? [...current.series, {
        name: '数据 2', color: SERIES_COLORS.find(color => color !== current.series[0].color),
        values: current.categories.map(() => null),
      }] : current.series }));
  }

  function selectSeries(index: number) {
    setSelectedSeries(index);
    setOccupiedDataPoint(false);
    if (!seriesField) return;
    if (index !== activeSeries) choose(null);
    onEdit(current => !current.series[index] || (current[seriesField] ?? 0) === index ? current
      : { ...current, [seriesField]: index, scaleExtent: seriesField === 'barSeries' ? null : current.scaleExtent });
  }

  function resetBoardControls() {
    changeTool('select');
    setSelectedSeries(0);
    setPanel(current => current === 'data' ? current : null);
    setImportRequest(0);
    setError('');
    if (desk.current) desk.current.scrollTo(0, 0);
  }

  function changeBoard(action: 'add' | 'duplicate' | 'random' | 'restore' | number) {
    if (compact && boardListVisible) closeBoardList();
    if (id === action) return;
    resetBoardControls();
    if (typeof action === 'number') dispatch({ type: 'select', id: action });
    else if (action === 'random') dispatch({ type: 'add', chart: generateExercise(chart.kind, topic, currentExercise, grouped) });
    else dispatch({ type: action });
  }

  function deleteBoard(boardId: number) {
    if (id === boardId) resetBoardControls();
    dispatch({ type: 'delete', id: boardId });
  }

  function clearBoards() {
    const prompt = loadFailure?.status === 'invalid'
      ? '保留无法读取的原始快照，并创建新的本机项目？如需保留本页的改动，请先备份当前项目。'
      : `清空 ${workspace.boards.length} 张画布及已删除的画布记录？可以恢复本次清空前的项目。`;
    if (window.confirm(prompt)) replaceProject(boardReducer(currentProject.current.workspace, { type: 'clear' }));
  }

  async function replaceProject(next: Workspace) {
    if (replacingProject.current || saveConflict) return;
    const { workspace: previous, loadFailure: failure } = currentProject.current;
    replacingProject.current = true;
    try {
      await withWorkspaceLock(() => {
        if (previous !== currentProject.current.workspace) {
          setError('当前项目已有新改动，请重新确认替换。');
          return;
        }
        if (failure?.status === 'unavailable') {
          setCheckpoint({ source: serializeWorkspace(previous), workspace: previous });
        } else {
          const unreadable = failure?.status === 'invalid';
          const expected = unreadable ? failure.source : savedSnapshot.current.source;
          const replacement = replaceStoredWorkspace(next, previous, expected, unreadable);
          savedSnapshot.current = replacement.snapshot;
          setCheckpoint(replacement.checkpoint);
          setArchivedSources(loadWorkspaceArchive());
          lastSavedWorkspace.current = next;
          setLoadFailure(null);
          setSaveFailed(false);
        }
        resetBoardControls();
        if (compact && boardListVisible) closeBoardList();
        setProjectRevision(revision => revision + 1);
        dispatch({ type: 'load', workspace: next });
      });
    } catch (error) {
      if (compact && boardListVisible) closeBoardList();
      if (error instanceof WorkspaceConflict) setSaveConflict(true);
      else setError('无法在本机保留替换前的数据。请备份当前项目并检查浏览器的存储设置或剩余空间。');
    } finally {
      replacingProject.current = false;
    }
  }

  function loadLatestProject() {
    const lastSaved = lastSavedWorkspace.current ?? startup.workspace;
    if (!sameWorkspaceContent(lastSaved, workspace)
      && !window.confirm('载入本机项目会替换本页尚未保存的改动。是否继续？')) return;
    const latest = loadWorkspace();
    if (latest.status === 'invalid' || latest.status === 'unavailable') {
      setError('无法读取本机最新版。请先备份本页项目。');
      return;
    }
    savedSnapshot.current = latest.snapshot;
    lastSavedWorkspace.current = latest.status === 'loaded' ? latest.workspace : null;
    setCheckpoint(loadWorkspaceCheckpoint());
    setArchivedSources(loadWorkspaceArchive());
    setLoadFailure(null);
    setSaveConflict(false);
    setSaveFailed(false);
    resetBoardControls();
    if (compact && boardListVisible) closeBoardList();
    setProjectRevision(revision => revision + 1);
    dispatch({ type: 'load', workspace: latest.workspace });
  }

  function deleteSeries(index: number) {
    if (chart.series.length <= 1) return;
    choose(null);
    onEdit(current => removeSeries(current, index));
    if (index <= activeSeries) setSelectedSeries(Math.max(0, activeSeries - 1));
  }

  function backupProject() {
    download(new Blob([serializeWorkspace(workspace)], { type: 'application/json' }), '统计图画板.json');
  }

  function downloadOriginal(source: string, index?: number) {
    download(new Blob([source], { type: 'application/json' }), `统计图画板-原始快照${index === undefined ? '' : `-${index + 1}`}.json`);
  }

  function restoreCheckpoint() {
    const previous = loadFailure?.status === 'unavailable' ? checkpoint : loadWorkspaceCheckpoint();
    if (!previous?.workspace) {
      setCheckpoint(previous);
      if (compact && boardListVisible) closeBoardList();
      setError('无法读取回滚项目。');
      return;
    }
    if (window.confirm(`恢复上次替换前的 ${previous.workspace.boards.length} 张画布？`)) replaceProject(previous.workspace);
  }

  async function restoreProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const restored = parseWorkspace(await file.text());
      if (window.confirm(`恢复项目中的 ${restored.boards.length} 张画布？这会替换当前项目。`)) replaceProject(restored);
    } catch {
      if (compact && boardListVisible) closeBoardList();
      setError('无法恢复项目。请选择由统计图画板导出的 JSON 文件。');
    }
  }

  function formatText(changes: Partial<TextStyle>) {
    if (activeText === null) return;
    onEdit(current => ({
      ...current,
      textStyles: { ...current.textStyles, [activeText]: { ...current.textStyles[activeText], ...changes } },
    }));
  }

  function placeAxisTitle(axis: Axis, titlePlacement: TitlePlacement) {
    onEdit(current => {
      const labelPositions = { ...current.labelPositions };
      delete labelPositions[axis === 'x' ? 'xLabel' : 'yLabel'];
      return {
        ...current, labelPositions, style: {
          ...current.style, axes: {
            ...current.style.axes, [axis]: { ...current.style.axes[axis], titlePlacement },
          },
        },
      };
    });
  }

  function toggleDataLabels() {
    if (seriesField) {
      onEdit(current => ({ ...current, series: current.series.map((series, i) => i === activeSeries
        ? { ...series, style: { ...series.style, showLabels: !showDataLabels } } : series) }));
      return;
    }
    onEdit(current => ({
      ...current, style: { ...current.style, showLabels: !showDataLabels },
      series: current.series.map(series => {
        if (series.style?.showLabels === undefined) return series;
        const { showLabels, ...style } = series.style;
        return { ...series, style };
      }),
    }));
  }

  function toggleLegend() {
    if (legendSelected) choose(null);
    onEdit(current => ({ ...current, style: pictograph
      ? { ...current.style, pictograph: { ...current.style.pictograph, showKey: !showLegend } }
      : { ...current.style, legend: !showLegend } }));
  }

  function updateMark(changes: Partial<Mark>) {
    if (markIndex === undefined || !mark) return;
    onEdit(current => {
      const previous = current.marks[markIndex];
      if (!previous || Object.entries(changes).every(([key, value]) => previous[key as keyof Mark] === value)) return current;
      return { ...current, marks: current.marks.map((item, index) => index === markIndex ? { ...previous, ...changes } : item) };
    });
  }

  function removeSelection() {
    if (mark) onEdit(current => ({ ...current, marks: current.marks.filter((_, index) => index !== markIndex) }));
    else if (activeText !== null) {
      onEdit(current => hideText(current, activeText));
    } else if (activeDatum) {
      onEdit(current => setChartValue(current, activeDatum.series, activeDatum.index, null));
    } else if (legendSelected) {
      toggleLegend();
      return;
    } else if (axis) {
      onEdit(current => {
        const { x, y } = current.style.axes;
        const axes = { x: axis === 'y' ? x : { ...x, visible: false }, y: axis === 'x' ? y : { ...y, visible: false } };
        return { ...current, style: { ...current.style, axes } };
      });
    } else return;
    choose(null);
  }

  function navigateHistory(type: 'undo' | 'redo') {
    choose(null);
    const next = type === 'undo' ? past.at(-1) : future[0];
    if (tool === 'add-data' && next && !hasChartAxes(next.kind)) setTool('select');
    dispatch({ type, id });
  }

  function selectAxisTab(axis: Axis) {
    choose({ kind: 'axis', axis });
  }

  function openAxes(axis: Axis = 'x', trigger?: HTMLElement) {
    selectAxisTab(axis);
    openEditorPanel('axes', trigger);
    setTool('select');
  }

  function toggleChartSettings(trigger: HTMLButtonElement) {
    if (openPanel === settingsPanel) {
      closeEditorPanel();
    } else if (hasAxes) {
      const selectedAxis = selection?.kind === 'text' && activeText === null ? null : axisForSelection(selection);
      openAxes(selectedAxis ?? 'x', trigger);
    } else {
      openEditorPanel(settingsPanel, trigger);
    }
  }

  function openPictographLegend(trigger?: HTMLElement) {
    setPictographTab('legend');
    openEditorPanel('pictograph', trigger);
  }

  function openPieLabelSettings(trigger: HTMLElement) {
    setPieTab('labels');
    openEditorPanel('pie', trigger);
  }

  function addStatistic(stat: Statistic) {
    if (!stats || !scale?.includes(stats[stat])) return;
    const y = scale.y(stats[stat]);
    const line: Mark = {
      type: 'line', lineKind: currentLineKind, color: currentInk, width: currentWidth,
      opacity: currentOpacity, arrows: currentArrows,
      referenceValue: stats[stat],
      points: [{ x: plot.left, y }, { x: plot.right, y }],
    };
    onEdit(current => ({ ...current, marks: [...current.marks, line] }));
    choose({ kind: 'mark', index: chart.marks.length });
  }

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const scope = workspaceShortcutScope(event.target);
      if (drawer.current?.open || event.defaultPrevented || scope === 'blocked' || event.isComposing || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === 'z' || key === 'y') {
          event.preventDefault();
          navigateHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
        }
        return;
      }
      if (dataView || scope === 'workspace' || document.querySelector(':is([popover]:popover-open)')) return;
      const next = TOOLS.find(item => item.key === key);
      if (next) {
        changeTool(next.id);
        return;
      }
      if (key === 'escape') {
        if (tool === 'add-data') changeTool('select');
        else choose(null);
      }
      if (scope !== 'tools' && (key === 'delete' || key === 'backspace')
        && (mark || activeDatum || activeText !== null || axis || legendSelected)) {
        event.preventDefault();
        removeSelection();
      }
      const visible = mark && (mark.referenceValue === undefined ? mark : visibleMark(mark, plot, scale, chart.kind));
      if (visible && scope === 'canvas' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const { points } = translateLine(visible.points, {
          x: key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
          y: key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
        }, NO_TARGETS, 0);
        updateMark({ points, referenceValue: undefined });
      }
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [id, tool, hasAxes, dataView, mark, markIndex, activeDatum, activeText, axis, legendSelected, mark?.referenceValue === undefined ? null : chart]);

  async function exportChart(format: 'PNG' | 'SVG') {
    if (!svg.current || exporting) return;
    setExporting(true);
    setError('');
    try {
      const save = format === 'PNG' ? exportChartImage : exportChartSvg;
      await save(svg.current, chart.title);
    } catch {
      setError(`${format} 导出失败，请重试。`);
    } finally {
      setExporting(false);
    }
  }

  function toolSettings() {
    if (tool === 'add-data') return (
      <div className="drawing-toolbar add-data-toolbar" role="group" aria-label="添加数据点设置">
        {chart.series.length > 1 ? <label className="ink-width">目标系列
          <select value={activeSeries} onChange={event => selectSeries(Number(event.target.value))}>
            {chart.series.map((series, index) => <option key={index} value={index}>{series.name}</option>)}
          </select>
        </label> : <span className="ink-width">目标系列
          <span className="text-toolbar-name add-data-series-name" title={chart.series[activeSeries].name}>
            {chart.series[activeSeries].name || '未命名系列'}
          </span>
        </span>}
        <button className="button compact toolbar-toggle" aria-pressed={snapAddedPoint}
          title="对齐到最近的纵轴刻度。按住 Alt 临时关闭吸附。" onClick={() => setSnapAddedPoint(!snapAddedPoint)}>
          <Magnet size={15} /> 吸附刻度
        </button>
        <button className="button compact" onClick={() => {
          onEdit(appendCategory);
          choose(null);
        }}>
          <Plus size={15} /> 添加类别
        </button>
        <span className="data-entry-hint" role="status">剩余 {emptyPointCount} 个空位</span>
      </div>
    );
    if (legendSelected) return (
      <div className="drawing-toolbar text-toolbar" role="group" aria-label={pie ? '所选扇形图图例' : '所选图标图例'}>
        <span className="text-toolbar-name">图例</span>
        <button className="button compact" onClick={event => {
          if (pie) {
            setPieTab('legend');
            openEditorPanel('pie', event.currentTarget);
          } else openPictographLegend(event.currentTarget);
        }}>
          <SlidersHorizontal size={15} /> {pie ? '图例设置' : '编辑图例文字'}</button>
        {pie && <button className="button compact toolbar-toggle" aria-pressed={!chart.pieLegendPosition}
          onClick={() => onEdit(togglePieLegendAttachment)}>随图移动</button>}
        <button className="button compact" disabled={pie ? !chart.pieLegendPosition && !chart.pieLegendOffset : !chart.pictographLegendPosition}
          onClick={() => onEdit(pie ? resetPieLegend : resetPictographLegend)}>
          <RotateCcw size={15} /> 还原位置</button>
        <button className="button compact" onClick={toggleLegend}>隐藏图例</button>
        <button className="icon-button text-toolbar-close" aria-label="关闭图例工具栏" onClick={() => choose(null)}><X size={17} /></button>
      </div>
    );
    if (activeText !== null) {
      const axis = activeText === 'xLabel' ? 'x' : activeText === 'yLabel' ? 'y' : undefined;
      const note = pie && isNote(activeText) ? chart.notes.find(note => note.id === activeText && !note.exerciseQuestion) : null;
      return <TextToolbar target={activeText} style={getTextStyle(chart, activeText)}
        followPie={note && { enabled: !!note.pieAttached, onToggle: () => onEdit(current => ({
          ...current, notes: current.notes.map(item => item.id === note.id ? { ...item, pieAttached: !item.pieAttached || undefined } : item),
        })) }}
        titlePlacement={axis && {
          axis, value: chart.style.axes[axis].titlePlacement, onChange: value => placeAxisTitle(axis, value),
        }}
        onChange={formatText} onClose={() => choose(null)} onDelete={removeSelection}
        onDeleteCategory={typeof activeText === 'number' && chart.categories.length > 1 ? () => {
          onEdit(current => removeCategory(current, activeText));
          choose(null);
        } : undefined} />;
    }
    if (tool === 'text') return <TextToolbar target="note:0" style={newTextStyle}
      onChange={changes => setNewTextStyle(previous => ({ ...previous, ...changes }))} />;
    if (activeDatum) return <Fragment key={`${id}:${chart.kind}:${activeDatum.series}:${activeDatum.index}`}>
      <DataSelectionToolbar chart={chart} datum={activeDatum} onEdit={onEdit}
        onClose={() => choose(null)} onRemoveSeries={deleteSeries} onHighlight={setHighlight} onOpenPieLabels={openPieLabelSettings} />
    </Fragment>;
    if (axis) return <Fragment key={axis}>
      <AxisSelectionToolbar chart={chart} axis={axis} onEdit={onEdit} onSettings={openAxes} />
    </Fragment>;
    if (tool === 'line' || tool === 'pen' || mark) return (
      <div className="drawing-toolbar" aria-label="标注设置" role="group">
        {(tool === 'line' || mark?.type === 'line') && (
          <div className="line-options" role="group" aria-label="线型">
            {LINE_KINDS.map(({ id, label }) => (
              <button key={id} className="button compact" aria-pressed={currentLineKind === id}
                onClick={() => mark ? updateMark({ lineKind: id }) : setLineKind(id)}>
                {id === 'arrow' ? <MoveRight size={17} /> : <Minus size={17} strokeDasharray={id === 'dashed' ? '3 3' : undefined} />}
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="color-field"><span>颜色</span>
          <ColorPicker value={currentInk} label="标注颜色" onChange={color => mark ? updateMark({ color }) : setInk(color)} />
        </div>
        <label className="ink-width">线宽
          <select value={currentWidth} onChange={event => {
            const width = Number(event.target.value);
            if (mark) updateMark({ width });
            else setInkWidth(width);
          }}>
            {[2, 3.5, 5, 7].map(width => <option key={width} value={width}>{width}</option>)}
          </select>
        </label>
        <label className="ink-width">不透明度
          <select value={currentOpacity} onChange={event => {
            const opacity = Number(event.target.value);
            if (mark) updateMark({ opacity });
            else setInkOpacity(opacity);
          }}>
            {[0.25, 0.5, 0.75, 1].map(opacity => <option key={opacity} value={opacity}>{opacity * 100}%</option>)}
          </select>
        </label>
        {(tool === 'line' || mark?.type === 'line') && currentLineKind === 'arrow' && (
          <label className="ink-width">箭头位置
            <select value={currentArrows} onChange={event => {
              const arrows = event.target.value as ArrowPlacement;
              if (mark) updateMark({ arrows });
              else setInkArrows(arrows);
            }}>
              <option value="end">终点</option><option value="start">起点</option><option value="both">两端</option>
            </select>
          </label>
        )}
        {mark && <button className="icon-button" aria-label="删除标注" title="删除标注" onClick={removeSelection}><Trash2 size={17} /></button>}
        {tool === 'line' && hasAxes && (stats || chart.series.length > 1) && (
          <div className="statistic-options" role="group" aria-label="统计参考线">
            {chart.series.length > 1 && (
              <select aria-label="统计参考线的数据系列" value={activeSeries} onChange={event => selectSeries(Number(event.target.value))}>
                {chart.series.map((series, index) => <option key={index} value={index}>{series.name}</option>)}
              </select>
            )}
            {stats ? STATISTICS.map(stat => (
              <button className="button compact" key={stat} disabled={!scale?.includes(stats[stat])} onClick={() => addStatistic(stat)}
                title={scale?.includes(stats[stat]) ? `添加${STATISTIC_LABELS[stat]}参考线` : '超出纵轴范围'}>
                {STATISTIC_LABELS[stat]} {formatValue(stats[stat])}
              </button>
            )) : <span className="data-entry-hint" role="status">该系列暂无数据</span>}
          </div>
        )}
      </div>
    );
    if (tool === 'eraser') return (
      <div className="drawing-toolbar" role="group" aria-label="橡皮设置">
        <span className="text-toolbar-name">擦除范围</span>
        {ERASER_OPTIONS.map(({ id, label }) => (
          <button key={id} className="button compact toolbar-toggle" aria-pressed={eraseScope === id}
            onClick={() => setEraseScope(id)}>{label}</button>
        ))}
      </div>
    );
    return (
      <div className="drawing-toolbar" aria-label="画布设置" role="group">
        {seriesField && chart.series.length > 1 && <label className="ink-width">展示系列
          <select value={activeSeries} onChange={event => selectSeries(Number(event.target.value))}>
            {chart.series.map((series, index) => <option key={index} value={index}>{series.name}</option>)}
          </select>
        </label>}
        {chart.kind === 'bar' && <ColumnIconField label="柱形图标" series={chart.series[activeSeries]} index={activeSeries}
          onEdit={onEdit} onHighlight={setHighlight} />}
        {grouped && <GroupWidthField chart={chart} onEdit={onEdit} />}
        {hasAxes && <button className="button quiet" aria-pressed={chart.style.grid} onClick={() => onEdit(current => ({
          ...current, style: { ...current.style, grid: !current.style.grid },
        }))}><Grid2X2 size={16} /> 网格线</button>}
        <button className="button quiet" onClick={() => onEdit(current => ({
          ...current, style: { ...current.style, showTitle: current.style.showTitle === false },
        }))}><Type size={16} /> {chart.style.showTitle === false ? '显示标题' : '隐藏标题'}</button>
        <button className="button quiet" aria-pressed={showDataLabels} onClick={toggleDataLabels}><Tags size={16} /> {pie ? '扇区标签' : '数据标签'}</button>
        {pie ? <button className="button quiet" onClick={event => openPieLabelSettings(event.currentTarget)}>
          <SlidersHorizontal size={15} /> 标签样式</button>
          : <DataLabelStyleControl chart={chart} onEdit={onEdit} />}
        <button className="button quiet" aria-pressed={showLegend} onClick={toggleLegend}><List size={16} /> {pictograph ? '图标图例' : '图例'}</button>
        {pie && chart.piePosition && <button className="button quiet" onClick={() => onEdit(current => movePie(current))}>
          <RotateCcw size={16} /> 还原扇形位置</button>}
        {hasAxes && <button className="button quiet" aria-pressed={chart.style.showOrigin} onClick={() => onEdit(current => ({
          ...current, style: { ...current.style, showOrigin: !current.style.showOrigin },
        }))}>原点 0</button>}
        <button className="button quiet" aria-pressed={snap} title="按住 Alt 临时关闭吸附"
          onClick={() => setSnap(!snap)}><Magnet size={16} /> 吸附对齐</button>
      </div>
    );
  }

  const dataPanelContent = openPanel === 'data' && <Fragment key={`${projectRevision}:${id}`}>
    <DataPanel chart={chart} onEdit={onEdit} activeSeries={activeSeries} onHighlight={setHighlight} importRequest={importRequest}
      onSelectSeries={selectSeries} onReplaceCategories={() => choose(null)} onRemoveSeries={deleteSeries} onClose={closeEditorPanel} />
  </Fragment>;

  const settingsContent = openPanel === 'axes'
    ? <AxisPanel axis={axisTab} onSelectAxis={selectAxisTab} chart={chart} onEdit={onEdit} onClose={closeEditorPanel} />
    : openPanel === 'pie'
      ? <PieSettings chart={chart} onEdit={onEdit} onClose={closeEditorPanel} tab={pieTab} onSelectTab={setPieTab}
        showLabels={showDataLabels} showLegend={showLegend} onToggleLabels={toggleDataLabels} onToggleLegend={toggleLegend} />
      : openPanel === 'pictograph' && <PictographSettings chart={chart} onEdit={onEdit} onClose={closeEditorPanel}
        onToggleLabels={toggleDataLabels} onToggleLegend={toggleLegend} tab={pictographTab}
        onSelectTab={setPictographTab} legendInput={pictographLegendInput} />;

  const boardList = boardListVisible && <BoardSidebar boards={workspace.boards} activeId={id} onSelect={changeBoard}
    deletedId={workspace.deleted.at(-1)?.board.id} onDelete={deleteBoard} onRestore={() => changeBoard('restore')}
    onAdd={() => changeBoard('add')} onDuplicate={() => changeBoard('duplicate')} onClear={clearBoards}
    saveStatus={loadFailure || saveConflict ? '本机自动保存已暂停' : saveFailed ? '本机自动保存失败' : '已保存到本机'}
    saveFailed={saveFailed || saveConflict || !!loadFailure} replacementDisabled={saveConflict}
    onBackup={backupProject} onRecover={() => projectFile.current?.click()}
    onClose={compact ? closeBoardList : undefined}
    onRestoreCheckpoint={checkpoint?.workspace ? restoreCheckpoint : undefined}
    archivedSources={archivedSources} onDownloadOriginal={downloadOriginal}
    onDownloadCheckpoint={checkpoint && !checkpoint.workspace ? () => downloadOriginal(checkpoint.source) : undefined} />;

  return (
    <div className="app-shell" ref={appShell}>
      <header className="app-header" ref={appHeader}>
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon"><ChartNoAxesCombined size={23} strokeWidth={2.2} /></span>
            <h1>统计图画板</h1>
          </div>
          <div className="header-actions">
            <button className="button" onClick={() => changeBoard('add')}><Plus size={17} /> 新建画布</button>
            <ExportControls title={chart.title} exporting={exporting} onExportImage={() => exportChart('PNG')} onExportSvg={() => exportChart('SVG')} />
          </div>
        </div>
        <div className="header-notices">
          {error && <p className="app-error" role="alert">{error}</p>}
          {(loadFailure || saveFailed || saveConflict) && <div className="project-notice">
            <p role="alert">{saveConflict ? '另一个标签页更新了本机项目。本页已暂停自动保存。'
              : loadFailure?.status === 'invalid'
              ? '无法读取原项目。本机快照已保留，自动保存已暂停。'
              : loadFailure?.status === 'unavailable'
                ? '浏览器的本机存储不可用。请备份当前项目以保留改动。'
                : '本机自动保存失败。请备份当前项目以保留改动。'}</p>
            <div className="panel-actions">
              {saveConflict && <button className="button compact" onClick={loadLatestProject}>载入本机最新版</button>}
              {!saveConflict && loadFailure?.status === 'invalid' && <>
                <button className="button compact" onClick={() => downloadOriginal(loadFailure.source)}>下载原始快照</button>
                <button className="button compact" onClick={() => projectFile.current?.click()}>恢复项目</button>
                <button className="button compact" onClick={clearBoards}>重置项目</button>
              </>}
              <button className="button compact" onClick={backupProject}>备份当前项目</button>
            </div>
          </div>}
        </div>
      </header>
      <main className="main">
        <div className="studio-layout" data-board-sidebar={!compact && boardListVisible || undefined}>
          <section className="workspace" ref={workspaceSection} aria-label="绘图工作区">
            <div className="workspace-tools" ref={workspaceTools}>
            <div className="workspace-toolbar">
              <div className="toolbar-start">
                <ChartKindPicker kind={chart.kind} onChange={changeKind} />
                <button ref={dataButton} className="button primary edit-data-button" aria-expanded={dataPanelOpen}
                  aria-controls={dataPanelOpen ? 'data-panel' : undefined}
                  onClick={event => dataPanelOpen ? closeEditorPanel() : openEditorPanel('data', event.currentTarget)}>
                  {dataView ? <ChartIcon size={17} /> : <Table2 size={17} />} {dataView ? '返回画布' : '编辑数据'}
                </button>
                {chart.kind === 'bar' && <button className="button toolbar-toggle" aria-pressed={grouped}
                  title="在普通柱状图和复式柱状图之间切换" onClick={toggleGroupedColumns}>复式柱状图</button>}
                <div className="toolbar-group history" aria-label="编辑历史" role="group">
                  <button className="icon-button" aria-label="撤销" title="撤销（Ctrl / ⌘ + Z）" disabled={!past.length}
                    onClick={() => navigateHistory('undo')}><Undo2 size={19} /></button>
                  <button className="icon-button" aria-label="重做" title="重做（Ctrl / ⌘ + Shift + Z）" disabled={!future.length}
                    onClick={() => navigateHistory('redo')}><Redo2 size={19} /></button>
                </div>
                <RandomChartControls topic={topic} exercise={currentExercise} exercises={availableExercises}
                  onTopicChange={setTopic} onExerciseChange={setExercise} onGenerate={() => changeBoard('random')} />
              </div>
              <div className="toolbar-end">
                {!dataView && <div className="canvas-view-controls zoom-control" role="group" aria-label="画布缩放">
                  <button className="icon-button" aria-label="缩小画布" disabled={zoom <= 50}
                    onClick={() => dispatch({ type: 'zoom', id, value: -10, relative: true })}><Minus size={15} /></button>
                  <button className="button quiet" title="还原缩放" aria-label={`缩放 ${zoom}%，点击还原`}
                    onClick={resetCanvasZoom}>{zoom}%</button>
                  <button className="icon-button" aria-label="放大画布" disabled={zoom >= 200}
                    onClick={() => dispatch({ type: 'zoom', id, value: 10, relative: true })}><Plus size={15} /></button>
                </div>}
                {!dataView && <button className="button quiet" aria-pressed={toolbar} title={toolbar ? '收起画布的全局设置' : '展开画布的全局设置'}
                  onClick={() => setToolbar(!toolbar)}><PanelTop size={16} /> 画布设置</button>}
                <button ref={settingsButton} className="button data-toggle" aria-expanded={openPanel === settingsPanel} aria-controls={openPanel === settingsPanel ? settingsId : undefined}
                  onClick={event => toggleChartSettings(event.currentTarget)}>
                  <SlidersHorizontal size={16} /> {pie ? '扇形设置' : pictograph ? '象形图设置' : '坐标轴'}
                </button>
                <button ref={boardButton} className="button" aria-expanded={boardListVisible} aria-controls={boardListVisible ? 'board-list-panel' : undefined}
                  onClick={() => compact ? setBoardDrawerOpen(!boardListVisible) : setBoardSidebarOpen(!boardListVisible)}>
                  <Layers size={16} /> 画布列表
                </button>
              </div>
            </div>
              {showObjectToolbar && <ToolbarStrip context={`${chart.kind}:${tool}:${JSON.stringify(selection)}`}
                onKeyDown={returnToCanvas} onClose={closeObjectToolbar} closeLabel={axisToolbar ? '关闭坐标轴工具栏' : undefined}>
                {toolSettings()}
              </ToolbarStrip>}
              {!dataView && <p className="canvas-tool-hint" role={occupiedDataPoint ? 'status' : undefined}>
                <Info size={15} aria-hidden="true" /> {chartHint}
              </p>}
              {!dataView && notice && <div className="chart-notice">
                <p role="status"><TriangleAlert size={16} aria-hidden="true" /> {notice}</p>
                {(clipped || scale?.tooManyTicks) ? <button className="button compact" onClick={event => openAxes('y', event.currentTarget)}>调整纵轴</button>
                  : <button className="button compact" onClick={event => openEditorPanel('data', event.currentTarget)}>查看图表数据</button>}
              </div>}
            </div>
            <div className={`workspace-body${inlinePanel ? ' with-data' : ''}`} data-data-view={dataView || undefined}
              data-stacked-axes={stackedAxes || undefined}
              style={{ '--panel-width': `${effectivePanelWidth}px` } as CSSProperties}>
              <nav className="tool-rail" ref={toolRail} aria-label="绘图工具" hidden={dataView}>
                {TOOLS.filter(item => hasAxes || item.id !== 'add-data').map(({ id, label, icon: Icon, key }) => (
                  <button key={id} className="tool-button" data-tool={id} aria-pressed={tool === id} onClick={() => changeTool(id)}
                    title={`${label}（${key}）`} aria-label={label} aria-keyshortcuts={key}>
                    <Icon size={21} strokeWidth={1.8} /><span>{id === 'add-data' ? '添加点' : label}</span>
                  </button>
                ))}
              </nav>
              <div className="canvas-stage" hidden={dataView}>
                <div className="desk" ref={desk} data-zoomed={zoom > 100 || undefined}
                  style={{ '--paper-zoom': zoom / 100 } as CSSProperties}>
                  <div className="paper-frame" key={`${projectRevision}:${id}:${chart.kind}`}>
                    <ChartDisplay document={chart} tool={tool} ink={currentInk} inkWidth={currentWidth}
                      inkOpacity={currentOpacity} inkArrows={currentArrows} newTextStyle={newTextStyle} eraseScope={eraseScope}
                      lineKind={currentLineKind} snap={snap} selection={selection} highlight={highlight} onSelect={choose} onEditObject={editCanvasObject}
                      onOccupiedDataPoint={() => setOccupiedDataPoint(true)} snapAddedPoint={snapAddedPoint} stats={stats} onAddStatistic={addStatistic}
                      activeSeries={activeSeries} svgRef={svg} onEdit={onEdit} onSelectSeries={setSelectedSeries} onEditPictographLegend={() => openPictographLegend()} />
                  </div>
                  {!hasDrawableData && tool === 'select' && !selectedObject && <div className="empty-chart">
                    <strong>{hasEnteredData ? '当前系列没有可绘制的数据' : '开始绘制统计图'}</strong>
                    <p>{hasAxes ? '填写类别和数值，就能在画布上看到图表。' : `为${CHART_KIND_LABELS[chart.kind]}填写至少一个正数。`}</p>
                    <div className="empty-chart-actions">
                      {otherDrawableSeries >= 0
                        ? <button className="button primary compact" onClick={() => {
                          selectSeries(otherDrawableSeries);
                          dataButton.current?.focus({ preventScroll: true });
                        }}>切换到有数据的系列</button>
                        : <button className="button primary compact" onClick={event => openEditorPanel('data', event.currentTarget)}>填入数据</button>}
                      <button className="button compact" onClick={event => openEditorPanel('data', event.currentTarget, true)}>导入表格</button>
                      {!hasEnteredData && <button className="button compact" onClick={loadExample}>加载示例数据</button>}
                    </div>
                  </div>}
                </div>
              </div>
              {inlinePanel && <div className="workspace-panel">
                {!narrowPanelLayout && maxPanelWidth > PANEL_WIDTH.min && <div className="panel-resize" role="separator" tabIndex={0} aria-label="调整面板宽度"
                  aria-controls={openPanel === 'data' ? 'data-panel' : settingsId} aria-orientation="vertical"
                  aria-valuemin={PANEL_WIDTH.min} aria-valuemax={maxPanelWidth} aria-valuenow={effectivePanelWidth}
                  onPointerDown={event => {
                    if (event.button !== 0 || !event.isPrimary) return;
                    panelResize.current = { x: event.clientX, width: effectivePanelWidth };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }} onPointerMove={event => {
                    const start = panelResize.current;
                    if (start && event.currentTarget.hasPointerCapture(event.pointerId)) {
                      setPanelWidth(clamp(Math.round(start.width + start.x - event.clientX), PANEL_WIDTH.min, maxPanelWidth));
                    }
                  }} onLostPointerCapture={() => { panelResize.current = null; }} onKeyDown={event => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
                    event.preventDefault();
                    setPanelWidth(event.key === 'Home' ? PANEL_WIDTH.min : event.key === 'End' ? maxPanelWidth
                      : clamp(effectivePanelWidth + (event.key === 'ArrowLeft' ? 16 : -16), PANEL_WIDTH.min, maxPanelWidth));
                  }} />}
                {openPanel === 'data' ? dataPanelContent : settingsContent}
              </div>}
            </div>
            {!dataView && <footer className="workspace-footer">
              <span>{chart.categories.length} 个类别 <span className="separator">·</span> {pointCount} 个{pie ? '扇区' : '数据点'}</span>
            </footer>}
          </section>
          {!compact && boardList}
          <input type="file" accept=".json,application/json" hidden ref={projectFile} onChange={restoreProject} />
        </div>
        {drawerContent && <dialog ref={drawer} className="studio-drawer" aria-label={drawerContent === 'boards' ? '画布列表' : '图表设置'}
          onCancel={event => {
            event.preventDefault();
            if (drawerContent === 'boards') closeBoardList();
            else closeEditorPanel();
          }}>
          {drawerContent === 'boards' ? boardList : settingsContent}
        </dialog>}
      </main>
    </div>
  );
}

export default App;
