import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import { PICTOGRAPH_SYMBOLS, SYMBOL_GROUPS } from '../pictographSymbols';
import type { PictographSymbol } from '../pictographSymbols';
import type { PictographStyle } from '../types';
import PictographIcon from './PictographIcon';

const symbols = (Object.keys(PICTOGRAPH_SYMBOLS) as PictographSymbol[]).map(id => {
  const [name, category, code] = PICTOGRAPH_SYMBOLS[id];
  const emoji = String.fromCodePoint(...code.split('_').map(part => Number.parseInt(part, 16)));
  return { id, name, category, search: `${name} ${id.toLowerCase()} ${emoji}`.replaceAll('\uFE0F', '') };
});

type ColorMode = PictographStyle['colorMode'];

export function iconPickerPosition(anchor: Pick<DOMRect, 'left' | 'top' | 'bottom'>, viewportWidth: number, viewportHeight: number) {
  const margin = 8;
  const gap = 6;
  const below = viewportHeight - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  const opensBelow = below >= 240 || below >= above;
  const height = Math.max(0, Math.min(400, viewportHeight - 2 * margin, Math.max(210, opensBelow ? below : above)));
  const width = Math.max(0, Math.min(354, viewportWidth - 2 * margin));
  const top = opensBelow ? anchor.bottom + gap : anchor.top - height - gap;
  return {
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
    left: Math.max(margin, Math.min(anchor.left, viewportWidth - width - margin)),
    width, height,
  };
}

export default function PictographSymbolField({ label, value, color, outline, mode, onChange, onModeChange, onReset,
  resetLabel = '恢复默认图标' }: {
  label: string; value: PictographSymbol | null; color: string; outline: boolean; mode: ColorMode;
  onChange: (value: PictographSymbol, mode: ColorMode) => void; onModeChange: (mode: ColorMode) => void;
  onReset?: () => void; resetLabel?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const selected = value === null ? null : PICTOGRAPH_SYMBOLS[value];
  const [group, setGroup] = useState(selected?.[1] ?? 'shapes');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draftMode, setDraftMode] = useState(mode);
  const previewMode = selected ? mode : draftMode;
  const colored = previewMode === 'color';
  const search = query.trim().toLowerCase().replaceAll('\uFE0F', '');
  const choices = open ? symbols.filter(symbol => search ? symbol.search.includes(search) : symbol.category === group) : [];

  useLayoutEffect(() => {
    if (!open) return;
    const button = trigger.current;
    const panel = popup.current;
    if (!button || !panel) return;
    const toolbar = button.closest('.toolbar-scroll');
    const sidebar = button.closest('.data-panel');

    function position(event?: Event) {
      if (event?.target instanceof Node && panel.contains(event.target)) return;
      const anchor = button.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      const sidebarBounds = sidebar?.getBoundingClientRect();
      if (anchor.bottom <= Math.max(0, sidebarBounds?.top ?? 0)
        || anchor.top >= Math.min(clientHeight, sidebarBounds?.bottom ?? clientHeight)) {
        panel.hidePopover();
        return;
      }
      if (toolbar) {
        const bounds = toolbar.getBoundingClientRect();
        if (anchor.right <= bounds.left || anchor.left >= bounds.right) {
          panel.hidePopover();
          return;
        }
      }
      const { top, left, width, height } = iconPickerPosition(anchor, clientWidth, clientHeight);
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      panel.dataset.positioned = '';
    }

    position();
    if (panel.matches(':popover-open')) searchInput.current?.focus({ preventScroll: true });
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      delete panel.dataset.positioned;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (results.current) results.current.scrollTop = 0;
  }, [group, search]);

  function select(symbol: PictographSymbol | null) {
    popup.current.hidePopover();
    trigger.current.focus({ preventScroll: true });
    if (symbol === null) onReset?.();
    else if (symbol !== value) onChange(symbol, previewMode);
  }

  function changeMode(next: ColorMode) {
    if (next === previewMode) return;
    if (selected) onModeChange(next);
    else setDraftMode(next);
  }

  return (
    <div className="pictograph-symbol-field">
      <span>{label}</span>
      <button type="button" ref={trigger} className="button compact pictograph-symbol-trigger" popoverTarget={id}
        aria-label={`${label}：${selected?.[0] ?? '选择图标'}`} title={selected?.[0]}
        onClick={() => {
          setGroup(selected?.[1] ?? 'shapes');
          setQuery('');
          setDraftMode(mode);
        }}>
        {selected ? <PictographIcon name={value} color={color} outline={outline} colored={colored} size={24} /> : '选择图标'}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={id} ref={popup} popover="auto" className="pictograph-symbol-popover" aria-label={label}
        onToggle={event => setOpen(event.newState === 'open')}
        onKeyDown={event => {
          if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.hidePopover();
          trigger.current?.focus({ preventScroll: true });
        }}>
        {open && <>
          <div className="pictograph-symbol-actions">
            <div className="segmented" role="group" aria-label="图标配色">
              <button type="button" aria-pressed={!colored} onClick={() => changeMode('single')}>单色</button>
              <button type="button" aria-pressed={colored} onClick={() => changeMode('color')}>彩色</button>
            </div>
            {onReset && <button type="button" className="button compact" onClick={() => select(null)}>
              <RotateCcw size={15} /> {resetLabel}
            </button>}
          </div>
          <label className="pictograph-symbol-search-field">
            <Search size={15} aria-hidden="true" />
            <input ref={searchInput} className="pictograph-symbol-search" type="search" aria-label="搜索图标" placeholder="搜索图标" value={query}
              onChange={event => setQuery(event.currentTarget.value)} />
          </label>
          <div className="pictograph-symbol-groups" role="group" aria-label="图标分类">
            {Object.entries(SYMBOL_GROUPS).map(([key, title]) => (
              <button className="button compact" type="button" key={key} aria-pressed={!search && key === group}
                onClick={() => { setQuery(''); setGroup(key as keyof typeof SYMBOL_GROUPS); }}>{title}</button>
            ))}
          </div>
          <div className="pictograph-symbol-results" ref={results} role="region" aria-label={search ? '图标搜索结果' : SYMBOL_GROUPS[group]}>
            {!choices.length && <p className="pictograph-symbol-empty" role="status">没有匹配的图标</p>}
            <div className="pictograph-symbol-grid">
              {choices.map(({ id, name }) => (
                <button type="button" className="button pictograph-symbol-tile" key={id} title={name} aria-pressed={id === value}
                  onClick={() => select(id)}>
                  <PictographIcon name={id} color={color} outline={outline} colored={colored} size={26} />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
