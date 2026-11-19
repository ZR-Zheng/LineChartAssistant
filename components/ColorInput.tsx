import { useEffect, useRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onCommit: (color: string) => void;
};

function ColorInput({ value, onCommit, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.current) input.current.value = value;
  }, [value]);

  useEffect(() => {
    const control = input.current;
    if (!control) return;
    const commit = () => {
      if (control.value !== value) onCommit(control.value);
    };
    // The native input event previews colors while the picker is dragged.
    control.addEventListener('change', commit);
    return () => control.removeEventListener('change', commit);
  }, [value, onCommit]);

  return <input {...props} ref={input} type="color" defaultValue={value} />;
}

export default ColorInput;
