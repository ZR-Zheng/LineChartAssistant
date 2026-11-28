import { useEffect } from 'react';
import type { RefObject } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { getSeriesStyle, TEXT_FONTS } from '../chart';
import { DEFAULT_PICTOGRAPH_LEGEND, DEFAULT_PICTOGRAPH_SHAPE, PICTOGRAPH_LEGEND_LIMIT, PICTOGRAPH_PRESETS, PICTOGRAPH_TABLE_LIMITS, pictographLayout,
  resetPictographLegend, resizePictographTable, savePictographLegendText, setPictographCategoryShare, updatePictographStyle } from '../pictograph';
import type { ChartDocument, ChartEdit, PictographStyle } from '../types';
import ColorPicker from './ColorPicker';
import DataLabelStyleControl from './DataLabelStyleControl';
import PictographSymbolField from './PictographSymbolField';

export type PictographSettingsTab = 'shape' | 'legend';

export default function PictographSettings({ chart, onEdit, onClose, onToggleLabels, onToggleLegend, tab, onSelectTab, legendInput }: {
  chart: ChartDocument; onEdit: ChartEdit; onClose: () => void; onToggleLabels: () => void; onToggleLegend: () => void;
  tab: PictographSettingsTab; onSelectTab: (tab: PictographSettingsTab) => void; legendInput: RefObject<HTMLTextAreaElement | null>;
}) {
  const { style, unit, unitLabel, series, seriesIndex, legend, table, vertical } = pictographLayout(chart);
  const categoryPercent = Math.round(table.category.percent * 10) / 10;
  const categoryField = vertical ? 'categoryRowShare' : 'categoryColumnShare';
  const presets = Object.entries(PICTOGRAPH_PRESETS);
  const currentPreset = presets.find(([, preset]) => Object.entries(preset.style).every(([key, value]) => style[key] === value))?.[0] ?? '';

  function update(changes: Partial<PictographStyle>) {
    onEdit(current => updatePictographStyle(current, changes));
  }

  useEffect(() => {
    if (tab === 'legend') legendInput.current?.focus({ preventScroll: true });
  }, [tab, legendInput]);

  return (
    <aside className="data-panel" id="pictograph-panel" aria-label="象形图设置">
      <div className="panel-heading">
        <h2>象形图设置</h2>
        <button className="icon-button" aria-label="关闭象形图设置" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="panel-content axis-settings">
        <div className="segmented axis-tabs pie-tabs" role="group" aria-label="象形图设置分类">
          <button aria-pressed={tab === 'shape'} onClick={() => onSelectTab('shape')}>图形</button>
          <button aria-pressed={tab === 'legend'} onClick={() => onSelectTab('legend')}>图例</button>
        </div>
        {tab === 'shape' && <>
          <label>排版样式
            <select value={currentPreset} onChange={event => {
              const preset = PICTOGRAPH_PRESETS[event.target.value as keyof typeof PICTOGRAPH_PRESETS];
              if (preset) onEdit(current => resetPictographLegend(updatePictographStyle(current, preset.style)));
            }}>
              <option value="" disabled>自定义</option>
              {presets.map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
            </select>
          </label>
          <div className="axis-row">
            <label>图标用法
              <select value={style.symbolMode} onChange={event => update({ symbolMode: event.target.value as PictographStyle['symbolMode'] })}>
                <option value="shared">统一图标</option><option value="category">按类别设置</option>
              </select>
            </label>
            {style.colorMode === 'single' && <div className="axis-color color-field"><span>颜色</span>
              <ColorPicker value={series.color} label="图标颜色" onChange={color => onEdit(current => ({
                ...current, series: current.series.map((item, index) => index === seriesIndex ? { ...item, color } : item),
              }))} />
            </div>}
          </div>
          {style.symbolMode === 'shared'
            ? <PictographSymbolField label="图标" value={style.symbol} color={series.color} outline={style.outline} mode={style.colorMode}
              onChange={symbol => update({ symbol })} onModeChange={colorMode => update({ colorMode })} />
            : <>
              <label>图标配色
                <select value={style.colorMode} onChange={event => update({ colorMode: event.target.value as PictographStyle['colorMode'] })}>
                  <option value="single">单色</option><option value="color">彩色</option>
                </select>
              </label>
              <small>选择画布上的行或列，在工具栏更换该类别的图标。</small>
            </>}
          <div className="axis-row">
            <label>排列方向
              <select value={style.direction} onChange={event => update({ direction: event.target.value as PictographStyle['direction'] })}>
                <option value="horizontal">横排</option><option value="vertical">竖排</option>
              </select>
            </label>
            <label>图标大小
              <select value={style.symbolSize} onChange={event => update({ symbolSize: Number(event.target.value) })}>
                {[...new Set([18, 22, 26, 32, 38, style.symbolSize])].sort((a, b) => a - b)
                  .map(size => <option key={size} value={size}>{size} px</option>)}
              </select>
            </label>
          </div>
          <div className="axis-row">
            <label>每个图标代表
              <select value={style.unit === undefined ? 'auto' : 'fixed'} onChange={event => update({ unit: event.target.value === 'auto' ? undefined : unit })}>
                <option value="auto">自动</option><option value="fixed">指定数量</option>
              </select>
            </label>
            <label>{style.unit === undefined ? '当前数量' : '数量'}
              <input key={`${style.unit === undefined}:${unit}`} type="number" step="any" defaultValue={unit} readOnly={style.unit === undefined}
                onBlur={event => {
                  const next = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(next) && next > 0 && next !== unit) update({ unit: next });
                  else event.currentTarget.value = String(unit);
                }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            </label>
          </div>
          <div className="axis-row">
            <label>单位
              <input key={unitLabel} maxLength={24} defaultValue={unitLabel} placeholder="如 本、个、人"
                onBlur={event => {
                  const next = event.currentTarget.value.trim();
                  if (next !== unitLabel) update({ unitLabel: next });
                }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            </label>
            <label>图标间距
              <select value={style.symbolGap} onChange={event => update({ symbolGap: Number(event.target.value) })}>
                {[...new Set([0, 3, 5, 8, 12, style.symbolGap])].sort((a, b) => a - b)
                  .map(gap => <option key={gap} value={gap}>{gap} px</option>)}
              </select>
            </label>
          </div>
          <div className="panel-actions" role="group" aria-label="图标辅助显示">
            <button className="button compact" aria-pressed={getSeriesStyle(series, chart.style).showLabels} onClick={onToggleLabels}>数值标签</button>
            <DataLabelStyleControl chart={chart} onEdit={onEdit} seriesIndex={seriesIndex} />
            <button className="button compact" aria-pressed={style.guides} onClick={() => update({ guides: !style.guides })}>辅助线</button>
            <button className="button compact" aria-pressed={style.frame} onClick={() => update({ frame: !style.frame })}>表格边框</button>
            {style.colorMode === 'single' && <button className="button compact" aria-pressed={style.outline}
              onClick={() => update({ outline: !style.outline })}>空心几何图标</button>}
          </div>
          {style.frame && <>
            <div className="axis-row" role="group" aria-label="表格尺寸">
              {(['width', 'height'] as const).map(dimension => {
                const { min, max } = PICTOGRAPH_TABLE_LIMITS[dimension];
                const limit = dimension === 'height' ? table.maxHeight : max;
                const value = table[dimension];
                return (
                  <label key={dimension}>表格{dimension === 'width' ? '宽度' : '高度'}
                    <input key={value} type="number" min={min} max={limit} step={1} defaultValue={value} disabled={limit < min}
                      onBlur={event => {
                        const input = event.currentTarget;
                        const size = input.valueAsNumber;
                        input.value = String(value);
                        if (Number.isFinite(size) && size !== value) onEdit(current => resizePictographTable(current, { [dimension]: size }));
                      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
                  </label>
                );
              })}
            </div>
            <label>{vertical ? '类别行占比（%）' : '类别列占比（%）'}
              <input key={`${categoryField}:${categoryPercent}`} type="number" min={table.category.min} max={table.category.max}
                step={0.1} defaultValue={categoryPercent} disabled={table.category.min >= table.category.max}
                onBlur={event => {
                  const input = event.currentTarget;
                  const share = input.valueAsNumber;
                  input.value = String(categoryPercent);
                  if (Number.isFinite(share) && share !== categoryPercent) onEdit(current => setPictographCategoryShare(current, share));
                }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            </label>
            {style[categoryField] !== undefined && (
              <div className="panel-actions">
                <button className="button compact" onClick={() => update({ [categoryField]: undefined })}>还原类别占比</button>
              </div>
            )}
            {(style.tableWidth !== undefined || style.tableHeight !== undefined) && (
              <div className="panel-actions">
                <button className="button compact" onClick={() => update({ tableWidth: undefined, tableHeight: undefined })}>还原表格尺寸</button>
              </div>
            )}
          </>}
          {(style.guides || style.frame) && <div className="panel-actions" role="group" aria-label="线条颜色">
            <div className="color-field"><span>边框与辅助线</span>
              <ColorPicker label="边框与辅助线颜色" value={style.frameColor ?? '#bfc9d9'} onChange={frameColor => update({ frameColor })} />
            </div>
            {style.frameColor && <button className="button compact" onClick={() => update({ frameColor: undefined })}>恢复默认色</button>}
          </div>}
          <button className="button quiet" onClick={() => update(DEFAULT_PICTOGRAPH_SHAPE)}>
            <RotateCcw size={15} /> 还原图标设置
          </button>
        </>}
        {tab === 'legend' && <>
          <label>图例文字
            <textarea ref={legendInput} key={style.legendText ?? ''} defaultValue={style.legendText ?? ''}
              placeholder={legend.automaticText} rows={3} maxLength={PICTOGRAPH_LEGEND_LIMIT}
              onBlur={event => {
                const text = event.currentTarget.value;
                onEdit(current => savePictographLegendText(current, text));
              }} onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                const input = event.currentTarget;
                if (event.key === 'Escape') {
                  input.value = style.legendText ?? '';
                  input.blur();
                }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) input.blur();
              }} />
          </label>
          <small>留空使用自动说明。也可用 {'{数量}'} 和 {'{单位}'} 引用当前换算。</small>
          <div className="panel-actions">
            <button className="button compact" onClick={() => legendInput.current?.blur()}>应用文字</button>
            <button className="button compact" disabled={style.legendText === undefined}
              onClick={() => onEdit(current => savePictographLegendText(current, ''))}>恢复自动说明</button>
          </div>
          <div className="axis-row">
            <label>对齐
              <select value={style.legendAlignment}
                onChange={event => update({ legendAlignment: event.target.value as PictographStyle['legendAlignment'] })}>
                <option value="auto">随排版对齐</option><option value="start">靠左</option>
                <option value="center">居中</option><option value="end">靠右</option>
              </select>
            </label>
            <label>示例图标
              <select value={style.legendIcon} onChange={event => update({ legendIcon: event.target.value as PictographStyle['legendIcon'] })}>
                <option value="auto">自动</option><option value="show">显示</option><option value="hide">隐藏</option>
              </select>
            </label>
          </div>
          <div className="axis-row">
            <label>字体
              <select value={style.legendFont} onChange={event => update({ legendFont: event.target.value as PictographStyle['legendFont'] })}>
                {Object.entries(TEXT_FONTS).map(([font, setting]) => <option key={font} value={font}>{setting.label}</option>)}
              </select>
            </label>
            <label>字号
              <select value={style.legendFontSize} onChange={event => update({ legendFontSize: Number(event.target.value) })}>
                {[...new Set([12, 14, 16, 18, 20, 22, 24, style.legendFontSize])].sort((a, b) => a - b)
                  .map(size => <option key={size} value={size}>{size} px</option>)}
              </select>
            </label>
            <div className="axis-color color-field"><span>颜色</span>
              <ColorPicker value={style.legendColor} label="图例文字颜色" onChange={legendColor => update({ legendColor })} />
            </div>
          </div>
          <div className="panel-actions" role="group" aria-label="图例显示">
            <button className="button compact" aria-pressed={style.showKey} onClick={onToggleLegend}>显示图例</button>
            <button className="button compact" aria-pressed={style.legendBold} onClick={() => update({ legendBold: !style.legendBold })}>加粗</button>
            <button className="button compact" disabled={!chart.pictographLegendPosition} onClick={() => onEdit(resetPictographLegend)}>还原位置</button>
          </div>
          <button className="button quiet" onClick={() => update({ ...DEFAULT_PICTOGRAPH_LEGEND, legendText: style.legendText })}>
            <RotateCcw size={15} /> 还原图例样式
          </button>
        </>}
      </div>
    </aside>
  );
}
