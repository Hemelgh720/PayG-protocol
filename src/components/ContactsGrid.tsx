import React from 'react';
import { Users, Store, ArrowUpRight } from 'lucide-react';
import { Contact } from '../types';

interface ContactsGridProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  searchQuery: string;
}

export default function ContactsGrid({ contacts, onSelectContact, searchQuery }: ContactsGridProps) {
  // Filter contacts by search query
  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.upiId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const friends = filtered.filter(c => !c.isMerchant);
  const businesses = filtered.filter(c => c.isMerchant);

  return (
    <section className="px-4 py-3 max-w-4xl mx-auto space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Friends Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
            <Users size={15} className="text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">People & Friends</h3>
          </div>

          {friends.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No contacts found
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {friends.map(contact => (
                <button
                  key={contact.id}
                  id={`contact-circle-${contact.id}`}
                  onClick={() => onSelectContact(contact)}
                  className="flex flex-col items-center group cursor-pointer focus:outline-none focus:scale-105 transition-all text-center"
                >
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${contact.avatarColor} flex items-center justify-center font-bold text-white text-sm shadow group-hover:scale-105 transition-all`}>
                    {contact.avatarText}
                  </div>
                  <span className="text-xs text-slate-200 mt-2 font-medium truncate w-full group-hover:text-white transition-colors">
                    {contact.name.split(' ')[0]}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono scale-[0.9] mt-0.5 opacity-80 block truncate w-full">
                    {contact.phone.slice(-4)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Merchants / Businesses Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
            <Store size={15} className="text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Businesses & Merchants</h3>
          </div>

          {businesses.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No businesses found
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {businesses.map(merchant => (
                <button
                  key={merchant.id}
                  id={`merchant-card-${merchant.id}`}
                  onClick={() => onSelectContact(merchant)}
                  className="bg-slate-850/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all group relative overflow-hidden"
                >
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${merchant.avatarColor} flex items-center justify-center text-white text-lg shadow mb-2`}>
                    {merchant.avatarText}
                  </div>
                  <span className="text-xs text-slate-200 font-semibold truncate w-full group-hover:text-white transition-colors">
                    {merchant.name}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 mt-1 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-900/10">
                    SCAN PAY
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
