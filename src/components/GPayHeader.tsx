import React from 'react';
import { Search, QrCode, Wifi, WifiOff, RefreshCw, User, HelpCircle, Shield, LogOut, Cloud, CloudRain } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface GPayHeaderProps {
  isOnline: boolean;
  onToggleNetwork: () => void;
  onResetData: () => void;
  onOpenScanner: () => void;
  onOpenHelp: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncingWithCloud?: boolean;
}

export default function GPayHeader({
  isOnline,
  onToggleNetwork,
  onResetData,
  onOpenScanner,
  onOpenHelp,
  searchQuery,
  setSearchQuery,
  currentUser,
  onLogin,
  onLogout,
  isSyncingWithCloud
}: GPayHeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 text-slate-100 shadow-md">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Top brand and controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-emerald-500 to-amber-500 flex items-center justify-center shadow-lg">
              <span className="font-bold text-lg text-white">G</span>
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-none tracking-tight flex items-center gap-1.5">
                GPay <span className="text-xs font-mono bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50">Proto</span>
              </h1>
              <p className="text-xs text-slate-400">Payment Gateway Sandbox</p>
            </div>
          </div>

          {/* Network Toggle Button and Helper Actions */}
          <div className="flex items-center space-x-2">
            <button
              id="network-toggle-btn"
              onClick={onToggleNetwork}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isOnline
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/30 animate-pulse'
              }`}
              title={isOnline ? "Switch to Offline Mode" : "Switch to Online Mode"}
            >
              {isOnline ? (
                <>
                  <Wifi size={14} className="text-emerald-400" />
                  <span>ONLINE (101.1)</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-amber-400" />
                  <span>OFFLINE (201.3)</span>
                </>
              )}
            </button>

            <button
              id="reset-db-btn"
              onClick={onResetData}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
              title="Reset Mock Database"
            >
              <RefreshCw size={15} />
            </button>

            <button
              id="help-btn"
              onClick={onOpenHelp}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
              title="Protocol Info & Guidelines"
            >
              <HelpCircle size={15} />
            </button>

            {currentUser ? (
              <div className="flex items-center space-x-2 pl-1 border-l border-slate-800">
                <button
                  id="profile-btn"
                  onClick={onLogout}
                  className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700/80 text-slate-300 hover:text-red-300 transition-all px-2.5 py-1.5 rounded-full text-xs"
                  title={`Signed in as ${currentUser.displayName || currentUser.email}. Click to Logout.`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-4 h-4 rounded-full border border-slate-600"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User size={13} className="text-slate-400" />
                  )}
                  <span className="max-w-[70px] truncate text-[11px] text-slate-300">
                    {currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Cloud'}
                  </span>
                  <LogOut size={11} className="text-slate-500 hover:text-red-400 ml-1" />
                </button>
              </div>
            ) : (
              <div className="flex items-center pl-1 border-l border-slate-800">
                <button
                  id="login-btn"
                  onClick={onLogin}
                  disabled={isSyncingWithCloud}
                  className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-2.5 py-1.5 rounded-full text-xs transition-all shadow-[0_0_8px_rgba(37,99,235,0.2)] disabled:opacity-50"
                  title="Sign in with Google to sync cloud wallet database"
                >
                  <Cloud size={13} />
                  <span>Sync Cloud</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search bar and Scan QR button */}
        <div className="flex items-center space-x-2 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              id="search-contact-input"
              type="text"
              placeholder="Pay friends, merchants, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700/70 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            id="scan-qr-header-btn"
            onClick={onOpenScanner}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-full transition-all shadow-md"
            title="Scan any UPI QR"
          >
            <QrCode size={18} />
          </button>
        </div>

      </div>
    </header>
  );
}
