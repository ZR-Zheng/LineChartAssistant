import { Bold, Italic, Underline } from 'lucide-react';

const FORMATS = [['bold', '加粗', Bold], ['italic', '斜体', Italic], ['underline', '下划线', Underline]] as const;
type Emphasis = typeof FORMATS[number][0];

export default function TextEmphasisControls({ style, mixed, onChange }: {
  style: Partial<Record<Emphasis, boolean>>;
  mixed?: (key: Emphasis) => boolean;
  onChange: (changes: Partial<Record<Emphasis, boolean>>) => void;
}) {
  return (
    <div className="text-format-actions" role="group" aria-label="文字样式">
      {FORMATS.map(([key, label, Icon]) => {
        const pressed = mixed?.(key) ? 'mixed' : style[key] === true;
        return <button key={key} type="button" className="icon-button text-weight" aria-pressed={pressed}
          aria-label={label} title={label} onClick={() => onChange({ [key]: pressed !== true })}><Icon size={17} /></button>;
      })}
    </div>
  );
}
