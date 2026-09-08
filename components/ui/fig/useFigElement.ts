'use client';

import { useEffect, useRef } from 'react';

let figInitPromise: Promise<void> | null = null;

export function ensureFigUI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!figInitPromise) {
    figInitPromise = Promise.all([
      // @ts-expect-error figui3 is a custom element library bundle
      import('@rogieking/figui3'),
      // @ts-expect-error figui3 editor bundle
      import('@rogieking/figui3/fig-editor.js'),
      // @ts-expect-error figui3 lab bundle
      import('@rogieking/figui3/fig-lab.js'),
    ]).then(() => {
      // Successfully registered custom elements
    }).catch((err) => {
      console.error('Failed to load @rogieking/figui3 bundles', err);
    });
  }
  return figInitPromise;
}

export interface UseFigElementOptions {
  properties?: Record<string, unknown>;
  attributes?: Record<string, string | boolean | number | undefined | null>;
  events?: Record<string, (e: Event) => void>;
}

export function useFigElement<T extends HTMLElement>(
  externalRef?: React.Ref<T>,
  options: UseFigElementOptions = {}
) {
  const internalRef = useRef<T>(null);
  const elementRef = (externalRef && typeof externalRef === 'object' && 'current' in externalRef)
    ? (externalRef as React.RefObject<T>)
    : internalRef;

  const { properties, attributes, events } = options;

  // 1. Ensure custom elements are registered in the browser
  useEffect(() => {
    ensureFigUI();
  }, []);

  // 2. Sync properties directly onto the DOM element
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !properties) return;

    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && (el as unknown as Record<string, unknown>)[key] !== value) {
        (el as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }, [elementRef, properties]);

  // 3. Sync attributes
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !attributes) return;

    for (const [key, value] of Object.entries(attributes)) {
      if (value === true) {
        el.setAttribute(key, '');
      } else if (value === false || value === undefined || value === null) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }, [elementRef, attributes]);

  // 4. Bind native event listeners
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !events) return;

    const entries = Object.entries(events).filter(([, handler]) => typeof handler === 'function');
    entries.forEach(([eventName, handler]) => {
      el.addEventListener(eventName, handler);
    });

    return () => {
      entries.forEach(([eventName, handler]) => {
        el.removeEventListener(eventName, handler);
      });
    };
  }, [elementRef, events]);

  return elementRef;
}
