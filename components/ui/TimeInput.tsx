'use client';

import React from 'react';
import { to12Hour, to24Hour } from '@/lib/utils/format';

export interface TimeInputProps {
  label: string;
  hour: number; // 0..23
  minute: number; // 0..59
  timeFormat: '12h' | '24h';
  onChange: (hour: number, minute: number) => void;
  minuteOptions?: number[];
  disabled?: boolean;
}

export function TimeInput({
  label,
  hour,
  minute,
  timeFormat,
  onChange,
  minuteOptions = [0, 15, 30, 45],
  disabled = false,
}: TimeInputProps) {
  const is12h = timeFormat === '12h';
  const { hour12, period } = to12Hour(hour);

  const handleHourChange = (valStr: string) => {
    let val = parseInt(valStr, 10);
    if (isNaN(val)) return;

    if (is12h) {
      if (val < 1) val = 12;
      if (val > 12) val = 1;
      const hour24 = to24Hour(val, period);
      onChange(hour24, minute);
    } else {
      if (val < 0) val = 23;
      if (val > 23) val = 0;
      onChange(val, minute);
    }
  };

  const handlePeriodToggle = (newPeriod: 'AM' | 'PM') => {
    if (newPeriod === period) return;
    const hour24 = to24Hour(hour12, newPeriod);
    onChange(hour24, minute);
  };

  const handleMinuteChange = (newMin: number) => {
    onChange(hour, newMin);
  };

  return (
    <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-2 rounded-lg border border-[#1F1F1F]">
      <label className="text-[9px] font-bold text-text-dim/60 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1">
        {/* Hour input */}
        <input
          type="number"
          value={is12h ? hour12 : hour}
          disabled={disabled}
          onChange={(e) => handleHourChange(e.target.value)}
          className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-main font-mono focus:border-accent focus:outline-none"
          min={is12h ? 1 : 0}
          max={is12h ? 12 : 23}
          step="1"
        />

        <span className="text-text-dim/40 font-bold">:</span>

        {/* Minute select */}
        <select
          value={minute}
          disabled={disabled}
          onChange={(e) => handleMinuteChange(Number(e.target.value))}
          className="w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded px-1 py-0.5 text-center text-[12px] font-bold text-main font-mono appearance-none cursor-pointer focus:border-accent focus:outline-none"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m.toString().padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* 12h AM/PM toggle */}
        {is12h && (
          <div className="flex items-center gap-0.5 bg-[#141414] p-0.5 rounded border border-[#2a2a2a] shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('AM')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition-all duration-150 ${
                period === 'AM'
                  ? 'bg-accent text-white shadow-[0_0_8px_rgba(61,126,255,0.4)]'
                  : 'text-text-dim/60 hover:text-main'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('PM')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition-all duration-150 ${
                period === 'PM'
                  ? 'bg-accent text-white shadow-[0_0_8px_rgba(61,126,255,0.4)]'
                  : 'text-text-dim/60 hover:text-main'
              }`}
            >
              PM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
