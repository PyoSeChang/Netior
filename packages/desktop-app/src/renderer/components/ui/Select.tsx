import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  selectSize?: 'default' | 'sm';
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  id,
  disabled,
  selectSize = 'default',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, buttonRef, {
    estimatedHeight: 220,
  }, dropdownRef);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) &&
          dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(!open);
  };

  const handleSelect = (optValue: string) => {
    onChange?.({ target: { value: optValue } });
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  const sizeStyle = selectSize === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-3 py-2 text-sm';

  const itemSizeStyle = selectSize === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-3 py-2 text-sm';

  return (
    <div className="relative block w-full" ref={ref}>
      <div
        ref={buttonRef}
        id={id}
        className={`flex items-center w-full ${sizeStyle} text-default bg-input border border-input rounded-lg cursor-pointer outline-none text-left transition-all duration-fast hover:border-strong focus:border-accent ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${open ? 'border-accent' : ''
          }`}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <span className={`block overflow-hidden text-ellipsis whitespace-nowrap flex-1 ${selectedOption ? '' : 'text-muted'}`}>
          {selectedOption?.label || placeholder || ''}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted ml-2 transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
      </div>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-surface-panel border border-default rounded-lg overflow-y-auto max-h-[200px] py-1"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
              visibility: dropdownPos.ready ? 'visible' : 'hidden',
              zIndex: 10001,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`block w-full ${itemSizeStyle} text-left cursor-pointer transition-colors duration-fast hover:bg-surface-hover ${opt.value === value ? 'text-accent bg-accent-muted' : 'text-default'
                  }`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};
