'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface PropskitSliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  units?: string;
  type?: 'range' | 'opacity' | 'hue' | 'stepper' | 'delta';
  onChange?: (value: number) => void;
  onInput?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  size?: 'small' | 'large' | '';
  variant?: 'minimal' | '';
  id?: string;
  title?: string;
  'aria-label'?: string;
}

export const PropskitSlider = forwardRef<HTMLElement, PropskitSliderProps>(function PropskitSlider(
  {
    label,
    value,
    min,
    max,
    step = 1,
    units,
    type = 'range',
    onChange,
    onInput,
    disabled = false,
    className,
    direction = 'horizontal',
    size,
    variant,
    id,
    title,
    'aria-label': ariaLabel,
  },
  forwardedRef
) {
  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    const parseVal = (e: Event): number => {
      const customEvent = e as CustomEvent<number | string>;
      const target = e.target as HTMLElement & { value?: string | number };
      const raw = customEvent.detail !== undefined ? customEvent.detail : target.value;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return isNaN(num) ? value : num;
    };

    if (onInput) {
      handlers.input = (e: Event) => {
        onInput(parseVal(e));
      };
    }
    if (onChange) {
      handlers.change = (e: Event) => {
        onChange(parseVal(e));
      };
    }
    return handlers;
  }, [onChange, onInput, value]);

  const properties = useMemo(() => ({
    value: String(value),
    disabled: Boolean(disabled),
  }), [value, disabled]);

  const attributes = useMemo(() => ({
    label: label || undefined,
    value: String(value),
    min: String(min),
    max: String(max),
    step: String(step),
    units: units || undefined,
    type,
    direction,
    size: size || undefined,
    variant: variant || undefined,
    disabled: disabled ? true : undefined,
    id: id || undefined,
    title: title || undefined,
    'aria-label': ariaLabel || label || title || undefined,
  }), [label, value, min, max, step, units, type, direction, size, variant, disabled, id, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <propskit-slider
      ref={ref}
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      units={units}
      type={type}
      direction={direction}
      size={size}
      variant={variant}
      disabled={disabled ? true : undefined}
      id={id}
      class={className || undefined}
    />
  );
});
