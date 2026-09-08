'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructiveSecondary' | 'destructiveGhost' | 'destructiveLink' | 'link';
  size?: 'small' | 'compact' | 'medium' | 'large';
  icon?: boolean;
  disabled?: boolean;
  selected?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent | MouseEvent) => void;
  className?: string;
  title?: string;
  id?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

export const FigButton = forwardRef<HTMLElement, FigButtonProps>(function FigButton(
  {
    variant = 'primary',
    size,
    icon = false,
    disabled = false,
    selected = false,
    type = 'button',
    onClick,
    className,
    title,
    id,
    'aria-label': ariaLabel,
    children,
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
    disabled: Boolean(disabled),
    selected: Boolean(selected),
  }), [disabled, selected]);

  const attributes = useMemo(() => ({
    variant,
    size: size || undefined,
    icon: icon ? true : undefined,
    selected: selected ? true : undefined,
    type,
    title: title || undefined,
    id: id || undefined,
    'aria-label': ariaLabel || title || undefined,
  }), [variant, size, icon, selected, type, title, id, ariaLabel]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
    events,
  });

  // Ensure shadow root button inherits cursor: pointer
  React.useEffect(() => {
    const el = (ref as React.RefObject<HTMLElement>)?.current;
    if (!el) return;
    const applyCursor = () => {
      el.style.cursor = disabled ? 'default' : 'pointer';
      if (el.shadowRoot) {
        const btn = el.shadowRoot.querySelector('button, .fig-button-control, span') as HTMLElement | null;
        if (btn) btn.style.cursor = disabled ? 'default' : 'pointer';
      }
    };
    applyCursor();
    const timer = setTimeout(applyCursor, 0);
    return () => clearTimeout(timer);
  }, [ref, disabled]);

  return (
    <fig-button
      ref={ref}
      id={id || undefined}
      class={className || undefined}
      variant={variant}
      size={size}
      icon={icon ? true : undefined}
      selected={selected ? true : undefined}
      disabled={disabled ? true : undefined}
      type={type}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      {children}
    </fig-button>
  );
});
