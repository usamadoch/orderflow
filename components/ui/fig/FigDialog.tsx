'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useFigElement } from './useFigElement';

export interface FigDialogProps extends React.HTMLAttributes<HTMLDialogElement> {
  open?: boolean;
  modal?: boolean;
  drag?: boolean;
  handle?: string;
  position?: string;
  closedby?: 'any' | 'none' | 'closerequest' | string;
  title?: string;
  autoresize?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
}

export const FigDialog = forwardRef<HTMLDialogElement, FigDialogProps>(function FigDialog(
  {
    open = false,
    modal = false,
    drag = false,
    handle,
    position = 'center center',
    closedby = 'any',
    title,
    autoresize,
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

  useFigElement(localRef, {
    properties: {
      modal,
      drag,
    },
    attributes: {
      is: 'fig-dialog',
      modal: modal ? 'true' : undefined,
      drag: drag ? 'true' : undefined,
      handle,
      position,
      closedby,
      title,
      autoresize: autoresize ? 'true' : undefined,
    },
    events: {
      close: () => {
        onClose?.();
      },
      cancel: () => {
        // Native Escape key on dialog triggers cancel event
        onClose?.();
      },
    },
  });

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;

    if (open) {
      if (!el.open) {
        try {
          if (modal) {
            el.showModal();
          } else {
            el.show();
          }
        } catch {
          el.open = true;
        }
      }
    } else {
      if (el.open) {
        try {
          el.close();
        } catch {
          el.open = false;
        }
      }
    }
  }, [open, modal]);

  return (
    <dialog
      ref={localRef}
      is="fig-dialog"
      modal={modal ? ('' as unknown as boolean) : undefined}
      drag={drag ? 'true' : undefined}
      handle={handle}
      position={position}
      closedby={closedby as 'any' | 'none' | 'closerequest'}
      className={className}
      style={style}
      {...restProps}
    >
      {children}
    </dialog>
  );
});
