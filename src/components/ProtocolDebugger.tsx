import React, { useState } from 'react';
import { Terminal, Shield, Wifi, WifiOff, FileJson, RefreshCw, Layers, Cpu, Search, Trash2, CheckCircle, Database } from 'lucide-react';
import { ProtocolLog, Transaction } from '../types';

interface ProtocolDebuggerProps {
  logs: ProtocolLog[];
  onClearLogs: () => void;
  pendingSyncCount: number;
  onForceSync: () => void;
  isSyncing: boolean;
  isOnline: boolean;
}

export default function ProtocolDebugger({
  logs,
  onClearLogs,
  pendingSyncCount,
  onForceSync,
  isSyncing,
  isOnline
}: ProtocolDebuggerProps) {
  const [filter, setFilter] = useState<'ALL' | '101.1' | '201.3' | 'SYSTEM'>('ALL');
  const [selectedLog, setSelectedLog] = useState<ProtocolLog | null>(null);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.protocol === filter;
  });

  return (
    <section className="px-4 py-3 max-w-4xl mx-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-5">
        
        {/* Terminal log list */}
        <div className="flex-1 flex flex-col min-h-[380px] max-h-[460px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <Terminal size={16} className="text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Protocol Sandbox & Logs</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                id="clear-logs-btn"
                onClick={onClearLogs}
                className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-all"
                title="Clear Logs"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Filtering tabs */}
          <div className="flex space-x-1 mb-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
            {(['ALL', '101.1', '201.3', 'SYSTEM'] as const).map(tab => (
              <button
                key={tab}
                id={`debugger-tab-${tab}`}
                onClick={() => setFilter(tab)}
                className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-mono font-bold transition-all ${
                  filter === tab
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/50'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {tab === 'ALL' ? 'ALL PACKETS' : tab === 'SYSTEM' ? 'SYSTEM' : `P-${tab}`}
              </button>
            ))}
          </div>

          {/* Logging stream */}
          <div className="flex-1 overflow-y-auto bg-slate-950 rounded-2xl p-3 border border-slate-850/80 font-mono text-[10.5px] leading-relaxed space-y-2.5 max-h-[310px] min-h-[180px] scrollbar-thin">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 py-10">
                <Cpu size={24} className="opacity-30 mb-2 animate-pulse" />
                <span>Waiting for payment activity...</span>
              </div>
            ) : (
              filteredLogs.map(log => {
                let badgeColor = "bg-blue-950 text-blue-400 border-blue-900/40";
                if (log.protocol === '101.1') badgeColor = "bg-emerald-950/80 text-emerald-400 border-emerald-900/40";
                if (log.protocol === '201.3') badgeColor = "bg-amber-950/80 text-amber-400 border-amber-900/40";
                if (log.protocol === 'SYSTEM') badgeColor = "bg-slate-900 text-slate-400 border-slate-800";

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/95 border border-slate-900 hover:border-slate-800 transition-all cursor-pointer flex flex-col space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${badgeColor}`}>
                          {log.protocol === 'SYSTEM' ? 'SYS' : `P-${log.protocol}`}
                        </span>
                        <span className="text-slate-300 font-medium text-[11px] truncate max-w-[200px]">
                          {log.step}
                        </span>
                      </div>
                      <span className="text-[8.5px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionSecondDigits: 1 } as any)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Decoder / Sandbox Details panel */}
        <div className="w-full md:w-80 bg-slate-950 border border-slate-850/80 rounded-2xl p-4 flex flex-col justify-between max-h-[460px]">
          <div>
            <div className="flex items-center space-x-1.5 border-b border-slate-900 pb-2 mb-3">
              <Layers size={14} className="text-blue-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Payload Inspector</h4>
            </div>

            {selectedLog ? (
              <div className="space-y-3 font-mono text-[10.5px]">
                <div>
                  <span className="text-slate-500 text-[9px] block uppercase">Event Step:</span>
                  <span className="text-slate-300 text-xs font-semibold">{selectedLog.step}</span>
                </div>
                
                <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-850 max-h-[220px] overflow-y-auto">
                  <span className="text-slate-500 text-[9px] block uppercase mb-1">Encrypted/Structured Payload:</span>
                  <pre className="text-[10px] text-emerald-400 whitespace-pre-wrap leading-tight select-all">
                    {selectedLog.payload}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-600 text-center p-4">
                <FileJson size={20} className="mb-2 opacity-35" />
                <span className="text-[10px]">Select a log row on the left to inspect its decrypted binary structure & variables.</span>
              </div>
            )}
          </div>

          {/* Sync Outbox controls for offline ledger */}
          <div className="mt-4 pt-3 border-t border-slate-900">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <Database size={13} className="text-amber-400" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Offline Cache Outbox</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                pendingSyncCount > 0
                  ? 'bg-amber-950 text-amber-400 border border-amber-900/30'
                  : 'bg-slate-900 text-slate-500 border border-slate-850'
              }`}>
                {pendingSyncCount} Pending
              </span>
            </div>

            <p className="text-[9.5px] text-slate-500 mb-3 leading-relaxed">
              When working in Offline Mode, payment tokens are stored securely in local outbox registers. Restore internet and hit Sync to clear balances.
            </p>

            <button
              id="force-sync-btn"
              onClick={onForceSync}
              disabled={pendingSyncCount === 0 || isSyncing}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                pendingSyncCount === 0
                  ? 'bg-slate-900 text-slate-600 border border-slate-850 cursor-not-allowed'
                  : !isOnline
                    ? 'bg-amber-950/20 border border-amber-900/30 text-amber-400 hover:bg-amber-950/30 active:scale-[0.98]'
                    : 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white shadow-md active:scale-[0.98]'
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Settling Transactions...</span>
                </>
              ) : !isOnline && pendingSyncCount > 0 ? (
                <>
                  <WifiOff size={13} className="text-amber-400" />
                  <span>Go Online to Sync</span>
                </>
              ) : (
                <>
                  <CheckCircle size={13} className="text-emerald-400" />
                  <span>Synchronize Local Ledger</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
