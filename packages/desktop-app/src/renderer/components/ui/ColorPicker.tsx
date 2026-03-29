import React, { useState } from 'react';
import { Input } from './Input';

export interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, presets = DEFAULT_PRESETS }) => {
  const [customInput, setCustomInput] = useState('');

  const handleCustomSubmit = () => {
    const hex = customInput.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
      onChange?.(hex);
      setCustomInput('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-6 h-6 rounded-full border-2 transition-all ${
              color === value ? 'border-default scale-110' : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange?.(color)}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {value && (
          <div className="w-6 h-6 rounded border border-subtle" style={{ backgroundColor: value }} />
        )}
        <Input
          inputSize="sm"
          className="flex-1"
          placeholder="#hex"
          value={customInput || value || ''}
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={handleCustomSubmit}
          onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
        />
      </div>
    </div>
  );
};
