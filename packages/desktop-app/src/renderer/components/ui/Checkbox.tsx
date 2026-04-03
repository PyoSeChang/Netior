import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, disabled, id }) => {
  const inputId = id || `checkbox-${React.useId()}`;

  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      htmlFor={inputId}
    >
      <div className="relative flex items-center">
        <input
          id={inputId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-fast border ${
            checked
              ? 'bg-accent border-accent text-on-accent'
              : 'bg-input border-input hover:border-default'
          } ${!disabled && 'peer-focus-visible:border-accent'}`}
        >
          {checked && <Check size={11} strokeWidth={3} />}
        </div>
      </div>
      {label && <span className="text-sm text-default">{label}</span>}
    </label>
  );
};
