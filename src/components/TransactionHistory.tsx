import React, { useState } from 'react';
import { History, Shield, Wifi, WifiOff, ArrowUpRight, ArrowDownLeft, Calendar, FileText, CheckCircle2, Clock, X, Hash, Cpu, Laptop, Lock } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onCapture?: (txId: string) => void;
}

export default function TransactionHistory({ transactions, onCapture }: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filteredTx = transactions.filter(tx => {
    if (filter === 'ALL') return true;
    if (filter === 'ONLINE') return tx.protocol === 'online_101_1' || tx.protocol === 'wallet_direct';
    if (filter === 'OFFLINE') return tx.protocol === 'offline_201_3';
    return true;
  });

  return (
    <section className="px-4 py-3 max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <History size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Transaction Ledger & Receipts</h3>
          </div>

          <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
            {(['ALL', 'ONLINE', 'OFFLINE'] as const).map(tab => (
              <button
                key={tab}
                id={`tx-filter-tab-${tab}`}
                onClick={() => setFilter(tab)}
                className={`py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
                  filter === tab
                    ? 'bg-slate-800 text-slate-200 shadow-sm border border-slate-700/50'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {tab === 'ALL' ? 'All Activities' : tab === 'ONLINE' ? 'Online (101.1)' : 'Offline (201.3)'}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions list */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredTx.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History size={32} className="mx-auto text-slate-700 mb-2.5" />
              <p className="text-sm">No transaction matches your selected filter.</p>
            </div>
          ) : (
            filteredTx.map(tx => {
              const isDebit = tx.senderId === 'user_current';
              const displayProtocolName = 
                tx.protocol === 'online_101_1' 
                  ? 'Online 101.1 Handshake' 
                  : tx.protocol === 'offline_201_3' 
                    ? 'Offline 201.3 Acoustic' 
                    : 'Wallet Transfer';

              return (
                <div
                  key={tx.id}
                  id={`tx-row-${tx.id}`}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-850/50 hover:border-slate-700 p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-300 relative">
                      {tx.receiverAvatar ? (
                        <span className="text-base">{tx.receiverAvatar}</span>
                      ) : (
                        <span className="text-sm">You</span>
                      )}

                      {/* Micro protocol icon */}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center bg-slate-950">
                        {tx.protocol === 'offline_201_3' ? (
                          <WifiOff size={8} className="text-amber-400" />
                        ) : (
                          <Wifi size={8} className="text-emerald-400" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">
                        {isDebit ? `Paid to ${tx.receiverName}` : `Received from ${tx.senderName}`}
                      </h4>
                      
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(tx.timestamp).toLocaleDateString()} • {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${
                          tx.protocol === 'online_101_1' 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' 
                            : tx.protocol === 'offline_201_3'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900/30'
                              : 'bg-blue-950/40 text-blue-400 border-blue-900/30'
                        }`}>
                          {tx.protocol === 'offline_201_3' && tx.status === 'pending_sync' ? 'Offline Cache' : 'Cleared'}
                        </span>

                        {/* Transaction Mode & Hold status badges */}
                        {tx.mode && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${
                            tx.mode === 'pre_auth'
                              ? tx.isCaptured
                                ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30'
                                : 'bg-amber-950/40 text-amber-400 border-amber-900/30 animate-pulse'
                              : tx.mode === 'bank_transfer'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                                : 'bg-slate-950/40 text-slate-400 border-slate-900/30'
                          }`}>
                            {tx.mode === 'pre_auth' 
                              ? tx.isCaptured ? 'Pre-Auth (Captured)' : 'Pre-Auth Hold' 
                              : tx.mode === 'bank_transfer' 
                                ? 'Bank Transfer' 
                                : 'Sale'}
                          </span>
                        )}
                      </div>

                      {tx.note && (
                        <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-1">"{tx.note}"</p>
                      )}
                    </div>
                  </div>

                  {/* Amount and Settlement Badge */}
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${isDebit ? 'text-slate-100' : 'text-emerald-400'}`}>
                      {isDebit ? '-' : '+'}${tx.amount.toFixed(2)}
                    </span>
                    
                    <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400 font-mono">
                      {tx.status === 'pending_sync' ? (
                        <>
                          <Clock size={10} className="text-amber-400" />
                          <span className="text-amber-400">Sync Pending</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={10} className="text-emerald-500" />
                          <span className="text-slate-500">Settled</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Dynamic Receipt Modal overlay */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Receipt Ribbon */}
            <div className="bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 h-2"></div>
            
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center space-x-2">
                  <Lock size={15} className="text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Secure Cryptographic Receipt</span>
                </div>
                <button
                  id="close-receipt-modal-btn"
                  onClick={() => setSelectedTx(null)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Info */}
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-2xl font-bold mb-2.5">
                  {selectedTx.receiverAvatar ? selectedTx.receiverAvatar : 'You'}
                </div>
                
                <h3 className="text-sm font-semibold text-white">
                  {selectedTx.senderId === 'user_current' ? `To ${selectedTx.receiverName}` : `From ${selectedTx.senderName}`}
                </h3>
                
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Category: <span className="text-slate-300">{selectedTx.category}</span>
                </p>

                <div className="text-3xl font-bold text-white font-mono mt-3 mb-1.5">
                  ${selectedTx.amount.toFixed(2)}
                </div>

                <div className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  selectedTx.status === 'pending_sync'
                    ? 'bg-amber-950 text-amber-400 border-amber-900/30'
                    : 'bg-emerald-950 text-emerald-400 border-emerald-900/30'
                }`}>
                  {selectedTx.status === 'pending_sync' ? 'OFFLINE TRANSACTION PENDING SYNC' : 'TRANSACTION FULLY SETTLED'}
                </div>
              </div>

              {/* Meta information parameters */}
              <div className="mt-5 space-y-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-850/80 font-mono text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="text-slate-300 font-bold">{selectedTx.id}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Mode:</span>
                  <span className="text-slate-300 capitalize font-bold">{selectedTx.mode || 'sale'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Approval Code:</span>
                  <span className="text-blue-400 font-bold">{selectedTx.approvalCode || `AP_GPAY_${Math.floor(Math.random() * 900000 + 100000)}`}</span>
                </div>

                {selectedTx.mode === 'pre_auth' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pre-Auth Status:</span>
                    <span className={`font-bold ${selectedTx.isCaptured ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold animate-pulse'}`}>
                      {selectedTx.isCaptured ? 'Captured & Settled' : 'Funds Authorized Hold'}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Method Used:</span>
                  <span className="text-slate-300">{selectedTx.paymentMethodName}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Clearing Protocol:</span>
                  <span className="text-slate-300">
                    {selectedTx.protocol === 'online_101_1' ? 'Online 101.1 Handshake' : selectedTx.protocol === 'offline_201_3' ? 'Offline 201.3 Acoustic' : 'Wallet Direct'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-300">
                    {new Date(selectedTx.timestamp).toLocaleString()}
                  </span>
                </div>

                {selectedTx.note && (
                  <div className="border-t border-slate-900 pt-2 flex flex-col">
                    <span className="text-slate-500">Note:</span>
                    <span className="text-slate-300 italic mt-0.5">"{selectedTx.note}"</span>
                  </div>
                )}

                {/* Protocol technical details */}
                <div className="border-t border-slate-900 pt-2 space-y-1">
                  <div className="flex items-center space-x-1 mb-1">
                    <Cpu size={12} className="text-blue-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Protocol Security Headers</span>
                  </div>

                  <div className="flex justify-between text-[9.5px]">
                    <span className="text-slate-500">Digital Signature:</span>
                    <span className="text-blue-400 select-all truncate w-40 text-right font-bold">
                      {selectedTx.protocolDetails.signature}
                    </span>
                  </div>

                  {selectedTx.protocolDetails.handshakeLatency !== undefined && (
                    <div className="flex justify-between text-[9.5px]">
                      <span className="text-slate-500">Handshake Latency:</span>
                      <span className="text-slate-300">{selectedTx.protocolDetails.handshakeLatency}ms</span>
                    </div>
                  )}

                  {selectedTx.protocolDetails.tokenSeed && (
                    <div className="flex justify-between text-[9.5px]">
                      <span className="text-slate-500">Server Seed Token:</span>
                      <span className="text-slate-300">{selectedTx.protocolDetails.tokenSeed}</span>
                    </div>
                  )}

                  {selectedTx.protocolDetails.offlineAuthCode && (
                    <div className="flex justify-between text-[9.5px]">
                      <span className="text-slate-500">Local Enclave Code:</span>
                      <span className="text-amber-400 font-bold">{selectedTx.protocolDetails.offlineAuthCode}</span>
                    </div>
                  )}

                  {selectedTx.protocolDetails.payloadSize !== undefined && (
                    <div className="flex justify-between text-[9.5px]">
                      <span className="text-slate-500">Encrypted Payload:</span>
                      <span className="text-slate-300">{selectedTx.protocolDetails.payloadSize} bytes</span>
                    </div>
                  )}

                  {selectedTx.protocolDetails.deviceFingerprint && (
                    <div className="flex justify-between text-[9.5px]">
                      <span className="text-slate-500">Device Fingerprint:</span>
                      <span className="text-slate-400">{selectedTx.protocolDetails.deviceFingerprint}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Capture Action button for Pre-Auth holds */}
              {selectedTx.mode === 'pre_auth' && !selectedTx.isCaptured && onCapture && (
                <button
                  id="capture-preauth-funds-btn"
                  onClick={() => {
                    onCapture(selectedTx.id);
                    // Update state locally so modal displays the updated Captured state immediately
                    setSelectedTx(prev => prev ? { ...prev, isCaptured: true } : null);
                  }}
                  className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center space-x-2 border border-amber-400/20"
                >
                  <Shield size={13} className="text-slate-950" />
                  <span>Capture Pre-Auth Hold (${selectedTx.amount.toFixed(2)})</span>
                </button>
              )}

              {/* Verified Badge */}
              <div className="flex items-center justify-center space-x-1 text-emerald-400 text-[10px] font-semibold mt-4 bg-emerald-950/20 py-1.5 rounded-xl border border-emerald-900/20">
                <Shield size={12} />
                <span>Verified Cryptographically by Central PayG Ledger</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
