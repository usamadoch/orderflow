import { useRef, useEffect } from 'react';

export function usePanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onRedraw: () => void,
  getCandlesLength: () => number,
  priceAxisWidth: number,
  timeAxisHeight: number,
  profileWidth: number,
  initialBarWidth: number = 12,
  initialScrollOffset: number = 0,
  onBarWidthChange?: (v: number) => void,
  onScrollOffsetChange?: (v: number) => void,
  isDrawMode: boolean = false,
  canStartDrag?: (x: number, y: number) => boolean
) {
  const scrollOffset = useRef(initialScrollOffset);
  const barWidth = useRef(initialBarWidth);
  const priceCenter = useRef<number | null>(null);
  const priceRange = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragMode = useRef<'chart' | 'price' | 'time'>('chart');
  const lastX = useRef(0);
  const lastY = useRef(0);

  const mouseX = useRef<number | null>(null);
  const mouseY = useRef<number | null>(null);
  const isMouseOver = useRef(false);

  // Sync from props on initial mount (don't overwrite during interaction)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      scrollOffset.current = initialScrollOffset;
      barWidth.current = initialBarWidth;
      initializedRef.current = true;
    }
  }, [initialBarWidth, initialScrollOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isDrawMode) return;
      if (canStartDrag && !canStartDrag(x, y)) return;

      if (x > rect.width - priceAxisWidth) {
        dragMode.current = 'price';
      } else if (y > rect.height - timeAxisHeight) {
        dragMode.current = 'time';
      } else {
        dragMode.current = 'chart';
      }

      isDragging.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update crosshair position
      mouseX.current = x;
      mouseY.current = y;

      if (!isDragging.current) {
        onRedraw();
        return;
      }
      
      if (isDrawMode) return;

      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      if (dragMode.current === 'chart') {
        // Free panning in time
        scrollOffset.current += deltaX;
        onScrollOffsetChange?.(scrollOffset.current);
        
        // Panning in price
        if (priceCenter.current !== null && priceRange.current !== null) {
          const pricePerPixel = priceRange.current / (rect.height - timeAxisHeight);
          // Dragging down (deltaY > 0) -> view moves up -> looking at higher prices -> center increases
          priceCenter.current += deltaY * pricePerPixel;
        }
      } else if (dragMode.current === 'price') {
        // Vertical zoom
        if (priceRange.current !== null) {
          const sensitivity = 0.005;
          // Dragging down (deltaY > 0) -> zoom out -> range increases
          priceRange.current = Math.max(0.0001, priceRange.current * (1 + deltaY * sensitivity));
        }
      } else if (dragMode.current === 'time') {
        // Horizontal zoom
        const sensitivity = 0.01;
        const oldBarWidth = barWidth.current;
        // Dragging right (deltaX > 0) -> zoom in -> barWidth increases
        const newBarWidth = Math.max(1, oldBarWidth * (1 + deltaX * sensitivity));
        
        if (oldBarWidth !== newBarWidth) {
          const chartWidth = rect.width - priceAxisWidth;
          const drawableWidth = chartWidth - profileWidth;
          
          // Anchor zoom to current mouse position
          scrollOffset.current += (scrollOffset.current + drawableWidth - x) * (newBarWidth / oldBarWidth - 1);
          barWidth.current = newBarWidth;
          onBarWidthChange?.(newBarWidth);
          onScrollOffsetChange?.(scrollOffset.current);
        }
      }
      
      onRedraw();
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onMouseEnter = () => {
      isMouseOver.current = true;
    };

    const onMouseLeave = () => {
      isMouseOver.current = false;
      mouseX.current = null;
      mouseY.current = null;
      onRedraw();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      const chartWidth = rect.width - priceAxisWidth;
      const drawableWidth = chartWidth - profileWidth;

      // Only zoom if mouse is within the chart area (including profile but excluding price axis)
      if (x < 0 || x > chartWidth) return;

      const zoomSensitivity = 0.002;
      const zoomFactor = 1 + e.deltaY * zoomSensitivity;
      
      const oldBarWidth = barWidth.current;
      const newBarWidth = Math.max(1, oldBarWidth / zoomFactor);
      
      if (oldBarWidth !== newBarWidth) {
        // scrollOffset' = scrollOffset + (scrollOffset + drawableWidth - x) * (newBarWidth / oldBarWidth - 1)
        scrollOffset.current += (scrollOffset.current + drawableWidth - x) * (newBarWidth / oldBarWidth - 1);
        barWidth.current = newBarWidth;
        onBarWidthChange?.(newBarWidth);
        onScrollOffsetChange?.(scrollOffset.current);
        onRedraw();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvasRef, onRedraw, getCandlesLength, priceAxisWidth, timeAxisHeight, profileWidth, onBarWidthChange, onScrollOffsetChange, isDrawMode]);

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
