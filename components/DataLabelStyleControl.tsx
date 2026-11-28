import { useId, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { clamp, dataLabelStyle, setDataLabelStyle, TEXT_FONTS, TEXT_SIZE } from '../chart';
import { VALUE_FONT_SIZE } from '../chartPresentation';
import type { ChartDocument, ChartEdit, DataLabelStyle, TextFont } from '../types';
import ColorPicker from './ColorPicker';
import TextEmphasisControls from './TextEmphasisControls';

export default function DataLabelStyleControl({ chart, onEdit, seriesIndex }: {
  chart: ChartDocument; onEdit: ChartEdit; seriesIndex?: number;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const series = seriesIndex === undefined ? undefined : chart.series[seriesIndex];
  const style = dataLabelStyle(chart.style, series);
  const font = style.font ?? 'system';
  const defaultSize = chart.kind === 'pictograph' ? undefined : VALUE_FONT_SIZE;
  const size = style.size ?? defaultSize;
  const emphasis = { bold: style.bold ?? chart.kind !== 'pictograph', italic: style.italic ?? false, underline: style.underline ?? false };
  const scope = series ? `「${series.name}」的数据标签` : '整张图的数据标签';

  function mixed<Key extends keyof DataLabelStyle>(key: Key, value: DataLabelStyle[Key]) {
    return seriesIndex === undefined && chart.series.some(item => {
      const override = item.style?.dataLabel?.[key];
      return override !== undefined && override !== value;
    });
  }

  const mixedFont = mixed('font', font);
  const mixedSize = mixed('size', size);
  const sizeValue = mixedSize ? '' : String(style.size ?? '');
  const mixedColor = mixed('color', style.color);

  function change(changes: DataLabelStyle) {
    onEdit(current => setDataLabelStyle(current, changes, seriesIndex));
  }

  return (
    <>
      <button type="button" ref={trigger} className="button compact" popoverTarget={id} title={scope}>
        <SlidersHorizontal size={15} /> 标签样式
      </button>
      <div id={id} className="data-label-style-menu text-toolbar" popover="auto" role="group" aria-label={scope}
        onToggle={event => {
          if (event.newState !== 'open' || !trigger.current) return;
          const popup = event.currentTarget;
          const anchor = trigger.current.getBoundingClientRect();
          const { clientWidth, clientHeight } = popup.ownerDocument.documentElement;
          const below = anchor.bottom + 6;
          const top = below + popup.offsetHeight <= clientHeight - 8 ? below : anchor.top - popup.offsetHeight - 6;
          popup.style.left = `${Math.max(8, Math.min(anchor.left, clientWidth - popup.offsetWidth - 8))}px`;
          popup.style.top = `${Math.max(8, Math.min(top, clientHeight - popup.offsetHeight - 8))}px`;
        }}>
        <p className="text-toolbar-name" title={scope}>{scope}</p>
        <div className="data-label-style-row">
          <label>字体
            <select value={mixedFont ? '' : font} onChange={event => change({ font: event.target.value as TextFont })}>
              {mixedFont && <option value="" disabled>混合</option>}
              {Object.entries(TEXT_FONTS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
            </select>
          </label>
          <label>字号
            <input key={sizeValue} type="number" {...TEXT_SIZE} defaultValue={sizeValue}
              placeholder={mixedSize ? '混合' : defaultSize ? `默认 ${defaultSize}` : '自动'}
              onBlur={event => {
                const input = event.currentTarget;
                if (input.value === sizeValue || input.validity.badInput) { input.value = sizeValue; return; }
                const value = input.value === '' ? undefined : clamp(Math.round(input.valueAsNumber), TEXT_SIZE.min, TEXT_SIZE.max);
                input.value = String(value ?? '');
                change({ size: value });
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  event.currentTarget.value = sizeValue;
                  event.currentTarget.blur();
                }
                if (event.key === 'Enter') event.currentTarget.blur();
              }} />
          </label>
        </div>
        <div className="data-label-style-row">
          <TextEmphasisControls style={emphasis} mixed={key => mixed(key, emphasis[key])} onChange={change} />
          <div className="color-field"><span>字色</span>
            <ColorPicker label="标签文字颜色" value={style.color ?? '#485861'} mixed={mixedColor || !style.color} onChange={color => change({ color })} />
          </div>
          <button type="button" className="text-button" disabled={!mixedColor && !(series ? series.style?.dataLabel?.color : style.color)}
            onClick={() => change({ color: undefined })}>{series && chart.style.dataLabel?.color ? '跟随画布' : '自动颜色'}</button>
        </div>
      </div>
    </>
  );
}
