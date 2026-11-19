import { RotateCcw, SlidersHorizontal, Tags, Trash2, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { AXIS_LENGTHS, clamp, DEFAULT_GROUP_WIDTH, getSeriesStyle, movePlot, parseValue, pieColor, removeCategory, setChartValue } from '../chart';
import { DEFAULT_PICTOGRAPH_STYLE, pictographSymbolAt } from '../pictograph';
import type { PictographSymbol } from '../pictographSymbols';
import type { Axis, AxisStyle, ChartDocument, ChartEdit, Datum, LineKind, PictographStyle, SeriesStyle } from '../types';
import AxisArrowheadField from './AxisArrowheadField';
import PictographSymbolField from './PictographSymbolField';
import ColorPicker from './ColorPicker';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  onClose: () => void;
}

function NumberField({ label, value, onChange, minimum, normalize }: {
  label: string; value: number | null | undefined; onChange: (value: number | null) => void;
  minimum?: number; normalize?: (value: number) => number;
}) {
  return (
    <label>{label}
      <input key={value ?? 'empty'} type="text" inputMode="decimal" placeholder={minimum !== undefined ? '自动' : undefined} defaultValue={value ?? ''}
        onBlur={event => {
          const input = event.currentTarget;
          try {
            const parsed = parseValue(input.value);
            if (minimum !== undefined && parsed !== null && parsed < minimum) throw new Error();
            const next = normalize ? parsed === null ? value ?? null : normalize(parsed) : parsed;
            input.value = String(next ?? '');
            if (next !== (value ?? null)) onChange(next);
          } catch {
            input.value = String(value ?? '');
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') event.currentTarget.value = String(value ?? '');
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        }} />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>{label}
      <input key={value} type="text" className="toolbar-name-input" defaultValue={value}
        onBlur={event => {
          const input = event.currentTarget;
          const next = input.value.trim();
          input.value = next || value;
          if (next && next !== value) onChange(next);
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') event.currentTarget.value = value;
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        }} />
    </label>
  );
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

export function DataSelectionToolbar({ chart, datum, onEdit, onClose, onRemoveSeries }: Props & {
  datum: Datum; onRemoveSeries: (index: number) => void;
}) {
  const series = chart.series[datum.series];
  const value = series.values[datum.index];
  const appearance = getSeriesStyle(series, chart.style);
  const category = chart.categories[datum.index];
  const pie = chart.kind === 'pie';
  const pictograph = chart.kind === 'pictograph';
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
  }

  function setSymbol(symbol: PictographSymbol | null) {
    onEdit(current => categorySymbols ? {
      ...current, pictographSymbols: current.categories.map((_, index) => index === datum.index ? symbol : current.pictographSymbols?.[index] ?? null),
    } : {
      ...current, style: { ...current.style, pictograph: { ...current.style.pictograph, symbol } },
    });
  }

  function setSymbolColorMode(colorMode: PictographStyle['colorMode']) {
    onEdit(current => ({ ...current, style: { ...current.style, pictograph: { ...current.style.pictograph, colorMode } } }));
  }

  return (
    <div className="drawing-toolbar text-toolbar datum-toolbar" role="group" aria-label="数据点设置">
      <span className="text-toolbar-name">{pie ? '扇区' : pictograph ? '图符数据' : '数据点'}</span>
      <NumberField label="数值" value={value} onChange={next => {
        onEdit(chart => setChartValue(chart, datum.series, datum.index, next));
        if (pie && !(next > 0)) onClose();
      }} />
      <TextField label="类别" value={category} onChange={name => onEdit(chart => ({
        ...chart, categories: chart.categories.map((item, index) => index === datum.index ? name : item),
      }))} />
      <TextField label="系列" value={series.name} onChange={name => onEdit(chart => ({
        ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, name } : item),
      }))} />
      {pictograph && <PictographSymbolField label={categorySymbols ? '类别图符' : '图符'} value={pictographSymbolAt(chart, datum.index)}
        color={series.color} outline={symbolStyle?.outline ?? false} mode={colorMode} onModeChange={setSymbolColorMode}
        onChange={setSymbol} onReset={categorySymbols && chart.pictographSymbols?.[datum.index] ? () => setSymbol(null) : undefined} />}
      {(!pictograph || colorMode === 'single') && <div className="color-field"><span>{pictograph ? '图符颜色' : '颜色'}</span>
        <ColorPicker value={pie ? pieColor(chart, datum.index) : series.color}
          label={pie ? '所选扇区颜色' : pictograph ? '图符颜色' : '所选系列颜色'}
          onChange={color => onEdit(chart => pie ? {
            ...chart, pieColors: chart.categories.map((_, index) => index === datum.index ? color : chart.pieColors?.[index] ?? null),
          } : {
            ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, color } : item),
          })} />
      </div>}
      <button className="button compact toolbar-toggle" aria-pressed={appearance.showLabels} aria-label={pie ? '扇区标签' : '系列数据标签'}
        onClick={() => format({ showLabels: !appearance.showLabels })}><Tags size={15} /> {pie ? '扇区标签' : '数值标签'}</button>
      {chart.kind === 'line' ? (
        <>
          <label>线宽
            <select value={appearance.strokeWidth} onChange={event => format({ strokeWidth: Number(event.target.value) })}>
              {numericOptions([1, 2, 3, 4, 5, 6, 8], appearance.strokeWidth).map(width => <option key={width} value={width}>{width}</option>)}
            </select>
          </label>
          <div className="toolbar-marker-controls" role="group" aria-label="点标记样式">
            <button className="button compact toolbar-toggle" aria-pressed={appearance.dots}
              onClick={() => format({ dots: !appearance.dots })}>点标记</button>
            {appearance.dots && (
              <>
                <label>标记形状
                  <select value={appearance.dotShape} onChange={event => format({ dotShape: event.target.value as SeriesStyle['dotShape'] })}>
                    <option value="circle">圆形</option><option value="square">方形</option><option value="diamond">菱形</option>
                  </select>
                </label>
                <label>标记大小
                  <select value={appearance.dotSize} onChange={event => format({ dotSize: Number(event.target.value) })}>
                    {numericOptions([3, 5, 7, 9, 11], appearance.dotSize).map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <button className="button compact toolbar-toggle" aria-label="实心数据点" aria-pressed={appearance.dotFill === 'solid'}
                  title="切换该系列数据点的实心或空心" onClick={() => format({
                    dotFill: appearance.dotFill === 'solid' ? 'hollow' : 'solid',
                  })}>{appearance.dotFill === 'solid' ? '实心' : '空心'}</button>
              </>
            )}
          </div>
        </>
      ) : chart.kind === 'bar' && (
        <>
          {chart.kind === 'bar' && chart.groupedColumns && <GroupWidthField chart={chart} onEdit={onEdit} />}
          <label>柱形宽度
            <select value={appearance.columnWidth} onChange={event => format({ columnWidth: Number(event.target.value) })}>
              {[0.4, 0.65, 0.86, 1].map(width => <option key={width} value={width}>{Math.round(width * 100)}%</option>)}
            </select>
          </label>
          <button className="button compact toolbar-toggle" aria-pressed={appearance.roundedColumns}
            onClick={() => format({ roundedColumns: !appearance.roundedColumns })}>圆角柱形</button>
        </>
      )}
      <button className="icon-button" aria-label="删除数据选项" title="清除数据点、删除类别或系列" popoverTarget={menuId}
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          menu.current.style.left = `${Math.max(8, Math.min(rect.right - 146, document.documentElement.clientWidth - 154))}px`;
          menu.current.style.top = `${Math.min(rect.bottom + 5, document.documentElement.clientHeight - 126)}px`;
        }}><Trash2 size={16} /></button>
      <div className="datum-delete-menu" popover="auto" id={menuId} ref={menu} role="group" aria-label="删除数据">
        <button className="button compact" disabled={value === null} onClick={() => {
          onEdit(chart => setChartValue(chart, datum.series, datum.index, null));
          onClose();
        }}>{pie ? '清除扇区数据' : '清除数据点'}</button>
        <button className="button compact" disabled={chart.categories.length <= 1} onClick={() => {
          onEdit(chart => removeCategory(chart, datum.index));
          onClose();
        }}>删除整个类别</button>
        {chart.series.length > 1 ? (
          <button className="button compact" onClick={() => onRemoveSeries(datum.series)}>删除整个系列</button>
        ) : (
          <button className="button compact" disabled={series.values.every(value => value === null)} onClick={() => {
            onEdit(current => ({ ...current, scaleExtent: null, series: current.series.map((item, index) => index === datum.series
              ? { ...item, values: item.values.map(() => null) } : item) }));
            onClose();
          }}>清空整个系列</button>
        )}
      </div>
      <button className="icon-button text-toolbar-close" aria-label="关闭数据点设置" onClick={onClose}><X size={17} /></button>
    </div>
  );
}

export function AxisSelectionToolbar({ chart, axis, onEdit, onClose, onSettings }: Props & {
  axis: Axis | 'both'; onSettings: (axis: Axis) => void;
}) {
  const style = chart.style.axes[axis === 'both' ? 'x' : axis];
  const mixedLine = axis === 'both' && chart.style.axes.x.line !== chart.style.axes.y.line;
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
    <div className="drawing-toolbar text-toolbar" role="group" aria-label="所选坐标轴设置">
      <span className="text-toolbar-name">{axis === 'both' ? '坐标系' : axis === 'x' ? '横轴' : '纵轴'}</span>
      <div className="color-field"><span>轴线颜色</span>
        <ColorPicker value={style.color} label="所选轴线颜色" onChange={color => update('color', color)}
          mixed={axis === 'both' && chart.style.axes.x.color !== chart.style.axes.y.color} />
      </div>
      <label>轴线样式
        <select value={mixedLine ? '' : style.line} onChange={event => update('line', event.target.value as LineKind)}>
          {mixedLine && <option value="" disabled>混合</option>}
          <option value="arrow">带箭头</option><option value="solid">实线</option><option value="dashed">虚线</option>
        </select>
      </label>
      <AxisArrowheadField style={chart.style} onEdit={onEdit} />
      <label>轴线宽度
        <select value={mixedWidth ? '' : style.width} onChange={event => update('width', Number(event.target.value))}>
          {mixedWidth && <option value="" disabled>混合</option>}
          {numericOptions([1, 1.6, 2, 3, 4, 5], style.width).map(width => <option value={width} key={width}>{width}</option>)}
        </select>
      </label>
      {axis !== 'both' && <NumberField label="轴线长度" value={style.length} normalize={value => {
        const { min, max } = AXIS_LENGTHS[axis];
        return clamp(Math.round(value), min, max);
      }} onChange={value => { if (value !== null) update('length', value); }} />}
      {axis === 'y' && <NumberField label="最大值" value={style.maximum} minimum={Math.max(0, style.omitted?.to ?? 0)}
        onChange={value => update('maximum', value ?? undefined)} />}
      {axis !== 'both' && (
        <>
          <button className="button compact toolbar-toggle" aria-pressed={style.showValues}
            onClick={() => update('showValues', !style.showValues)}>{axis === 'x' ? '类别标签' : '刻度标签'}</button>
          <button className="button compact toolbar-toggle" aria-pressed={style.showLabel}
            onClick={() => update('showLabel', !style.showLabel)}>轴标题</button>
        </>
      )}
      <button className="button compact" onClick={() => onSettings(axis === 'both' ? 'x' : axis)}><SlidersHorizontal size={15} /> 坐标轴设置</button>
      {axis === 'both' && <button className="button compact" onClick={() => onEdit(chart => movePlot(chart, { x: 0, y: 0 }))}>
        <RotateCcw size={15} /> 还原位置
      </button>}
      <button className="icon-button text-toolbar-close" aria-label="关闭所选坐标轴设置" onClick={onClose}><X size={17} /></button>
    </div>
  );
}
