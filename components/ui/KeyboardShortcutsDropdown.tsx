'use client';

import React, { useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { FigButton, FigPopup, FigTooltip } from './fig';

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutCategory {
  category: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutCategory[] = [
  {
    category: 'Navigation & Movement',
    shortcuts: [
      { keys: ['←', '→'], label: 'Move 1 bar (chart / object)' },
      { keys: ['Ctrl', '← / →'], label: 'Move 10 bars' },
      { keys: ['↑', '↓'], label: 'Nudge 1 tick (selected)' },
      { keys: ['Ctrl', '↑ / ↓'], label: 'Zoom in / out' },
      { keys: ['Alt', 'R'], label: 'Reset & auto-scale' },
      { keys: ['Alt', 'S'], label: 'Toggle split layout' },
      { keys: ['Alt', 'Shift', 'Z'], label: 'Focus mode' },
    ],
  },
  {
    category: 'Actions & Editing',
    shortcuts: [
      { keys: ['Del / ⌫'], label: 'Delete selected' },
      { keys: ['Esc'], label: 'Deselect / cancel' },
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Y'], label: 'Redo' },
    ],
  },
  {
    category: 'Timeframe & Search',
    shortcuts: [
      { keys: ['1-9'], label: 'Type interval' },
      { keys: ['/'], label: 'Open indicators' },
      { keys: ['Ctrl', 'K'], label: 'Symbol search' },
    ],
  },
  {
    category: 'Tools & Overlays',
    shortcuts: [
      { keys: ['V'], label: 'Custom Volume Profile' },
      { keys: ['C', 'F'], label: 'Candle / Footprint' },
      { keys: ['M'], label: 'Measure tool' },
      { keys: ['[', ']'], label: 'Bucket size - / +' },
      { keys: ['S'], label: 'Sessions toggle' },
    ],
  },
];

export function KeyboardShortcutsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = 'header-keyboard-shortcuts-trigger';

  return (
    <div className="relative">
      <FigTooltip text={!isOpen ? 'Keyboard Shortcuts & Utilities' : ''}>
        <FigButton
          id={triggerId}
          variant="ghost"
          icon
          size="small"
          selected={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="Keyboard Shortcuts & Utilities"
          className="cursor-pointer text-[#8A8A8A] hover:text-white"
        >
          <Keyboard size={15} strokeWidth={2} />
        </FigButton>
      </FigTooltip>

      <FigPopup
        open={isOpen}
        anchor={`#${triggerId}`}
        position="bottom right"
        offset="0 4"
        mode="dropdown"
        dropdown
        onClose={() => setIsOpen(false)}
        className="z-[70] w-[310px] rounded-xl border border-[#282828] bg-[#181818] p-2.5 shadow-2xl select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242424] px-1.5 pb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#A0A0A0]">
            <Keyboard size={13} strokeWidth={2.2} className="text-[#3D7EFF]" />
            <span>Shortcuts & Utilities</span>
          </div>
          <FigTooltip text="Close">
            <FigButton
              variant="ghost"
              icon
              size="compact"
              onClick={() => setIsOpen(false)}
              className="h-5 w-5 text-[#787B86] hover:text-white"
            >
              <X size={12} strokeWidth={2.5} />
            </FigButton>
          </FigTooltip>
        </div>

        {/* Shortcuts Content List */}
        <div className="flex max-h-[380px] flex-col gap-2.5 overflow-y-auto px-1 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#606060]">
                {group.category}
              </span>
              <div className="flex flex-col rounded-lg bg-[#141414] border border-[#222222] p-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between py-1 px-1 border-b border-[#1E1E1E] last:border-0 text-[11px]"
                  >
                    <span className="text-[#B0B0B0]">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={`${key}-${i}`}
                          className="inline-flex items-center justify-center min-w-[18px] px-1.5 py-0.5 rounded bg-[#202020] border border-[#333333] font-mono text-[9.5px] font-semibold text-[#E0E0E0] shadow-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-2 border-t border-[#222222] pt-1.5 px-1 text-center text-[9px] text-[#555555]">
          Press any digit <kbd className="text-[#888]">1-9</kbd> on chart to type interval
        </div>
      </FigPopup>
    </div>
  );
}
