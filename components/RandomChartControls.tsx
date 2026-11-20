import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Dices } from 'lucide-react';
import { EXERCISE_TOPICS, EXERCISE_TYPES } from '../randomChart';
import type { ExerciseTopic, ExerciseType } from '../randomChart';

interface Props {
  topic: ExerciseTopic;
  exercise: ExerciseType;
  exercises: ExerciseType[];
  onTopicChange: (topic: ExerciseTopic) => void;
  onExerciseChange: (exercise: ExerciseType) => void;
  onGenerate: () => void;
}

export default function RandomChartControls({ topic, exercise, exercises, onTopicChange, onExerciseChange, onGenerate }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function positionMenu() {
    const button = trigger.current;
    const popup = menu.current;
    if (!button || !popup?.matches(':popover-open')) return;
    const page = button.ownerDocument.documentElement;
    const rect = button.getBoundingClientRect();
    const edge = 8;
    const gap = 6;
    const below = Math.max(0, page.clientHeight - rect.bottom - gap - edge);
    const above = Math.max(0, rect.top - gap - edge);
    const height = popup.scrollHeight + 2;
    const placeAbove = height > below && above > below;
    const maxHeight = Math.min(page.clientHeight - edge * 2, Math.max(80, placeAbove ? above : below));
    const top = placeAbove ? rect.top - gap - Math.min(height, maxHeight) : rect.bottom + gap;
    popup.style.left = `${Math.max(edge, Math.min(rect.left, page.clientWidth - popup.offsetWidth - edge))}px`;
    popup.style.top = `${Math.max(edge, Math.min(top, page.clientHeight - Math.min(height, maxHeight) - edge))}px`;
    popup.style.maxHeight = `${maxHeight}px`;
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  return (
    <div className="random-options">
      <button type="button" ref={trigger} className="button random-chart-trigger" popoverTarget={id}>
        <Dices size={16} /> 随机生成 <ChevronDown size={13} />
      </button>
      <div id={id} ref={menu} className="random-chart-controls" role="group" aria-label="随机生成设置" popover="auto"
        onToggle={event => {
          const next = event.newState === 'open';
          if (next) positionMenu();
          setOpen(next);
        }}>
        <label>出题题材<select autoFocus value={topic} onChange={event => onTopicChange(event.target.value as ExerciseTopic)}>
          {Object.entries(EXERCISE_TOPICS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select></label>
        <label>出题题型<select value={exercise} onChange={event => onExerciseChange(event.target.value as ExerciseType)}>
          {exercises.map(value => <option key={value} value={value}>{EXERCISE_TYPES[value]}</option>)}
        </select></label>
        <button type="button" className="button primary compact" onClick={() => {
          menu.current?.hidePopover();
          trigger.current?.focus({ preventScroll: true });
          onGenerate();
        }}>生成新画布</button>
      </div>
    </div>
  );
}
