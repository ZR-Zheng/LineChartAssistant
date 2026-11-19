import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ColorInput from './ColorInput';

const COLORS = [
  ['#ff0000', '红色'], ['#ffa500', '橙色'], ['#ffff00', '黄色'], ['#008000', '绿色'], ['#00ffff', '青色'], ['#0000ff', '蓝色'],
  ['#800080', '紫色'], ['#ffc0cb', '粉色'], ['#a52a2a', '棕色'], ['#ffffff', '白色'], ['#808080', '灰色'], ['#000000', '黑色'],
] as const;

function ColorPicker({ value, label, onChange, mixed = false }: {
  value: string; label: string; onChange: (color: string) => void; mixed?: boolean;
}) {
  const picker = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const control = picker.current;
      if (control?.open && !control.contains(event.target as Node)) control.open = false;
    }
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const control = picker.current;
    const panel = popover.current;
    const viewport = control.closest('.toolbar-scroll');

    function position() {
      const anchor = trigger.current.getBoundingClientRect();
      if (viewport) {
        const bounds = viewport.getBoundingClientRect();
        if (anchor.right <= bounds.left || anchor.left >= bounds.right) {
          control.open = false;
          return;
        }
      }
      const { clientWidth, clientHeight } = document.documentElement;
      const { offsetWidth, offsetHeight } = panel;
      const below = anchor.bottom + 6;
      const top = below + offsetHeight <= clientHeight - 8 ? below : anchor.top - offsetHeight - 6;
      panel.style.left = `${Math.max(8, Math.min(anchor.left, clientWidth - offsetWidth - 8))}px`;
      panel.style.top = `${Math.max(8, top)}px`;
    }

    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open]);

  function apply(color: string) {
    if (picker.current) picker.current.open = false;
    if (mixed || value !== color) onChange(color);
  }

  return (
    <details className="color-picker" ref={picker} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => {
      if (event.key !== 'Escape' || !event.currentTarget.open) return;
      event.stopPropagation();
      event.currentTarget.open = false;
      trigger.current.focus();
    }}>
      <summary ref={trigger} aria-label={label} title={mixed ? `${label}（混合）` : label}>
        <span data-mixed={mixed || undefined} style={mixed ? undefined : { backgroundColor: value }} />
      </summary>
      <div className="color-picker-popover" aria-label={label} ref={popover}>
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
