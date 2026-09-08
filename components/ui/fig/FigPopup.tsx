'use client';

import React, { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef } from 'react';
import { useFigElement } from './useFigElement';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface FigPopupProps extends React.HTMLAttributes<HTMLDialogElement> {
  open?: boolean;
  anchor?: string | HTMLElement | null;
  position?: string;
  offset?: string | number;
  variant?: 'popover' | 'tooltip' | string;
  theme?: string;
  drag?: boolean;
  handle?: string;
  autoresize?: boolean;
  closedby?: 'any' | 'none' | 'closerequest' | string;
  title?: string;
  dropdown?: boolean;
  mode?: 'dropdown' | 'modal';
  onClose?: () => void;
  children?: React.ReactNode;
}

export const FigPopup = forwardRef<HTMLDialogElement, FigPopupProps>(function FigPopup(
  {
    open = false,
    anchor,
    position = 'bottom left',
    offset = '6 0',
    variant,
    theme,
    drag,
    handle,
    autoresize,
    closedby = 'any',
    title,
    dropdown = false,
    mode,
    onClose,
    className = '',
    style,
    children,
    ...restProps
  },
  forwardedRef
) {
  const localRef = useRef<HTMLDialogElement>(null);
  useImperativeHandle(forwardedRef, () => localRef.current as HTMLDialogElement);

  const isDropdown = mode === 'dropdown' || (mode === undefined && dropdown === true);

  useFigElement(localRef, {
    properties: {
      open,
      anchor: anchor ?? undefined,
    },
    attributes: {
      is: 'fig-popup',
      anchor: typeof anchor === 'string' ? anchor : undefined,
      position,
      offset: offset !== undefined ? String(offset) : undefined,
      variant,
      theme,
      drag: drag ? 'true' : undefined,
      handle,
      autoresize: autoresize ? 'true' : undefined,
      closedby,
      title,
    },
    events: {
      close: () => {
        onClose?.();
      },
    },
  });

  // Additional safety: listen for popover toggle events if browser uses native Popover API
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;

    const handleToggle = (e: Event) => {
      // ToggleEvent in Popover API has newState property
      const toggleEvent = e as Event & { newState?: string };
      if (toggleEvent.newState === 'closed') {
        onClose?.();
      }
    };

    el.addEventListener('toggle', handleToggle);
    return () => {
      el.removeEventListener('toggle', handleToggle);
    };
  }, [onClose]);

  // Dropdown-specific positioning directly below trigger/button — executed synchronously before browser paint
  useIsomorphicLayoutEffect(() => {
    if (!open || !isDropdown) return;
    const el = localRef.current;
    if (!el) return;

    const updatePosition = () => {
      let triggerEl: HTMLElement | null = null;
      if (typeof anchor === 'string' && anchor.length > 0) {
        triggerEl = document.querySelector(anchor);
      } else if (anchor && typeof anchor === 'object' && 'getBoundingClientRect' in anchor) {
        triggerEl = anchor as HTMLElement;
      }
      if (!triggerEl) {
        triggerEl = el.parentElement?.querySelector('button, fig-button') || (el.previousElementSibling as HTMLElement | null);
      }
      if (!triggerEl) return;

      const rect = triggerEl.getBoundingClientRect();
      const popupWidth = el.offsetWidth || 240;
      const popupHeight = el.offsetHeight || 200;

      // Parse offset tokens (e.g. "0 4")
      let offsetX = 0;
      let offsetY = 4;
      if (typeof offset === 'string') {
        const parts = offset.trim().split(/\s+/).map((p) => parseFloat(p) || 0);
        if (parts.length === 1) {
          offsetY = parts[0];
        } else if (parts.length >= 2) {
          offsetX = parts[0];
          offsetY = parts[1];
        }
      } else if (typeof offset === 'number') {
        offsetY = offset;
      }

      // Vertical placement
      let top = rect.bottom + offsetY;
      if (position.includes('top')) {
        top = rect.top - popupHeight - offsetY;
      }

      // Horizontal placement: support right-aligned (top-right corner under trigger), center, and left
      let left = rect.left + offsetX;
      if (position.includes('right')) {
        left = rect.right - popupWidth - offsetX;
      } else if (position.includes('center')) {
        left = rect.left + (rect.width - popupWidth) / 2 + offsetX;
      }

      // Viewport safety clamping (8px viewport margin)
      if (left + popupWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popupWidth - 8);
      }
      if (left < 8) {
        left = 8;
      }

      if (top + popupHeight > window.innerHeight - 8) {
        if (rect.top - popupHeight - offsetY > 0) {
          top = rect.top - popupHeight - offsetY;
        }
      }
      if (top < 8) {
        top = 8;
      }

      el.style.position = 'fixed';
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.margin = '0';
      el.style.bottom = 'auto';
      el.style.right = 'auto';
    };

    // Position synchronously on the initial frame before paint
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const handlePointerDown = (e: PointerEvent) => {
      let triggerEl: HTMLElement | null = null;
      if (typeof anchor === 'string' && anchor.length > 0) {
        triggerEl = document.querySelector(anchor);
      } else if (anchor && typeof anchor === 'object' && 'getBoundingClientRect' in anchor) {
        triggerEl = anchor as HTMLElement;
      }
      if (!triggerEl) {
        triggerEl = el.parentElement?.querySelector('button, fig-button') || (el.previousElementSibling as HTMLElement | null);
      }

      const target = e.target as Node | null;
      if (target && !el.contains(target) && (!triggerEl || !triggerEl.contains(target))) {
        onClose?.();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open, isDropdown, anchor, position, offset, onClose]);

  return (
    <dialog
      ref={localRef}
      is="fig-popup"
      open={open}
      anchor={typeof anchor === 'string' ? anchor : undefined}
      data-dropdown={isDropdown ? 'true' : undefined}
      data-mode={isDropdown ? 'dropdown' : 'modal'}
      position={position}
      offset={offset}
      variant={variant}
      theme={theme}
      closedby={closedby as 'any' | 'none' | 'closerequest'}
      className={className}
      style={{
        ...(isDropdown ? { position: 'fixed', margin: 0 } : {}),
        ...style,
      }}
      {...restProps}
    >
      {children}
    </dialog>
  );
});
