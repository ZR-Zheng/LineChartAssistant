import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { PICTOGRAPH_SYMBOLS, SYMBOL_GROUPS } from '../pictographSymbols';
import type { PictographSymbol } from '../pictographSymbols';
import type { PictographStyle } from '../types';
import PictographIcon from './PictographIcon';

const symbols = Object.entries(PICTOGRAPH_SYMBOLS);

export default function PictographSymbolField({ label, value, color, outline, mode, onChange, onModeChange, onReset }: {
  label: string; value: PictographSymbol; color: string; outline: boolean; mode: PictographStyle['colorMode'];
  onChange: (value: PictographSymbol) => void; onModeChange: (mode: PictographStyle['colorMode']) => void; onReset?: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [group, setGroup] = useState(PICTOGRAPH_SYMBOLS[value][2]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const colored = mode === 'color';
  const search = query.trim().toLowerCase();
  const choices = symbols.filter(([key, [name, , category]]) => search ? name.includes(search) || key.includes(search) : category === group);

  useLayoutEffect(() => {
    if (!open) return;
    const button = trigger.current;
    const panel = popup.current;
    const toolbar = button.closest('.toolbar-scroll');

    function position() {
      const anchor = button.getBoundingClientRect();
      if (toolbar) {
        const bounds = toolbar.getBoundingClientRect();
        if (anchor.right <= bounds.left || anchor.left >= bounds.right) {
          panel.hidePopover();
          return;
        }
      }
      const { clientWidth, clientHeight } = document.documentElement;
      const below = anchor.bottom + 6;
      const top = below + panel.offsetHeight <= clientHeight - 8 ? below : anchor.top - panel.offsetHeight - 6;
      panel.style.left = `${Math.max(8, Math.min(anchor.left, clientWidth - panel.offsetWidth - 8))}px`;
      panel.style.top = `${Math.max(8, Math.min(top, clientHeight - panel.offsetHeight - 8))}px`;
    }

    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open, group, search]);

  function select(symbol: PictographSymbol | null) {
    popup.current.hidePopover();
    trigger.current.focus();
    if (symbol === null) onReset?.();
    else if (symbol !== value) onChange(symbol);
  }

  return (
    <div className="pictograph-symbol-field">
      <span>{label}</span>
      <button type="button" ref={trigger} className="button compact pictograph-symbol-trigger" popoverTarget={id}
        aria-label={`${label}：${PICTOGRAPH_SYMBOLS[value][0]}`} title={PICTOGRAPH_SYMBOLS[value][0]}
        onClick={() => {
          setGroup(PICTOGRAPH_SYMBOLS[value][2]);
          setQuery('');
        }}>
        <PictographIcon name={value} color={color} outline={outline} colored={colored} size={24} />
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={id} ref={popup} popover="auto" className="pictograph-symbol-popover" aria-label={label}
        onToggle={event => setOpen(event.currentTarget.matches(':popover-open'))}>
        {open && <>
          <div className="segmented" role="group" aria-label="图符配色">
            <button type="button" aria-pressed={!colored} onClick={() => { if (colored) onModeChange('single'); }}>单色</button>
            <button type="button" aria-pressed={colored} onClick={() => { if (!colored) onModeChange('color'); }}>彩色</button>
          </div>
          <input className="pictograph-symbol-search" type="search" aria-label="搜索图符" placeholder="搜索图符" value={query}
            onChange={event => setQuery(event.currentTarget.value)} />
          <div className="pictograph-symbol-groups" role="group" aria-label="图符分类">
            {Object.entries(SYMBOL_GROUPS).map(([key, title]) => (
              <button className="button compact" type="button" key={key} aria-pressed={!search && key === group}
                onClick={() => { setQuery(''); setGroup(key as keyof typeof SYMBOL_GROUPS); }}>{title}</button>
            ))}
          </div>
          {!choices.length && <small role="status">没有匹配的图符</small>}
          <div className="pictograph-symbol-grid" role="group" aria-label={search ? '图符搜索结果' : SYMBOL_GROUPS[group]}>
            {choices.map(([key, [name]]) => (
              <button type="button" className="button icon-button" key={key} aria-label={name} title={name} aria-pressed={key === value}
                onClick={() => select(key as PictographSymbol)}>
                <PictographIcon name={key as PictographSymbol} color={color} outline={outline} colored={colored} size={27} />
              </button>
            ))}
            {onReset && <button type="button" className="button icon-button" aria-label="恢复默认图符" title="恢复默认图符"
              onClick={() => select(null)}><RotateCcw size={19} /></button>}
          </div>
        </>}
      </div>
    </div>
  );
}
