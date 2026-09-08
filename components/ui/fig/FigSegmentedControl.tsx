'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigSegmentOption {
  value: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
}

export interface FigSegmentProps {
  value: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent | MouseEvent) => void;
}

export const FigSegment = forwardRef<HTMLElement, FigSegmentProps>(function FigSegment(
  {
    value,
    selected,
    disabled = false,
    className,
    title,
    'aria-label': ariaLabel,
    children,
    onClick,
  },
  forwardedRef
) {
  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    if (onClick) {
      handlers.click = (e: Event) => {
        onClick(e as unknown as React.MouseEvent);
      };
    }
    return handlers;
  }, [onClick]);

  const properties = useMemo(() => ({
    value: String(value),
    selected: Boolean(selected),
    disabled: Boolean(disabled),
  }), [value, selected, disabled]);

  const attributes = useMemo(() => ({
    value: String(value),
    selected: selected ? true : undefined,
    disabled: disabled ? true : undefined,
    title: title || undefined,
    'aria-label': ariaLabel || title || undefined,
  }), [value, selected, disabled, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <fig-segment
      ref={ref}
      value={value}
      selected={selected ? true : undefined}
      disabled={disabled ? true : undefined}
      class={`${className ? `${className} ` : ''}cursor-pointer`}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      onClick={onClick}
    >
      {children}
    </fig-segment>
  );
});

export interface FigSegmentedControlProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: FigSegmentOption[];
  disabled?: boolean;
  size?: 'small' | 'large' | 'compact';
  full?: boolean;
  animated?: boolean;
  sizing?: 'equal' | 'auto';
  name?: string;
  id?: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

export const FigSegmentedControl = forwardRef<HTMLElement, FigSegmentedControlProps>(function FigSegmentedControl(
  {
    value,
    onChange,
    options,
    disabled = false,
    size,
    full = false,
    animated = true,
    sizing,
    name,
    id,
    className,
    title,
    'aria-label': ariaLabel,
    children,
  },
  forwardedRef
) {
  const events = useMemo<Record<string, (e: Event) => void>>(() => {
    const handlers: Record<string, (e: Event) => void> = {};
    if (onChange) {
      const handleSelection = (e: Event) => {
        const customEvent = e as CustomEvent<string>;
        const target = e.target as HTMLElement & { value?: string };
        const segment = target.closest('fig-segment');
        const nextValue =
          (customEvent.detail !== undefined && typeof customEvent.detail === 'string' && customEvent.detail) ||
          segment?.getAttribute('value') ||
          target.value ||
          target.getAttribute('value') ||
          '';
        if (nextValue) {
          onChange(nextValue);
        }
      };
      handlers.change = handleSelection;
      handlers.input = handleSelection;
      handlers.click = handleSelection;
    }
    return handlers;
  }, [onChange]);

  const properties = useMemo(() => ({
    value: value !== undefined ? String(value) : undefined,
    disabled: Boolean(disabled),
  }), [value, disabled]);

  const attributes = useMemo(() => ({
    value: value !== undefined ? String(value) : undefined,
    disabled: disabled ? true : undefined,
    size: size || undefined,
    full: full ? true : undefined,
    animated: animated ? true : undefined,
    sizing: sizing || undefined,
    name: name || undefined,
    id: id || undefined,
    title: title || undefined,
    'aria-label': ariaLabel || title || undefined,
  }), [value, disabled, size, full, animated, sizing, name, id, title, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  return (
    <fig-segmented-control
      ref={ref}
      value={value}
      size={size}
      full={full ? true : undefined}
      animated={animated ? true : undefined}
      sizing={sizing}
      disabled={disabled ? true : undefined}
      class={`${className ? `${className} ` : ''}cursor-pointer`}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      onClick={(e: React.MouseEvent) => {
        if (disabled || !onChange) return;
        const target = e.target as HTMLElement;
        const segment = target.closest('fig-segment');
        const segmentValue = segment?.getAttribute('value');
        if (segmentValue && segment?.getAttribute('disabled') !== 'true') {
          onChange(segmentValue);
        }
      }}
    >
      {options
        ? options.map((opt) => (
            <FigSegment
              key={opt.value}
              value={opt.value}
              selected={value === opt.value}
              disabled={opt.disabled}
              title={opt.title}
              aria-label={opt['aria-label']}
              onClick={() => {
                if (!disabled && !opt.disabled && onChange) {
                  onChange(opt.value);
                }
              }}
            >
              {opt.icon && <span className="inline-flex items-center mr-1.5">{opt.icon}</span>}
              {opt.label ?? opt.value}
            </FigSegment>
          ))
        : children}
    </fig-segmented-control>
  );
});
