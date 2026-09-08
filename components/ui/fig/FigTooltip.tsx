'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigTooltipProps {
  text?: string;
  action?: 'hover' | 'click' | 'manual';
  delay?: number;
  offset?: string;
  show?: boolean;
  open?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FigTooltip = forwardRef<HTMLElement, FigTooltipProps>(function FigTooltip(
  {
    text,
    action = 'hover',
    delay,
    offset,
    show,
    open,
    className,
    children,
  },
  forwardedRef
) {
  const properties = useMemo(() => ({
    text: text || '',
    action,
    delay,
    offset,
    show: Boolean(show),
    open: Boolean(open),
  }), [text, action, delay, offset, show, open]);

  const attributes = useMemo(() => ({
    text: text || undefined,
    action: action || undefined,
    delay: delay !== undefined ? delay : undefined,
    offset: offset || undefined,
    show: show ? true : undefined,
    open: open ? true : undefined,
  }), [text, action, delay, offset, show, open]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
  });

  return (
    <fig-tooltip ref={ref} class={className || undefined}>
      {children}
    </fig-tooltip>
  );
});
