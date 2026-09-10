'use client';

import React, { forwardRef, useMemo } from 'react';
import { useFigElement } from './useFigElement';

export interface FigTooltipProps {
  text?: string;
  action?: 'hover' | 'click' | 'manual';
  delay?: number;
  offset?: string;
  position?: string;
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
    offset = '4 4',
    position = 'bottom center',
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
    position,
    show: Boolean(show),
    open: Boolean(open),
  }), [text, action, delay, offset, position, show, open]);

  const attributes = useMemo(() => ({
    text: text || undefined,
    action: action || undefined,
    delay: delay !== undefined ? delay : undefined,
    offset: offset || undefined,
    position: position || undefined,
    show: show ? true : undefined,
    open: open ? true : undefined,
  }), [text, action, delay, offset, position, show, open]);

  const ref = useFigElement<HTMLElement>(forwardedRef, {
    properties,
    attributes,
  });

  React.useEffect(() => {
    const el = (ref as React.RefObject<HTMLElement>)?.current;
    if (!el) return;

    interface FigTooltipCustomElement extends HTMLElement {
      popup?: HTMLElement | null;
      render?: () => void;
      showPopup?: (...args: unknown[]) => unknown;
      __tooltipPatched?: boolean;
    }

    const customEl = el as FigTooltipCustomElement;
    const proto = Object.getPrototypeOf(customEl) as FigTooltipCustomElement;
    const target = typeof customEl.showPopup === 'function' ? customEl : proto;
    const origShowPopup = target.showPopup;

    if (typeof origShowPopup === 'function' && !customEl.__tooltipPatched) {
      customEl.__tooltipPatched = true;
      customEl.showPopup = function (...args: unknown[]) {
        if (!this.popup) {
          this.render?.();
        }
        if (this.popup) {
          const targetPos = this.getAttribute('position') || position || 'bottom center';
          const targetOff = this.getAttribute('offset') || offset || '4 4';
          this.popup.setAttribute('position', targetPos);
          this.popup.setAttribute('offset', targetOff);
        }
        return origShowPopup.apply(this, args);
      };
    }
  }, [ref, position, offset]);

  return (
    <fig-tooltip ref={ref} class={className || undefined}>
      {children}
    </fig-tooltip>
  );
});
