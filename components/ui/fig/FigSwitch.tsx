'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

export const FigSwitch = forwardRef<HTMLElement, FigSwitchProps>(function FigSwitch(
  {
    checked,
    onChange,
    disabled = false,
    label,
    id,
    className,
    title,
    'aria-label': ariaLabel,
  },
  forwardedRef
) {
  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    if (onChange) {
      handlers.change = (e: Event) => {
        const customEvent = e as CustomEvent<{ checked?: boolean }>;
        const nextChecked = customEvent.detail?.checked !== undefined
          ? Boolean(customEvent.detail.checked)
          : Boolean((e.target as HTMLInputElement)?.checked);
        onChange(nextChecked);
      };
    }
    return handlers;
  }, [onChange]);

  const properties = useMemo(() => ({
    checked: Boolean(checked),
    disabled: Boolean(disabled),
  }), [checked, disabled]);

  const attributes = useMemo(() => ({
    label: label || undefined,
    id: id || undefined,
    title: title || undefined,
    'aria-label': ariaLabel || label || undefined,
  }), [label, id, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <fig-switch
      ref={ref}
      class={className || undefined}
      checked={checked ? true : undefined}
      disabled={disabled ? true : undefined}
    />
  );
});
