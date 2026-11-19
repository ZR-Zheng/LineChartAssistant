import { useEffect, useRef } from 'react';
import ColorInput from './ColorInput';

const COLORS = [
  ['#ff0000', '红色'], ['#ffa500', '橙色'], ['#ffff00', '黄色'], ['#008000', '绿色'], ['#00ffff', '青色'], ['#0000ff', '蓝色'],
  ['#800080', '紫色'], ['#ffc0cb', '粉色'], ['#a52a2a', '棕色'], ['#ffffff', '白色'], ['#808080', '灰色'], ['#000000', '黑色'],
] as const;

function ColorPicker({ value, label, onChange, mixed = false }: {
  value: string; label: string; onChange: (color: string) => void; mixed?: boolean;
}) {
  const picker = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const control = picker.current;
      if (control?.open && !control.contains(event.target as Node)) control.open = false;
    }
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, []);

  function apply(color: string) {
    if (picker.current) picker.current.open = false;
    if (mixed || value !== color) onChange(color);
  }

  return (
    <details className="color-picker" ref={picker} onToggle={event => {
      const control = event.currentTarget;
      if (!control.open) return;
      const left = control.getBoundingClientRect().left;
      const width = control.querySelector('.color-picker-popover')?.getBoundingClientRect().width ?? 0;
      const offset = Math.min(0, document.documentElement.clientWidth - left - width - 8);
      control.style.setProperty('--palette-offset', `${offset}px`);
    }}>
      <summary aria-label={label} title={mixed ? `${label}（混合）` : label}>
        <span data-mixed={mixed || undefined} style={mixed ? undefined : { backgroundColor: value }} />
      </summary>
      <div className="color-picker-popover" aria-label={label}>
        <div className="color-swatches" role="group" aria-label="基础色">
          {COLORS.map(([color, name]) => (
            <button type="button" key={color} aria-label={name} aria-pressed={!mixed && value === color} title={name}
              style={{ backgroundColor: color }} onClick={() => apply(color)} />
          ))}
        </div>
        <label className="color-custom">自定义
          <ColorInput aria-label={`自定义${label}`} value={value} onCommit={apply} />
        </label>
      </div>
    </details>
  );
}

export default ColorPicker;
