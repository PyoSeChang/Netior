import React from 'react';

export interface RadioGroupProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
  disabled,
  orientation = 'vertical',
}) => {
  return (
    <div className={orientation === 'horizontal' ? 'flex flex-wrap gap-3' : 'flex flex-col gap-1.5'}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={() => !disabled && onChange?.(opt.value)}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              opt.value === value ? 'border-accent' : 'border-subtle'
            }`}
          >
            {opt.value === value && <div className="w-2 h-2 rounded-full bg-accent" />}
          </div>
          <span className="text-default">{opt.label}</span>
        </label>
      ))}
    </div>
  );
};
