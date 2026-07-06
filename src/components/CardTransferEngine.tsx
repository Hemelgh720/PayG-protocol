import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Landmark, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Database, 
  HelpCircle, 
  CheckCircle, 
  Activity, 
  Settings, 
  RefreshCcw, 
  Sliders, 
  Terminal, 
  Layers, 
  Sparkles, 
  Zap,
  Globe,
  Lock
} from 'lucide-react';
import { PaymentMethod, Transaction, ProtocolLog } from '../types';

interface CardTransferEngineProps {
  paymentMethods: PaymentMethod[];
  onAddTransaction: (
    amount: number,
    contact: any,
    methodId: string,
    protocol: 'online_101_1' | 'offline_201_3',
    note: string,
    extraDetails: any,
    status: 'success' | 'pending_sync'
  ) => void;
  onAddLog: (
    step: string, 
    payload: string, 
    type: 'info' | 'success' | 'warning' | 'crypto',
    protocol: '101.1' | '201.3' | 'SYSTEM'
  ) => void;
  triggerToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  isOnline: boolean;
  isLiveMode?: boolean;
}

export default function CardTransferEngine({
  paymentMethods,
  onAddTransaction,
  onAddLog,
  triggerToast,
  isOnline,
  isLiveMode = false
}: CardTransferEngineProps) {
  const [activeTab, setActiveTab] = useState<'card_to_card' | 'card_bank_card' | 'env_config'>('card_to_card');
  
  // --- CARD TO CARD STATE ---
  const [c2cSourceId, setC2cSourceId] = useState<string>('');
  const [c2cTargetType, setC2cTargetType] = useState<'linked' | 'custom'>('linked');
  const [c2cTargetId, setC2cTargetId] = useState<string>('');
  const [c2cCustomNumber, setC2cCustomNumber] = useState<string>('4111 2222 3333 4444');
  const [c2cCustomName, setC2cCustomName] = useState<string>('Alex Johnson');
  const [c2cAmount, setC2cAmount] = useState<string>('120.00');
  const [c2cProtocol, setC2cProtocol] = useState<'online_101_1' | 'offline_201_3'>('online_101_1');
  const [c2cTxMode, setC2cTxMode] = useState<'sale' | 'pre_auth'>('sale');
  const [c2cSimulating, setC2cSimulating] = useState<boolean>(false);
  const [c2cSimSteps, setC2cSimSteps] = useState<{ label: string; done: boolean; extra?: string }[]>([]);

  // --- CARD TO BANK TO CARD STATE ---
  const [cbcSourceId, setCbcSourceId] = useState<string>('');
  const [cbcBankId, setCbcBankId] = useState<string>('');
  const [cbcDestId, setCbcDestId] = useState<string>('');
  const [cbcAmount, setCbcAmount] = useState<string>('250.00');
  const [cbcProtocol, setCbcProtocol] = useState<'online_101_1' | 'offline_201_3'>('online_101_1');
  const [cbcSimulating, setCbcSimulating] = useState<boolean>(false);
  const [cbcSimSteps, setCbcSimSteps] = useState<{ label: string; done: boolean; extra?: string }[]>([]);

  // --- CONFIGURABLE ENV STATE ---
  const [envCryptoStrength, setEnvCryptoStrength] = useState<string>('ECDSA_P256');
  const [envHandshakeTimeout, setEnvHandshakeTimeout] = useState<number>(350);
  const [envGatewayKey, setEnvGatewayKey] = useState<string>('gpay_secure_live_key_99348');
  const [envMockLatency, setEnvMockLatency] = useState<number>(150);
  const [envPreAuthDuration, setEnvPreAuthDuration] = useState<number>(3600);
  const [envEnclaveSigning, setEnvEnclaveSigning] = useState<boolean>(true);

  // Filter linked cards and bank accounts
  const cardMethods = paymentMethods.filter(m => m.type === 'credit_card' || m.type === 'debit_card');
  const bankMethods = paymentMethods.filter(m => m.type === 'bank_account');

  // Initialize dropdowns with existing values
  useEffect(() => {
    if (cardMethods.length > 0) {
      if (!c2cSourceId) setC2cSourceId(cardMethods[0].id);
      if (!c2cTargetId && cardMethods.length > 1) setC2cTargetId(cardMethods[1].id);
      if (!cbcSourceId) setCbcSourceId(cardMethods[0].id);
      if (!cbcDestId && cardMethods.length > 1) setCbcDestId(cardMethods[1].id);
    }
    if (bankMethods.length > 0 && !cbcBankId) {
      setCbcBankId(bankMethods[0].id);
    }
  }, [paymentMethods]);

  // --- RUN CARD TO CARD SIMULATION ---
  const handleRunC2c = async () => {
    const amountVal = parseFloat(c2cAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      triggerToast("Please enter a valid transfer amount", "warning");
      return;
    }

    const source = paymentMethods.find(m => m.id === c2cSourceId);
    if (!source) {
      triggerToast("Please select a valid source card", "warning");
      return;
    }

    if (source.balance !== undefined && source.balance < amountVal) {
      triggerToast(`Insufficient funds on ${source.name}! Balance: $${source.balance.toFixed(2)}`, "warning");
      return;
    }

    let targetName = "";
    if (c2cTargetType === 'linked') {
      const target = paymentMethods.find(m => m.id === c2cTargetId);
      if (!target) {
        triggerToast("Please select a target card", "warning");
        return;
      }
      if (source.id === target.id) {
        triggerToast("Source and Target cards cannot be the same!", "warning");
        return;
      }
      targetName = target.name;
    } else {
      if (!c2cCustomName || !c2cCustomNumber) {
        triggerToast("Please enter target card name and number", "warning");
        return;
      }
      targetName = `${c2cCustomName} (*${c2cCustomNumber.slice(-4)})`;
    }

    setC2cSimulating(true);
    const modeStr = c2cTxMode === 'sale' ? 'Sale Capture' : 'Pre-Authorization Hold';
    const protoLabel = c2cProtocol === 'online_101_1' ? 'Online 101.1 (Handshake)' : 'Offline 201.3 (Acoustic/QR)';
    
    // Set up step indicators
    setC2cSimSteps([
      { label: isLiveMode ? `[LIVE HSM] Connecting to AWS CloudHSM v3 (${modeStr})...` : `Initializing Card-to-Card Router in ${modeStr} mode...`, done: false },
      { label: isLiveMode ? `[LIVE HSM] Authenticating Enclave Co-Processor with ${envCryptoStrength}...` : `Negotiating ${protoLabel} cryptographic token...`, done: false },
      { label: isLiveMode ? `[LIVE HSM] Dual-Signing payload with hardware production key...` : `Evaluating Enclave security parameters (Strength: ${envCryptoStrength})...`, done: false },
      { label: isLiveMode ? `[LIVE HSM] Settle ledger debit of $${amountVal.toFixed(2)} with Live Gateway...` : `Settling ledger debit from ${source.name}...`, done: false },
      { label: isLiveMode ? `[LIVE HSM] Done: Credit settlement broadcast to ${targetName}...` : `Broadcasting credits to destination: ${targetName}...`, done: false }
    ]);

    try {
      // Step 1
      await new Promise(r => setTimeout(r, envMockLatency + 200));
      setC2cSimSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, done: true } : s));
      onAddLog(
        isLiveMode ? "[LIVE MODE] Card-to-Card Handshake Initiated" : "Card-to-Card Handshake Initiated", 
        JSON.stringify({
          source_card: source.name,
          source_type: source.type,
          target_card: targetName,
          amount: amountVal,
          protocol: c2cProtocol === 'online_101_1' ? '101.1' : '201.3',
          mode: c2cTxMode,
          environment: isLiveMode ? "PRODUCTION_LIVE" : "SANDBOX_MOCK",
          handshake_timeout: `${envHandshakeTimeout}ms`
        }, null, 2), 
        "info", 
        c2cProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      // Step 2
      await new Promise(r => setTimeout(r, envMockLatency + 300));
      setC2cSimSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, done: true, extra: isLiveMode ? `OK (LIVE)` : `OK (ECC)` } : s));
      onAddLog(
        isLiveMode ? "[LIVE MODE] Hardware Signature Negotiated" : "Card-to-Card Signature Negotiation", 
        JSON.stringify({
          crypto_algorithm: envCryptoStrength,
          secure_enclave_enabled: envEnclaveSigning,
          gateway_authorization_key: envGatewayKey.slice(0, 10) + "...",
          enclave_status: isLiveMode ? "HSM_PROD_READY" : "SANDBOX_MOCK",
          hash: "SHA256_HASH_SALT_348982348"
        }, null, 2), 
        "crypto", 
        c2cProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      // Step 3
      await new Promise(r => setTimeout(r, envMockLatency + 250));
      setC2cSimSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, done: true } : s));

      // Step 4
      await new Promise(r => setTimeout(r, envMockLatency + 400));
      setC2cSimSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, done: true, extra: `-$${amountVal.toFixed(2)}` } : s));

      // Step 5
      await new Promise(r => setTimeout(r, envMockLatency + 350));
      setC2cSimSteps(prev => prev.map((s, idx) => idx === 4 ? { ...s, done: true, extra: `+$${amountVal.toFixed(2)}` } : s));

      // Build Approval Code
      const appCode = `AP_C2C_${Math.floor(Math.random() * 900000 + 100000)}`;

      // Complete Transaction
      onAddTransaction(
        amountVal,
        {
          id: `c2c_${Math.floor(Math.random() * 1000)}`,
          name: targetName,
          phone: "Card Routing",
          upiId: "card2card@payg",
          avatarColor: "from-blue-600 to-indigo-700",
          isMerchant: false,
          avatarText: "💳"
        } as any,
        source.id,
        c2cProtocol,
        `Direct Card-to-Card Routing (${modeStr})`,
        {
          signature: isLiveMode 
            ? "LIVE_HSM_SIG_" + Math.random().toString(36).substring(7).toUpperCase()
            : "ECDSA_P256_SIG_" + Math.random().toString(36).substring(7).toUpperCase(),
          offlineAuthCode: c2cProtocol === 'offline_201_3' ? appCode : undefined,
          payloadSize: 128,
          sequence: 22,
          mode: c2cTxMode,
          approvalCode: appCode,
          isCaptured: c2cTxMode !== 'pre_auth'
        },
        c2cProtocol === 'offline_201_3' && !isOnline ? 'pending_sync' : 'success'
      );

      // Adjust mock balances locally
      if (source.balance !== undefined) {
        source.balance -= amountVal;
      }
      if (c2cTargetType === 'linked') {
        const target = paymentMethods.find(m => m.id === c2cTargetId);
        if (target && target.balance !== undefined && c2cTxMode === 'sale') {
          target.balance += amountVal;
        }
      }

      onAddLog(
        isLiveMode ? "[LIVE MODE] Card-to-Card Ledger Settled" : "Card-to-Card Ledger Settled", 
        JSON.stringify({
          status: "SUCCESS",
          approval_code: appCode,
          source_card_debited: source.name,
          target_card_credited: targetName,
          final_balance_change: `-$${amountVal.toFixed(2)} -> +$${amountVal.toFixed(2)}`,
          clearing_timestamp: new Date().toISOString(),
          sec_environment: isLiveMode ? "LIVE_CO_PROCESSOR_ENCLAVE_ACTIVE" : "SANDBOX_MOCK",
          hsm_signature: isLiveMode ? "LIVE_KEY_AUTHORIZED" : "NONE"
        }, null, 2), 
        "success", 
        c2cProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      triggerToast(isLiveMode ? `Live Card-to-Card Payment Complete! Code: ${appCode}` : `Card-to-Card Routing Complete! Code: ${appCode}`, "success");
    } catch (err) {
      console.error(err);
      triggerToast("C2C transfer simulation failed", "warning");
    } finally {
      setC2cSimulating(false);
    }
  };

  // --- RUN CARD-TO-BANK-TO-CARD MULTI-HOP SIMULATION ---
  const handleRunCbc = async () => {
    const amountVal = parseFloat(cbcAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      triggerToast("Please enter a valid amount", "warning");
      return;
    }

    const source = paymentMethods.find(m => m.id === cbcSourceId);
    const bank = paymentMethods.find(m => m.id === cbcBankId);
    const dest = paymentMethods.find(m => m.id === cbcDestId);

    if (!source || !bank || !dest) {
      triggerToast("Please populate all three hops", "warning");
      return;
    }

    if (source.id === dest.id) {
      triggerToast("Source and Destination cards must be distinct!", "warning");
      return;
    }

    if (source.balance !== undefined && source.balance < amountVal) {
      triggerToast(`Insufficient funds on ${source.name}!`, "warning");
      return;
    }

    setCbcSimulating(true);
    const protoLabel = cbcProtocol === 'online_101_1' ? '101.1 Online' : '201.3 Offline';

    setCbcSimSteps([
      { label: isLiveMode ? `[LIVE] Outbound debit authorization from: ${source.name}...` : `Hop 1: Requesting debit from source: ${source.name}...`, done: false },
      { label: isLiveMode ? `[LIVE] Clearing settlement via Enclave vault: ${bank.name}...` : `Hop 2: Clearing through ACH vault: ${bank.name}...`, done: false },
      { label: isLiveMode ? `[LIVE] Real-time hardware push credit to destination: ${dest.name}...` : `Hop 3: Final credit push to destination: ${dest.name}...`, done: false },
      { label: isLiveMode ? `[LIVE] Verifying dual-signed HSM multi-hop cryptographic chains...` : `Verifying multi-hop cryptographic signature chains...`, done: false }
    ]);

    try {
      // Hop 1
      await new Promise(r => setTimeout(r, envMockLatency + 400));
      setCbcSimSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, done: true, extra: `Debited -$${amountVal}` } : s));
      onAddLog(
        isLiveMode ? "[LIVE MODE] Multi-Hop Phase 1: Outbound Clearing" : "Multi-Hop Phase 1: Card Outbound", 
        JSON.stringify({
          hop: "1/3",
          action: "CARD_DEBIT",
          card_name: source.name,
          amount: amountVal,
          verification: isLiveMode ? "LIVE_HSM_TOKEN_GENERATED" : "ENCLAVE_TOKEN_GENERATED",
          environment: isLiveMode ? "PRODUCTION" : "SANDBOX"
        }, null, 2), 
        "info", 
        cbcProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      // Hop 2
      await new Promise(r => setTimeout(r, envMockLatency + 450));
      setCbcSimSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, done: true, extra: isLiveMode ? `Cleared (Enclave)` : `Cleared via Bank` } : s));
      onAddLog(
        isLiveMode ? "[LIVE MODE] Multi-Hop Phase 2: HSM Bank Settlement" : "Multi-Hop Phase 2: Bank ACH Settlement", 
        JSON.stringify({
          hop: "2/3",
          action: "BANK_CLEARING_INTERMEDIATE",
          bank_name: bank.name,
          clearing_routing: bank.number || "ACH_9934",
          clearing_auth: "AUTH_ROUTING_SUCCESS",
          hsm_slot: isLiveMode ? "SLOT_04_PROD" : "SLOT_TEST_MOCK"
        }, null, 2), 
        "crypto", 
        cbcProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      // Hop 3
      await new Promise(r => setTimeout(r, envMockLatency + 500));
      setCbcSimSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, done: true, extra: `Credited +$${amountVal}` } : s));
      
      // Hop 4 (validation verification)
      await new Promise(r => setTimeout(r, envMockLatency + 300));
      setCbcSimSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, done: true, extra: isLiveMode ? `Chain Verified (Live)` : `Chain Verified` } : s));

      const appCode = `AP_CBC_${Math.floor(Math.random() * 900000 + 100000)}`;

      // Record transaction
      onAddTransaction(
        amountVal,
        {
          id: `cbc_${Math.floor(Math.random() * 1000)}`,
          name: dest.name,
          phone: "Multi-Hop Route",
          upiId: "card2bank2card@payg",
          avatarColor: "from-teal-600 to-emerald-700",
          isMerchant: false,
          avatarText: "🔄"
        } as any,
        source.id,
        cbcProtocol,
        isLiveMode ? `Direct Multi-Hop Cleared (Live Enclave)` : `Multi-Hop Card ➔ Bank ➔ Card Route`,
        {
          signature: isLiveMode 
            ? "LIVE_HSM_CHAIN_SIG_" + Math.random().toString(36).substring(7).toUpperCase()
            : "ECDSA_CHAIN_SIG_" + Math.random().toString(36).substring(7).toUpperCase(),
          offlineAuthCode: cbcProtocol === 'offline_201_3' ? appCode : undefined,
          payloadSize: 256,
          sequence: 45,
          mode: 'bank_transfer',
          approvalCode: appCode,
          isCaptured: true
        },
        cbcProtocol === 'offline_201_3' && !isOnline ? 'pending_sync' : 'success'
      );

      // Adjust mock balances
      if (source.balance !== undefined) source.balance -= amountVal;
      if (dest.balance !== undefined) dest.balance += amountVal;

      onAddLog(
        isLiveMode ? "[LIVE MODE] Multi-Hop Route Settled" : "Multi-Hop Route Settled", 
        JSON.stringify({
          status: "ROUTED_SUCCESS",
          approval_code: appCode,
          route_path: `${source.name} -> ${bank.name} -> ${dest.name}`,
          intermediate_ach_ref: "ACH_REF_" + Math.floor(Math.random() * 900000 + 100000),
          cryptographic_chain_strength: envCryptoStrength,
          environment: isLiveMode ? "PRODUCTION_HSM_LIVE" : "SANDBOX"
        }, null, 2), 
        "success", 
        cbcProtocol === 'online_101_1' ? '101.1' : '201.3'
      );

      triggerToast(isLiveMode ? `Live Multi-Hop payment settled! Code: ${appCode}` : `Multi-Hop Route cleared successfully! Code: ${appCode}`, "success");
    } catch (err) {
      console.error(err);
      triggerToast("Multi-hop transaction simulation failed", "warning");
    } finally {
      setCbcSimulating(false);
    }
  };

  return (
    <section className="px-4 py-3 max-w-4xl mx-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        
        {/* Header and tabs selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
          <div className="flex items-center space-x-2">
            <Zap size={18} className={isLiveMode ? "text-emerald-400 animate-pulse" : "text-yellow-400"} />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">PayG Multi-Route Clearing Engine</h3>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border font-bold tracking-wider uppercase ${
                  isLiveMode 
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30 animate-pulse' 
                    : 'bg-slate-950 text-slate-500 border-slate-850'
                }`}>
                  {isLiveMode ? 'LIVE ENCLAVE' : 'DEMO SANDBOX'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Simulate card to card, multi-hop routing, and security variables</p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-850 self-start sm:self-center">
            <button
              id="tab-c2c-btn"
              onClick={() => setActiveTab('card_to_card')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'card_to_card'
                  ? 'bg-slate-800 text-white border border-slate-700/60 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <CreditCard size={13} />
              <span>Card-to-Card</span>
            </button>
            <button
              id="tab-cbc-btn"
              onClick={() => setActiveTab('card_bank_card')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'card_bank_card'
                  ? 'bg-slate-800 text-white border border-slate-700/60 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <RefreshCcw size={13} />
              <span>Card-Bank-Card</span>
            </button>
            <button
              id="tab-env-btn"
              onClick={() => setActiveTab('env_config')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'env_config'
                  ? 'bg-slate-800 text-white border border-slate-700/60 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Sliders size={13} />
              <span>Security Config</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CARD TO CARD ROUTER */}
        {activeTab === 'card_to_card' && (
          <div className="space-y-4">
            {cardMethods.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-850">
                <p>No credit/debit cards available in your secure balance container yet.</p>
                <p className="mt-1 text-[10px] text-slate-600">Please scroll up to "Link Payment Methods" and add Visa or Mastercard debit/credit cards first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Form column */}
                <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-850/75">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 font-mono block">Direct Card Router</span>
                  
                  {/* Source Card dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Source Card Account (Sender)</label>
                    <select
                      id="c2c-source-select"
                      value={c2cSourceId}
                      onChange={(e) => setC2cSourceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {cardMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - ${m.balance?.toFixed(2)} ({m.number})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Card selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400">Target Card Destination (Receiver)</label>
                      <div className="flex space-x-2 text-[10px]">
                        <button
                          id="c2c-target-linked-btn"
                          type="button"
                          onClick={() => setC2cTargetType('linked')}
                          className={`font-semibold ${c2cTargetType === 'linked' ? 'text-blue-400 underline' : 'text-slate-500'}`}
                        >
                          My Cards
                        </button>
                        <button
                          id="c2c-target-custom-btn"
                          type="button"
                          onClick={() => setC2cTargetType('custom')}
                          className={`font-semibold ${c2cTargetType === 'custom' ? 'text-blue-400 underline' : 'text-slate-500'}`}
                        >
                          Custom Card
                        </button>
                      </div>
                    </div>

                    {c2cTargetType === 'linked' ? (
                      <select
                        id="c2c-target-select"
                        value={c2cTargetId}
                        onChange={(e) => setC2cTargetId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        {cardMethods.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} - ${m.balance?.toFixed(2)} ({m.number})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2 mt-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <input
                          id="c2c-custom-number-input"
                          type="text"
                          placeholder="Card Number (xxxx xxxx xxxx xxxx)"
                          value={c2cCustomNumber}
                          onChange={(e) => setC2cCustomNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          id="c2c-custom-name-input"
                          type="text"
                          placeholder="Cardholder Friendly Name"
                          value={c2cCustomName}
                          onChange={(e) => setC2cCustomName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Amount and Mode in grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Transfer Amount ($)</label>
                      <input
                        id="c2c-amount-input"
                        type="number"
                        step="0.01"
                        value={c2cAmount}
                        onChange={(e) => setC2cAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Clearing Mode</label>
                      <select
                        id="c2c-tx-mode-select"
                        value={c2cTxMode}
                        onChange={(e) => setC2cTxMode(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="sale">Direct Sale</option>
                        <option value="pre_auth">Pre-Auth Hold</option>
                      </select>
                    </div>
                  </div>

                  {/* Protocol Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Clearing Protocol</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="c2c-protocol-online-btn"
                        type="button"
                        onClick={() => setC2cProtocol('online_101_1')}
                        className={`py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                          c2cProtocol === 'online_101_1'
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        Online 101.1 Protocol
                      </button>
                      <button
                        id="c2c-protocol-offline-btn"
                        type="button"
                        onClick={() => setC2cProtocol('offline_201_3')}
                        className={`py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                          c2cProtocol === 'offline_201_3'
                            ? 'bg-amber-950 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        Offline 201.3 Protocol
                      </button>
                    </div>
                  </div>

                  {/* Trigger Action */}
                  <button
                    id="run-c2c-simulation-btn"
                    onClick={handleRunC2c}
                    disabled={c2cSimulating}
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {c2cSimulating ? (
                      <>
                        <RefreshCcw size={13} className="animate-spin" />
                        <span>Running Router Simulation...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={13} />
                        <span>Initiate Direct Card-to-Card Route</span>
                      </>
                    )}
                  </button>

                </div>

                {/* Animated progress tracking column */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block mb-2.5">Live Execution Output</span>
                    
                    {c2cSimulating || c2cSimSteps.length > 0 ? (
                      <div className="space-y-2.5 font-mono text-[10px]">
                        {c2cSimSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start space-x-2 text-slate-300">
                            {step.done ? (
                              <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                              <Activity size={12} className="text-blue-500 mt-0.5 animate-pulse shrink-0" />
                            )}
                            <div className="flex-1">
                              <span className={step.done ? 'text-slate-400' : 'text-slate-100 font-medium'}>
                                {step.label}
                              </span>
                              {step.extra && (
                                <span className="ml-1.5 text-[9px] bg-slate-900 text-emerald-400 border border-slate-800 px-1 py-0.2 rounded font-semibold">
                                  {step.extra}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-44 flex flex-col items-center justify-center text-slate-600 text-center py-6">
                        <Cpu size={24} className="opacity-30 mb-2" />
                        <p className="text-[10px]">Configure your source & target cards then click execute to run the cryptographic clearing handshake pipeline.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono leading-relaxed space-y-1">
                    <p className="flex items-center space-x-1.5">
                      <Lock size={10} className="text-blue-500" />
                      <span><strong>Crypto Strength:</strong> {envCryptoStrength}</span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <Globe size={10} className="text-emerald-500" />
                      <span><strong>Simulated Latency:</strong> {envMockLatency}ms</span>
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: CARD TO BANK TO CARD MULTI-HOP ROUTER */}
        {activeTab === 'card_bank_card' && (
          <div className="space-y-4">
            {cardMethods.length === 0 || bankMethods.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-850">
                <p>Multi-hop clearing requires at least 1 credit/debit card and 1 bank checking account.</p>
                <p className="mt-1 text-[10px] text-slate-600">Please scroll up to "Link Payment Methods" and link checking accounts/cards to satisfy the multi-hop prerequisite.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Inputs */}
                <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-850/75">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400 font-mono block">Multi-Hop Routing Vault</span>

                  {/* Hop 1 Source card */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Hop 1: Source Card Account (Sender)</label>
                    <select
                      id="cbc-source-select"
                      value={cbcSourceId}
                      onChange={(e) => setCbcSourceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {cardMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - ${m.balance?.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hop 2 Bank clearing vault */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Hop 2: Intermediate Clearing Bank Vault</label>
                    <select
                      id="cbc-bank-select"
                      value={cbcBankId}
                      onChange={(e) => setCbcBankId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {bankMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - ({m.number || 'ACH Check_Transfer'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hop 3 Dest card */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Hop 3: Destination Card Account (Receiver)</label>
                    <select
                      id="cbc-dest-select"
                      value={cbcDestId}
                      onChange={(e) => setCbcDestId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {cardMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - ${m.balance?.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount & Protocol selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Amount ($)</label>
                      <input
                        id="cbc-amount-input"
                        type="number"
                        step="0.01"
                        value={cbcAmount}
                        onChange={(e) => setCbcAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Protocol Standard</label>
                      <select
                        id="cbc-protocol-select"
                        value={cbcProtocol}
                        onChange={(e) => setCbcProtocol(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="online_101_1">Online 101.1 Handshake</option>
                        <option value="offline_201_3">Offline 201.3 Acoustic</option>
                      </select>
                    </div>
                  </div>

                  {/* Run Simulation */}
                  <button
                    id="run-cbc-simulation-btn"
                    onClick={handleRunCbc}
                    disabled={cbcSimulating}
                    className="w-full mt-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {cbcSimulating ? (
                      <>
                        <RefreshCcw size={13} className="animate-spin" />
                        <span>Running Router Simulation...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCcw size={13} />
                        <span>Execute Card ➔ Bank ➔ Card Transfer</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Animated progress tracking column */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block mb-2.5">Route Hop Tracking Progress</span>
                    
                    {cbcSimulating || cbcSimSteps.length > 0 ? (
                      <div className="space-y-3 font-mono text-[10px]">
                        
                        {/* Interactive flow diagram */}
                        <div className="flex items-center justify-between px-2 py-2.5 bg-slate-900 rounded-xl mb-3 border border-slate-800 text-center text-[9px] text-slate-300">
                          <div>
                            <CreditCard size={14} className="mx-auto text-blue-400 mb-1" />
                            <span>Card Source</span>
                          </div>
                          <ArrowRight size={12} className="text-slate-600 animate-pulse" />
                          <div>
                            <Landmark size={14} className="mx-auto text-emerald-400 mb-1" />
                            <span>Bank Vault</span>
                          </div>
                          <ArrowRight size={12} className="text-slate-600 animate-pulse" />
                          <div>
                            <CreditCard size={14} className="mx-auto text-teal-400 mb-1" />
                            <span>Card Dest</span>
                          </div>
                        </div>

                        {cbcSimSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start space-x-2 text-slate-300">
                            {step.done ? (
                              <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                              <Activity size={12} className="text-blue-500 mt-0.5 animate-pulse shrink-0" />
                            )}
                            <div className="flex-1">
                              <span className={step.done ? 'text-slate-400' : 'text-slate-100 font-medium'}>
                                {step.label}
                              </span>
                              {step.extra && (
                                <span className="ml-1.5 text-[9px] bg-slate-900 text-teal-400 border border-slate-800 px-1 py-0.2 rounded font-semibold">
                                  {step.extra}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-44 flex flex-col items-center justify-center text-slate-600 text-center py-6">
                        <RefreshCcw size={24} className="opacity-30 mb-2" />
                        <p className="text-[10px]">Execute a multi-hop sequence to trace transactions as they transition from high-speed cards into ACH accounts and re-settle into target digital ledgers.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono leading-relaxed space-y-1">
                    <p className="flex items-center space-x-1.5">
                      <Lock size={10} className="text-blue-500" />
                      <span><strong>Clearing Standard:</strong> SHA256 / RSA Chain Verification</span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <Globe size={10} className="text-emerald-500" />
                      <span><strong>Ledger Latency:</strong> {(envMockLatency * 2.5).toFixed(0)}ms (Multi-Hop)</span>
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONFIGURABLE ENV AND SECURITY VARIABLES CONTROL PANEL */}
        {activeTab === 'env_config' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Controllers column */}
              <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <span className="text-[10px] uppercase font-bold tracking-wider text-yellow-500 font-mono block">Security & Sandbox Tuning</span>
                
                {/* Latency */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Simulated Clearing Latency Delay</span>
                    <span className="text-white font-mono">{envMockLatency} ms</span>
                  </div>
                  <input
                    id="env-latency-slider"
                    type="range"
                    min="50"
                    max="1500"
                    step="50"
                    value={envMockLatency}
                    onChange={(e) => setEnvMockLatency(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Handshake Timeout */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>101.1 Handshake Expiration</span>
                    <span className="text-white font-mono">{envHandshakeTimeout} ms</span>
                  </div>
                  <input
                    id="env-timeout-slider"
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={envHandshakeTimeout}
                    onChange={(e) => setEnvHandshakeTimeout(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Crypto Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Elliptic Curve Algorithmic Strength</label>
                  <select
                    id="env-crypto-select"
                    value={envCryptoStrength}
                    onChange={(e) => setEnvCryptoStrength(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ECDSA_P256">ECDSA NIST P-256 (High Speed, Enterprise-Grade)</option>
                    <option value="ED25519">Ed25519 Twisted Edwards (Extremely Safe, Lightweight)</option>
                    <option value="RSA_4096">RSA-4096 (Robust Backwards Compatibility)</option>
                  </select>
                </div>

                {/* Simulated API Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Simulated Gateway Authentication Token (`GATEWAY_API_KEY`)</label>
                  <input
                    id="env-gateway-key-input"
                    type="text"
                    value={envGatewayKey}
                    onChange={(e) => setEnvGatewayKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Security toggles */}
                <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck size={14} className="text-blue-400" />
                    <span>Enforce Enclave Co-Processor Signature</span>
                  </div>
                  <input
                    id="env-enclave-toggle"
                    type="checkbox"
                    checked={envEnclaveSigning}
                    onChange={(e) => {
                      setEnvEnclaveSigning(e.target.checked);
                      triggerToast(
                        e.target.checked 
                          ? "Enclaved cryptography activated." 
                          : "Cryptography fallback: CPU emulation activated.",
                        "info"
                      );
                    }}
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                  />
                </div>

              </div>

              {/* Dynamic env file preview column */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block mb-2">Dynamically Rendered `.env` Payload</span>
                  
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
                    <span className="text-slate-500"># PayG Environmental Parameters</span><br />
                    <span>PAYG_PRIMARY_ALGORITHM=<strong>"{envCryptoStrength}"</strong></span><br />
                    <span>HANDSHAKE_LATENCY_DELAY_MS=<strong>{envMockLatency}</strong></span><br />
                    <span>ONLINE_HANDSHAKE_TIMEOUT_MS=<strong>{envHandshakeTimeout}</strong></span><br />
                    <span>ENCLAVE_SIGNING_CO_PROCESSOR=<strong>{envEnclaveSigning ? "true" : "false"}</strong></span><br />
                    <span>GATEWAY_AUTHENTICATION_KEY=<strong>"{envGatewayKey}"</strong></span><br /><br />
                    <span className="text-slate-500"># Platform Context & Safe URL Mapping</span><br />
                    <span>APP_URL=<strong>"https://ais-pre-hxgnkmmmhen..."</strong></span><br />
                    <span>APPLET_ID=<strong>"348ff549-2b44-4e46-b016-1809d044927c"</strong></span>
                  </div>
                </div>

                <div className="mt-4 text-[10px] text-slate-400 leading-relaxed flex items-start space-x-2">
                  <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <p>Changes on this panel alter simulated latencies and elliptic algorithms used by both the 101.1 Online payment handshakes and 201.3 Offline acoustic packets, ensuring deep, multi-mode sandbox capability.</p>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </section>
  );
}
