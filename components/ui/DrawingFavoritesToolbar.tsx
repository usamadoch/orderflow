'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Minus,
  MoveRight,
  Ruler,
  Square,
  AlignLeft,
  Crosshair,
  MousePointer,
  Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FigTooltip } from './fig';
import {
  LineDrawMode,
  PanelId,
  DrawingToolbarItemId,
  DEFAULT_DRAWING_TOOLBAR_ORDER,
  useChartStore,
} from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';

interface DrawingFavoritesToolbarProps {
  panelId: PanelId;
}

interface SortableToolbarItemProps {
  id: DrawingToolbarItemId;
  disabled?: boolean;
  children: React.ReactNode;
}

function SortableToolbarItem({ id, disabled, children }: SortableToolbarItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const dragAttributes = { ...attributes } as Record<string, unknown>;
  delete dragAttributes.role;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragAttributes}
      {...listeners}
      className={`relative flex items-center ${
        isDragging
          ? 'opacity-25 rounded-md border border-dashed border-[#3D7EFF] bg-[#3D7EFF]/10 scale-95'
          : ''
      }`}
    >
      {children}
    </div>
  );
}

export function DrawingFavoritesToolbar({ panelId }: DrawingFavoritesToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const panel = useChartStore(s => s.panels[panelId]);
  const cursorType = panel.cursorType ?? 'crosshair';
  const measureToolActive = useChartRuntimeStore(s => s.panels[panelId]?.measureToolActive ?? false);
  const setLineDrawMode = useChartStore(s => s.setLineDrawMode);
  const setDrawMode = useChartStore(s => s.setDrawMode);
  const setCursorType = useChartStore(s => s.setCursorType);
  const setMeasureToolActive = useChartRuntimeStore(s => s.setMeasureToolActive);
  const setDrawingToolbarPosition = useChartStore(s => s.setDrawingToolbarPosition);
  const setDrawingToolbarItemOrder = useChartStore(s => s.setDrawingToolbarItemOrder);

  const [localOrder, setLocalOrder] = React.useState<DrawingToolbarItemId[]>(
    () => panel.drawingToolbarItemOrder ?? DEFAULT_DRAWING_TOOLBAR_ORDER
  );

  React.useEffect(() => {
    if (panel.drawingToolbarItemOrder && panel.drawingToolbarItemOrder.length > 0) {
      setLocalOrder(panel.drawingToolbarItemOrder);
    }
  }, [panel.drawingToolbarItemOrder]);

  const isDefaultPosition = React.useCallback((pos: { x: number; y: number }) => {
    return pos.x < 0 || (pos.x === 16 && (pos.y === 48 || pos.y === 16));
  }, []);

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

  const getDefaultPosition = React.useCallback(() => {
    const toolbar = toolbarRef.current;
    const panelElement = toolbar?.closest(`[data-chart-panel-id="${panelId}"]`) as HTMLElement | null;
    const toolbarWidth = toolbar?.offsetWidth || 260;
    const panelRect = panelElement?.getBoundingClientRect();
    const panelLeft = panelRect ? panelRect.left : 0;
    const panelWidth = panelRect ? panelRect.width : (typeof window !== 'undefined' ? window.innerWidth : 1200);
    const panelTop = panelRect ? panelRect.top : 40;

    const x = Math.round(panelLeft + (panelWidth - toolbarWidth) / 2);
    const y = Math.max(8, Math.round(panelTop + 4));
    return clampPosition({ x, y });
  }, [clampPosition, panelId]);

  const [position, setPosition] = React.useState(() => {
    if (panel.drawingToolbarPosition.x < 0 || (panel.drawingToolbarPosition.x === 16 && (panel.drawingToolbarPosition.y === 48 || panel.drawingToolbarPosition.y === 16))) {
      return { x: 500, y: 44 };
    }
    return panel.drawingToolbarPosition;
  });
  const [collapsed, setCollapsed] = React.useState(false);
  const [cursorDropdownOpen, setCursorDropdownOpen] = React.useState(false);
  const cursorDropdownRef = React.useRef<HTMLDivElement | null>(null);

  // Drag-and-drop reordering state with @dnd-kit
  const [activeId, setActiveId] = React.useState<DrawingToolbarItemId | null>(null);
  const initialOrderRef = React.useRef<DrawingToolbarItemId[] | null>(null);
  const currentOrderRef = React.useRef<DrawingToolbarItemId[]>(localOrder);
  currentOrderRef.current = localOrder;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setCursorDropdownOpen(false);
    setActiveId(event.active.id as DrawingToolbarItemId);
    initialOrderRef.current = localOrder;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder(items => {
      const oldIndex = items.indexOf(active.id as DrawingToolbarItemId);
      const newIndex = items.indexOf(over.id as DrawingToolbarItemId);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      if (initialOrderRef.current) {
        setLocalOrder(initialOrderRef.current);
        setDrawingToolbarItemOrder(panelId, initialOrderRef.current);
      }
      return;
    }
    const current = currentOrderRef.current;
    const oldIndex = current.indexOf(active.id as DrawingToolbarItemId);
    const newIndex = current.indexOf(over.id as DrawingToolbarItemId);
    let finalOrder = current;
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      finalOrder = arrayMove(current, oldIndex, newIndex);
      setLocalOrder(finalOrder);
    }
    setDrawingToolbarItemOrder(panelId, finalOrder);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    if (initialOrderRef.current) {
      setLocalOrder(initialOrderRef.current);
    }
  };

  React.useEffect(() => {
    if (!cursorDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cursorDropdownRef.current && !cursorDropdownRef.current.contains(event.target as Node)) {
        setCursorDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [cursorDropdownOpen]);

  React.useLayoutEffect(() => {
    if (isDefaultPosition(panel.drawingToolbarPosition)) {
      setPosition(getDefaultPosition());
    } else {
      setPosition(panel.drawingToolbarPosition);
    }
  }, [getDefaultPosition, isDefaultPosition, panel.drawingToolbarPosition]);

  React.useEffect(() => {
    const handleResize = () => {
      setPosition(prev => (isDefaultPosition(prev) ? getDefaultPosition() : clampPosition(prev)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, getDefaultPosition, isDefaultPosition]);

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

  // Pointer drag for moving the whole toolbar
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
    `flex h-8 w-8 items-center justify-center p-1.5 rounded-md transition-colors m-0 border select-none cursor-grab ${
      active
        ? 'border-[#3D7EFF] bg-[#262626] text-white shadow-sm shadow-[#3D7EFF]/20'
        : 'border-transparent text-[#909090] hover:bg-white/10 hover:text-white'
    }`;

  const tooltipText = (text: string) => (activeId ? '' : text);

  const renderItemIcon = (itemId: DrawingToolbarItemId) => {
    switch (itemId) {
      case 'cursor':
        return cursorType === 'pointer' ? (
          <MousePointer size={16} strokeWidth={1.5} />
        ) : (
          <Crosshair size={16} strokeWidth={1.5} />
        );
      case 'profile':
        return <AlignLeft size={16} strokeWidth={1.5} />;
      case 'measure':
        return <Ruler size={16} strokeWidth={1.5} />;
      case 'horizontal':
        return <Minus size={16} strokeWidth={1.5} />;
      case 'vertical':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round" />
          </svg>
        );
      case 'horizontal-ray':
        return <MoveRight size={16} strokeWidth={1.5} />;
      case 'box':
        return <Square size={16} strokeWidth={1.5} />;
      default:
        return null;
    }
  };

  const renderItem = (itemId: DrawingToolbarItemId) => {
    switch (itemId) {
      case 'cursor':
        return (
          <div ref={cursorDropdownRef} className="relative">
            <FigTooltip text={tooltipText(cursorType === 'pointer' ? 'Pointer' : 'Crosshair')}>
              <button
                type="button"
                onClick={() => {
                  setCursorDropdownOpen(prev => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={cursorDropdownOpen}
                aria-label="Cursor Selection"
                className={getButtonClass(cursorDropdownOpen)}
              >
                {cursorType === 'pointer' ? (
                  <MousePointer size={16} strokeWidth={1.5} />
                ) : (
                  <Crosshair size={16} strokeWidth={1.5} />
                )}
              </button>
            </FigTooltip>

            {cursorDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-36 rounded-lg border border-[#282828] bg-[#181818] p-1 shadow-2xl shadow-black/80 z-[80] flex flex-col gap-0.5"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCursorType(panelId, 'crosshair');
                    setCursorDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    cursorType === 'crosshair'
                      ? 'bg-[#262626] text-white'
                      : 'text-[#909090] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Crosshair size={14} strokeWidth={1.5} />
                    Crosshair
                  </span>
                  {cursorType === 'crosshair' && <Check size={14} className="text-[#3D7EFF]" strokeWidth={2} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCursorType(panelId, 'pointer');
                    setCursorDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    cursorType === 'pointer'
                      ? 'bg-[#262626] text-white'
                      : 'text-[#909090] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MousePointer size={14} strokeWidth={1.5} />
                    Pointer
                  </span>
                  {cursorType === 'pointer' && <Check size={14} className="text-[#3D7EFF]" strokeWidth={2} />}
                </button>
              </div>
            )}
          </div>
        );

      case 'profile':
        return (
          <FigTooltip text={tooltipText('Custom Volume Profile (V)')}>
            <button
              type="button"
              onClick={selectProfile}
              aria-pressed={panel.isDrawMode}
              aria-label="Custom Volume Profile"
              className={getButtonClass(panel.isDrawMode)}
            >
              <AlignLeft size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        );

      case 'measure':
        return (
          <FigTooltip text={tooltipText('Measure')}>
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
        );

      case 'horizontal':
        return (
          <FigTooltip text={tooltipText('Horizontal Line')}>
            <button
              type="button"
              onClick={() => selectTool('horizontal')}
              aria-pressed={panel.lineDrawMode === 'horizontal'}
              aria-label="Horizontal Line"
              className={getButtonClass(panel.lineDrawMode === 'horizontal')}
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        );

      case 'vertical':
        return (
          <FigTooltip text={tooltipText('Vertical Line')}>
            <button
              type="button"
              onClick={() => selectTool('vertical')}
              aria-pressed={panel.lineDrawMode === 'vertical'}
              aria-label="Vertical Line"
              className={getButtonClass(panel.lineDrawMode === 'vertical')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round" />
              </svg>
            </button>
          </FigTooltip>
        );

      case 'horizontal-ray':
        return (
          <FigTooltip text={tooltipText('Line')}>
            <button
              type="button"
              onClick={() => selectTool('horizontal-ray')}
              aria-pressed={panel.lineDrawMode === 'horizontal-ray'}
              aria-label="Line"
              className={getButtonClass(panel.lineDrawMode === 'horizontal-ray')}
            >
              <MoveRight size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        );

      case 'box':
        return (
          <FigTooltip text={tooltipText('Box')}>
            <button
              type="button"
              onClick={() => selectTool('box')}
              aria-pressed={panel.lineDrawMode === 'box'}
              aria-label="Box"
              className={getButtonClass(panel.lineDrawMode === 'box')}
            >
              <Square size={16} strokeWidth={1.5} />
            </button>
          </FigTooltip>
        );

      default:
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={toolbarRef}
        className={`fixed z-[70] flex items-center p-0.5 border border-[#282828] bg-[#181818] shadow-2xl shadow-black/60 select-none ${
          collapsed ? 'rounded-full' : 'rounded-lg'
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
            <SortableContext items={localOrder} strategy={horizontalListSortingStrategy}>
              {localOrder.map((itemId) => (
                <SortableToolbarItem
                  key={itemId}
                  id={itemId}
                  disabled={cursorDropdownOpen}
                >
                  {renderItem(itemId)}
                </SortableToolbarItem>
              ))}
            </SortableContext>

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

      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeId ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#3D7EFF] bg-[#222222] text-white shadow-2xl shadow-black/90 scale-110 cursor-grabbing ring-2 ring-[#3D7EFF]/50 select-none pointer-events-none">
            {renderItemIcon(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
