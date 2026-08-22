'use client';

import { useState, useEffect } from 'react';
import { Database, Trash2, X, AlertCircle } from 'lucide-react';

import type { StorageDay, DatabasesInfo } from '../../types/storage';

interface StorageManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StorageManager({ isOpen, onClose }: StorageManagerProps) {
  const [days, setDays] = useState<StorageDay[]>([]);
  const [databases, setDatabases] = useState<DatabasesInfo | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Deletion targets
  const [targetMain, setTargetMain] = useState(true);
  const [targetBubbles, setTargetBubbles] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchStorage();
      setSelectedDays(new Set());
      setError(null);
    }
  }, [isOpen]);

  const fetchStorage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/history/storage');
      if (!res.ok) throw new Error('Failed to fetch storage data');
      const data = await res.json();
      setDays(data.days || []);
      setDatabases(data.databases || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading storage data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDay = (date: string) => {
    const newSelected = new Set(selectedDays);
    if (newSelected.has(date)) {
      newSelected.delete(date);
    } else {
      newSelected.add(date);
    }
    setSelectedDays(newSelected);
  };

  const toggleAll = () => {
    if (selectedDays.size === days.length) {
      setSelectedDays(new Set());
    } else {
      setSelectedDays(new Set(days.map(d => d.date)));
    }
  };

  const handleDelete = async () => {
    if (selectedDays.size === 0) return;
    
    // Safety confirm
    if (!window.confirm(`Are you sure you want to delete data for ${selectedDays.size} day(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const targets = [];
      if (targetMain) targets.push('main');
      if (targetBubbles) targets.push('bubbles');

      const res = await fetch('/api/history/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dates: Array.from(selectedDays),
          targets
        })
      });
      if (!res.ok) throw new Error('Failed to delete storage data');
      
      // Refresh the list
      await fetchStorage();
      setSelectedDays(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting storage data');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const totalSelectedMb = Array.from(selectedDays).reduce((sum, date) => {
    const day = days.find(d => d.date === date);
    if (!day) return sum;
    let size = 0;
    if (targetMain) size += day.mainMb;
    if (targetBubbles) size += day.bubbleMb;
    return sum + size;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/30">
          <div className="flex items-center gap-2 text-main">
            <Database size={18} className="text-accent" />
            <h2 className="font-bold text-sm tracking-wide">Storage Manager</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-text-dim hover:text-main hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[70vh] bg-surface">
          
          {/* Capacity Dashboard */}
          {databases && (
            <div className="mb-4 space-y-3 p-3 rounded-lg border border-border bg-background/50">
              {/* Main DB */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-text-dim">Main DB (Footprint/Profile)</span>
                  <span className="text-main">{databases.main.usedMb} / {databases.main.totalMb} MB</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, (databases.main.usedMb / databases.main.totalMb) * 100)}%` }}
                  />
                </div>
              </div>
              
              {/* Bubbles DB */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-text-dim">Bubbles DB (Agg Trades)</span>
                  <span className="text-main">{databases.bubbles.usedMb} / {databases.bubbles.totalMb} MB</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, (databases.bubbles.usedMb / databases.bubbles.totalMb) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 flex gap-2 items-start text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-text-dim font-medium uppercase tracking-wider">Loading Database...</p>
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-10">
              <Database size={32} className="mx-auto text-text-dim/30 mb-3" />
              <p className="text-sm text-text-dim">No storage data found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-border/50">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedDays.size === days.length && days.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-border bg-background/50 text-accent focus:ring-accent/30 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-text-dim group-hover:text-main transition-colors">Select All</span>
                </label>
                <span className="text-xs text-text-dim font-medium">Est. Size</span>
              </div>
              
              <div className="space-y-1">
                {days.map(day => (
                  <label 
                    key={day.date}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                      selectedDays.has(day.date)
                        ? 'bg-accent/5 border-accent/30'
                        : 'bg-background/30 border-transparent hover:border-border hover:bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={selectedDays.has(day.date)}
                        onChange={() => toggleDay(day.date)}
                        className="w-4 h-4 rounded border-border bg-background/50 text-accent focus:ring-accent/30 cursor-pointer"
                      />
                      <span className={`text-sm font-medium ${selectedDays.has(day.date) ? 'text-main' : 'text-text-dim'}`}>
                        {day.date}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-mono font-medium ${selectedDays.has(day.date) ? 'text-accent' : 'text-text-dim/70'}`}>
                        Main: {day.mainMb.toFixed(1)} MB
                      </span>
                      <span className={`text-xs font-mono font-medium ${selectedDays.has(day.date) ? 'text-accent' : 'text-text-dim/70'}`}>
                        Bubbles: {day.bubbleMb.toFixed(1)} MB
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/50 flex flex-col gap-3">
          
          <div className="flex items-center gap-4 text-xs font-medium text-text-dim px-1">
            <span>Erase targets:</span>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-main transition-colors">
              <input 
                type="checkbox" 
                checked={targetMain}
                onChange={e => setTargetMain(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border bg-background/50 text-accent focus:ring-accent/30 cursor-pointer"
              />
              Main DB
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-main transition-colors">
              <input 
                type="checkbox" 
                checked={targetBubbles}
                onChange={e => setTargetBubbles(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border bg-background/50 text-accent focus:ring-accent/30 cursor-pointer"
              />
              Bubbles DB
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-dim font-medium uppercase tracking-wider">Selected</span>
              <span className="text-sm font-bold text-main">
                {totalSelectedMb.toFixed(1)} <span className="text-text-dim text-xs">MB</span>
              </span>
            </div>
            
            <button
              onClick={handleDelete}
              disabled={selectedDays.size === 0 || (!targetMain && !targetBubbles) || isDeleting || isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                selectedDays.size > 0 && (targetMain || targetBubbles) && !isDeleting
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                  : 'bg-background text-text-dim border border-border cursor-not-allowed'
              }`}
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  Erasing...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete Data
                </>
              )}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
