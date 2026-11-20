import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChartColumn, ChartNoAxesCombined, ChartPie, Check, ChevronDown, Shapes } from 'lucide-react';
import { CHART_KIND_LABELS } from '../chartKindLabels';
import type { ChartKind } from '../types';
import './chartKindPicker.css';

export const CHART_KIND_ICONS = {
  line: ChartNoAxesCombined, bar: ChartColumn, pie: ChartPie, pictograph: Shapes,
} as const;

const kinds = Object.keys(CHART_KIND_LABELS) as ChartKind[];

export default function ChartKindPicker({ kind, onChange }: { kind: ChartKind; onChange: (kind: ChartKind) => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const entryFocus = useRef<ChartKind>(kind);
  const [open, setOpen] = useState(false);
  const Icon = CHART_KIND_ICONS[kind];

  useLayoutEffect(() => {
    const button = trigger.current;
    const popup = menu.current;
    if (!open || !button || !popup?.matches(':popover-open')) return;

    function position(event?: Event) {
      if (event?.target instanceof Node && popup.contains(event.target)) return;
      const { clientWidth, clientHeight } = button.ownerDocument.documentElement;
      const rect = button.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= clientHeight) {
        popup.hidePopover();
        return;
      }
      const edge = 8;
      const gap = 6;
      const below = clientHeight - rect.bottom - gap - edge;
      const above = rect.top - gap - edge;
      const naturalHeight = popup.scrollHeight + 2;
      const opensAbove = naturalHeight > below && above > below;
      const height = Math.min(naturalHeight, Math.max(0, opensAbove ? above : below));
      const top = opensAbove ? rect.top - gap - height : rect.bottom + gap;

      popup.style.left = `${Math.max(edge, Math.min(rect.left, clientWidth - popup.offsetWidth - edge))}px`;
      popup.style.top = `${Math.max(edge, Math.min(top, clientHeight - height - edge))}px`;
      popup.style.maxHeight = `${height}px`;
      popup.dataset.positioned = '';
    }

    position();
    if (popup.matches(':popover-open')) popup.querySelector<HTMLButtonElement>(`[data-kind="${entryFocus.current}"]`)?.focus();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      delete popup.dataset.positioned;
    };
  }, [open]);

  function closeMenu(restoreFocus = true) {
    if (menu.current?.matches(':popover-open')) menu.current.hidePopover();
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === 'Tab') {
      requestAnimationFrame(() => closeMenu(false));
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const index = options.indexOf(event.currentTarget.ownerDocument.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }

  return (
    <div className="chart-kind-picker">
      <button type="button" ref={trigger} className="button chart-kind-trigger" popoverTarget={id}
        aria-label={`图表类型：${CHART_KIND_LABELS[kind]}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        onClick={() => { entryFocus.current = kind; }}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const popup = menu.current;
          if (!popup) return;
          entryFocus.current = event.key === 'ArrowDown' ? kinds[0] : kinds[kinds.length - 1];
          if (popup.matches(':popover-open')) popup.querySelector<HTMLButtonElement>(`[data-kind="${entryFocus.current}"]`)?.focus();
          else popup.showPopover();
        }}>
        <Icon size={17} aria-hidden="true" /> {CHART_KIND_LABELS[kind]}
        <ChevronDown className="chart-kind-chevron" size={14} aria-hidden="true" />
      </button>
      <div id={id} ref={menu} className="chart-kind-menu" popover="auto" role="menu" aria-label="图表类型"
        onToggle={event => setOpen(event.newState === 'open')} onKeyDown={navigateMenu}>
        {kinds.map(option => {
          const OptionIcon = CHART_KIND_ICONS[option];
          const selected = option === kind;
          return <button type="button" className="chart-kind-option" role="menuitemradio" key={option} data-kind={option}
            aria-checked={selected} tabIndex={-1} onClick={() => { closeMenu(); onChange(option); }}>
            <span className="chart-kind-option-icon" aria-hidden="true"><OptionIcon size={17} /></span>
            <span>{CHART_KIND_LABELS[option]}</span>
            {selected && <Check className="chart-kind-check" size={16} aria-hidden="true" />}
          </button>;
        })}
      </div>
    </div>
  );
}
