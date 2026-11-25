import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { AXIS_LENGTHS, AXIS_TITLE_PLACEMENTS, DEFAULT_STYLE, isAxisBreak, parseValue } from '../chart';
import type { Axis, AxisStyle, ChartDocument, ChartEdit } from '../types';
import AxisArrowheadField from './AxisArrowheadField';
import ColorPicker from './ColorPicker';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  onClose: () => void;
  axis: Axis;
  onSelectAxis: (axis: Axis) => void;
}

function AxisPanel({ chart, onEdit, onClose, axis, onSelectAxis }: Props) {
  const [error, setError] = useState('');
  const style = chart.style.axes[axis];
  const label = axis === 'x' ? 'xLabel' : 'yLabel';
  const axisName = axis === 'x' ? '横轴' : '纵轴';

  useEffect(() => setError(''), [axis]);

  function update<Key extends keyof AxisStyle>(key: Key, value: AxisStyle[Key]) {
    onEdit(current => {
      const previous = current.style.axes[axis];
      if (previous[key] === value) return current;
      const axes = { ...current.style.axes, [axis]: { ...previous, [key]: value } };
      const labelPositions = { ...current.labelPositions };
      if (key === 'titlePlacement') delete labelPositions[label];
      return {
        ...current, style: { ...current.style, axes }, labelPositions,
        scaleExtent: key === 'maximum' || key === 'omitted' ? null : current.scaleExtent,
      };
    });
  }

  function commitNumber(input: HTMLInputElement, key: 'maximum' | 'interval') {
    try {
      const value = parseValue(input.value);
      if (key === 'maximum') {
        if (value !== null && value < 0) throw new Error();
        if (value !== null && style.omitted && value < style.omitted.to) {
          input.value = String(style.maximum ?? '');
          setError('最大值须达到断轴终点，或先移除断轴。');
          return;
        }
        update('maximum', value ?? undefined);
      } else {
        if (value === null || value <= 0 || axis === 'x' && !Number.isSafeInteger(value)) throw new Error();
        update('interval', value);
      }
      setError('');
    } catch {
      input.value = String(style[key] ?? '');
      setError(key === 'maximum' ? '纵轴最大值应大于或等于 0。留空使用自动范围。'
        : axis === 'x' ? '类别间隔须为正整数。' : '刻度间隔须大于 0。');
    }
  }

  function finishNumber(event: KeyboardEvent<HTMLInputElement>, previous?: number) {
    if (event.key === 'Escape') event.currentTarget.value = String(previous ?? '');
    if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
  }

  function resetAxis() {
    setError('');
    onEdit(current => {
      const labelPositions = { ...current.labelPositions };
      delete labelPositions[label];
      return {
        ...current, labelPositions, scaleExtent: axis === 'y' ? null : current.scaleExtent,
        style: { ...current.style, axes: { ...current.style.axes, [axis]: DEFAULT_STYLE.axes[axis] } },
      };
    });
  }

  return (
    <aside className="data-panel axis-panel" id="axis-panel" aria-label="坐标轴设置">
      <div className="panel-heading">
        <h2>坐标轴</h2>
        <button className="icon-button" title="关闭坐标轴设置" aria-label="关闭坐标轴设置" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="panel-content">
        <div className="axis-panel-top">
          <div className="segmented axis-tabs" role="group" aria-label="选择坐标轴">
            {(['x', 'y'] as const).map(value => (
              <button key={value} aria-pressed={axis === value} onClick={() => { onSelectAxis(value); setError(''); }}>
                {value === 'x' ? '横轴' : '纵轴'}
              </button>
            ))}
          </div>
          <label className="origin-toggle">
            <input type="checkbox" checked={chart.style.showOrigin} onChange={event => {
              const showOrigin = event.target.checked;
              onEdit(current => ({ ...current, style: { ...current.style, showOrigin } }));
            }} />
            显示原点 0
          </label>
        </div>
        <div className="axis-settings" key={axis}>
          <AxisArrowheadField style={chart.style} onEdit={onEdit} />
          <div className="axis-row">
            <label>轴线样式
              <select value={style.line} onChange={event => update('line', event.target.value as AxisStyle['line'])}>
                <option value="arrow">带箭头</option><option value="solid">实线</option><option value="dashed">虚线</option>
              </select>
            </label>
            <label>线宽
              <select value={style.width} onChange={event => update('width', Number(event.target.value))}>
                {[1, 1.6, 2, 3, 4, 5].map(width => <option key={width} value={width}>{width}</option>)}
                {![1, 1.6, 2, 3, 4, 5].includes(style.width) && <option value={style.width}>{style.width}</option>}
              </select>
            </label>
            <div className="axis-color color-field"><span>颜色</span>
              <ColorPicker label="轴线颜色" value={style.color} onChange={color => update('color', color)} />
            </div>
          </div>
          <div className="axis-row axis-range-row">
            <LengthControl axis={axis} value={style.length} onCommit={value => update('length', value)} />
            {axis === 'y' && (
              <label>最大值
                <input key={style.maximum ?? 'auto'} type="text" inputMode="decimal" aria-label="纵轴最大值"
                  placeholder="自动" defaultValue={style.maximum ?? ''}
                  onBlur={event => commitNumber(event.currentTarget, 'maximum')}
                  onKeyDown={event => finishNumber(event, style.maximum)} />
              </label>
            )}
          </div>
          {axis === 'y' && <AxisBreakFields style={style}
            onApply={range => update('omitted', range)} />}
          <div className="axis-row">
            <label>刻度线位置
              <select value={style.tickPosition} onChange={event => update('tickPosition', event.target.value as AxisStyle['tickPosition'])}>
                <option value="outside">外侧</option><option value="inside">内侧</option><option value="cross">穿过轴线</option>
              </select>
            </label>
            <label>刻度线长度
              <select value={style.tickLength} onChange={event => update('tickLength', Number(event.target.value))}>
                <option value="0">隐藏</option>
                {[3, 5, 8, 12, 18, 20].map(length => <option key={length} value={length}>{length}</option>)}
                {![0, 3, 5, 8, 12, 18, 20].includes(style.tickLength) && <option value={style.tickLength}>{style.tickLength}</option>}
              </select>
            </label>
          </div>
          <div className="axis-row">
            <label>刻度显示
              <select value={style.tickMode} onChange={event => {
                update('tickMode', event.target.value as AxisStyle['tickMode']);
                setError('');
              }}>
                <option value="auto">自动</option>
                <option value="all">全部显示</option>
                <option value="interval">按间隔显示</option>
              </select>
            </label>
            {style.tickMode === 'interval' && (
              <label>{axis === 'x' ? '类别间隔' : '刻度间隔'}
                <input key={style.interval} type="text" inputMode={axis === 'x' ? 'numeric' : 'decimal'}
                  defaultValue={style.interval} aria-describedby="axis-tick-hint"
                  onBlur={event => commitNumber(event.currentTarget, 'interval')}
                  onKeyDown={event => finishNumber(event, style.interval)} />
              </label>
            )}
          </div>
          {style.tickMode !== 'auto' && (
            <small id="axis-tick-hint">
              {style.tickMode === 'all' ? (axis === 'x' ? '每个类别显示一个刻度。' : '每单位显示一个刻度，小数范围使用更细的刻度。')
                : (axis === 'x' ? '填 2 会隔一个类别标注。' : '填 5 会按 5、10、15 等数值标注。')}
            </small>
          )}
          {error && <p className="panel-error" role="alert">{error}</p>}
          <div className="axis-checks">
            <label><input type="checkbox" checked={style.visible !== false} onChange={event => update('visible', event.target.checked)} />
              显示{axisName}</label>
            <label><input type="checkbox" checked={style.showValues} onChange={event => update('showValues', event.target.checked)} />
              {axis === 'x' ? '显示类别标签' : '显示刻度标签'}</label>
            <label><input type="checkbox" checked={style.showLabel} onChange={event => update('showLabel', event.target.checked)} /> 显示轴标题</label>
          </div>
          {style.showLabel && (
            <label>轴标题位置
              <select value={style.titlePlacement} onChange={event => update('titlePlacement', event.target.value as AxisStyle['titlePlacement'])}>
                {Object.entries(AXIS_TITLE_PLACEMENTS[axis]).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="axis-panel-footer">
          <button className="text-button" disabled={!chart.labelPositions[label]} onClick={() => onEdit(current => {
            const labelPositions = { ...current.labelPositions };
            delete labelPositions[label];
            return { ...current, labelPositions };
          })}>还原标题位置</button>
          <button className="text-button" onClick={resetAxis}><RotateCcw size={14} /> 重置{axisName}</button>
        </div>
      </div>
    </aside>
  );
}

function AxisBreakFields({ style, onApply }: { style: AxisStyle; onApply: (range: AxisStyle['omitted']) => void }) {
  const [open, setOpen] = useState(Boolean(style.omitted));
  const [error, setError] = useState('');
  return (
    <details className="axis-break-settings" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>纵轴断轴{style.omitted ? '（已启用）' : ''}</summary>
      <form onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          const range = { from: parseValue(String(form.get('from'))), to: parseValue(String(form.get('to'))) };
          if (!isAxisBreak(range)) throw new Error('请填写递增的断轴起点和终点，省略区间不能跨过原点 0。');
          if (style.maximum !== undefined && range.to > style.maximum) throw new Error('断轴终点须小于或等于纵轴最大值。');
          setError('');
          onApply(range);
        } catch (caught) { setError(caught.message); }
      }}>
        <div className="axis-row">
          <label>省略起点<input key={style.omitted?.from ?? 'empty'} type="text" name="from" inputMode="decimal"
            defaultValue={style.omitted?.from} placeholder="例如 2" autoComplete="off" /></label>
          <label>省略终点<input key={style.omitted?.to ?? 'empty'} type="text" name="to" inputMode="decimal"
            defaultValue={style.omitted?.to} placeholder="例如 10" autoComplete="off" /></label>
        </div>
        <small>起点和终点保留显示，区间内部以断轴符号省略。</small>
        {error && <p role="alert" className="panel-error">{error}</p>}
        <div className="panel-actions">
          <button className="button compact">应用断轴</button>
          {style.omitted && <button type="button" className="text-button" onClick={() => onApply(undefined)}>移除断轴</button>}
        </div>
      </form>
    </details>
  );
}

function LengthControl({ axis, value, onCommit }: { axis: Axis; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const commit = (next: number) => {
    setDraft(null);
    if (next !== value) onCommit(next);
  };
  return (
    <label className="axis-length">
      <span>轴线长度 <output>{draft ?? value}</output></span>
      <input type="range" {...AXIS_LENGTHS[axis]} value={draft ?? value}
        onChange={event => setDraft(Number(event.target.value))}
        onPointerUp={event => commit(Number(event.currentTarget.value))}
        onPointerCancel={() => setDraft(null)}
        onKeyUp={event => {
          if (draft !== null) commit(Number(event.currentTarget.value));
        }}
        onBlur={() => { if (draft !== null) commit(draft); }} />
    </label>
  );
}

export default AxisPanel;
