import { Bold, Italic, Trash2, Underline, X } from 'lucide-react';
import { AXIS_TITLE_PLACEMENTS, clamp, isNote, TEXT_FONTS, TEXT_SIZE } from '../chart';
import type { Axis, TextFont, TextStyle, TextTarget, TitlePlacement } from '../types';
import ColorPicker from './ColorPicker';

interface Props {
  target: TextTarget;
  style: TextStyle;
  onChange: (changes: Partial<TextStyle>) => void;
  onClose?: () => void;
  onDelete?: () => void;
  titlePlacement?: { axis: Axis; value: TitlePlacement; onChange: (value: TitlePlacement) => void };
}

function TextToolbar({ target, style, onChange, onClose, onDelete, titlePlacement }: Props) {
  const name = typeof target === 'number' ? '类别标签' : isNote(target) ? '文字标注' : {
    title: '图表标题', xLabel: '横轴标题', yLabel: '纵轴标题',
  }[target];
  return (
    <div className="drawing-toolbar text-toolbar" role="group" aria-label="文字格式">
      <span className="text-toolbar-name">{name}</span>
      <label>字体
        <select value={style.font} onChange={event => onChange({ font: event.target.value as TextFont })}>
          {Object.entries(TEXT_FONTS).map(([value, font]) => <option key={value} value={value}>{font.label}</option>)}
        </select>
      </label>
      <label>字号
        <input key={`${target}:${style.size}`} type="number" {...TEXT_SIZE} defaultValue={style.size}
          onBlur={event => {
            const input = event.currentTarget;
            const value = input.valueAsNumber;
            const size = Number.isFinite(value) ? clamp(Math.round(value), TEXT_SIZE.min, TEXT_SIZE.max) : style.size;
            input.value = String(size);
            if (size !== style.size) onChange({ size });
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') event.currentTarget.value = String(style.size);
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
          }} />
      </label>
      <div className="color-field"><span>颜色</span>
        <ColorPicker label="文字颜色" value={style.color} onChange={color => onChange({ color })} />
      </div>
      <div className="text-format-actions" role="group" aria-label="文字样式">
        <button className="icon-button text-weight" aria-pressed={style.bold} aria-label="加粗" title="加粗"
          onClick={() => onChange({ bold: !style.bold })}><Bold size={17} /></button>
        <button className="icon-button text-weight" aria-pressed={style.italic} aria-label="斜体" title="斜体"
          onClick={() => onChange({ italic: !style.italic })}><Italic size={17} /></button>
        <button className="icon-button text-weight" aria-pressed={style.underline} aria-label="下划线" title="下划线"
          onClick={() => onChange({ underline: !style.underline })}><Underline size={17} /></button>
      </div>
      {isNote(target) && (
        <label>对齐
          <select value={style.alignment} onChange={event => onChange({ alignment: event.target.value as TextStyle['alignment'] })}>
            <option value="start">左对齐</option><option value="middle">居中</option><option value="end">右对齐</option>
          </select>
        </label>
      )}
      {titlePlacement && (
        <label>轴标题位置
          <select value={titlePlacement.value} onChange={event => titlePlacement.onChange(event.target.value as TitlePlacement)}>
            {Object.entries(AXIS_TITLE_PLACEMENTS[titlePlacement.axis]).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
          </select>
        </label>
      )}
      {onDelete && <button className="icon-button" aria-label="删除文字标注" title="删除文字标注" onClick={onDelete}><Trash2 size={16} /></button>}
      {onClose && <button className="icon-button text-toolbar-close" aria-label="关闭文字格式" title="关闭文字格式"
        onClick={onClose}><X size={17} /></button>}
    </div>
  );
}

export default TextToolbar;
