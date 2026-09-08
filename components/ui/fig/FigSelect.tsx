'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigSelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FigSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: Array<FigSelectOptionItem> | string;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

export const FigSelect = forwardRef<HTMLElement, FigSelectProps>(function FigSelect(
  {
    value,
    onChange,
    options,
    label,
    disabled = false,
    className,
    id,
    title,
    'aria-label': ariaLabel,
    children,
  },
  forwardedRef
) {
  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    if (onChange) {
      const handleSelect = (e: Event) => {
        const customEvent = e as CustomEvent<string>;
        const target = e.target as HTMLElement & { value?: string };
        const nextVal = customEvent.detail !== undefined && typeof customEvent.detail === 'string'
          ? customEvent.detail
          : target.value ?? target.getAttribute('value') ?? '';
        onChange(nextVal);
      };
      handlers.change = handleSelect;
      handlers.input = handleSelect;
    }
    return handlers;
  }, [onChange]);

  const optionsAttr = useMemo(() => {
    if (!options) return undefined;
    if (typeof options === 'string') return options;
    return JSON.stringify(options.map((opt) => ({ value: opt.value, label: opt.label })));
  }, [options]);

  const properties = useMemo(() => ({
    value: value !== undefined ? String(value) : undefined,
    disabled: Boolean(disabled),
  }), [value, disabled]);

  const attributes = useMemo(() => ({
    value: value !== undefined ? String(value) : undefined,
    options: optionsAttr,
    label: label || undefined,
    disabled: disabled ? true : undefined,
    id: id || undefined,
    title: title || undefined,
    'aria-label': ariaLabel || label || title || undefined,
  }), [value, optionsAttr, label, disabled, id, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <fig-select
      ref={ref}
      value={value}
      options={optionsAttr}
      label={label}
      disabled={disabled ? true : undefined}
      id={id}
      class={className || undefined}
    >
      {Array.isArray(options) ? (
        <fig-select-options slot="panel">
          {options.map((opt) => (
            <fig-select-option
              key={opt.value}
              value={opt.value}
              label={opt.label}
              selected={value === opt.value ? true : undefined}
              disabled={opt.disabled ? true : undefined}
            >
              {opt.label}
            </fig-select-option>
          ))}
        </fig-select-options>
      ) : (
        children
      )}
    </fig-select>
  );
});
