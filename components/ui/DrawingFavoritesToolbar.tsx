'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Minus, MoveRight, Ruler, Square, AlignLeft } from 'lucide-react';
import { FigTooltip } from './fig';
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
      icon: <Minus size={16} strokeWidth={1.5} />,
    },
    {
      mode: 'vertical',
      title: 'Vertical Line',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      mode: 'horizontal-ray',
      title: 'Line',
      icon: <MoveRight size={16} strokeWidth={1.5} />,
    },
    {
      mode: 'box',
      title: 'Box',
      icon: <Square size={16} strokeWidth={1.5} />,
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
    setPosition(panel.drawingToolbarPosition);
  }, [panel.drawingToolbarPosition]);

  React.useEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

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

  const getButtonClass = (active: boolean) =>
    `flex h-8 w-8 items-center justify-center p-1.5 rounded-md transition-colors m-0 border ${active
      ? 'border-[#3D7EFF] bg-[#262626] text-white shadow-sm shadow-[#3D7EFF]/20'
      : 'border-transparent text-[#909090] hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div
      ref={toolbarRef}
      className={`fixed z-[70] flex items-center p-0.5 border border-[#282828] bg-[#181818] shadow-2xl shadow-black/60 select-none ${collapsed ? 'rounded-full' : 'rounded-lg'
        }`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={startDrag}
        className="flex h-8 w-6 items-center justify-center p-1 rounded-md text-[#666666] transition-colors hover:bg-white/10 hover:text-white cursor-move m-0 border border-transparent"
        aria-label="Drag drawing toolbar"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      {collapsed ? (
        <>
          <div className="h-3.5 w-5 rounded-full bg-[#2A2A2A] mx-1" />
          <FigTooltip text="Expand toolbar">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand drawing toolbar"
              className="flex h-8 w-8 items-center justify-center p-1.5 rounded-full text-[#909090] hover:bg-white/10 hover:text-white transition-colors m-0 border border-transparent"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        </>
      ) : (
        <>
          <FigTooltip text="Volume Profile">
            <button
              type="button"
              onClick={selectProfile}
              aria-pressed={panel.isDrawMode}
              aria-label="Volume Profile"
              className={getButtonClass(panel.isDrawMode)}
            >
              <AlignLeft size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>

          <FigTooltip text="Measure">
            <button
              type="button"
              onClick={selectMeasure}
              aria-pressed={measureToolActive}
              aria-label="Measure"
              className={getButtonClass(measureToolActive)}
            >
              <Ruler size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>

          {FAVORITE_TOOLS.map(tool => {
            const active = panel.lineDrawMode === tool.mode;
            return (
              <FigTooltip key={tool.mode} text={tool.title}>
                <button
                  type="button"
                  onClick={() => selectTool(tool.mode)}
                  aria-pressed={active}
                  aria-label={tool.title}
                  className={getButtonClass(active)}
                >
                  {tool.icon}
                </button>
              </FigTooltip>
            );
          })}

          <FigTooltip text="Collapse toolbar">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse drawing toolbar"
              className="flex h-8 w-8 items-center justify-center p-1.5 rounded-md text-[#909090] hover:bg-white/10 hover:text-white transition-colors m-0 border border-transparent"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        </>
      )}
    </div>
  );
}
