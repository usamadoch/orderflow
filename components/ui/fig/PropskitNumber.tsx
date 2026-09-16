'use client';

import React, { forwardRef, useMemo, useRef } from 'react';
import { useFigElement } from './useFigElement';

export interface PropskitNumberProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  units?: string;
  steppers?: boolean;
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

export const PropskitNumber = forwardRef<HTMLElement, PropskitNumberProps>(function PropskitNumber(
  {
    label,
    value,
    min,
    max,
    step = 1,
    precision,
    units,
    steppers = true,
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
  const valueRef = useRef(value);
  valueRef.current = value;

  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    const parseVal = (e: Event): number => {
      const customEvent = e as CustomEvent<number | string>;
      const target = e.target as HTMLElement & { value?: string | number };
      const raw = customEvent.detail !== undefined ? customEvent.detail : target.value;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return isNaN(num) ? valueRef.current : num;
    };

    if (onInput || onChange) {
      handlers.input = (e: Event) => {
        const parsed = parseVal(e);
        if (onInput) {
          onInput(parsed);
        } else if (onChange) {
          onChange(parsed);
        }
      };
    }
    if (onChange) {
      handlers.change = (e: Event) => {
        onChange(parseVal(e));
      };
    }
    return handlers;
  }, [onChange, onInput]);

  const properties = useMemo(() => ({
    value: String(value),
    disabled: Boolean(disabled),
  }), [value, disabled]);

  const attributes = useMemo(() => ({
    label: label ?? '',
    value: String(value),
    min: min !== undefined ? String(min) : undefined,
    max: max !== undefined ? String(max) : undefined,
    step: step !== undefined ? String(step) : undefined,
    precision: precision !== undefined ? String(precision) : undefined,
    units: units || undefined,
    steppers: steppers ? true : undefined,
    direction,
    size: size || undefined,
    variant: variant || undefined,
    disabled: disabled ? true : undefined,
    id: id || undefined,
    title: title || undefined,
    'aria-label': ariaLabel || label || title || undefined,
  }), [label, value, min, max, step, precision, units, steppers, direction, size, variant, disabled, id, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <propskit-number
      ref={ref}
      label={label ?? ''}
      value={value}
      min={min}
      max={max}
      step={step}
      precision={precision}
      units={units}
      steppers={steppers ? true : undefined}
      direction={direction}
      size={size}
      variant={variant}
      disabled={disabled ? true : undefined}
      id={id}
      class={className || undefined}
    />
  );
});
