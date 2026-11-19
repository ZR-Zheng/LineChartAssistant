import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_PIE_STYLE, PIE_PALETTE_NAMES, PIE_PRESETS, pieStyle, TEXT_FONTS } from '../chart';
import type { ChartDocument, ChartEdit, PieStyle, TextFont } from '../types';
import { movePie, resetPieLegend, togglePieLegendAttachment } from '../pieLayout';
import ColorPicker from './ColorPicker';

const TABS = { shape: '图形', labels: '标签', legend: '图例' } as const;
export type PieSettingsTab = keyof typeof TABS;
const FONT_OPTIONS = Object.entries(TEXT_FONTS).map(([value, { label }]): [string, string] => [value, label]);
const DEFAULT_SHAPE = { ...PIE_PRESETS.classic.style, radius: DEFAULT_PIE_STYLE.radius, startAngle: DEFAULT_PIE_STYLE.startAngle,
  clockwise: DEFAULT_PIE_STYLE.clockwise, order: DEFAULT_PIE_STYLE.order };

function Choice({ label, value, options, onChange }: {
  label: string; value: string | number; options: [string | number, string][]; onChange: (value: string) => void;
}) {
  return <label>{label}
    <select value={value} onChange={event => onChange(event.target.value)}>
      {options.map(([value, name]) => <option value={value} key={value}>{name}</option>)}
    </select>
  </label>;
}

export default function PieSettings({ chart, onEdit, onClose, tab, onSelectTab, showLabels, showLegend, onToggleLabels, onToggleLegend }: {
  chart: ChartDocument; onEdit: ChartEdit; onClose: () => void; tab: PieSettingsTab; onSelectTab: (tab: PieSettingsTab) => void;
  showLabels: boolean; showLegend: boolean; onToggleLabels: () => void; onToggleLegend: () => void;
}) {
  const style = pieStyle(chart.style);
  const options = Object.entries(PIE_PRESETS);
  const activePreset = options.find(([, { style: preset }]) => Object.entries(preset).every(([key, value]) => style[key] === value))?.[0] ?? 'custom';
  const hasCustomShape = Object.entries(DEFAULT_SHAPE).some(([key, value]) => style[key] !== value);

  function update(changes: Partial<PieStyle>) {
    onEdit(current => ({ ...current, style: { ...current.style, pie: { ...current.style.pie, ...changes } } }));
  }

  function sizes(label: string, key: 'labelFontSize' | 'legendFontSize' | 'legendRowGap' | 'legendMarkerSize' | 'legendMarkerGap', sizes: number[]) {
    return <Choice label={label} value={style[key]} options={[...new Set([...sizes, style[key]])].sort((a, b) => a - b).map(size => [size, `${size} px`])}
      onChange={value => update({ [key]: Number(value) })} />;
  }

  return (
    <aside className="data-panel" id="pie-panel" aria-label="扇形图设置">
      <div className="panel-heading">
        <h2>扇形图设置</h2>
        <button className="icon-button" aria-label="关闭扇形图设置" title="关闭扇形图设置" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="panel-content axis-settings">
        <div className="segmented axis-tabs pie-tabs" role="group" aria-label="扇形设置分类">
          {Object.entries(TABS).map(([key, label]) => <button key={key} aria-pressed={tab === key}
            onClick={() => onSelectTab(key as PieSettingsTab)}>{label}</button>)}
        </div>

        {tab === 'shape' && <>
          <Choice label="图表样式" value={activePreset} options={[
            ...(activePreset === 'custom' ? [['custom', '自定义'] as [string, string]] : []),
            ...options.map(([key, item]): [string, string] => [key, item.label]),
          ]}
            onChange={value => { if (Object.hasOwn(PIE_PRESETS, value)) update(PIE_PRESETS[value].style); }} />
          <div className="axis-row">
            <Choice label="默认配色" value={style.palette} options={Object.entries(PIE_PALETTE_NAMES)} onChange={value => update({ palette: value as PieStyle['palette'] })} />
            <Choice label="中空比例" value={style.holeRatio} options={[...new Set([0, 0.3, 0.5, 0.65, style.holeRatio])].sort((a, b) => a - b)
              .map(ratio => [ratio, `${Math.round(ratio * 100)}%`])} onChange={value => update({ holeRatio: Number(value) })} />
          </div>
          <div className="axis-row">
            <Choice label="扇形大小" value={style.radius} options={[[125, '小'], [155, '中'], [176, '大'],
              ...(![125, 155, 176].includes(style.radius) ? [[style.radius, `${style.radius} px`] as [number, string]] : [])]}
              onChange={value => update({ radius: Number(value) })} />
            <Choice label="起始角度" value={style.startAngle} options={[...new Set([0, 45, 90, 135, 180, 225, 270, 315, style.startAngle])]
              .sort((a, b) => a - b).map(angle => [angle, `${angle}°`])} onChange={value => update({ startAngle: Number(value) })} />
          </div>
          <div className="axis-row">
            <Choice label="扇区顺序" value={style.order} options={[["data", '数据表顺序'], ['desc', '从大到小'], ['asc', '从小到大']]}
              onChange={value => update({ order: value as PieStyle['order'] })} />
            <Choice label="排列方向" value={String(style.clockwise)} options={[["true", '顺时针'], ['false', '逆时针']]}
              onChange={value => update({ clockwise: value === 'true' })} />
          </div>
          <div className="axis-row">
            <Choice label="扇区分隔线" value={style.separatorWidth} options={[[0, '隐藏'], [1, '1 px'], [2, '2 px'], [3, '3 px'], [4, '4 px']]}
              onChange={value => update({ separatorWidth: Number(value) })} />
            <div className="axis-color color-field"><span>颜色</span>
              <ColorPicker label="扇区分隔线颜色" value={style.separatorColor} onChange={color => update({ separatorColor: color })} />
            </div>
          </div>
          <div className="axis-panel-footer">
            <button className="text-button" disabled={!hasCustomShape} onClick={() => update(DEFAULT_SHAPE)}>
              <RotateCcw size={14} /> 重置扇形样式</button>
            <button className="text-button" disabled={!chart.piePosition} onClick={() => onEdit(current => movePie(current))}>
              <RotateCcw size={14} /> 还原扇形位置</button>
            {chart.pieColors?.some(Boolean) && <button className="text-button" onClick={() => onEdit(current => ({
              ...current, pieColors: undefined,
            }))}>恢复默认配色</button>}
          </div>
        </>}

        {tab === 'labels' && <>
          <div className="axis-checks"><label><input type="checkbox" checked={showLabels} onChange={onToggleLabels} />显示扇区标签</label></div>
          <Choice label="标签内容" value={style.labelMode} options={[["percent", '百分比'], ['value', '数值'], ['both', '数值与百分比']]}
            onChange={value => update({ labelMode: value as PieStyle['labelMode'] })} />
          <div className="axis-row">
            <Choice label="标签字体" value={style.labelFont} options={FONT_OPTIONS} onChange={value => update({ labelFont: value as TextFont })} />
            {sizes('标签字号', 'labelFontSize', [10, 12, 14, 15, 16, 18, 20, 22])}
          </div>
          <div className="axis-row">
            <Choice label="标签位置" value={style.labelPlacement} options={[["middle", '扇区中间'], ['rim', '靠近外缘']]}
              onChange={value => update({ labelPlacement: value as PieStyle['labelPlacement'] })} />
            <Choice label="百分比精度" value={style.percentageDigits} options={[[0, '整数'], [1, '最多 1 位小数'], [2, '最多 2 位小数']]}
              onChange={value => update({ percentageDigits: Number(value) })} />
          </div>
          <div className="pie-color-setting">
            <div className="color-field"><span>标签颜色</span>
              <ColorPicker label="扇区标签颜色" value={style.labelColor ?? '#ffffff'} mixed={!style.labelColor} onChange={color => update({ labelColor: color })} />
            </div>
            <button className="text-button" disabled={!style.labelColor} onClick={() => update({ labelColor: undefined })}>自动对比</button>
          </div>
        </>}

        {tab === 'legend' && <>
          <div className="axis-checks">
            <label><input type="checkbox" checked={showLegend} onChange={onToggleLegend} />显示图例</label>
            <label><input type="checkbox" checked={!chart.pieLegendPosition} onChange={() => onEdit(togglePieLegendAttachment)} />随图移动</label>
          </div>
          <div className="axis-row">
            <Choice label="默认位置" value={style.legendSide} options={[["right", '右侧'], ['left', '左侧']]}
              onChange={value => onEdit(current => ({ ...resetPieLegend(current),
                style: { ...current.style, pie: { ...current.style.pie, legendSide: value as PieStyle['legendSide'] } } }))} />
            <Choice label="图例内容" value={style.legendContent}
              options={[["follow", '跟随扇区标签'], ['category', '仅类别'], ['value', '类别与数值'], ['percent', '类别与占比'], ['both', '类别、数值与占比']]}
              onChange={value => update({ legendContent: value as PieStyle['legendContent'] })} />
          </div>
          <div className="axis-row">
            <Choice label="图例字体" value={style.legendFont} options={FONT_OPTIONS} onChange={value => update({ legendFont: value as TextFont })} />
            {sizes('图例字号', 'legendFontSize', [10, 12, 14, 16, 18, 20, 22])}
            <div className="axis-color color-field"><span>字色</span>
              <ColorPicker label="图例文字颜色" value={style.legendColor} onChange={color => update({ legendColor: color })} />
            </div>
          </div>
          <div className="axis-row">
            <Choice label="色标形状" value={style.legendMarker} options={[["square", '方块'], ['circle', '圆点'], ['line', '短线']]}
              onChange={value => update({ legendMarker: value as PieStyle['legendMarker'] })} />
            {sizes('色标大小', 'legendMarkerSize', [7, 9, 12, 15, 18])}
          </div>
          <div className="axis-row">
            {sizes('色标与文字间距', 'legendMarkerGap', [2, 3, 5, 8, 12])}
            {sizes('图例行距', 'legendRowGap', [2, 4, 6, 10, 14])}
          </div>
          <small>可拖动图例独立摆放。拖回扇形旁的默认位置时，图例会吸附并随图移动。</small>
          <div className="axis-panel-footer">
            <button className="text-button" disabled={!chart.pieLegendPosition && !chart.pieLegendOffset} onClick={() => onEdit(resetPieLegend)}>
              <RotateCcw size={14} /> 还原图例位置</button>
          </div>
        </>}
      </div>
    </aside>
  );
}
