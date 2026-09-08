'use client';

import { useState } from 'react';
import { useChartStore } from '../../lib/store/chart';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { AccountBalanceWidget } from '../ui/AccountBalanceWidget';
import { StorageManager } from '../ui/StorageManager';
import { Database } from 'lucide-react';
import { FigButton } from '../ui/fig';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';

export function Header() {
  const isAuthenticated = useChartStore(s => s.isAuthenticated);
  const authenticate = useChartStore(s => s.authenticate);
  const logout = useChartStore(s => s.logout);
  const [pass, setPass] = useState('');
  const [showUnlock, setShowUnlock] = useState(false);
  const [error, setError] = useState(false);
  const [showStorage, setShowStorage] = useState(false);

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
    <header className="font-sans h-10 border-b border-border bg-[#0F0F0F] flex items-center px-4 justify-between shrink-0 shadow-sm z-[60] relative">
      <div className="flex items-center gap-6">
        <h1 className="sr-only">OrderFlow</h1>
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated && (
          <FigButton
            variant="ghost"
            icon
            onClick={() => setShowStorage(true)}
            title="Manage Storage"
            aria-label="Manage Storage"
          >
            <Database size={16} />
          </FigButton>
        )}

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
              <FigButton
                variant="ghost"
                size="small"
                onClick={() => logout()}
                className="text-[10px] uppercase tracking-widest font-medium"
              >
                Lock
              </FigButton>
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
                  <FigButton
                    variant="ghost"
                    size="small"
                    icon
                    onClick={handleAuth}
                    title="Submit Key"
                    aria-label="Submit Key"
                    className="h-6 w-6 text-accent hover:text-accent-bright"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                  </FigButton>
                </div>
              ) : (
                <FigButton
                  variant="ghost"
                  size="small"
                  onClick={() => setShowUnlock(true)}
                  title="Unlock Details"
                  className="gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Unlock Details</span>
                </FigButton>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {process.env.NEXT_PUBLIC_DISABLE_TRADING !== 'true' && <AccountBalanceWidget />}
          {process.env.NEXT_PUBLIC_DISABLE_TRADING !== 'true' && (
            <div className="flex items-center gap-3">
              <MT5AccountWidget />
            </div>
          )}
          <ConnectionStatus />
        </div>
      </div>
      
      <StorageManager isOpen={showStorage} onClose={() => setShowStorage(false)} />
    </header>
  );
}

function MT5AccountWidget() {
  const accountName = useChartRuntimeStore(s => s.tradingStatus.mt5AccountName);
  const pnl = useChartRuntimeStore(s => s.tradingStatus.mt5Pnl);
  const mt5Connected = useChartRuntimeStore(s => s.tradingStatus.mt5Connected);

  if (!mt5Connected || !accountName) return null;

  const isProfitable = pnl > 0;
  const isLoss = pnl < 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-background/50 border border-border rounded-md text-xs font-mono">
      <span className="text-text-muted">{accountName}</span>
      <div className="w-[1px] h-3 bg-border" />
      <span className={isProfitable ? 'text-chart-bullish' : isLoss ? 'text-chart-bearish' : 'text-text-muted'}>
        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
      </span>
    </div>
  );
}
