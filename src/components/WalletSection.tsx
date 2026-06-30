import React, { useState } from 'react';
import { CreditCard, Landmark, Plus, ArrowUpRight, DollarSign, Wallet, ShieldAlert, Sparkles, X, Check } from 'lucide-react';
import { PaymentMethod } from '../types';

interface WalletSectionProps {
  paymentMethods: PaymentMethod[];
  onAddMethod: (method: Omit<PaymentMethod, 'id'>) => void;
  onTopUpWallet: (amount: number, bankMethodId: string) => boolean | Promise<boolean>;
}

export default function WalletSection({
  paymentMethods,
  onAddMethod,
  onTopUpWallet
}: WalletSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  
  // Add Method State
  const [methodType, setMethodType] = useState<'bank_account' | 'credit_card'>('bank_account');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [number, setNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('1000');
  
  // Top Up State
  const [topUpAmount, setTopUpAmount] = useState('50');
  const [selectedBankId, setSelectedBankId] = useState('');

  // Find GPay Wallet balance
  const wallet = paymentMethods.find(m => m.type === 'wallet');
  const walletBalance = wallet?.balance ?? 0;

  // Filter bank methods for topping up
  const bankMethods = paymentMethods.filter(m => m.type === 'bank_account');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !provider || !number) return;

    onAddMethod({
      type: methodType,
      name,
      provider,
      number: methodType === 'bank_account' ? `•••• ${number.slice(-4)}` : `•••• •••• •••• ${number.slice(-4)}`,
      balance: methodType === 'bank_account' ? parseFloat(initialBalance) || 0 : undefined
    });

    // Reset fields
    setName('');
    setProvider('');
    setNumber('');
    setInitialBalance('1000');
    setShowAddModal(false);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(topUpAmount);
    if (!amountNum || amountNum <= 0 || !selectedBankId) return;

    const success = await onTopUpWallet(amountNum, selectedBankId);
    if (success) {
      setShowTopUpModal(false);
      setTopUpAmount('50');
    }
  };

  return (
    <section className="px-4 py-3 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Wallet Balance Card */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group min-h-[170px]">
          <div className="absolute right-[-20px] bottom-[-20px] w-36 h-36 rounded-full bg-gradient-to-tr from-blue-600/10 to-teal-500/10 blur-xl pointer-events-none group-hover:scale-125 transition-all duration-700"></div>
          
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-br from-blue-500/15 to-teal-500/15 border border-blue-500/20 text-blue-400 rounded-xl">
                <Wallet size={18} />
              </div>
              <span className="text-sm font-medium text-slate-300">GPay Secure Balance</span>
            </div>
            <div className="flex items-center space-x-1 text-xs bg-slate-700/50 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono text-[10px]">VAULT_SECURE</span>
            </div>
          </div>

          <div className="my-3 z-10">
            <div className="text-3xl font-bold text-white tracking-tight flex items-baseline">
              <span className="text-xl font-medium text-slate-400 mr-1">$</span>
              {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Simulated balance backed by FDIC vault</p>
          </div>

          <div className="z-10 flex space-x-2">
            <button
              id="topup-trigger-btn"
              onClick={() => {
                if (bankMethods.length > 0) {
                  setSelectedBankId(bankMethods[0].id);
                }
                setShowTopUpModal(true);
              }}
              className="flex-1 flex items-center justify-center space-x-1 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white py-2 px-3 rounded-xl text-xs font-semibold transition-all shadow-md active:scale-[0.98]"
            >
              <ArrowUpRight size={14} />
              <span>Load Cash</span>
            </button>
          </div>
        </div>

        {/* Linked Accounts Carousel Grid */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Linked Payment Methods</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                {paymentMethods.length - 1} Methods
              </span>
            </h3>
            
            <button
              id="add-payment-method-trigger-btn"
              onClick={() => setShowAddModal(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1 bg-blue-950/40 hover:bg-blue-950/70 border border-blue-800/40 px-2.5 py-1 rounded-full transition-all"
            >
              <Plus size={14} />
              <span>Link Account</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[110px] overflow-y-auto pr-1">
            {paymentMethods
              .filter(m => m.type !== 'wallet')
              .map(method => (
                <div
                  key={method.id}
                  className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 hover:border-slate-700 p-3 rounded-2xl flex items-center justify-between transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl flex items-center justify-center ${
                      method.type === 'bank_account'
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-900/40'
                        : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}>
                      {method.type === 'bank_account' ? <Landmark size={15} /> : <CreditCard size={15} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-slate-200">{method.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400">{method.provider} • {method.number}</p>
                    </div>
                  </div>
                  {method.balance !== undefined && (
                    <span className="text-xs font-semibold text-slate-200 font-mono">
                      ${method.balance.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>

      </div>

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus size={18} className="text-blue-400" />
                <span>Link a Bank or Card</span>
              </h3>
              <button
                id="close-add-method-btn"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Account / Method Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="select-type-bank"
                    type="button"
                    onClick={() => {
                      setMethodType('bank_account');
                      setProvider('Chase Bank');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                      methodType === 'bank_account'
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    <Landmark size={13} />
                    <span>Bank Account</span>
                  </button>
                  <button
                    id="select-type-card"
                    type="button"
                    onClick={() => {
                      setMethodType('credit_card');
                      setProvider('Visa');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                      methodType === 'credit_card'
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    <CreditCard size={13} />
                    <span>Credit Card</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Friendly Name</label>
                <input
                  id="add-method-name"
                  type="text"
                  placeholder={methodType === 'bank_account' ? "Chase Checking, Wells Fargo Savings" : "Visa Gold Card"}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Provider Network</label>
                  <select
                    id="add-method-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {methodType === 'bank_account' ? (
                      <>
                        <option value="Chase Bank">Chase Bank</option>
                        <option value="Wells Fargo">Wells Fargo</option>
                        <option value="Bank of America">Bank of America</option>
                        <option value="Sallie Mae">Sallie Mae</option>
                      </>
                    ) : (
                      <>
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="American Express">American Express</option>
                        <option value="Discover">Discover</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {methodType === 'bank_account' ? "Account Number" : "Card Number"}
                  </label>
                  <input
                    id="add-method-number"
                    type="password"
                    maxLength={16}
                    placeholder="Last 4-16 digits"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono tracking-widest"
                  />
                </div>
              </div>

              {methodType === 'bank_account' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Simulated Starting Balance ($)</label>
                  <input
                    id="add-method-balance"
                    type="number"
                    min="0"
                    placeholder="1000"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                id="add-method-submit-btn"
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md mt-2 flex items-center justify-center space-x-1"
              >
                <Check size={16} />
                <span>Link Method Successfully</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Up Wallet Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ArrowUpRight size={18} className="text-emerald-400" />
                <span>Load Cash into Wallet</span>
              </h3>
              <button
                id="close-topup-btn"
                onClick={() => setShowTopUpModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {bankMethods.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <ShieldAlert className="mx-auto text-amber-500" size={32} />
                <p className="text-sm text-slate-300">You must link a Bank Account first to load cash into your wallet.</p>
                <button
                  id="topup-go-link-btn"
                  onClick={() => {
                    setShowTopUpModal(false);
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold rounded-xl border border-slate-750 transition-all"
                >
                  Link Bank Account Now
                </button>
              </div>
            ) : (
              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Source Bank Account</label>
                  <select
                    id="topup-source-select"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {bankMethods.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.provider} • Bal: ${b.balance?.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Load Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                    <input
                      id="topup-amount-input"
                      type="number"
                      min="1"
                      required
                      placeholder="50"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-850 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Funds will be instantly cleared and transferred into GPay balance.
                  </p>
                </div>

                <div className="flex space-x-2 pt-2">
                  {['10', '25', '50', '100', '250'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTopUpAmount(val)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        topUpAmount === val
                          ? 'bg-blue-950 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-slate-750 text-slate-400 hover:bg-slate-750'
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>

                <button
                  id="topup-submit-btn"
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md mt-2 flex items-center justify-center space-x-1"
                >
                  <Check size={16} />
                  <span>Transfer Instantly</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
