import React, { useState, useEffect, useRef } from 'react';
import { X, Landmark, CreditCard, Wallet, Smartphone, ShieldCheck, Wifi, WifiOff, RefreshCcw, CheckCircle2, AlertTriangle, Play, HelpCircle, Volume2 } from 'lucide-react';
import { Contact, PaymentMethod, ProtocolType, Transaction } from '../types';
import { simulateOnline101Handshake, generateOffline201Token } from '../utils/crypto';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  paymentMethods: PaymentMethod[];
  selectedContact: Contact | null;
  isOnline: boolean;
  onPaymentComplete: (amount: number, contact: Contact, methodId: string, protocol: ProtocolType, note: string, extraDetails: any, status: 'success' | 'pending_sync') => void;
  onAddLog: (step: string, payload: string, type: 'info' | 'success' | 'warning' | 'crypto', protocol: '101.1' | '201.3') => void;
  offlineSequence: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  contacts,
  paymentMethods,
  selectedContact,
  isOnline,
  onPaymentComplete,
  onAddLog,
  offlineSequence
}: PaymentModalProps) {
  // Navigation inside payment modal
  const [step, setStep] = useState<'qr_scan' | 'form' | 'processing' | 'success'>('form');
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [amount, setAmount] = useState('15.50');
  const [note, setNote] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  
  // Custom camera scanner simulation
  const [scannerLaserY, setScannerLaserY] = useState(0);
  const [scanningStatus, setScanningStatus] = useState('Align QR code inside container...');

  // Processing state
  const [processingProtocol, setProcessingProtocol] = useState<ProtocolType>('online_101_1');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [progressLog, setProgressLog] = useState<{ label: string; done: boolean; extra?: string }[]>([]);
  const [offlineQRToken, setOfflineQRToken] = useState('');

  // Audio Context Ref for synthesized chime sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize selected contact if provided
  useEffect(() => {
    if (isOpen) {
      if (selectedContact) {
        setRecipient(selectedContact);
        setStep('form');
      } else {
        setStep('qr_scan');
        setRecipient(null);
      }
      setAmount('15.50');
      setNote('');
      if (paymentMethods.length > 0) {
        // Default to GPay wallet if available, else first method
        const wallet = paymentMethods.find(m => m.type === 'wallet');
        setSelectedMethodId(wallet ? wallet.id : paymentMethods[0].id);
      }
    }
  }, [isOpen, selectedContact, paymentMethods]);

  // QR scan laser animation loop
  useEffect(() => {
    if (step === 'qr_scan') {
      const interval = setInterval(() => {
        setScannerLaserY(prev => (prev >= 100 ? 0 : prev + 2));
      }, 40);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Audio Playback: Synthesizes standard payment chimes
  const playChime = (type: 'online' | 'offline') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      if (type === 'online') {
        // Beautiful major chord chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'sine';

        osc1.frequency.setValueAtTime(523.25, now);
        osc2.frequency.setValueAtTime(659.25, now + 0.1);
        osc3.frequency.setValueAtTime(783.99, now + 0.2);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc3.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.8);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.8);
        osc3.start(now + 0.2);
        osc3.stop(now + 0.8);
      } else {
        // Offline payment acoustic chirp: Rapid sweep up and down to sound like acoustic data transfer
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        
        // Sequence of sweeps
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.15);
        osc.frequency.setValueAtTime(2200, now + 0.15);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.3);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.25);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn("Audio Context playback failed or blocked: ", e);
    }
  };

  const handleSimulatedScan = (merchantContact: Contact) => {
    setScanningStatus(`Found Secure QR Code: ${merchantContact.name}!`);
    setTimeout(() => {
      setRecipient(merchantContact);
      setStep('form');
    }, 800);
  };

  const initiatePayment = async () => {
    if (!recipient || !amount || parseFloat(amount) <= 0) return;
    
    const amountVal = parseFloat(amount);
    const methodSelected = paymentMethods.find(m => m.id === selectedMethodId);
    if (!methodSelected) return;

    // Determine the protocol to run based on current network mode
    const isOfflineMode = !isOnline;
    const protocolType: ProtocolType = isOfflineMode ? 'offline_201_3' : 'online_101_1';
    
    setProcessingProtocol(protocolType);
    setStep('processing');
    setActiveStepIndex(0);

    if (protocolType === 'online_101_1') {
      // ONLINE 101.1
      setProgressLog([
        { label: 'Initializing Secure Session (Phase 1)...', done: false },
        { label: 'Receiving Cryptographic challenge seed (Phase 2)...', done: false },
        { label: 'Solving ECDSA challenge & signing payload (Phase 3)...', done: false },
        { label: 'Clearing ledger with central payment gateway (Phase 4)...', done: false }
      ]);

      try {
        // Log start
        onAddLog("Starting 101.1 Payment Sequence", "Payment amount: $" + amount, "info", "101.1");
        
        // Phase 1
        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(1);
        setProgressLog(prev => prev.map((item, idx) => idx === 0 ? { ...item, done: true, extra: "Handshake Active" } : item));

        // Phase 2
        const cryptoDetails = await simulateOnline101Handshake(
          amountVal,
          "You",
          recipient.name,
          methodSelected.name,
          (step, payload, type) => onAddLog(step, payload, type, "101.1")
        );
        
        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(2);
        setProgressLog(prev => prev.map((item, idx) => idx === 1 ? { ...item, done: true, extra: `Seed: ${cryptoDetails.seed}` } : item));

        // Phase 3
        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(3);
        setProgressLog(prev => prev.map((item, idx) => idx === 2 ? { ...item, done: true, extra: `Signature: ${cryptoDetails.signature.slice(0, 12)}...` } : item));

        // Phase 4
        await new Promise(r => setTimeout(r, 600));
        setProgressLog(prev => prev.map((item, idx) => idx === 3 ? { ...item, done: true, extra: ` cleared in ${cryptoDetails.latency}ms` } : item));

        // Play positive sound chime
        playChime('online');

        // Complete Transaction callback
        onPaymentComplete(
          amountVal,
          recipient,
          selectedMethodId,
          'online_101_1',
          note,
          {
            handshakeLatency: cryptoDetails.latency,
            signature: cryptoDetails.signature,
            tokenSeed: cryptoDetails.seed,
            deviceFingerprint: cryptoDetails.fingerprint
          },
          'success'
        );

        setStep('success');
      } catch (err) {
        console.error("Online protocol failure: ", err);
      }

    } else {
      // OFFLINE 201.3
      setProgressLog([
        { label: 'Triage local network connectivity (Offline mode)...', done: false },
        { label: 'Accessing secure enclave key to sign offline bundle...', done: false },
        { label: 'Generating compressed TOTP-201.3 payload token...', done: false },
        { label: 'Broadcasting Acoustic Sound Wave payload (19kHz)...', done: false }
      ]);

      try {
        onAddLog("Starting 201.3 Offline Payment Sequence", "Payment amount: $" + amount, "info", "201.3");
        
        // Phase 1
        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(1);
        setProgressLog(prev => prev.map((item, idx) => idx === 0 ? { ...item, done: true, extra: "Active Offline" } : item));

        // Phase 2
        const offlineData = generateOffline201Token(
          amountVal,
          "You",
          recipient.name,
          methodSelected.name,
          offlineSequence,
          (step, payload, type) => onAddLog(step, payload, type, "201.3")
        );
        
        setOfflineQRToken(offlineData.token);

        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(2);
        setProgressLog(prev => prev.map((item, idx) => idx === 1 ? { ...item, done: true, extra: `AuthCode: ${offlineData.authCode}` } : item));

        // Phase 3
        await new Promise(r => setTimeout(r, 600));
        setActiveStepIndex(3);
        setProgressLog(prev => prev.map((item, idx) => idx === 2 ? { ...item, done: true, extra: `Size: ${offlineData.payloadSize} bytes` } : item));

        // Phase 4
        // Sound pulse simulation
        playChime('offline');
        
        await new Promise(r => setTimeout(r, 1200)); // allow longer soundwave broadcast visualization
        setProgressLog(prev => prev.map((item, idx) => idx === 3 ? { ...item, done: true, extra: "Acoustic sequence transmitted" } : item));

        // Complete Transaction callback (status is pending_sync!)
        onPaymentComplete(
          amountVal,
          recipient,
          selectedMethodId,
          'offline_201_3',
          note,
          {
            signature: offlineData.signature,
            offlineAuthCode: offlineData.authCode,
            payloadSize: offlineData.payloadSize,
            sequence: offlineSequence
          },
          'pending_sync'
        );

        setStep('success');
      } catch (err) {
        console.error("Offline protocol failure: ", err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <ShieldCheck size={18} className="text-blue-400" />
            <span>Secure GPay gateway</span>
          </h2>
          <button
            id="close-payment-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal content body based on step */}
        {step === 'qr_scan' && (
          <div className="p-6 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Simulated QR Scanner</h3>
            <p className="text-xs text-slate-400 text-center mb-5">Align a merchant QR code below to scan. Select a merchant to simulate scanner read.</p>
            
            {/* Viewfinder frame */}
            <div className="relative w-56 h-56 border-2 border-slate-700 rounded-3xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center mb-6 shadow-inner">
              
              {/* Scan Laser effect */}
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                style={{ top: `${scannerLaserY}%` }}
              ></div>

              {/* Scanning markers */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-md"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-md"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-md"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-md"></div>

              <div className="text-center p-4">
                <Smartphone size={28} className="mx-auto text-slate-500 mb-2 animate-bounce" />
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md max-w-[180px] block truncate">
                  {scanningStatus}
                </span>
              </div>
            </div>

            {/* Quick simulated scan options */}
            <div className="w-full space-y-2">
              <h4 className="text-xs font-semibold text-slate-400">Scan Simulated Merchant QR Code:</h4>
              <div className="grid grid-cols-3 gap-2">
                {contacts.filter(c => c.isMerchant).map(merchant => (
                  <button
                    key={merchant.id}
                    id={`scan-merchant-${merchant.id}-btn`}
                    onClick={() => handleSimulatedScan(merchant)}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 hover:border-slate-650 border border-slate-700/60 rounded-xl flex flex-col items-center transition-all text-center"
                  >
                    <span className="text-lg">{merchant.avatarText}</span>
                    <span className="text-[10px] font-medium text-slate-200 mt-1 truncate w-full">{merchant.name}</span>
                  </button>
                ))}
              </div>
              <div className="pt-2 flex justify-center">
                <button
                  id="scanner-switch-manual-btn"
                  onClick={() => {
                    // Set default to first contact
                    setRecipient(contacts[0]);
                    setStep('form');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Or enter payment details manually
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'form' && recipient && (
          <div className="p-6 space-y-4">
            
            {/* Recipient Card */}
            <div className="flex items-center justify-between bg-slate-850/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${recipient.avatarColor} flex items-center justify-center font-bold text-white shadow`}>
                  {recipient.avatarText}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{recipient.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{recipient.upiId || recipient.phone}</p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex flex-col items-end">
                {recipient.isMerchant ? (
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Verified Merchant
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    Contact
                  </span>
                )}
                
                {/* Protocol badge predicting action */}
                <div className="mt-1 flex items-center text-[10px] text-slate-400">
                  {isOnline ? (
                    <span className="flex items-center space-x-1 font-mono text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30">
                      <Wifi size={10} />
                      <span>101.1 Protocol</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 font-mono text-amber-400 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                      <WifiOff size={10} />
                      <span>201.3 Protocol</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* If opening scanner menu but want to change contact */}
            {!selectedContact && (
              <div className="flex justify-end mt-[-10px]">
                <button
                  id="change-recipient-btn"
                  onClick={() => setStep('qr_scan')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                >
                  Change Recipient / Scan QR
                </button>
              </div>
            )}

            {/* Amount inputs */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Enter Transfer Amount ($)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">$</span>
                <input
                  id="payment-amount-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-slate-850 border border-slate-700 rounded-2xl text-2xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Add Note / Description (Optional)</label>
              <input
                id="payment-note-input"
                type="text"
                placeholder="What's this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Payment Method Select */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Choose Payment Method</label>
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    id={`select-pay-method-${method.id}`}
                    type="button"
                    onClick={() => setSelectedMethodId(method.id)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                      selectedMethodId === method.id
                        ? 'bg-blue-950/80 border-blue-500 text-blue-100 shadow-md'
                        : 'bg-slate-850/40 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-1.5 rounded-lg ${
                        selectedMethodId === method.id ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {method.type === 'wallet' ? (
                          <Wallet size={14} />
                        ) : method.type === 'bank_account' ? (
                          <Landmark size={14} />
                        ) : (
                          <CreditCard size={14} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-200">{method.name}</p>
                        <p className="text-[10px] text-slate-400">{method.provider} • {method.number}</p>
                      </div>
                    </div>
                    {method.balance !== undefined && (
                      <span className="text-xs font-mono font-bold text-slate-200">
                        ${method.balance.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Protocol security prompt */}
            <div className={`p-3 rounded-2xl border text-[11px] leading-relaxed flex items-start space-x-2 ${
              isOnline
                ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
                : 'bg-amber-950/20 border-amber-900/30 text-amber-400'
            }`}>
              {isOnline ? (
                <>
                  <Wifi size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Protocol 101.1 (Online Handshake) Active.</span> Operates with a multi-step key signing procedure directly synced with central routing gateway for instantaneous settlement.
                  </div>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Protocol 201.3 (Offline Acoustic) Active.</span> Encodes payment in local cryptographically signed tokens. Transmits via dynamic high-density QR payload and micro-acoustic wave pulses.
                  </div>
                </>
              )}
            </div>

            {/* Pay Button */}
            <button
              id="confirm-pay-submit-btn"
              onClick={initiatePayment}
              disabled={!amount || parseFloat(amount) <= 0}
              className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-lg active:scale-[0.98] mt-2 flex items-center justify-center space-x-1.5 ${
                !amount || parseFloat(amount) <= 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isOnline
                    ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-900/10'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/10'
              }`}
            >
              <ShieldCheck size={16} />
              <span>
                Pay ${parseFloat(amount || '0').toFixed(2)} with{' '}
                {isOnline ? 'Online 101.1' : 'Offline 201.3'}
              </span>
            </button>

          </div>
        )}

        {step === 'processing' && (
          <div className="p-8 flex flex-col items-center">
            
            {/* Spinning radar visual for sound wave / online load */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-6">
              {processingProtocol === 'offline_201_3' ? (
                // Pulsing radar ripple for acoustic waves
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute w-24 h-24 border border-amber-500/20 rounded-full animate-ping"></div>
                  <div className="absolute w-16 h-16 border border-amber-500/40 rounded-full animate-ping [animation-delay:0.3s]"></div>
                  <div className="absolute w-8 h-8 bg-amber-500/20 rounded-full animate-pulse"></div>
                  <Volume2 size={24} className="text-amber-400 z-10 animate-bounce" />
                </div>
              ) : (
                // Tech spinning loader for handshake
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute w-24 h-24 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute w-16 h-16 border-r-2 border-l-2 border-teal-500/50 rounded-full animate-spin [animation-direction:reverse]"></div>
                  <Smartphone size={24} className="text-blue-400 z-10 animate-pulse" />
                </div>
              )}
            </div>

            <h3 className="text-sm font-bold text-white mb-1.5">
              {processingProtocol === 'online_101_1' ? 'Executing Online 101.1 Handshake' : 'Broadcasting Offline 201.3 Sequence'}
            </h3>
            <p className="text-xs text-slate-400 text-center mb-6">
              {processingProtocol === 'online_101_1' 
                ? 'Securing connection with decentralized clearing gateways...' 
                : 'Emitting acoustic chirp packets to local merchant. Please keep device close.'}
            </p>

            {/* Handshake Phase list */}
            <div className="w-full bg-slate-950 rounded-2xl p-4 border border-slate-850/80 space-y-3 font-mono text-left">
              {progressLog.map((log, index) => {
                const isActive = index === activeStepIndex;
                const isPassed = index < activeStepIndex;
                
                return (
                  <div key={index} className="flex items-start justify-between text-[11px]">
                    <div className="flex items-start space-x-2.5">
                      {isPassed ? (
                        <span className={`font-bold ${processingProtocol === 'online_101_1' ? 'text-emerald-400' : 'text-amber-400'}`}>[OK]</span>
                      ) : isActive ? (
                        <span className="text-blue-400 animate-pulse font-bold">[&gt;]</span>
                      ) : (
                        <span className="text-slate-600">[..]</span>
                      )}
                      
                      <span className={`${
                        isPassed ? 'text-slate-400 line-through' : isActive ? 'text-white font-medium' : 'text-slate-500'
                      }`}>
                        {log.label}
                      </span>
                    </div>

                    {log.extra && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[150px] bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                        {log.extra}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'success' && recipient && (
          <div className="p-8 flex flex-col items-center">
            
            <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <CheckCircle2 size={36} className="animate-in zoom-in duration-300" />
            </div>

            <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-3 py-1 rounded-full font-bold tracking-widest mb-1.5">
              {processingProtocol === 'online_101_1' ? 'Protocol 101.1 Successful' : 'Protocol 201.3 Cached'}
            </span>

            <div className="text-center space-y-1 mb-5">
              <h3 className="text-lg font-bold text-white">Payment of ${parseFloat(amount).toFixed(2)} completed</h3>
              <p className="text-xs text-slate-400">
                To <span className="font-semibold text-slate-200">{recipient.name}</span>
              </p>
              {note && <p className="text-xs text-slate-400 italic">"{note}"</p>}
            </div>

            {/* Offline QR token display for visual detail */}
            {processingProtocol === 'offline_201_3' && offlineQRToken && (
              <div className="w-full bg-slate-950 rounded-2xl p-4 border border-slate-850/80 mb-5 text-center">
                <span className="text-[10px] text-amber-400 font-mono block mb-2">Offline Dynamic High-Density QR Payload:</span>
                <div className="bg-white p-2 rounded-xl inline-block mb-2">
                  {/* Styled block simulating highly detailed QR */}
                  <div className="w-24 h-24 grid grid-cols-6 gap-[1px]">
                    {Array.from({ length: 36 }).map((_, i) => {
                      const isDark = (i * 7 + 13) % 3 === 0 || (i % 5 === 0) || i < 6 || i > 30 || (i % 6 === 0);
                      return (
                        <div key={i} className={`w-full h-full rounded-[1px] ${isDark ? 'bg-black' : 'bg-white'}`}></div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-500 break-all select-all px-2 border-t border-slate-900 pt-2 text-left">
                  <span className="text-slate-400">Payload:</span> {offlineQRToken.slice(0, 80)}...
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-850 border border-slate-800 rounded-2xl text-[11px] leading-relaxed text-slate-400 text-center w-full">
              {processingProtocol === 'online_101_1' ? (
                <span>Cleared instantaneously! The transaction has been settled inside the GPay decentralized ledger safely.</span>
              ) : (
                <span>
                  <strong className="text-amber-400 font-bold block mb-0.5">⚠️ Offline Storage Logged!</strong> 
                  Your token has been transmitted acoustic-ultrasound wave/QR. We cached this transaction locally. It will auto-settle the instant you regain Online status.
                </span>
              )}
            </div>

            <button
              id="payment-success-close-btn"
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl text-xs font-semibold transition-all shadow-md mt-5 active:scale-[0.98]"
            >
              Done & Back to Wallet
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
