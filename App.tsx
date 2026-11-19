import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  ChartColumn, ChartNoAxesCombined, ChartPie, ChevronDown, Dices, Download, Eraser, Grid2X2, Info, Magnet, Minus,
  List, MousePointer2, MoveRight, MoveUpRight, PanelTop, Pencil, Plus, Redo2, RotateCcw, Shapes, SlidersHorizontal, Table2, Tags, Trash2, Type, Undo2, X,
} from 'lucide-react';
import AxisPanel from './components/AxisPanel';
import BoardSidebar from './components/BoardSidebar';
import ChartDisplay from './components/ChartDisplay';
import ColorPicker from './components/ColorPicker';
import DataPanel from './components/DataPanel';
import PieSettings from './components/PieSettings';
import type { PieSettingsTab } from './components/PieSettings';
import PictographSettings from './components/PictographSettings';
import type { PictographSettingsTab } from './components/PictographSettings';
import { AxisSelectionToolbar, DataSelectionToolbar, GroupWidthField } from './components/SelectionToolbar';
import TextToolbar from './components/TextToolbar';
import ToolbarStrip from './components/ToolbarStrip';
import { boardReducer } from './boards';
import { displayedSeries, displayedSeriesField, formatValue, getPlot, getScale, getSeriesStyle, getTextStyle, hasChartAxes, hideText, isNote, MAX_MANUAL_TICKS,
  removeCategory, removeSeries, SERIES_COLORS, setChartValue, STATISTIC_LABELS, statistics, visibleMark } from './chart';
import { download, exportChartImage, exportChartSvg } from './downloads';
import { NO_TARGETS, translateLine } from './alignment';
import { EXERCISE_TOPICS, EXERCISE_TYPES, exerciseTypes, randomChart } from './randomChart';
import type { ExerciseTopic, ExerciseType } from './randomChart';
import { movePie, resetPieLegend, togglePieLegendAttachment } from './pieLayout';
import { resetPictographLegend } from './pictograph';
import { loadWorkspace, parseWorkspace, saveWorkspace, serializeWorkspace } from './workspaceStorage';
import type { ArrowPlacement, Axis, ChartEdit, ChartKind, EraseScope, LineKind, Mark, Selection, Statistic, TextStyle, TitlePlacement, Tool } from './types';

const TOOLS = [
  { id: 'select', key: '1', label: '选择', icon: MousePointer2, hint: '点击绘图区添加数据点，拖动数据点调整数值。拖动轴线或原点可移动坐标系。' },
  { id: 'line', key: '2', label: '标注线', icon: MoveUpRight, hint: '拖动绘制标注线，或点击最大值、最小值和平均值参考线。' },
  { id: 'pen', key: '3', label: '画笔', icon: Pencil, hint: '在画布上按住并拖动，自由绘制线条。' },
  { id: 'eraser', key: '4', label: '橡皮', icon: Eraser, hint: '点击标注、数据点或柱形即可擦除。' },
  { id: 'text', key: '5', label: '文字', icon: Type, hint: '点击画布添加文字，输入后按 Enter 确认。' },
] as const;
const LINE_KINDS = [
  { id: 'solid', label: '实线' }, { id: 'dashed', label: '虚线' }, { id: 'arrow', label: '箭头线' },
] as const;
const STATISTICS = ['max', 'min', 'mean'] as const;
const CHART_KINDS = {
  line: { label: '折线图', icon: ChartNoAxesCombined }, bar: { label: '柱状图', icon: ChartColumn },
  pie: { label: '扇形图', icon: ChartPie }, pictograph: { label: '象形图', icon: Shapes },
} as const;
const ERASER_OPTIONS = [
  { id: 'all', label: '全部' }, { id: 'marks', label: '仅标注' }, { id: 'data', label: '仅数据点' },
] as const;
const TOOLBAR_PREFERENCE = 'chartToolbarVisible';

function App() {
  const [workspace, dispatch] = useReducer(boardReducer, undefined, loadWorkspace);
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
  const [eraseScope, setEraseScope] = useState<EraseScope>('all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [snap, setSnap] = useState(true);
  const [toolbar, setToolbar] = useState(() => {
    try { return localStorage.getItem(TOOLBAR_PREFERENCE) !== 'false'; } catch { return true; }
  });
  const [panel, setPanel] = useState<'data' | 'axes' | 'pie' | 'pictograph' | null>(null);
  const [axisTab, setAxisTab] = useState<Axis>('x');
  const [pieTab, setPieTab] = useState<PieSettingsTab>('shape');
  const [pictographTab, setPictographTab] = useState<PictographSettingsTab>('shape');
  const [selectedSeries, setSelectedSeries] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [topic, setTopic] = useState<ExerciseTopic>('all');
  const [exercise, setExercise] = useState<ExerciseType>('chart');
  const projectFile = useRef<HTMLInputElement>(null);
  const pictographLegendInput = useRef<HTMLTextAreaElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const desk = useRef<HTMLDivElement>(null);

  const pie = chart.kind === 'pie';
  const pictograph = chart.kind === 'pictograph';
  const hasAxes = hasChartAxes(chart.kind);
  const grouped = chart.kind === 'bar' && !!chart.groupedColumns;
  const seriesField = displayedSeriesField(chart);
  const visibleSeries = displayedSeries(chart);
  const activeSeries = seriesField ? chart[seriesField] ?? 0 : Math.min(selectedSeries, chart.series.length - 1);
  const settingsPanel = pie ? 'pie' : pictograph ? 'pictograph' : 'axes';
  const settingsId = pie ? 'pie-panel' : pictograph ? 'pictograph-panel' : 'axis-panel';
  const openPanel = panel === 'data' || panel === settingsPanel ? panel : null;
  const ChartIcon = CHART_KINDS[chart.kind].icon;
  const availableExercises = exerciseTypes(chart.kind, grouped);
  const currentExercise = availableExercises.includes(exercise) ? exercise : 'chart';
  const values = chart.series[activeSeries].values;
  const stats = useMemo(() => statistics(values), [values]);
  const onEdit: ChartEdit = update => dispatch({ type: 'edit', id, update });
  const { hint } = TOOLS.find(item => item.id === tool);
  const pieHint = tool === 'select' ? '拖动扇形可移动图形和吸附的图注。点击扇区可改数值和颜色。' : tool === 'line' ? '拖动绘制标注线。' : hint;
  const pictographHint = tool === 'select' ? '点击一行或一列可编辑图符和数值，也可直接拖动图例。' : tool === 'line' ? '拖动绘制标注线。' : hint;
  const chartHint = pie ? pieHint : pictograph ? pictographHint
    : grouped && tool === 'select' ? '选择要编辑的系列，点击绘图区添加柱形，或上下拖动柱形调整数值。' : hint;
  const pointCount = pie ? values.filter(value => value > 0).length
    : visibleSeries.reduce((sum, item) => sum + item.values.filter(value => value !== null).length, 0);
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
  const yAxis = chart.style.axes.y;
  const limit = yAxis.maximum ?? Infinity;
  const needScale = yAxis.tickMode !== 'auto' || tool === 'line' || mark?.referenceValue !== undefined || yAxis.omitted;
  const plot = getPlot(chart.style, chart.plotOffset);
  const scale = hasAxes && needScale ? getScale(visibleSeries, chart.scaleExtent, plot, yAxis) : null;
  const clipped = hasAxes && Number.isFinite(limit) ? visibleSeries.reduce((sum, item) =>
    sum + item.values.filter(value => value !== null && value > limit).length, 0) : 0;
  const omitted = scale?.omission ? visibleSeries.reduce((sum, item) =>
    sum + item.values.filter(value => value !== null && scale.inBreak(value)).length, 0) : 0;
  const negative = pie ? values.filter(value => value < 0).length : 0;
  const notice = [
    scale?.tooManyTicks ? `纵轴超过 ${MAX_MANUAL_TICKS} 个刻度，暂用自动刻度。` : '',
    clipped ? `${clipped} 个数据值超出纵轴最大值，超出部分已裁切。` : '',
    omitted ? `${omitted} 个数据值位于断轴省略区间，可在数据表中查看。` : '',
    negative ? `${negative} 个负值已省略，占比按正数计算。` : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    try { localStorage.setItem(TOOLBAR_PREFERENCE, String(toolbar)); } catch {}
  }, [toolbar]);

  useEffect(() => {
    try {
      saveWorkspace(workspace);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [workspace]);

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
    setSelection(next);
    if (next?.kind === 'data') setSelectedSeries(next.datum.series);
  }

  function changeTool(next: Tool) {
    choose(null);
    setTool(next);
  }

  function changeKind(kind: ChartKind) {
    if (kind === chart.kind) return;
    choose(null);
    if (!hasChartAxes(kind) && chart.series.every(series => !series.values.some(value => value > 0))) {
      setPanel('data');
    } else if (panel !== 'data') setPanel(null);
    onEdit(current => ({ ...current, kind, scaleExtent: null,
      ...(kind === 'bar' && { groupedColumns: current.groupedColumns ?? false }) }));
  }

  function toggleGroupedColumns() {
    const enabled = !grouped;
    choose(null);
    setSelectedSeries(activeSeries);
    if (enabled) setPanel('data');
    onEdit(current => ({ ...current, groupedColumns: enabled, barSeries: activeSeries, scaleExtent: null,
      series: enabled && current.series.length === 1 ? [...current.series, {
        name: '数据 2', color: SERIES_COLORS.find(color => color !== current.series[0].color),
        values: current.categories.map(() => null),
      }] : current.series }));
  }

  function selectSeries(index: number) {
    setSelectedSeries(index);
    if (!seriesField) return;
    if (index !== activeSeries) choose(null);
    onEdit(current => !current.series[index] || (current[seriesField] ?? 0) === index ? current
      : { ...current, [seriesField]: index, scaleExtent: seriesField === 'barSeries' ? null : current.scaleExtent });
  }

  function resetBoardControls() {
    changeTool('select');
    setSelectedSeries(0);
    setPanel(null);
    setError('');
    if (desk.current) desk.current.scrollTo(0, 0);
  }

  function changeBoard(action: 'add' | 'duplicate' | 'random' | 'restore' | number) {
    if (id === action) return;
    resetBoardControls();
    if (typeof action === 'number') dispatch({ type: 'select', id: action });
    else if (action === 'random') dispatch({ type: 'add', chart: randomChart(chart.kind, Math.random, topic, currentExercise, grouped) });
    else dispatch({ type: action });
  }

  function deleteBoard(boardId: number) {
    if (id === boardId) resetBoardControls();
    dispatch({ type: 'delete', id: boardId });
  }

  function clearBoards() {
    if (!window.confirm(`清空 ${workspace.boards.length} 张画布及已删除的画布记录？此操作无法撤销。`)) return;
    resetBoardControls();
    setProjectRevision(revision => revision + 1);
    dispatch({ type: 'clear' });
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

  async function restoreProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const restored = parseWorkspace(await file.text());
      if (!window.confirm(`恢复项目中的 ${restored.boards.length} 张画布？这会替换当前项目。`)) return;
      resetBoardControls();
      dispatch({ type: 'load', workspace: restored });
    } catch {
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
    dispatch({ type, id });
  }

  function openAxes(axis: Axis = 'x') {
    setAxisTab(axis);
    setPanel('axes');
    setTool('select');
  }

  function openPictographLegend() {
    if (openPanel === 'pictograph' && pictographTab === 'legend') pictographLegendInput.current?.focus({ preventScroll: true });
    setPictographTab('legend');
    setPanel('pictograph');
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
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || target?.closest?.('input, textarea, select, [contenteditable]') || event.isComposing || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === 'z' || key === 'y') {
          event.preventDefault();
          navigateHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
        }
        return;
      }
      const next = TOOLS.find(item => item.key === key);
      if (next) changeTool(next.id);
      if (key === 'escape' && !document.querySelector('.datum-delete-menu:popover-open, .pictograph-symbol-popover:popover-open')) choose(null);
      if ((key === 'delete' || key === 'backspace') && (mark || activeDatum || activeText !== null || axis || legendSelected)) {
        event.preventDefault();
        removeSelection();
      }
      const visible = mark && (mark.referenceValue === undefined ? mark : visibleMark(mark, plot, scale, chart.kind));
      if (visible && !target?.closest?.('.toolbar-strip') && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
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
  }, [id, mark, markIndex, activeDatum, activeText, axis, legendSelected, mark?.referenceValue === undefined ? null : chart]);

  async function exportImage() {
    if (!svg.current || exporting) return;
    setExporting(true);
    setError('');
    try {
      await exportChartImage(svg.current, chart.title);
    } catch {
      setError('图片导出失败，请重试。');
    } finally {
      setExporting(false);
    }
  }

  function exportVector() {
    if (!svg.current) return;
    setError('');
    try { exportChartSvg(svg.current, chart.title); } catch { setError('SVG 导出失败，请重试。'); }
  }

  function toolSettings() {
    if (legendSelected) return (
      <div className="drawing-toolbar text-toolbar" role="group" aria-label={pie ? '所选扇形图图例' : '所选图符图例'}>
        <span className="text-toolbar-name">图例</span>
        <button className="button compact" onClick={pie ? () => { setPieTab('legend'); setPanel('pie'); } : openPictographLegend}>
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
    if (activeDatum) return <DataSelectionToolbar chart={chart} datum={activeDatum} onEdit={onEdit} onClose={() => choose(null)} onRemoveSeries={deleteSeries} />;
    if (axis) return <AxisSelectionToolbar chart={chart} axis={axis} onEdit={onEdit} onClose={() => choose(null)} onSettings={openAxes} />;
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
        <button className="button quiet" aria-pressed={chart.style.showTitle !== false} onClick={() => onEdit(current => ({
          ...current, style: { ...current.style, showTitle: current.style.showTitle === false },
        }))}><Type size={16} /> 图表标题</button>
        {(seriesField || grouped) && chart.series.length > 1 && <label className="ink-width">{seriesField ? '展示系列' : '编辑系列'}
          <select aria-label={seriesField ? '展示系列' : '编辑系列'} value={activeSeries} onChange={event => selectSeries(Number(event.target.value))}>
            {chart.series.map((series, index) => <option key={index} value={index}>{series.name}</option>)}
          </select>
        </label>}
        {grouped && <GroupWidthField chart={chart} onEdit={onEdit} />}
        {hasAxes && <button className="button quiet" aria-pressed={chart.style.grid} onClick={() => onEdit(current => ({
          ...current, style: { ...current.style, grid: !current.style.grid },
        }))}><Grid2X2 size={16} /> 网格线</button>}
        <button className="button quiet" aria-pressed={showDataLabels} onClick={toggleDataLabels}><Tags size={16} /> {pie ? '扇区标签' : '数据标签'}</button>
        <button className="button quiet" aria-pressed={showLegend} onClick={toggleLegend}><List size={16} /> {pictograph ? '图符图例' : '图例'}</button>
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

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon"><ChartNoAxesCombined size={23} strokeWidth={2.2} /></span>
            <h1>统计图画板</h1>
          </div>
          <div className="header-actions">
            <button className="button" onClick={() => changeBoard('add')}><Plus size={17} /> 新建画布</button>
            <div className="export-actions">
              <button className="button primary" disabled={exporting} onClick={exportImage}>
                <Download size={17} /> {exporting ? '正在导出…' : '导出 PNG'}
              </button>
              <details className="export-options">
                <summary className="button primary" aria-label="更多导出格式" title="更多导出格式"><ChevronDown size={15} /></summary>
                <div className="export-menu">
                  <button className="button compact" onClick={event => {
                    exportVector();
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}>导出 SVG</button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>
      <main className="main">
        {error && <p className="app-error" role="alert">{error}</p>}
        <div className="studio-layout">
          <section className="workspace" aria-label="绘图工作区" data-toolbar-visible={toolbar || undefined}>
            <div className="workspace-tools">
            <div className="workspace-toolbar">
              <div className="toolbar-start">
                <label className="chart-kind-select">
                  <ChartIcon size={17} aria-hidden="true" />
                  <select aria-label="图表类型" value={chart.kind} onChange={event => changeKind(event.target.value as ChartKind)}>
                    {Object.entries(CHART_KINDS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {chart.kind === 'bar' && <button className="button compact toolbar-toggle" aria-pressed={grouped}
                  title="在普通柱状图和复式柱状图之间切换" onClick={toggleGroupedColumns}>复式柱状图</button>}
                <div className="toolbar-group history" aria-label="编辑历史" role="group">
                  <button className="icon-button" aria-label="撤销" title="撤销（Ctrl / ⌘ + Z）" disabled={!past.length}
                    onClick={() => navigateHistory('undo')}><Undo2 size={19} /></button>
                  <button className="icon-button" aria-label="重做" title="重做（Ctrl / ⌘ + Shift + Z）" disabled={!future.length}
                    onClick={() => navigateHistory('redo')}><Redo2 size={19} /></button>
                </div>
                <div className="random-chart-controls">
                  <select aria-label="出题题材" title="出题题材" value={topic} onChange={event => setTopic(event.target.value as ExerciseTopic)}>
                    {Object.entries(EXERCISE_TOPICS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                  </select>
                  <select aria-label="出题题型" title="出题题型" value={currentExercise} onChange={event => setExercise(event.target.value as ExerciseType)}>
                    {availableExercises.map(value => <option key={value} value={value}>{EXERCISE_TYPES[value]}</option>)}
                  </select>
                  <button className="button compact random-chart-button" title="按所选题材、题型和当前图表类型生成新画布"
                    onClick={() => changeBoard('random')}><Dices size={16} /> 随机生成</button>
                </div>
              </div>
              <div className="toolbar-end">
                <div className="zoom-control" role="group" aria-label="画布缩放">
                  <button className="icon-button" aria-label="缩小画布" disabled={zoom <= 50}
                    onClick={() => dispatch({ type: 'zoom', id, value: -10, relative: true })}><Minus size={15} /></button>
                  <button className="button quiet" title="还原缩放" aria-label={`缩放 ${zoom}%，点击还原`}
                    onClick={() => dispatch({ type: 'zoom', id, value: 100 })}>{zoom}%</button>
                  <button className="icon-button" aria-label="放大画布" disabled={zoom >= 200}
                    onClick={() => dispatch({ type: 'zoom', id, value: 10, relative: true })}><Plus size={15} /></button>
                </div>
                <button className="button quiet" aria-pressed={toolbar} title={toolbar ? '隐藏工具栏' : '显示工具栏'}
                  onClick={() => setToolbar(!toolbar)}><PanelTop size={16} /> 工具栏</button>
                <button className="button data-toggle" aria-expanded={openPanel === settingsPanel} aria-controls={openPanel === settingsPanel ? settingsId : undefined}
                  onClick={() => openPanel === settingsPanel ? setPanel(null) : hasAxes ? openAxes(axis === 'y' ? 'y' : 'x') : setPanel(settingsPanel)}>
                  <SlidersHorizontal size={16} /> {pie ? '扇形设置' : pictograph ? '象形图设置' : '坐标轴'}
                </button>
                <button className="button data-toggle" aria-expanded={panel === 'data'} aria-controls={panel === 'data' ? 'data-panel' : undefined}
                  onClick={() => setPanel(panel === 'data' ? null : 'data')}><Table2 size={17} /> 数据表</button>
              </div>
            </div>
              {toolbar && <ToolbarStrip context={`${chart.kind}:${tool}:${JSON.stringify(selection)}`}>{toolSettings()}</ToolbarStrip>}
            </div>
            <div className={`workspace-body${openPanel ? ' with-data' : ''}`}>
              <nav className="tool-rail" aria-label="绘图工具">
                {TOOLS.map(({ id, label, icon: Icon, key }) => (
                  <button key={id} className="tool-button" aria-pressed={tool === id} onClick={() => changeTool(id)}
                    title={`${label}（${key}）`} aria-keyshortcuts={key}><Icon size={21} strokeWidth={1.8} /><span>{label}</span></button>
                ))}
              </nav>
              <div ref={desk} className="desk" data-zoomed={zoom > 100 || undefined} style={{ '--paper-zoom': zoom / 100 } as CSSProperties}>
                <div className="paper-frame" key={`${projectRevision}:${id}:${chart.kind}`}>
                  <ChartDisplay document={chart} tool={tool} ink={currentInk} inkWidth={currentWidth}
                    inkOpacity={currentOpacity} inkArrows={currentArrows} newTextStyle={newTextStyle} eraseScope={eraseScope}
                    lineKind={currentLineKind} snap={snap} selection={selection} onSelect={choose} stats={stats} onAddStatistic={addStatistic}
                    activeSeries={activeSeries} svgRef={svg} onEdit={onEdit} onSelectSeries={setSelectedSeries} onEditPictographLegend={openPictographLegend} />
                </div>
              </div>
              {openPanel === 'data' && <DataPanel chart={chart} onEdit={onEdit} activeSeries={activeSeries}
                onSelectSeries={selectSeries} onReplaceCategories={() => choose(null)} onRemoveSeries={deleteSeries} onClose={() => setPanel(null)} />}
              {openPanel === 'axes' && <AxisPanel axis={axisTab} onSelectAxis={setAxisTab} chart={chart} onEdit={onEdit} onClose={() => setPanel(null)} />}
              {openPanel === 'pie' && <PieSettings chart={chart} onEdit={onEdit} onClose={() => setPanel(null)}
                tab={pieTab} onSelectTab={setPieTab}
                showLabels={showDataLabels} showLegend={showLegend} onToggleLabels={toggleDataLabels} onToggleLegend={toggleLegend} />}
              {openPanel === 'pictograph' && <PictographSettings chart={chart} onEdit={onEdit}
                onClose={() => setPanel(null)} onToggleLabels={toggleDataLabels} onToggleLegend={toggleLegend}
                tab={pictographTab} onSelectTab={setPictographTab} legendInput={pictographLegendInput} />}
            </div>
            <footer className="workspace-footer">
              <p role={notice ? 'status' : undefined}><Info size={15} /> {notice || chartHint}</p>
              <span>{chart.categories.length} 个类别 <span className="separator">·</span> {pointCount} 个{pie ? '扇区' : '数据点'}</span>
            </footer>
          </section>
          <BoardSidebar boards={workspace.boards} activeId={id} onSelect={changeBoard}
            deletedId={workspace.deleted.at(-1)?.board.id} onDelete={deleteBoard} onRestore={() => changeBoard('restore')}
            onAdd={() => changeBoard('add')} onDuplicate={() => changeBoard('duplicate')} saveFailed={saveFailed} onClear={clearBoards}
            onBackup={backupProject} onRecover={() => projectFile.current.click()} />
          <input type="file" accept=".json,application/json" hidden ref={projectFile} onChange={restoreProject} />
        </div>
      </main>
    </>
  );
}

export default App;
