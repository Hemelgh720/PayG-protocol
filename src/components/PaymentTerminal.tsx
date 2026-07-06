import React, { useState, useMemo } from 'react';
import { 
  Terminal, ShieldCheck, Cpu, Key, ArrowRight, CheckCircle, Clock, 
  Lock, RefreshCw, AlertCircle, Fingerprint, Check, Shield, 
  Volume2, QrCode, Wifi, WifiOff, CreditCard, Sparkles, Activity, FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Contact, PaymentMethod, Transaction, ProtocolType } from '../types';
import { calculateSimulatedHash, generateUUID, simulateOnline101Handshake, generateOffline201Token } from '../utils/crypto';

interface PaymentTerminalProps {
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  onAddTransaction: (
    amount: number,
    contact: Contact,
    methodId: string,
    protocol: ProtocolType,
    note: string,
    extraDetails: any,
    status: 'success' | 'pending_sync'
  ) => Promise<void>;
  onCaptureTransaction: (txId: string) => Promise<void>;
  onAddLog: (
    step: string,
    payload: string,
    type: 'info' | 'success' | 'warning' | 'crypto',
    protocol: '101.1' | '201.3' | 'SYSTEM'
  ) => void;
  triggerToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  isOnline: boolean;
  contacts: Contact[];
}

type TerminalMode = 'SALE' | 'PRE_AUTH' | 'PRE_AUTH_APPROVAL';

export default function PaymentTerminal({
  paymentMethods,
  transactions,
  onAddTransaction,
  onCaptureTransaction,
  onAddLog,
  triggerToast,
  isOnline,
  contacts
}: PaymentTerminalProps) {
  // Input and settings
  const [terminalMode, setTerminalMode] = useState<TerminalMode>('SALE');
  const [amountStr, setAmountStr] = useState<string>('15.50');
  const [approvalCodeInput, setApprovalCodeInput] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>(contacts[0]?.id || '');
  const [selectedMethodId, setSelectedMethodId] = useState<string>(paymentMethods[0]?.id || '');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('online_101_1');

  // Interactive transaction states
  const [txStep, setTxStep] = useState<'idle' | 'transmitting' | 'enclave' | 'network' | 'complete' | 'failed'>('idle');
  const [terminalMessage, setTerminalMessage] = useState<string>('INSERT, SWIPE OR TAP TO START');
  const [activeHandshakeLogs, setActiveHandshakeLogs] = useState<string[]>([]);
  const [generatedApprovalCode, setGeneratedApprovalCode] = useState<string>('');
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  // Sound Synth Cues
  const playSynthesizedCue = (type: 'beep' | 'acoustic' | 'success' | 'error' | 'click') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'beep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'acoustic') {
        // Acoustic sweep for 201.3
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + 0.7);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } else if (type === 'success') {
        // POS double success chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
        osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.24); // C6
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Acoustic audio context blocked/unsupported:", e);
    }
  };

  // List of active uncaptured pre-auth transactions
  const activePreAuths = useMemo(() => {
    return transactions.filter(
      tx => tx.mode === 'pre_auth' && !tx.isCaptured
    );
  }, [transactions]);

  // Selected contact object
  const selectedContact = useMemo(() => {
    return contacts.find(c => c.id === selectedContactId) || contacts[0];
  }, [contacts, selectedContactId]);

  // Selected payment method
  const selectedMethod = useMemo(() => {
    return paymentMethods.find(m => m.id === selectedMethodId) || paymentMethods[0];
  }, [paymentMethods, selectedMethodId]);

  // Numeric keypad inputs
  const handleKeypadPress = (val: string) => {
    playSynthesizedCue('click');
    if (terminalMode === 'PRE_AUTH_APPROVAL') {
      if (val === 'C') {
        setApprovalCodeInput('');
      } else if (val === '⌫') {
        setApprovalCodeInput(prev => prev.slice(0, -1));
      } else {
        if (approvalCodeInput.length < 12) {
          setApprovalCodeInput(prev => prev + val);
        }
      }
    } else {
      if (val === 'C') {
        setAmountStr('0.00');
      } else if (val === '⌫') {
        setAmountStr(prev => {
          const removed = prev.slice(0, -1);
          return removed === '' || removed === '$' ? '0.00' : removed;
        });
      } else {
        setAmountStr(prev => {
          if (prev === '0.00' || prev === '0') {
            return val === '.' ? '0.' : val;
          }
          if (val === '.' && prev.includes('.')) return prev;
          
          // Limit to 2 decimals
          const decIndex = prev.indexOf('.');
          if (decIndex !== -1 && prev.length - decIndex > 2) {
            return prev;
          }
          return prev + val;
        });
      }
    }
  };

  // Quick preset amounts
  const handleApplyPreset = (amt: number) => {
    playSynthesizedCue('click');
    setAmountStr(amt.toFixed(2));
  };

  // Run Sale or Pre-Auth simulation
  const handleExecuteTerminalTransaction = async () => {
    if (txStep !== 'idle') return;
    
    const amountVal = parseFloat(amountStr) || 0;
    if (amountVal <= 0) {
      playSynthesizedCue('error');
      triggerToast("Please enter a valid payment amount.", "warning");
      return;
    }

    if (!selectedContact) {
      playSynthesizedCue('error');
      triggerToast("No valid target contact selected.", "warning");
      return;
    }

    // Check balance
    if (selectedMethod && selectedMethod.balance !== undefined && selectedMethod.balance < amountVal) {
      playSynthesizedCue('error');
      triggerToast(`Insufficient balance on card ${selectedMethod.name}.`, "warning");
      return;
    }

    setTxStep('transmitting');
    setGeneratedApprovalCode('');
    setTerminalMessage('CONNECTING TO CARDS...');
    setActiveHandshakeLogs(['[POS] Initializing contact-less protocol reader...']);

    // Determine protocol fallback based on network status
    const actualProtocol = isOnline ? selectedProtocol : 'offline_201_3';

    try {
      if (actualProtocol === 'online_101_1') {
        // --- ONLINE 101.1 ROUTE ---
        playSynthesizedCue('beep');
        setTerminalMessage('TRANSMITTING PAYLOAD...');
        await new Promise(r => setTimeout(r, 600));

        setTxStep('enclave');
        setTerminalMessage('SIGNING WITH CLOUD_HSM...');
        
        const handshakeRes = await simulateOnline101Handshake(
          amountVal,
          'You (Terminal)',
          selectedContact.name,
          selectedMethod ? selectedMethod.name : 'Terminal',
          (step, payload, type) => {
            onAddLog(step, payload, type, '101.1');
            setActiveHandshakeLogs(prev => [...prev, `[101.1] ${step}`]);
          }
        );

        setTxStep('network');
        setTerminalMessage('GATEWAY APPROVAL CO-PROCESSOR...');
        await new Promise(r => setTimeout(r, 750));

        // Generate approval code
        const isPreAuth = terminalMode === 'PRE_AUTH';
        const approvalCode = isPreAuth 
          ? `AUTH-PA-${Math.floor(Math.random() * 89999 + 10000)}` 
          : `AUTH-SL-${Math.floor(Math.random() * 89999 + 10000)}`;

        const extraDetails = {
          handshakeLatency: handshakeRes.latency,
          signature: handshakeRes.signature,
          tokenSeed: handshakeRes.seed,
          deviceFingerprint: handshakeRes.fingerprint,
          payloadSize: 194,
          mode: isPreAuth ? 'pre_auth' : 'sale',
          approvalCode,
          isCaptured: !isPreAuth
        };

        await onAddTransaction(
          amountVal,
          selectedContact,
          selectedMethodId,
          'online_101_1',
          `Terminal ${terminalMode} transaction`,
          extraDetails,
          'success'
        );

        setGeneratedApprovalCode(approvalCode);
        setTxStep('complete');
        setTerminalMessage('APPROVED - THANK YOU');
        playSynthesizedCue('success');

      } else {
        // --- OFFLINE 201.3 ROUTE ---
        playSynthesizedCue('acoustic');
        setTerminalMessage('ACOUSTIC SWEEP BROADCAST...');
        await new Promise(r => setTimeout(r, 1200));

        setTxStep('enclave');
        setTerminalMessage('LOCAL ENCLAVE TOKEN SIGN...');
        
        const offlineToken = generateOffline201Token(
          amountVal,
          'You (Terminal)',
          selectedContact.name,
          selectedMethod ? selectedMethod.name : 'Terminal',
          transactions.length + 1,
          (step, payload, type) => {
            onAddLog(step, payload, type, '201.3');
            setActiveHandshakeLogs(prev => [...prev, `[201.3] ${step}`]);
          }
        );

        const isPreAuth = terminalMode === 'PRE_AUTH';
        const approvalCode = isPreAuth 
          ? `AUTH-PA-${Math.floor(Math.random() * 89999 + 10000)}` 
          : `AUTH-SL-${Math.floor(Math.random() * 89999 + 10000)}`;

        const extraDetails = {
          offlineAuthCode: offlineToken.authCode,
          signature: offlineToken.signature,
          payloadSize: offlineToken.payloadSize,
          tokenSeed: offlineToken.token,
          mode: isPreAuth ? 'pre_auth' : 'sale',
          approvalCode,
          isCaptured: !isPreAuth
        };

        await onAddTransaction(
          amountVal,
          selectedContact,
          selectedMethodId,
          'offline_201_3',
          `Offline Terminal ${terminalMode}`,
          extraDetails,
          'pending_sync'
        );

        setGeneratedApprovalCode(approvalCode);
        setTxStep('complete');
        setTerminalMessage('OFFLINE CACHED');
        playSynthesizedCue('success');
      }
    } catch (err: any) {
      setTxStep('failed');
      setTerminalMessage('DECLINED / FAILURE');
      playSynthesizedCue('error');
      triggerToast(err.message || "Terminal Handshake Error", "warning");
    }
  };

  // Execute Pre-Auth Approval (Capture by approval code)
  const handleApprovePreAuth = async () => {
    if (txStep !== 'idle') return;
    setMismatchError(null);

    const inputCode = approvalCodeInput.trim().toUpperCase();
    if (!inputCode) {
      playSynthesizedCue('error');
      triggerToast("Please enter an approval code.", "warning");
      return;
    }

    // Find matching pre-auth transaction
    const targetTx = transactions.find(
      tx => tx.mode === 'pre_auth' && !tx.isCaptured && tx.approvalCode?.toUpperCase() === inputCode
    );

    if (!targetTx) {
      playSynthesizedCue('error');
      setMismatchError("INVALID OR EXPIRED APPROVAL CODE");
      triggerToast("Verification failed: Approval code not found.", "warning");
      return;
    }

    setTxStep('transmitting');
    setTerminalMessage('VERIFYING APPROVAL CODE...');
    setActiveHandshakeLogs([
      `[POS-CAPTURE] Querying vault for authorization code: ${inputCode}`,
      `[POS-CAPTURE] Match found. Lock-in amount: $${targetTx.amount.toFixed(2)}`
    ]);

    await new Promise(r => setTimeout(r, 800));

    setTxStep('network');
    setTerminalMessage('SETTLING FUNDS LIVE...');
    setActiveHandshakeLogs(prev => [
      ...prev,
      `[POS-CAPTURE] Sending capture instruction to central clearing gateway`,
      `[POS-CAPTURE] Resolving escrow hold. Releasing to ${targetTx.receiverName}`
    ]);

    await new Promise(r => setTimeout(r, 1000));

    try {
      // Capture transaction
      await onCaptureTransaction(targetTx.id);

      onAddLog(
        `Pre-Auth Captured: ${inputCode}`,
        JSON.stringify({
          status: "CAPTURED",
          approval_code: inputCode,
          original_tx_id: targetTx.id,
          settled_amount: targetTx.amount,
          clearing_ledger: "SUCCESSFUL_SETTLEMENT",
          timestamp: new Date().toISOString()
        }, null, 2),
        'success',
        targetTx.protocol === 'offline_201_3' ? '201.3' : '101.1'
      );

      setTxStep('complete');
      setTerminalMessage('CAP APPROVED - SETTLED');
      playSynthesizedCue('success');
      setApprovalCodeInput('');
      triggerToast(`Successfully settled $${targetTx.amount.toFixed(2)} via Approval Code!`, "success");
    } catch (err: any) {
      setTxStep('failed');
      setTerminalMessage('CAPTURE FAILURE');
      playSynthesizedCue('error');
      triggerToast(err.message || "Failed to capture pre-auth hold.", "warning");
    }
  };

  const handleResetTerminal = () => {
    playSynthesizedCue('click');
    setTxStep('idle');
    setTerminalMessage('INSERT, SWIPE OR TAP TO START');
    setActiveHandshakeLogs([]);
    setGeneratedApprovalCode('');
    setMismatchError(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-left max-w-4xl mx-auto font-sans mt-4">
      {/* Absolute background decorations */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: POS Terminal UI Visualizer */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-950 text-blue-400 rounded-xl border border-blue-900/40">
                <Terminal size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  Secure POS Terminal
                  <span className="text-[9px] font-mono font-normal bg-blue-950 text-blue-400 border border-blue-900/30 px-1.5 py-0.5 rounded">
                    PRO v2
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500">Real-time payment clearance console</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Wifi size={10} /> Online
                </span>
              ) : (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <WifiOff size={10} /> Offline (201.3 Only)
                </span>
              )}
            </div>
          </div>

          {/* Terminal Mode Tab Selector */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
            {(['SALE', 'PRE_AUTH', 'PRE_AUTH_APPROVAL'] as TerminalMode[]).map((mode) => (
              <button
                key={mode}
                disabled={txStep !== 'idle'}
                onClick={() => {
                  playSynthesizedCue('click');
                  setTerminalMode(mode);
                  setMismatchError(null);
                }}
                className={`text-[9px] sm:text-xs font-bold py-2 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                  terminalMode === mode
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-50'
                }`}
              >
                {mode === 'PRE_AUTH_APPROVAL' ? 'Capture Approval' : mode.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Real-Time Glassmorphic Screen */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden h-[180px] shadow-inner">
            {/* Glossy overlay reflection */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {terminalMode === 'PRE_AUTH_APPROVAL' ? 'Hold Settler Mode' : `${terminalMode} HANDSHAKE`}
              </span>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  txStep === 'idle' 
                    ? 'bg-blue-500 animate-pulse' 
                    : txStep === 'complete' 
                      ? 'bg-emerald-500 animate-none' 
                      : txStep === 'failed' 
                        ? 'bg-rose-500 animate-none' 
                        : 'bg-amber-500 animate-ping'
                }`} />
                <span className="text-[8px] font-mono text-slate-400 uppercase">
                  {txStep}
                </span>
              </div>
            </div>

            {/* Display value / instructions */}
            <div className="py-4 text-center">
              <AnimatePresence mode="wait">
                {txStep === 'idle' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-1"
                  >
                    {terminalMode === 'PRE_AUTH_APPROVAL' ? (
                      <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Approval Hold Code</div>
                        <div className="text-xl sm:text-2xl font-mono font-bold text-blue-400 tracking-widest uppercase">
                          {approvalCodeInput || 'ENTER CODE'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Transaction Total</div>
                        <div className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tight">
                          ${amountStr}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-1.5"
                  >
                    <div className="text-xs font-mono font-bold text-blue-400 tracking-wider">
                      {terminalMessage}
                    </div>
                    {generatedApprovalCode && (
                      <div className="bg-slate-900 border border-slate-850 px-3 py-1 rounded-lg inline-block font-mono text-xs font-bold text-emerald-400">
                        Approval Code: {generatedApprovalCode}
                      </div>
                    )}
                    {mismatchError && (
                      <div className="text-[10px] font-mono font-semibold text-rose-400 animate-shake">
                        {mismatchError}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Micro cryptographics info line */}
            <div className="text-[8.5px] font-mono text-slate-500 border-t border-slate-900 pt-1.5 flex justify-between">
              <span>Card: {selectedMethod ? selectedMethod.name : 'None'}</span>
              <span>Proto: {isOnline ? selectedProtocol.replace('_', ' ') : 'offline 201.3'}</span>
            </div>
          </div>

          {/* Interactive Flow Controllers */}
          {txStep !== 'idle' ? (
            <div className="bg-slate-950/60 border border-slate-850/60 rounded-2xl p-4 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-900">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity size={12} className="text-blue-400" />
                  Live Verification Step Logs
                </span>
                <span className="text-[8px] text-slate-600">Secure Channel</span>
              </div>
              <div className="h-[80px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800 text-[10px] text-left pr-1">
                {activeHandshakeLogs.map((log, index) => (
                  <div key={index} className="text-slate-300 leading-normal flex items-start gap-1">
                    <span className="text-emerald-500">✔</span>
                    <span>{log}</span>
                  </div>
                ))}
                {txStep !== 'complete' && txStep !== 'failed' && (
                  <div className="text-blue-400 animate-pulse flex items-center gap-1.5">
                    <RefreshCw size={10} className="animate-spin" />
                    <span>Awaiting Secure Handshake clearance...</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleResetTerminal}
                className="w-full mt-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold py-2 rounded-xl transition duration-150"
              >
                Clear / Reset Terminal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Settings selectors */}
              {terminalMode !== 'PRE_AUTH_APPROVAL' && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Select Payee Customer */}
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase font-mono block mb-1">Target Account Payee</label>
                    <select
                      value={selectedContactId}
                      onChange={(e) => {
                        playSynthesizedCue('click');
                        setSelectedContactId(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.isMerchant ? 'Merchant' : 'Friend'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Payment Method */}
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase font-mono block mb-1">Billing Card Source</label>
                    <select
                      value={selectedMethodId}
                      onChange={(e) => {
                        playSynthesizedCue('click');
                        setSelectedMethodId(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {paymentMethods.map(m => (
                        <option key={m.id} value={m.id}>{m.name} (${(m.balance ?? 0).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {terminalMode !== 'PRE_AUTH_APPROVAL' && (
                <div>
                  <label className="text-[9px] text-slate-500 uppercase font-mono block mb-1">Handshake Protocol Standard</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!isOnline}
                      onClick={() => {
                        playSynthesizedCue('click');
                        setSelectedProtocol('online_101_1');
                      }}
                      className={`text-xs py-2 px-3 rounded-xl border font-medium flex items-center justify-center gap-1.5 transition ${
                        selectedProtocol === 'online_101_1' && isOnline
                          ? 'bg-blue-950/40 text-blue-400 border-blue-900/60'
                          : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900 disabled:opacity-40'
                      }`}
                    >
                      <Wifi size={13} /> Online 101.1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSynthesizedCue('click');
                        setSelectedProtocol('offline_201_3');
                      }}
                      className={`text-xs py-2 px-3 rounded-xl border font-medium flex items-center justify-center gap-1.5 transition ${
                        selectedProtocol === 'offline_201_3' || !isOnline
                          ? 'bg-amber-950/40 text-amber-400 border-amber-900/60'
                          : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900'
                      }`}
                    >
                      <WifiOff size={13} /> Offline 201.3
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION BUTTON */}
              {terminalMode === 'PRE_AUTH_APPROVAL' ? (
                <button
                  onClick={handleApprovePreAuth}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <FileCheck size={16} /> Settle Capture Hold By Approval Code
                </button>
              ) : (
                <button
                  onClick={handleExecuteTerminalTransaction}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40"
                >
                  <CreditCard size={16} /> 
                  Execute {terminalMode === 'PRE_AUTH' ? 'Pre-Auth Hold' : 'Sale Checkout'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Keypad & Quick Clipboard Controls */}
        <div className="w-full lg:w-[280px] bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-900">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {terminalMode === 'PRE_AUTH_APPROVAL' ? 'Keypad / Approval' : 'Keypad / Pricing'}
              </span>
              <Sparkles size={12} className="text-blue-400 animate-pulse" />
            </div>

            {/* Presets Grid */}
            {terminalMode !== 'PRE_AUTH_APPROVAL' && txStep === 'idle' && (
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[10.00, 25.50, 49.99, 100.00, 250.00, 500.00].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleApplyPreset(val)}
                    className="text-[9px] font-bold font-mono py-1 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-850/60"
                  >
                    ${val.toFixed(0)}
                  </button>
                ))}
              </div>
            )}

            {/* Numerical Tactical Pad */}
            {txStep === 'idle' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '.'].map((keyVal) => {
                  if (terminalMode === 'PRE_AUTH_APPROVAL' && (keyVal === '.' || keyVal === '0')) {
                    // Replace with dash or helper for authorization keys
                    const customizedKey = keyVal === '.' ? '-' : 'PA-';
                    return (
                      <button
                        key={customizedKey}
                        onClick={() => handleKeypadPress(customizedKey)}
                        className="h-10 text-xs font-bold font-mono rounded-xl bg-slate-900 hover:bg-slate-850 text-blue-400 active:scale-[0.95] transition border border-slate-850/60 flex items-center justify-center"
                      >
                        {customizedKey}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={keyVal}
                      onClick={() => handleKeypadPress(keyVal)}
                      className={`h-10 text-xs font-bold font-mono rounded-xl active:scale-[0.95] transition flex items-center justify-center border border-slate-850/60 ${
                        keyVal === 'C' 
                          ? 'bg-rose-950/40 text-rose-400 hover:bg-rose-950/70' 
                          : 'bg-slate-900 hover:bg-slate-850 text-slate-200'
                      }`}
                    >
                      {keyVal}
                    </button>
                  );
                })}
                {/* Backspace spans all 3 columns below */}
                <button
                  onClick={() => handleKeypadPress('⌫')}
                  className="col-span-3 h-10 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 active:scale-[0.95] transition border border-slate-850/60 flex items-center justify-center gap-1"
                >
                  Backspace ⌫
                </button>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="relative inline-block">
                  <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-blue-400 font-mono">
                    POS
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  Settle Handshake in progress...
                </p>
              </div>
            )}
          </div>

          {/* Sidetrack Clipboard with Active Holds */}
          <div className="mt-4 pt-4 border-t border-slate-900 text-left">
            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Active Pre-Auth Holds ({activePreAuths.length})
            </h4>
            <div className="max-h-[110px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
              {activePreAuths.length > 0 ? (
                activePreAuths.map((tx) => (
                  <button
                    key={tx.id}
                    disabled={txStep !== 'idle'}
                    onClick={() => {
                      playSynthesizedCue('click');
                      setTerminalMode('PRE_AUTH_APPROVAL');
                      setApprovalCodeInput(tx.approvalCode || '');
                    }}
                    className="w-full bg-slate-900 hover:bg-blue-950/30 border border-slate-850 hover:border-blue-900/40 p-2 rounded-xl text-[9px] font-mono flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="font-bold text-slate-300 truncate max-w-[110px]">Hold: {tx.receiverName}</div>
                      <div className="text-[8px] text-slate-500">{tx.approvalCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">${tx.amount.toFixed(2)}</div>
                      <div className="text-[7.5px] text-blue-400 uppercase">Apply</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-[9px] text-slate-600 italic">
                  No active holds. Perform a Pre-Auth transaction first.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
