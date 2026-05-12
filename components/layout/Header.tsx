'use client';

import { useState } from 'react';
import { useChartStore } from '../../lib/store/chart';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { ChartSettingsDropdown } from '../ui/ChartSettingsDropdown';

export function Header() {
  const layoutMode = useChartStore(s => s.layoutMode);
  const setLayoutMode = useChartStore(s => s.setLayoutMode);
  const activePanelId = useChartStore(s => s.activePanel);
  const isAuthenticated = useChartStore(s => s.isAuthenticated);
  const authenticate = useChartStore(s => s.authenticate);
  const logout = useChartStore(s => s.logout);
  const [showSettings, setShowSettings] = useState(false);
  const [pass, setPass] = useState('');
  const [showUnlock, setShowUnlock] = useState(false);
  const [error, setError] = useState(false);

  const handleAuth = () => {
    if (authenticate(pass)) {
      setShowUnlock(false);
      setPass('');
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <header className="font-sans h-10 border-b border-border bg-surface flex items-center px-4 justify-between shrink-0 shadow-sm z-20 relative">
      <div className="flex items-center gap-6">
        <h1 className="font-extrabold text-base text-accent tracking-tighter flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          OrderFlow
        </h1>
        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Layout Toggle */}
        <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setLayoutMode('single')}
            className={`px-2 py-1 rounded-md transition-all duration-200 ${
              layoutMode === 'single'
                ? 'bg-surface text-accent border border-border shadow-sm'
                : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
            title="Single panel"
          >
            {/* Single rectangle icon */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0.5" y="0.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
          <button
            onClick={() => setLayoutMode('dual')}
            className={`px-2 py-1 rounded-md transition-all duration-200 ${
              layoutMode === 'dual'
                ? 'bg-surface text-accent border border-border shadow-sm'
                : 'text-text-dim hover:text-main hover:bg-surface'
            }`}
            title="Dual panel"
          >
            {/* Two rectangles side by side icon */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0.5" y="0.5" width="6" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
              <rect x="7.5" y="0.5" width="6" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Premium Unlock UI */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 border border-accent/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">PRO</span>
              </div>
              <button 
                onClick={() => logout()}
                className="text-[10px] text-text-dim hover:text-main transition-colors uppercase tracking-widest font-medium"
              >
                Lock
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {showUnlock ? (
                <div className={`flex items-center bg-background/80 rounded-md border transition-all duration-300 ${error ? 'border-red-500 animate-shake' : 'border-border'}`}>
                  <input
                    type="password"
                    placeholder="Enter Key"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                    className="bg-transparent text-[10px] px-2 py-1 outline-none w-24 text-main placeholder:text-text-dim/50"
                    autoFocus
                  />
                  <button onClick={handleAuth} className="px-2 py-1 text-accent hover:text-accent-bright">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowUnlock(true)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border hover:border-accent/50 group transition-all duration-200"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-dim group-hover:text-accent">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-[10px] font-bold text-text-dim group-hover:text-accent uppercase tracking-wider">Unlock Details</span>
                </button>
              )}
            </div>
          )}
        </div>

        <ConnectionStatus />
        
        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${
            showSettings 
              ? 'bg-accent/10 border-accent text-accent' 
              : 'bg-background/50 border-border text-text-dim hover:text-main hover:border-text-dim/30'
          }`}
          title="Chart Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        {showSettings && (
          <ChartSettingsDropdown 
            panelId={activePanelId} 
            onClose={() => setShowSettings(false)} 
          />
        )}
      </div>
    </header>
  );
}
