import { RotateCcw, SlidersHorizontal, Tags, Trash2, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { clamp, DEFAULT_GROUP_WIDTH, DEFAULT_TICK_LABEL, getSeriesStyle, movePlot, parseValue, pieColor,
  removeCategory, setChartValue, shorten, TEXT_FONTS, TEXT_SIZE } from '../chart';
import { DEFAULT_PICTOGRAPH_STYLE, pictographSymbolAt } from '../pictograph';
import type { PictographSymbol } from '../pictographSymbols';
import type { Axis, AxisStyle, ChartDocument, ChartEdit, DataHighlight, Datum, PictographStyle, SeriesStyle } from '../types';
import PictographSymbolField from './PictographSymbolField';
import ColorPicker from './ColorPicker';
import ColumnIconField from './ColumnIconField';
import './selectionToolbar.css';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  onClose: () => void;
}

function EditableField<T extends string | number | null>({ label, value, parse, onChange, numeric = false, placeholder }: {
  label: string; value: T; parse: (text: string) => T; onChange: (next: T) => void;
  numeric?: boolean; placeholder?: string;
}) {
  const errorId = useId();
  const original = String(value ?? '');
  const [draft, setDraft] = useState({ source: original, text: original, error: '' });
  const cancelled = useRef(false);
  const field = useRef<HTMLDivElement>(null);
  if (draft.source !== original) setDraft({ source: original, text: original, error: '' });

  useLayoutEffect(() => {
    if (draft.error && field.current?.matches(':focus-within')) {
      field.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [draft.error]);

  function commit(text: string) {
    try {
      const next = parse(text);
      setDraft({ source: original, text: String(next ?? ''), error: '' });
      if (next !== value) onChange(next);
    } catch (error) {
      setDraft({ source: original, text, error: error instanceof Error ? error.message : '输入有误。' });
    }
  }

  return (
    <div className="object-toolbar-field" ref={field}>
      <label>{label}
        <input type="text" inputMode={numeric ? 'decimal' : undefined} placeholder={placeholder}
          className={numeric ? undefined : 'toolbar-name-input'} value={draft.text}
          aria-invalid={!!draft.error || undefined} aria-describedby={draft.error ? errorId : undefined}
          onFocus={() => { cancelled.current = false; }}
          onChange={event => setDraft({ source: original, text: event.target.value, error: '' })}
          onBlur={event => {
            if (!cancelled.current && event.currentTarget.value !== original) commit(event.currentTarget.value);
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
            if (event.key === 'Escape') {
              cancelled.current = true;
              setDraft({ source: original, text: original, error: '' });
            }
          }} />
      </label>
      {draft.error && <span className="object-toolbar-error" id={errorId} role="alert">{draft.error}</span>}
    </div>
  );
}

function NumberField({ label, value, onChange, minimum, normalize, placeholder = minimum !== undefined ? '自动' : undefined }: {
  label: string; value: number | null | undefined; onChange: (value: number | null) => void;
  minimum?: number; normalize?: (value: number) => number; placeholder?: string;
}) {
  return <EditableField label={label} value={value ?? null} onChange={onChange} numeric
    placeholder={placeholder} parse={text => {
      let number: number | null;
      try {
        number = parseValue(text);
      } catch {
        throw new Error('请输入有效数字。');
      }
      if (number !== null && minimum !== undefined && number < minimum) throw new Error(`最小为 ${minimum}。`);
      return number !== null && normalize ? normalize(number) : number;
    }} />;
}

function TextField({ label, value, onChange, allowEmpty = false }: {
  label: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean;
}) {
  return <EditableField label={label} value={value} onChange={onChange} parse={text => {
    const name = text.trim();
    if (!name && !allowEmpty) throw new Error(`请输入${label}名称。`);
    return name;
  }} />;
}

function numericOptions(options: number[], value: number) {
  return [...new Set([...options, value])].sort((a, b) => a - b);
}

export function GroupWidthField({ chart, onEdit }: { chart: ChartDocument; onEdit: ChartEdit }) {
  const width = chart.style.groupWidth ?? DEFAULT_GROUP_WIDTH;
  return <label className="ink-width" title="每组柱形占类别间距的比例">组宽
    <select aria-label="组宽" value={width} onChange={event => {
      const groupWidth = Number(event.target.value);
      onEdit(current => ({ ...current, style: { ...current.style, groupWidth } }));
    }}>
      {numericOptions([0.5, 0.6, DEFAULT_GROUP_WIDTH, 0.82, 0.92], width)
        .map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
    </select>
  </label>;
}

export function DataSelectionToolbar({ chart, datum, onEdit, onClose, onRemoveSeries, onHighlight }: Props & {
  datum: Datum; onRemoveSeries: (index: number) => void;
  onHighlight: (highlight: DataHighlight) => void;
}) {
  const series = chart.series[datum.series];
  const value = series.values[datum.index];
  const appearance = getSeriesStyle(series, chart.style);
  const category = chart.categories[datum.index];
  const pie = chart.kind === 'pie';
  const pictograph = chart.kind === 'pictograph';
  const column = chart.kind === 'bar';
  const categoryName = category.trim() || `第 ${datum.index + 1} 行`;
  const seriesName = series.name.trim() || `系列 ${datum.series + 1}`;
  const datumName = `${categoryName} · ${seriesName}`;
  const colorLabel = pie ? '此扇区颜色' : pictograph ? '系列图标颜色' : column ? '系列柱色' : '系列线色';
  const symbolStyle = chart.style.pictograph;
  const categorySymbols = symbolStyle?.symbolMode === 'category';
  const colorMode = symbolStyle?.colorMode ?? DEFAULT_PICTOGRAPH_STYLE.colorMode;
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);

  function format(changes: Partial<SeriesStyle>) {
    onEdit(chart => ({
      ...chart, series: chart.series.map((item, index) => index === datum.series
        ? { ...item, style: { ...item.style, ...changes } } : item),
    }));
    onHighlight({ series: datum.series });
  }

  function setSymbol(symbol: PictographSymbol | null) {
    onEdit(current => categorySymbols ? {
      ...current, pictographSymbols: current.categories.map((_, index) => index === datum.index ? symbol : current.pictographSymbols?.[index] ?? null),
    } : {
      ...current, style: { ...current.style, pictograph: { ...current.style.pictograph, symbol } },
    });
    onHighlight(categorySymbols ? datum : { series: datum.series });
  }

  function setSymbolColorMode(colorMode: PictographStyle['colorMode']) {
    onEdit(current => ({ ...current, style: { ...current.style, pictograph: { ...current.style.pictograph, colorMode } } }));
    onHighlight({ series: datum.series });
  }

  const symbolField = pictograph && <PictographSymbolField label={categorySymbols ? '此项图标' : '图标'}
    value={pictographSymbolAt(chart, datum.index)} color={series.color} outline={symbolStyle?.outline ?? false} mode={colorMode}
    onModeChange={setSymbolColorMode} onChange={setSymbol}
    onReset={categorySymbols && chart.pictographSymbols?.[datum.index] ? () => setSymbol(null) : undefined} />;
  const colorField = (!pictograph || colorMode === 'single') && (!column || appearance.columnIcon?.colorMode !== 'color') && (
    <div className="color-field">
      <span>{column ? '柱色' : chart.kind === 'line' ? '线色' : '颜色'}</span>
      <ColorPicker value={pie ? pieColor(chart, datum.index) : series.color} label={colorLabel} onChange={color => {
        onEdit(chart => pie ? {
          ...chart, pieColors: chart.categories.map((_, index) => index === datum.index ? color : chart.pieColors?.[index] ?? null),
        } : {
          ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, color } : item),
        });
        onHighlight(pie ? datum : { series: datum.series });
      }} />
    </div>
  );

  return (
    <div className="drawing-toolbar text-toolbar datum-toolbar" role="group" aria-label={`${datumName}的设置`}>
      <div className="datum-toolbar-group datum-toolbar-primary" role="group" aria-label="当前数据项">
        <span className="text-toolbar-name" title={datumName}>{datumName}</span>
        <NumberField label="数值" value={value} onChange={next => {
          onEdit(chart => setChartValue(chart, datum.series, datum.index, next));
          if (pie && !(next > 0)) onClose();
          else onHighlight(datum);
        }} />
        <TextField label="类别" value={category} allowEmpty onChange={name => onEdit(chart => ({
          ...chart, categories: chart.categories.map((item, index) => index === datum.index ? name : item),
        }))} />
        {pie && colorField}
        {categorySymbols && symbolField}
      </div>
      <div className="datum-toolbar-group" role="group" aria-label="系列属性">
        <TextField label="系列" value={series.name} onChange={name => onEdit(chart => ({
          ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, name } : item),
        }))} />
        {column && <ColumnIconField label="柱形图标" series={series} index={datum.series} onEdit={onEdit} onHighlight={onHighlight} />}
        {!categorySymbols && symbolField}
        {!pie && colorField}
        <button className="button compact toolbar-toggle" aria-pressed={appearance.showLabels}
          onClick={() => format({ showLabels: !appearance.showLabels })}><Tags size={15} /> {pie ? '扇区标签' : '数值标签'}</button>
        {chart.kind === 'line' && <label>线宽
          <select value={appearance.strokeWidth} onChange={event => format({ strokeWidth: Number(event.target.value) })}>
            {numericOptions([1, 2, 3, 4, 5, 6, 8], appearance.strokeWidth).map(width => <option key={width} value={width}>{width}</option>)}
          </select>
        </label>}
        {column && <>
          {chart.groupedColumns && <GroupWidthField chart={chart} onEdit={onEdit} />}
          <label>柱宽
            <select value={appearance.columnWidth} onChange={event => format({ columnWidth: Number(event.target.value) })}>
              {[0.4, 0.65, 0.86, 1].map(width => <option key={width} value={width}>{Math.round(width * 100)}%</option>)}
            </select>
          </label>
          {!appearance.columnIcon && <button className="button compact toolbar-toggle" aria-pressed={appearance.roundedColumns}
            onClick={() => format({ roundedColumns: !appearance.roundedColumns })}>圆角</button>}
        </>}
      </div>
      {chart.kind === 'line' && <div className="datum-toolbar-group" role="group" aria-label="系列点标记">
        <button className="button compact toolbar-toggle" aria-pressed={appearance.dots}
          onClick={() => format({ dots: !appearance.dots })}>点标记</button>
        {appearance.dots && <>
          <label>形状
            <select value={appearance.dotShape} onChange={event => format({ dotShape: event.target.value as SeriesStyle['dotShape'] })}>
              <option value="circle">圆形</option><option value="square">方形</option><option value="diamond">菱形</option>
            </select>
          </label>
          <label>大小
            <select value={appearance.dotSize} onChange={event => format({ dotSize: Number(event.target.value) })}>
              {numericOptions([3, 5, 7, 9, 11], appearance.dotSize).map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button className="button compact toolbar-toggle" aria-label="实心数据点" aria-pressed={appearance.dotFill === 'solid'}
            title="切换该系列数据点的实心或空心" onClick={() => format({
              dotFill: appearance.dotFill === 'solid' ? 'hollow' : 'solid',
            })}>{appearance.dotFill === 'solid' ? '实心' : '空心'}</button>
        </>}
      </div>}
      <div className="datum-toolbar-group datum-toolbar-delete">
        <button className="button compact datum-delete-trigger" popoverTarget={menuId}
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            const width = Math.min(250, document.documentElement.clientWidth - 16);
            menu.current.style.left = `${Math.max(8, Math.min(rect.right, document.documentElement.clientWidth - 8) - width)}px`;
            menu.current.style.top = `${Math.max(8, Math.min(rect.bottom + 5, document.documentElement.clientHeight - 126))}px`;
          }}><Trash2 size={16} /> 删除数据…</button>
        <div className="datum-delete-menu" popover="auto" id={menuId} ref={menu} role="group" aria-label="删除数据">
          <button className="button compact" title={`清除 ${datumName} 的数值`} disabled={value === null} onClick={() => {
            onEdit(chart => setChartValue(chart, datum.series, datum.index, null));
            onClose();
          }}>清除「{shorten(categoryName, 10)}」的此项数值</button>
          <button className="button compact" title={`删除整行 ${categoryName}`} disabled={chart.categories.length <= 1} onClick={() => {
            onEdit(chart => removeCategory(chart, datum.index));
            onClose();
          }}>删除「{shorten(categoryName, 12)}」整行</button>
          {chart.series.length > 1 ? (
            <button className="button compact" title={`删除整组 ${seriesName}`} onClick={() => onRemoveSeries(datum.series)}>
              删除「{shorten(seriesName, 12)}」整组
            </button>
          ) : (
            <button className="button compact" title={`清空整组 ${seriesName}`} disabled={series.values.every(value => value === null)} onClick={() => {
              onEdit(current => ({ ...current, scaleExtent: null, series: current.series.map((item, index) => index === datum.series
                ? { ...item, values: item.values.map(() => null) } : item) }));
              onClose();
            }}>清空「{shorten(seriesName, 12)}」整组</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AxisSelectionToolbar({ chart, axis, onEdit, onSettings }: Omit<Props, 'onClose'> & {
  axis: Axis | 'both'; onSettings: (axis: Axis, trigger?: HTMLElement) => void;
}) {
  const style = chart.style.axes[axis === 'both' ? 'x' : axis];
  const axisName = axis === 'both' ? '坐标系' : axis === 'x' ? '横轴' : '纵轴';
  const values = axis === 'x' ? '标签' : '标值';
  const mixedWidth = axis === 'both' && chart.style.axes.x.width !== chart.style.axes.y.width;

  function update<Key extends keyof AxisStyle>(key: Key, value: AxisStyle[Key]) {
    onEdit(chart => {
      const { x, y } = chart.style.axes;
      return {
        ...chart, scaleExtent: key === 'maximum' ? null : chart.scaleExtent,
        style: { ...chart.style, axes: {
          x: axis === 'y' ? x : { ...x, [key]: value },
          y: axis === 'x' ? y : { ...y, [key]: value },
        } },
      };
    });
  }

  return (
    <div className="drawing-toolbar text-toolbar axis-selection-toolbar" role="group" aria-label={`${axisName}工具栏`}>
      <span className="text-toolbar-name">{axisName}</span>
      {axis !== 'both' && <>
        <label>{values}字体
          <select value={style.tickLabelFont ?? DEFAULT_TICK_LABEL.font}
            onChange={event => update('tickLabelFont', event.target.value as AxisStyle['tickLabelFont'])}>
            {Object.entries(TEXT_FONTS).map(([value, font]) => <option key={value} value={value}>{font.label}</option>)}
          </select>
        </label>
        <NumberField label={`${values}字号`} value={style.tickLabelSize} placeholder={`默认 ${DEFAULT_TICK_LABEL.size}`}
          normalize={value => clamp(Math.round(value), TEXT_SIZE.min, TEXT_SIZE.max)}
          onChange={value => update('tickLabelSize', value ?? undefined)} />
      </>}
      <button className="button compact" onClick={event => onSettings(axis === 'both' ? 'x' : axis, event.currentTarget)}><SlidersHorizontal size={15} /> 坐标轴设置</button>
      {axis !== 'both' && <>
        <button className="button compact toolbar-toggle" aria-pressed={style.showValues}
          onClick={() => update('showValues', !style.showValues)}>{axis === 'x' ? '类别标签' : '标值'}</button>
        <button className="button compact toolbar-toggle" aria-pressed={style.showLabel}
          onClick={() => update('showLabel', !style.showLabel)}>轴标题</button>
        <button className="button compact toolbar-toggle" aria-pressed={style.visible !== false}
          onClick={() => update('visible', style.visible === false)}>轴线</button>
        <label>刻度位置
          <select value={style.tickPosition} onChange={event => update('tickPosition', event.target.value as AxisStyle['tickPosition'])}>
            <option value="inside">内侧</option><option value="outside">外侧</option><option value="cross">穿过轴线</option>
          </select>
        </label>
      </>}
      {axis === 'y' && <NumberField label="最大值" value={style.maximum} minimum={Math.max(0, style.omitted?.to ?? 0)}
        onChange={value => update('maximum', value ?? undefined)} />}
      <button className="button compact toolbar-toggle" aria-pressed={chart.style.grid}
        onClick={() => onEdit(current => ({ ...current, style: { ...current.style, grid: !current.style.grid } }))}>网格线</button>
      <button className="button compact toolbar-toggle" aria-pressed={chart.style.showOrigin}
        onClick={() => onEdit(current => ({ ...current, style: { ...current.style, showOrigin: !current.style.showOrigin } }))}>原点 0</button>
      <div className="color-field"><span>轴线颜色</span>
        <ColorPicker value={style.color} label="所选轴线颜色" onChange={color => update('color', color)}
          mixed={axis === 'both' && chart.style.axes.x.color !== chart.style.axes.y.color} />
      </div>
      <label>轴线宽度
        <select value={mixedWidth ? '' : style.width} onChange={event => update('width', Number(event.target.value))}>
          {mixedWidth && <option value="" disabled>混合</option>}
          {numericOptions([1, 1.6, 2, 3, 4, 5], style.width).map(width => <option value={width} key={width}>{width}</option>)}
        </select>
      </label>
      {axis === 'both' && <button className="button compact" onClick={() => onEdit(chart => movePlot(chart, { x: 0, y: 0 }))}>
        <RotateCcw size={15} /> 还原位置
      </button>}
    </div>
  );
}
