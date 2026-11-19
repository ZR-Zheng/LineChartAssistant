import { RotateCcw, SlidersHorizontal, Tags, Trash2, X } from 'lucide-react';
import { AXIS_LENGTHS, clamp, getSeriesStyle, movePlot, parseValue, setChartValue } from '../chart';
import type { Axis, AxisStyle, ChartDocument, ChartEdit, Datum, LineKind, SeriesStyle } from '../types';
import ColorPicker from './ColorPicker';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  onClose: () => void;
}

function NumberField({ label, value, onChange, nonnegative = false, normalize }: {
  label: string; value: number | null | undefined; onChange: (value: number | null) => void;
  nonnegative?: boolean; normalize?: (value: number) => number;
}) {
  return (
    <label>{label}
      <input key={value ?? 'empty'} type="text" inputMode="decimal" placeholder={nonnegative ? '自动' : undefined} defaultValue={value ?? ''}
        onBlur={event => {
          const input = event.currentTarget;
          try {
            const parsed = parseValue(input.value);
            if (nonnegative && parsed !== null && parsed < 0) throw new Error();
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

export function DataSelectionToolbar({ chart, datum, onEdit, onClose }: Props & { datum: Datum }) {
  const series = chart.series[datum.series];
  const value = series.values[datum.index];
  const appearance = getSeriesStyle(series, chart.style);
  const category = chart.categories[datum.index];

  function format(changes: Partial<SeriesStyle>) {
    onEdit(chart => ({
      ...chart, series: chart.series.map((item, index) => index === datum.series
        ? { ...item, style: { ...item.style, ...changes } } : item),
    }));
  }

  return (
    <div className="drawing-toolbar text-toolbar" role="group" aria-label="数据点设置">
      <span className="text-toolbar-name">数据点</span>
      <NumberField label="数值" value={value} onChange={next => onEdit(chart => setChartValue(chart, datum.series, datum.index, next))} />
      <TextField label="类别名称" value={category} onChange={name => onEdit(chart => ({
        ...chart, categories: chart.categories.map((item, index) => index === datum.index ? name : item),
      }))} />
      <TextField label="系列名称" value={series.name} onChange={name => onEdit(chart => ({
        ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, name } : item),
      }))} />
      <div className="color-field"><span>系列颜色</span>
        <ColorPicker value={series.color} label="所选系列颜色" onChange={color => onEdit(chart => ({
          ...chart, series: chart.series.map((item, index) => index === datum.series ? { ...item, color } : item),
        }))} />
      </div>
      <button className="button compact toolbar-toggle" aria-pressed={appearance.showLabels}
        onClick={() => format({ showLabels: !appearance.showLabels })}><Tags size={15} /> 系列数据标签</button>
      {chart.kind === 'line' ? (
        <>
          <label>折线宽度
            <select value={appearance.strokeWidth} onChange={event => format({ strokeWidth: Number(event.target.value) })}>
              {numericOptions([1, 2, 3, 4, 5, 6, 8], appearance.strokeWidth).map(width => <option key={width} value={width}>{width}</option>)}
            </select>
          </label>
          <div className="toolbar-marker-controls" role="group" aria-label="点标记样式">
            <button className="button compact toolbar-toggle" aria-pressed={appearance.dots}
              onClick={() => format({ dots: !appearance.dots })}>显示点标记</button>
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
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <label>柱形宽度
            <select value={appearance.columnWidth} onChange={event => format({ columnWidth: Number(event.target.value) })}>
              {[0.4, 0.65, 0.86, 1].map(width => <option key={width} value={width}>{Math.round(width * 100)}%</option>)}
            </select>
          </label>
          <button className="button compact toolbar-toggle" aria-pressed={appearance.roundedColumns}
            onClick={() => format({ roundedColumns: !appearance.roundedColumns })}>圆角柱形</button>
        </>
      )}
      <button className="icon-button" aria-label="清除数据点" title="清除数据点" disabled={value === null}
        onClick={() => onEdit(chart => setChartValue(chart, datum.series, datum.index, null))}><Trash2 size={16} /></button>
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
      {axis === 'y' && <NumberField label="最大值" value={style.maximum} nonnegative onChange={value => update('maximum', value ?? undefined)} />}
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
