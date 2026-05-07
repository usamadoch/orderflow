import { useRef, useEffect } from 'react';

export function usePanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onRedraw: () => void,
  getCandlesLength: () => number,
  priceAxisWidth: number,
  timeAxisHeight: number
) {
  const scrollOffset = useRef(0);
  const barWidth = useRef(12);
  const priceCenter = useRef<number | null>(null);
  const priceRange = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragMode = useRef<'chart' | 'price' | 'time'>('chart');
  const lastX = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x > rect.width - priceAxisWidth) {
        dragMode.current = 'price';
        canvas.style.cursor = 'ns-resize';
      } else if (y > rect.height - timeAxisHeight) {
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

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      if (dragMode.current === 'chart') {
        // Free panning in time
        scrollOffset.current += deltaX;
        
        // Panning in price
        if (priceCenter.current !== null && priceRange.current !== null) {
          const rect = canvas.getBoundingClientRect();
          const chartHeight = rect.height - timeAxisHeight;
          const pricePerPixel = priceRange.current / chartHeight;
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
        // Dragging right (deltaX > 0) -> zoom in -> barWidth increases
        barWidth.current = Math.max(1, barWidth.current * (1 + deltaX * sensitivity));
      }
      
      onRedraw();
    };

    const onMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'crosshair';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomSensitivity = 0.002;
      const zoomFactor = 1 + e.deltaY * zoomSensitivity;
      
      barWidth.current = Math.max(1, barWidth.current / zoomFactor);
      onRedraw();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    canvas.style.cursor = 'crosshair';

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvasRef, onRedraw, getCandlesLength, priceAxisWidth, timeAxisHeight]);

  return { scrollOffset, barWidth, priceCenter, priceRange };
}

