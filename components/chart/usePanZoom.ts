import { useRef, useEffect } from 'react';

export function usePanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onRedraw: () => void,
  getCandlesLength: () => number
) {
  const scrollOffset = useRef(0);
  const barWidth = useRef(12);
  const isDragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastX.current = e.clientX;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - lastX.current;
      lastX.current = e.clientX;
      
      const maxOffset = Math.max(0, (getCandlesLength() - 1) * barWidth.current);
      scrollOffset.current = Math.min(maxOffset, Math.max(0, scrollOffset.current + deltaX));
      onRedraw();
    };

    const onMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'crosshair';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomSensitivity = 0.05;
      const zoomFactor = 1 - Math.sign(e.deltaY) * zoomSensitivity;
      
      barWidth.current = Math.min(80, Math.max(3, barWidth.current * zoomFactor));
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
  }, [canvasRef, onRedraw, getCandlesLength]);

  return { scrollOffset, barWidth };
}
