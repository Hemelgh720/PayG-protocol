import React from 'react';
import { QrCode, Phone, Landmark, AtSign, ArrowLeftRight, FileText } from 'lucide-react';

interface QuickActionsProps {
  onAction: (actionType: 'scan' | 'phone' | 'upi' | 'bank' | 'self' | 'bills') => void;
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  const actions = [
    {
      id: 'scan',
      label: 'Scan any QR',
      sub: 'Merchant scan',
      color: 'bg-blue-900/60 hover:bg-blue-950 text-blue-400 border border-blue-700/40 hover:border-blue-500/50',
      icon: <QrCode size={22} />
    },
    {
      id: 'phone',
      label: 'Pay Phone',
      sub: 'Any contact',
      color: 'bg-emerald-900/60 hover:bg-emerald-950 text-emerald-400 border border-emerald-700/40 hover:border-emerald-500/50',
      icon: <Phone size={22} />
    },
    {
      id: 'bank',
      label: 'Bank Transfer',
      sub: 'To account',
      color: 'bg-amber-900/60 hover:bg-amber-950 text-amber-400 border border-amber-700/40 hover:border-amber-500/50',
      icon: <Landmark size={22} />
    },
    {
      id: 'upi',
      label: 'Pay UPI ID',
      sub: 'Or phone No.',
      color: 'bg-indigo-900/60 hover:bg-indigo-950 text-indigo-400 border border-indigo-700/40 hover:border-indigo-500/50',
      icon: <AtSign size={22} />
    },
    {
      id: 'self',
      label: 'Self Transfer',
      sub: 'Between banks',
      color: 'bg-teal-900/60 hover:bg-teal-950 text-teal-400 border border-teal-700/40 hover:border-teal-500/50',
      icon: <ArrowLeftRight size={22} />
    },
    {
      id: 'bills',
      label: 'Pay Bills',
      sub: 'Power, internet',
      color: 'bg-violet-900/60 hover:bg-violet-950 text-violet-400 border border-violet-700/40 hover:border-violet-500/50',
      icon: <FileText size={22} />
    }
  ];

  return (
    <section className="px-4 py-2 max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Money Transfers</h3>
        
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {actions.map(act => (
            <button
              key={act.id}
              id={`quick-action-${act.id}-btn`}
              onClick={() => onAction(act.id as any)}
              className="flex flex-col items-center group cursor-pointer focus:outline-none focus:scale-105 transition-all"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${act.color} active:scale-[0.95]`}>
                {act.icon}
              </div>
              <span className="text-xs font-medium text-slate-200 mt-2.5 text-center leading-tight group-hover:text-white transition-colors">
                {act.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 text-center hidden sm:block">
                {act.sub}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
