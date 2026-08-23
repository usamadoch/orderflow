'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Minus, MoveRight, Ruler, Square, AlignLeft } from 'lucide-react';
import { LineDrawMode, PanelId, useChartStore } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';

const FAVORITE_TOOLS: Array<{
  mode: Exclude<LineDrawMode, 'none'>;
  title: string;
  icon: React.ReactNode;
}> = [
  {
    mode: 'horizontal',
    title: 'Horizontal Line',
    icon: <Minus size={15} strokeWidth={2.7} />,
  },
  {
    mode: 'vertical',
    title: 'Vertical Line',
    icon: <span className="text-[16px] leading-none">|</span>,
  },
  {
    mode: 'horizontal-ray',
    title: 'Line',
    icon: <MoveRight size={15} strokeWidth={2.5} />,
  },
  {
    mode: 'box',
    title: 'Box',
    icon: <Square size={14} strokeWidth={2.3} />,
  },
];

interface DrawingFavoritesToolbarProps {
  panelId: PanelId;
}

export function DrawingFavoritesToolbar({ panelId }: DrawingFavoritesToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const panel = useChartStore(s => s.panels[panelId]);
  const measureToolActive = useChartRuntimeStore(s => s.panels[panelId].measureToolActive);
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);
  const setDrawMode = useChartStore(s => s.setDrawMode);
  const setMeasureToolActive = useChartRuntimeStore(s => s.setMeasureToolActive);
  const setDrawingToolbarPosition = useChartStore(s => s.setDrawingToolbarPosition);
  const [position, setPosition] = React.useState(panel.drawingToolbarPosition);
  const [collapsed, setCollapsed] = React.useState(false);

  const clampPosition = React.useCallback((nextPosition: { x: number; y: number }) => {
    const toolbar = toolbarRef.current;
    const panelElement = toolbar?.closest(`[data-chart-panel-id="${panelId}"]`) as HTMLElement | null;
    if (!panelElement || !toolbar) return nextPosition;

    const panelRect = panelElement.getBoundingClientRect();
    const minX = panelId === 'right' ? panelRect.left + 8 : 8;
    const maxX =
      panelId === 'left'
        ? panelRect.right - toolbar.offsetWidth - 8
        : window.innerWidth - toolbar.offsetWidth - 8;
    const maxY = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);
    const x =
      maxX < minX
        ? panelId === 'left'
          ? maxX
          : minX
        : Math.min(maxX, Math.max(minX, nextPosition.x));

    return {
      x,
      y: Math.min(maxY, Math.max(8, nextPosition.y)),
    };
  }, [panelId]);

  React.useEffect(() => {
    setPosition(clampPosition(panel.drawingToolbarPosition));
  }, [clampPosition, panel.drawingToolbarPosition]);

  const selectTool = (mode: Exclude<LineDrawMode, 'none'>) => {
    setMeasureToolActive(panelId, false);
    setLineDrawMode(panelId, panel.lineDrawMode === mode ? 'none' : mode);
  };

  const selectProfile = () => {
    setMeasureToolActive(panelId, false);
    setDrawMode(panelId, !panel.isDrawMode);
  };

  const selectMeasure = () => {
    setMeasureToolActive(panelId, !measureToolActive);
  };

  const buttonClass = (active: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150 ${
      active
        ? 'border border-[#3D7EFF] bg-[#1F1F1F] text-[#E8E8E8] shadow-sm shadow-[#3D7EFF]/20'
        : 'border border-transparent text-[#787B86] hover:bg-[#1F1F1F] hover:text-[#E8E8E8]'
    }`;

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const startPointer = { x: event.clientX, y: event.clientY };
    const startPosition = clampPosition(position);
    let latestPosition = startPosition;

    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      latestPosition = clampPosition({
        x: startPosition.x + moveEvent.clientX - startPointer.x,
        y: startPosition.y + moveEvent.clientY - startPointer.y,
      });
      setPosition(latestPosition);
    };

    const handlePointerUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setDrawingToolbarPosition(panelId, latestPosition);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      ref={toolbarRef}
      className={`popup-contrast fixed z-40 flex items-center gap-0.5 border border-[#252525] bg-[#1F1F1F]/95 p-0.5 shadow-2xl shadow-black/40 backdrop-blur-sm ${
        collapsed ? 'rounded-full' : 'rounded-lg'
      }`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={startDrag}
        className="flex h-7 w-6 items-center justify-center rounded-md text-[#4A4A4A] transition-colors hover:bg-[#1F1F1F] hover:text-[#A5A5A5] cursor-move"
        title="Drag drawing toolbar"
        aria-label="Drag drawing toolbar"
      >
        <GripVertical size={15} strokeWidth={2.4} />
      </button>

      {collapsed ? (
        <>
          <div className="h-3.5 w-5 rounded-full bg-[#2A2A2A]" />
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#787B86] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
            title="Expand drawing toolbar"
            aria-label="Expand drawing toolbar"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </>
      ) : (
        <>
          <div className="h-5 w-px bg-[#1F1F1F]" />

          <button
            type="button"
            onClick={selectProfile}
            className={buttonClass(panel.isDrawMode)}
            title="Profile"
            aria-pressed={panel.isDrawMode}
            aria-label="Profile"
          >
            <AlignLeft size={14} strokeWidth={2.3} />
          </button>

          <button
            type="button"
            onClick={selectMeasure}
            className={buttonClass(measureToolActive)}
            title="Measure"
            aria-pressed={measureToolActive}
            aria-label="Measure"
          >
            <Ruler size={14} strokeWidth={2.4} />
          </button>

          <div className="h-5 w-px bg-[#1F1F1F]" />

          {FAVORITE_TOOLS.map(tool => {
            const active = panel.lineDrawMode === tool.mode;
            return (
              <button
                key={tool.mode}
                type="button"
                onClick={() => selectTool(tool.mode)}
                className={buttonClass(active)}
                title={tool.title}
                aria-pressed={active}
                aria-label={tool.title}
              >
                {tool.icon}
              </button>
            );
          })}

          <div className="h-5 w-px bg-[#1F1F1F]" />

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#787B86] transition-colors hover:bg-[#1F1F1F] hover:text-[#E8E8E8]"
            title="Collapse drawing toolbar"
            aria-label="Collapse drawing toolbar"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  );
}
