import React from 'react';
import { X, AlertTriangle, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';

interface AuthErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'closed' | 'blocked' | 'other';
  message: string;
}

export default function AuthErrorModal({ isOpen, onClose, type, message }: AuthErrorModalProps) {
  if (!isOpen) return null;

  const isIframe = window.self !== window.top;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        id="auth-error-modal"
        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
          <div className="flex items-center space-x-2 text-amber-500">
            <AlertTriangle size={18} />
            <h2 className="text-sm font-bold text-slate-100">Sign-In Protocol Handshake Alert</h2>
          </div>
          <button
            id="close-auth-error-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">
                {type === 'closed' ? 'Popup Dismissed / Blocked' : type === 'blocked' ? 'Browser Blocked Popup' : 'Handshake Denied'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Iframe detection assistance */}
          {isIframe && (
            <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs">
                <Sparkles size={14} />
                <span>Recommended Sandbox Solution</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                To bypass browser iframe security rules and sign in with your Google account:
              </p>
              <ol className="text-[10px] space-y-1.5 text-slate-400 font-medium">
                <li className="flex items-start space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0 font-bold">1</span>
                  <span>Look at the top-right corner of the AI Studio preview.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0 font-bold">2</span>
                  <span>Click the <strong className="text-blue-300">"Open in a new tab"</strong> icon (the square with an arrow).</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0 font-bold">3</span>
                  <span>In the new tab, click <strong className="text-slate-200">"Sync Cloud"</strong> to authenticate securely!</span>
                </li>
              </ol>
            </div>
          )}

          {/* Sandbox Local Mode info */}
          <div className="text-[11px] text-slate-400 bg-slate-950 border border-slate-850 p-3 rounded-2xl">
            <strong>Note:</strong> You can continue using all payment simulation, offline acoustic 201.3 sequences, and QR codes in <strong>Local Sandbox Mode</strong> without signing in!
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800/60 px-6 py-4 flex items-center justify-between gap-3">
          {isIframe ? (
            <a
              id="auth-error-new-tab-btn"
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              <span>Open App in New Tab</span>
              <ExternalLink size={12} />
            </a>
          ) : (
            <div />
          )}
          <button
            id="auth-error-dismiss-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-750"
          >
            Continue in Local Mode
          </button>
        </div>
      </div>
    </div>
  );
}
