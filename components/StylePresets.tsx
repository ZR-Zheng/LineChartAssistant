import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AXIS_LENGTHS, DEFAULT_AXIS_ARROWHEAD, DEFAULT_STYLE, clamp, isAxisArrowhead, isAxisBreak, isGroupWidth, isPieStyle } from '../chart';
import { download } from '../downloads';
import { isPictographStyle } from '../pictograph';
import type { Axis, AxisStyle, ChartStyle } from '../types';

interface Preset {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

const STORAGE_KEY = 'chartPresets';

function readPresets(text: string): Preset[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('预设文件格式不正确。');
  return data.filter(item => typeof item?.id === 'string' && typeof item?.name === 'string'
    && item.config && typeof item.config === 'object' && !Array.isArray(item.config));
}

function savedPresets() {
  try {
    return readPresets(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function applyPreset(config: Preset['config']): ChartStyle {
  const setting = (key: keyof ChartStyle) => typeof config[key] === 'boolean' ? Boolean(config[key]) : DEFAULT_STYLE[key] === true;
  const size = (key: 'strokeWidth' | 'dotSize', max: number) => typeof config[key] === 'number' && Number.isFinite(config[key])
    ? clamp(config[key], 1, max) : DEFAULT_STYLE[key];
  return {
    grid: setting('grid'),
    showLabels: setting('showLabels'),
    dots: setting('dots'),
    showOrigin: setting('showOrigin'),
    showTitle: config.showTitle !== false,
    dotSize: size('dotSize', 12),
    strokeWidth: size('strokeWidth', 10),
    axes: { x: presetAxis('x', config), y: presetAxis('y', config) },
    axisArrowhead: isAxisArrowhead(config.axisArrowhead) ? config.axisArrowhead : DEFAULT_AXIS_ARROWHEAD,
    groupWidth: isGroupWidth(config.groupWidth) ? config.groupWidth : undefined,
    pie: isPieStyle(config.pie) ? config.pie : undefined,
    pictograph: isPictographStyle(config.pictograph) ? config.pictograph : undefined,
    legend: typeof config.legend === 'boolean' ? config.legend : DEFAULT_STYLE.legend,
  };
}

function presetAxis(axis: Axis, config: Preset['config']): AxisStyle {
  const fallback = DEFAULT_STYLE.axes[axis];
  const legacy = axis === 'x' ? 'XAxis' : 'YAxis';
  const axes = config.axes as Partial<Record<Axis, Partial<AxisStyle>>> | undefined;
  const saved = axes?.[axis];
  const color = saved?.color ?? config.axisColor;
  const tickPosition = saved?.tickPosition ?? config[`${axis}AxisTickType`];
  const tickLength = saved?.tickLength ?? config[`${axis}AxisTickSize`];
  const legacyInterval = config[`${axis}AxisTickInterval`];
  const interval = saved?.interval ?? (axis === 'x' && typeof legacyInterval === 'number' && legacyInterval > 0
    ? legacyInterval + 1 : legacyInterval);
  const validInterval = typeof interval === 'number' && Number.isFinite(interval) && interval > 0;
  const legacyMaximum = config.yAxisMax;
  const maximum = saved?.maximum ?? (typeof legacyMaximum === 'string' && legacyMaximum.trim() ? Number(legacyMaximum) : undefined);
  const validMaximum = axis === 'y' && typeof maximum === 'number' && Number.isFinite(maximum) && maximum >= 0;
  const bounded = (value: unknown, min: number, max: number, defaultValue: number) =>
    typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : defaultValue;
  const range = AXIS_LENGTHS[axis];
  return {
    line: saved?.line === 'solid' || saved?.line === 'dashed' || saved?.line === 'arrow'
      ? saved.line : config[`${axis}AxisArrowEnd`] === false ? 'solid' : fallback.line,
    color: typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : fallback.color,
    width: bounded(saved?.width, 1, 6, fallback.width),
    length: Math.round(bounded(saved?.length, range.min, range.max, fallback.length)),
    tickPosition: tickPosition === 'inside' || tickPosition === 'cross' ? tickPosition : fallback.tickPosition,
    tickLength: bounded(tickLength, 0, 20, fallback.tickLength),
    tickMode: saved?.tickMode === 'auto' || saved?.tickMode === 'all' || saved?.tickMode === 'interval'
      ? saved.tickMode : validInterval ? 'interval' : 'auto',
    interval: validInterval ? (axis === 'x' ? Math.round(clamp(interval, 1, Number.MAX_SAFE_INTEGER)) : interval) : fallback.interval,
    ...(validMaximum && { maximum }),
    ...(axis === 'y' && isAxisBreak(saved?.omitted) && (!validMaximum || saved.omitted.to <= maximum) && { omitted: saved.omitted }),
    visible: saved?.visible !== false,
    showValues: typeof saved?.showValues === 'boolean' ? saved.showValues : fallback.showValues,
    showLabel: typeof saved?.showLabel === 'boolean' ? saved.showLabel : config[`show${legacy}Label`] !== false,
    titlePlacement: saved?.titlePlacement === 'center' || saved?.titlePlacement === 'start' ? saved.titlePlacement : fallback.titlePlacement,
  };
}

function StylePresets({ style, onApply }: { style: ChartStyle; onApply: (style: ChartStyle) => void }) {
  const [presets, setPresets] = useState(savedPresets);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function save(items: Preset[]) {
    setPresets(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setError('');
    } catch {
      setError('浏览器存储不可用。可下载预设以保留修改。');
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    save([...presets, { id: String(Date.now()), name: name.trim(), config: { ...style } }]);
    setName('');
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const imported = readPresets(await file.text());
      if (!imported.length) throw new Error('预设文件为空。');
      save([...presets, ...imported.map((preset, i) => ({ ...preset, id: `${Date.now()}-${i}` }))]);
    } catch {
      setError('文件中没有可用的样式预设。');
    }
  }

  return (
    <details className="presets">
      <summary>全局样式预设</summary>
      <p className="preset-scope">预设保存画布的全局样式。系列有独立样式时，该系列优先使用自己的设置。</p>
      <form className="preset-actions" onSubmit={add}>
        <input aria-label="预设名称" placeholder="预设名称" value={name} onChange={event => setName(event.target.value)} />
        <button className="button compact" disabled={!name.trim()}>保存</button>
      </form>
      {presets.map(preset => (
        <div className="preset-actions" key={preset.id}>
          <button className="preset-name text-button" onClick={() => onApply(applyPreset(preset.config))}>{preset.name}</button>
          <button className="button compact" aria-label={`删除预设 ${preset.name}`}
            onClick={() => save(presets.filter(item => item.id !== preset.id))}>删除</button>
        </div>
      ))}
      <div className="preset-actions">
        <button className="button compact" onClick={() => fileInput.current?.click()}>导入预设</button>
        <button className="button compact" disabled={!presets.length} onClick={() => download(
          new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' }), 'chart-presets.json',
        )}>导出预设</button>
        <input type="file" hidden ref={fileInput} accept=".json" onChange={importFile} />
      </div>
      {error && <p className="panel-error" role="alert">{error}</p>}
    </details>
  );
}

export default StylePresets;
