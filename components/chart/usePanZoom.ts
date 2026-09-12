import { useRef, useEffect } from 'react';
import { getDrawableChartWidth } from './useCoordinates';

export interface PanZoomRefs {
  scrollOffset: React.MutableRefObject<number>;
  barWidth: React.MutableRefObject<number>;
  priceCenter: React.MutableRefObject<number | null>;
  priceRange: React.MutableRefObject<number | null>;
}

export function usePanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onRedraw: (layer?: 'all' | 'overlay' | 'background' | 'live') => void,
  getCandlesLength: () => number,
  priceAxisWidth: number,
  timeAxisHeight: number,
  profileWidth: number,
  bottomPanelsHeight: number = 0,
  initialBarWidth: number = 12,
  initialScrollOffset: number = 0,
  onBarWidthChange?: (v: number) => void,
  onScrollOffsetChange?: (v: number) => void,
  isDrawMode: boolean = false,
  measureToolActive: boolean = false,
  canStartDrag?: (x: number, y: number) => boolean,
  onCrosshairChange?: (x: number | null, y: number | null) => void,
  externalRefs?: PanZoomRefs
) {
  const localScrollOffset = useRef(initialScrollOffset);
  const localBarWidth = useRef(initialBarWidth);
  const localPriceCenter = useRef<number | null>(null);
  const localPriceRange = useRef<number | null>(null);

  const scrollOffset = externalRefs?.scrollOffset || localScrollOffset;
  const barWidth = externalRefs?.barWidth || localBarWidth;
  const priceCenter = externalRefs?.priceCenter || localPriceCenter;
  const priceRange = externalRefs?.priceRange || localPriceRange;

  // Store callbacks in refs to avoid re-binding event listeners on every render
  const callbacksRef = useRef({
    onRedraw,
    getCandlesLength,
    onBarWidthChange,
    onScrollOffsetChange,
    canStartDrag,
    onCrosshairChange
  });
  
  useEffect(() => {
    callbacksRef.current = {
      onRedraw,
      getCandlesLength,
      onBarWidthChange,
      onScrollOffsetChange,
      canStartDrag,
      onCrosshairChange
    };
  });

  const isDragging = useRef(false);
  const dragMode = useRef<'chart' | 'price' | 'time'>('chart');
  const lastX = useRef(0);
  const lastY = useRef(0);

  const mouseX = useRef<number | null>(null);
  const mouseY = useRef<number | null>(null);
  const isMouseOver = useRef(false);

  // Sync from persisted panel geometry so sibling canvases stay horizontally aligned.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      scrollOffset.current = initialScrollOffset;
      barWidth.current = initialBarWidth;
      initializedRef.current = true;
      return;
    }

    if (!isDragging.current) {
      scrollOffset.current = initialScrollOffset;
      barWidth.current = initialBarWidth;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarWidth, initialScrollOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      if (isDrawMode || measureToolActive) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mouseX.current = x;
      mouseY.current = y;

      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      if (dragMode.current === 'chart') {
        canvas.style.cursor = 'grabbing';
        // Free panning in time
        scrollOffset.current += deltaX;
        callbacksRef.current.onScrollOffsetChange?.(scrollOffset.current);
        
        // Panning in price
        if (priceCenter.current !== null && priceRange.current !== null) {
          const pricePerPixel = priceRange.current / Math.max(1, rect.height - timeAxisHeight - bottomPanelsHeight);
          priceCenter.current += deltaY * pricePerPixel;
        }
      } else if (dragMode.current === 'price') {
        canvas.style.cursor = 'ns-resize';
        // Vertical zoom
        if (priceRange.current !== null) {
          const sensitivity = 0.005;
          priceRange.current = Math.max(0.0001, priceRange.current * (1 + deltaY * sensitivity));
        }
      } else if (dragMode.current === 'time') {
        canvas.style.cursor = 'ew-resize';
        // Horizontal zoom
        const sensitivity = 0.01;
        const oldBarWidth = barWidth.current;
        const newBarWidth = Math.max(1, oldBarWidth * (1 + deltaX * sensitivity));
        
        if (oldBarWidth !== newBarWidth) {
          const chartWidth = rect.width - priceAxisWidth;
          const drawableWidth = getDrawableChartWidth(chartWidth, profileWidth);
          scrollOffset.current += (scrollOffset.current + drawableWidth - x) * (newBarWidth / oldBarWidth - 1);
          barWidth.current = newBarWidth;
          callbacksRef.current.onBarWidthChange?.(newBarWidth);
          callbacksRef.current.onScrollOffsetChange?.(scrollOffset.current);
        }
      }
      
      callbacksRef.current.onRedraw();
    };

    const handleDragEnd = () => {
      if (isDragging.current) {
        isDragging.current = false;
        const rect = canvas.getBoundingClientRect();
        if (mouseX.current !== null && mouseY.current !== null) {
          const chartWidth = rect.width - priceAxisWidth;
          const chartHeight = rect.height - timeAxisHeight - bottomPanelsHeight;
          if (mouseX.current >= chartWidth) {
            canvas.style.cursor = 'ns-resize';
          } else if (mouseY.current >= chartHeight) {
            canvas.style.cursor = 'ew-resize';
          } else {
            canvas.style.cursor = 'crosshair';
          }
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isDrawMode || measureToolActive) return;
      if (callbacksRef.current.canStartDrag && !callbacksRef.current.canStartDrag(x, y)) return;

      const chartHeight = rect.height - timeAxisHeight - bottomPanelsHeight;

      if (x > rect.width - priceAxisWidth) {
        dragMode.current = 'price';
        canvas.style.cursor = 'ns-resize';
      } else if (y > chartHeight) {
        dragMode.current = 'time';
        canvas.style.cursor = 'ew-resize';
      } else {
        dragMode.current = 'chart';
        canvas.style.cursor = 'grabbing';
      }

      isDragging.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
      if (isDragging.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mouseX.current = x;
      mouseY.current = y;
      isMouseOver.current = true;

      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = rect.height - timeAxisHeight - bottomPanelsHeight;

      if (x >= chartWidth && x <= rect.width && y >= 0 && y <= rect.height) {
        canvas.style.cursor = 'ns-resize';
      } else if (y >= chartHeight && y <= rect.height && x >= 0 && x <= chartWidth) {
        canvas.style.cursor = 'ew-resize';
      }

      callbacksRef.current.onCrosshairChange?.(x, y);
      callbacksRef.current.onRedraw('overlay');
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        handleDragMove(e);
      }
    };

    const onWindowMouseUp = () => {
      if (isDragging.current) {
        handleDragEnd();
      }
    };

    const onMouseEnter = () => {
      isMouseOver.current = true;
    };

    const onMouseLeave = () => {
      isMouseOver.current = false;
      mouseX.current = null;
      mouseY.current = null;
      callbacksRef.current.onCrosshairChange?.(null, null);
      callbacksRef.current.onRedraw('overlay');
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = rect.height - timeAxisHeight - bottomPanelsHeight;
      const drawableWidth = getDrawableChartWidth(chartWidth, profileWidth);

      // Price Axis Wheel Zoom: When mouse wheel is used over the vertical price bar
      if (x >= chartWidth && x <= rect.width) {
        if (priceRange.current !== null) {
          const zoomSensitivity = 0.002;
          const zoomFactor = 1 + e.deltaY * zoomSensitivity;
          priceRange.current = Math.max(0.0001, priceRange.current * zoomFactor);
          callbacksRef.current.onRedraw();
        }
        return;
      }

      // Time Axis Wheel Zoom: When mouse wheel is used over the horizontal time bar
      if (y >= chartHeight && y <= rect.height && x >= 0 && x <= chartWidth) {
        const zoomSensitivity = 0.002;
        const zoomFactor = 1 + e.deltaY * zoomSensitivity;
        
        const oldBarWidth = barWidth.current;
        const newBarWidth = Math.max(1, oldBarWidth / zoomFactor);
        
        if (oldBarWidth !== newBarWidth) {
          scrollOffset.current += (scrollOffset.current + drawableWidth - x) * (newBarWidth / oldBarWidth - 1);
          barWidth.current = newBarWidth;
          callbacksRef.current.onBarWidthChange?.(newBarWidth);
          callbacksRef.current.onScrollOffsetChange?.(scrollOffset.current);
        }
        
        callbacksRef.current.onRedraw();
        return;
      }

      // Chart Area Wheel Zoom: When mouse is within the main chart area
      if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) return;

      const zoomSensitivity = 0.002;
      const zoomFactor = 1 + e.deltaY * zoomSensitivity;
      
      const oldBarWidth = barWidth.current;
      const newBarWidth = Math.max(1, oldBarWidth / zoomFactor);
      
      if (oldBarWidth !== newBarWidth) {
        scrollOffset.current += (scrollOffset.current + drawableWidth - x) * (newBarWidth / oldBarWidth - 1);
        barWidth.current = newBarWidth;
        callbacksRef.current.onBarWidthChange?.(newBarWidth);
        callbacksRef.current.onScrollOffsetChange?.(scrollOffset.current);
      }
      
      callbacksRef.current.onRedraw();
    };

    const onDoubleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const chartWidth = rect.width - priceAxisWidth;
      const chartHeight = rect.height - timeAxisHeight - bottomPanelsHeight;

      // Double-click on price axis auto-fits price
      if (x >= chartWidth) {
        priceCenter.current = null;
        priceRange.current = null;
        callbacksRef.current.onRedraw();
        return;
      }

      // Double-click on time axis resets time zoom
      if (y >= chartHeight) {
        barWidth.current = initialBarWidth;
        scrollOffset.current = initialScrollOffset;
        callbacksRef.current.onBarWidthChange?.(initialBarWidth);
        callbacksRef.current.onScrollOffsetChange?.(initialScrollOffset);
        callbacksRef.current.onRedraw();
        return;
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onCanvasMouseMove);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, priceAxisWidth, timeAxisHeight, bottomPanelsHeight, profileWidth, isDrawMode, measureToolActive]);

  return { 
    scrollOffset, 
    barWidth, 
    priceCenter, 
    priceRange, 
    mouseX, 
    mouseY, 
    isMouseOver,
    isDragging: isDragging,
    dragMode: dragMode
  };
}
