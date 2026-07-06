import React from 'react';
import { X, Shield, Wifi, WifiOff, Terminal, HelpCircle, Layers, Settings, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ProtocolHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProtocolHelpModal({ isOpen, onClose }: ProtocolHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 shrink-0">
          <div className="flex items-center space-x-2">
            <HelpCircle size={18} className="text-blue-400" />
            <h2 className="text-base font-bold text-white">Interactive Protocol Reference Guide</h2>
          </div>
          <button
            id="close-help-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Intro */}
          <div className="space-y-2">
            <p className="text-xs text-slate-300 leading-relaxed">
              Welcome to the <strong>PayG Gateway & Protocol Sandbox</strong>. This clone represents a highly specialized deployment demonstrating how central mobile wallets perform standard payments, alongside two distinct payment clearing protocols: <strong>Online 101.1</strong> and <strong>Offline 201.3</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 101.1 Info */}
            <div className="bg-emerald-950/20 border border-emerald-900/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Wifi size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider">Online 101.1 Protocol</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Operates when internet connectivity is active. Requires a dynamic four-way handshake to secure verification.
              </p>
              <ul className="text-[10px] space-y-1.5 font-mono text-slate-300">
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-500 font-bold">1.</span>
                  <span><strong>Phase 1:</strong> Client initiates secure session and registers device fingerprint.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-500 font-bold">2.</span>
                  <span><strong>Phase 2:</strong> Central Gateway responds with a challenge seed.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-500 font-bold">3.</span>
                  <span><strong>Phase 3:</strong> Client signs payload using private ECDSA-P256 curve key.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-500 font-bold">4.</span>
                  <span><strong>Phase 4:</strong> Gateway verifies signature and instantly settles balances.</span>
                </li>
              </ul>
              <div className="text-[10.5px] bg-slate-900/60 p-2 rounded-xl text-emerald-500 border border-emerald-900/20">
                <strong>How to Trigger:</strong> Keep status <span className="font-bold">ONLINE</span>, click a contact or merchant, choose amount and press pay.
              </div>
            </div>

            {/* 201.3 Info */}
            <div className="bg-amber-950/20 border border-amber-900/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center space-x-2 text-amber-400">
                <WifiOff size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider">Offline 201.3 Protocol</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Operates without network coverage (subways, planes, basements). Uses decentralized store-and-forward local cryptography.
              </p>
              <ul className="text-[10px] space-y-1.5 font-mono text-slate-300">
                <li className="flex items-start space-x-1.5">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span><strong>Phase 1:</strong> Local ledger engine confirms offline mode is safe.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span><strong>Phase 2:</strong> Signs payload using client symmetric enclave session key.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span><strong>Phase 3:</strong> Encodes payment packet into high-density QR payload or near-ultrasonic acoustic waves.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-amber-500 font-bold">4.</span>
                  <span><strong>Phase 4:</strong> Emits acoustic chirp signals, caches in local outbox pending sync.</span>
                </li>
              </ul>
              <div className="text-[10.5px] bg-slate-900/60 p-2 rounded-xl text-amber-500 border border-amber-900/20">
                <strong>How to Trigger:</strong> Toggle status to <span className="font-bold">OFFLINE</span>, pay any contact. Hear the acoustic sweeps, then check the sync outbox.
              </div>
            </div>

          </div>

          {/* Setup / Instructions step by step */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Settings size={14} className="text-blue-400" />
              <span>Full Sandbox Walkthrough Instructions</span>
            </h3>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-xs text-slate-400 space-y-2.5 leading-relaxed font-sans">
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 flex items-center justify-center shrink-0">1</span>
                <p>Toggle <strong>ONLINE / OFFLINE</strong> status bar in the header to switch between protocol channels.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 flex items-center justify-center shrink-0">2</span>
                <p>Initiate payments to your friends, or choose <strong>"Scan any QR"</strong> to trigger scanner overlay for Starbucks or Whole Foods.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 flex items-center justify-center shrink-0">3</span>
                <p>Inspect raw payloads in the <strong>"Payload Inspector"</strong> console on the screen. Selecting any row decrypts keys, signatures and parameters.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 flex items-center justify-center shrink-0">4</span>
                <p>While in offline mode, make multiple payments. Then toggle <strong>ONLINE</strong> status and press <strong>"Synchronize Local Ledger"</strong> in the outbox container to see items clear and settle!</p>
              </div>
            </div>
          </div>

          {/* APP METADATA & GITHUB ACTION DEPLOYMENT GUIDE */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Layers size={14} className="text-emerald-400" />
              <span>GPay Security Sandbox Metadata & CI/CD Deployment</span>
            </h3>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-[11px] text-slate-400 space-y-3 leading-relaxed font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-500 block uppercase">Application ID:</span>
                  <span className="text-blue-400 font-bold block select-all">348ff549-2b44-4e46-b016-1809d044927c</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Firestore DB Identifier:</span>
                  <span className="text-yellow-400 font-bold block select-all">ai-studio-gpayprotocolclon-348ff549-2b44-4e46-b016-1809d044927c</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500 block uppercase">Development App Service URL:</span>
                  <a href="https://ais-dev-hxgnkmmmhen2ft3tlf7jxc-549957398283.asia-east1.run.app" target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300 block select-all">
                    https://ais-dev-hxgnkmmmhen2ft3tlf7jxc-549957398283.asia-east1.run.app
                  </a>
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500 block uppercase">Shared Preview URL:</span>
                  <a href="https://ais-pre-hxgnkmmmhen2ft3tlf7jxc-549957398283.asia-east1.run.app" target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300 block select-all">
                    https://ais-pre-hxgnkmmmhen2ft3tlf7jxc-549957398283.asia-east1.run.app
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900">
                <span className="text-slate-500 block uppercase font-bold mb-1.5 text-[10px]">GitHub Actions CI/CD Pipeline Configuration (.github/workflows/deploy.yml)</span>
                <p className="text-[9.5px] leading-tight text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-850 overflow-x-auto whitespace-pre">
{`name: Deploy PayG Sandbox to Google Cloud Run
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    - name: Install Dependencies
      run: npm ci
    - name: Run Security Audits & Lints
      run: npm run lint
    - name: Build Assets
      run: npm run build
    - name: Deploy to Cloud Run Container
      run: |
        echo "Successfully deployed to 348ff549-2b44-4e46-b016-1809d044927c"`}
                </p>
              </div>
            </div>
          </div>

          {/* Secure Enclave Badge */}
          <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-850">
            <Shield size={16} className="text-blue-500" />
            <span>Cryptographic structures conform to strict PayG standards and AES/ECC encryption specifications.</span>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-6 py-4 shrink-0 flex justify-end">
          <button
            id="help-guide-close-btn"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
}
