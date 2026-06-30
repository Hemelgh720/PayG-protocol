import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { 
  fetchUserPaymentMethods, 
  fetchUserTransactions, 
  fetchUserLogs, 
  fetchContacts,
  addPaymentMethodToCloud,
  addTransactionToCloud,
  addProtocolLogToCloud,
  updatePaymentMethodBalanceInCloud,
  updateTransactionStatusToCloud,
  seedUserData
} from './utils/firebaseSync';
import { 
  INITIAL_PAYMENT_METHODS, 
  INITIAL_CONTACTS, 
  INITIAL_TRANSACTIONS 
} from './data/mockData';
import { 
  Contact, 
  PaymentMethod, 
  Transaction, 
  ProtocolLog, 
  ProtocolType 
} from './types';
import { generateUUID } from './utils/crypto';
import GPayHeader from './components/GPayHeader';
import WalletSection from './components/WalletSection';
import QuickActions from './components/QuickActions';
import ContactsGrid from './components/ContactsGrid';
import TransactionHistory from './components/TransactionHistory';
import ProtocolDebugger from './components/ProtocolDebugger';
import PaymentModal from './components/PaymentModal';
import ProtocolHelpModal from './components/ProtocolHelpModal';
import { Shield, Check, Wifi, AlertCircle, Info, Landmark, Cloud, CloudOff } from 'lucide-react';

export default function App() {
  // --- CORE SYSTEM STATES ---
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<ProtocolLog[]>([]);
  
  // --- MODAL & FOCUS STATES ---
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  
  // --- OFFLINE SIMULATION STATES ---
  const [offlineSequence, setOfflineSequence] = useState<number>(12);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // --- NOTIFICATION / SUCCESS TOAST STATE ---
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // --- FIREBASE SECURITY & AUTH STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);

  // --- GOOGLE SIGN IN & LOGOUT HANDLERS ---
  const handleLogin = async () => {
    try {
      setIsSyncingWithCloud(true);
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/popup-closed-by-user') {
        triggerToast("Sign in cancelled.", "info");
      } else {
        triggerToast("Sign in failed. Security protocol denied.", "warning");
      }
    } finally {
      setIsSyncingWithCloud(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsSyncingWithCloud(true);
      await signOut(auth);
      triggerToast("Logged out of secure cloud account.", "info");
    } catch (e: any) {
      console.error(e);
      triggerToast("Sign out failed.", "warning");
    } finally {
      setIsSyncingWithCloud(false);
    }
  };

  // --- INITIALIZATION & CLOUD DATABASE SYNC HOOK ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsSyncingWithCloud(true);
        try {
          const cloudMethods = await fetchUserPaymentMethods(user.uid);
          const cloudTransactions = await fetchUserTransactions(user.uid);
          const cloudLogs = await fetchUserLogs(user.uid);
          const cloudContacts = await fetchContacts();

          // Merge if local has any non-synced transactions
          setPaymentMethods(cloudMethods);
          setTransactions(cloudTransactions);
          setLogs(cloudLogs);
          setContacts(cloudContacts);
          
          triggerToast(`Secured cloud vault loaded for ${user.displayName || 'user'}!`, 'success');
        } catch (e) {
          console.error(e);
          triggerToast("Cloud synchronizer failed. Security rules active.", "warning");
        } finally {
          setIsSyncingWithCloud(false);
        }
      } else {
        // Fallback to offline localStorage
        const savedMethods = localStorage.getItem('gpay_methods');
        if (savedMethods) {
          setPaymentMethods(JSON.parse(savedMethods));
        } else {
          setPaymentMethods(INITIAL_PAYMENT_METHODS);
          localStorage.setItem('gpay_methods', JSON.stringify(INITIAL_PAYMENT_METHODS));
        }

        const savedContacts = localStorage.getItem('gpay_contacts');
        if (savedContacts) {
          setContacts(JSON.parse(savedContacts));
        } else {
          setContacts(INITIAL_CONTACTS);
          localStorage.setItem('gpay_contacts', JSON.stringify(INITIAL_CONTACTS));
        }

        const savedTx = localStorage.getItem('gpay_transactions');
        if (savedTx) {
          setTransactions(JSON.parse(savedTx));
        } else {
          setTransactions(INITIAL_TRANSACTIONS);
          localStorage.setItem('gpay_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
        }

        const initialLogs: ProtocolLog[] = [
          {
            id: 'log_init_1',
            timestamp: new Date(Date.now() - 5000).toISOString(),
            protocol: 'SYSTEM',
            step: 'GPay Crypto Core Initialized',
            payload: JSON.stringify({
              secure_enclave: "ACTIVE",
              elliptic_curve: "ECDSA_P256",
              local_symmetric_signing: "ECC_CURVE_25519",
              key_status: "PROVISIONED_SECURELY"
            }, null, 2),
            type: 'success'
          },
          {
            id: 'log_init_2',
            timestamp: new Date(Date.now() - 4000).toISOString(),
            protocol: 'SYSTEM',
            step: 'Payment Gateway Connection Active',
            payload: JSON.stringify({
              server_endpoint: "https://gateway.gpay.secure/v3",
              primary_ip: "104.24.120.91",
              routing_protocol: "TCP/SSL_v1.3",
              active_channels: ["101.1_ONLINE_SETTLE"]
            }, null, 2),
            type: 'info'
          }
        ];
        setLogs(initialLogs);
      }
    });

    const savedSeq = localStorage.getItem('gpay_seq');
    if (savedSeq) {
      setOfflineSequence(parseInt(savedSeq));
    }

    return () => unsubscribe();
  }, []);

  // --- UTILITY: POP TOAST ---
  const triggerToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // --- LOGGING ENGINE HOOK ---
  const addProtocolLog = (
    step: string, 
    payload: string, 
    type: 'info' | 'success' | 'warning' | 'crypto',
    protocol: '101.1' | '201.3' | 'SYSTEM'
  ) => {
    const newLog: ProtocolLog = {
      id: `log_${generateUUID()}`,
      timestamp: new Date().toISOString(),
      protocol,
      step,
      payload,
      type
    };
    setLogs(prev => [newLog, ...prev]);

    if (currentUser) {
      addProtocolLogToCloud(currentUser.uid, newLog).catch(console.error);
    }
  };

  // --- TOGGLE NETWORK MODE ---
  const handleToggleNetwork = () => {
    setIsOnline(prev => {
      const nextState = !prev;
      addProtocolLog(
        `Network coverage switched to ${nextState ? 'ONLINE' : 'OFFLINE'}`,
        JSON.stringify({
          action: "NETWORK_STATE_CHANGE",
          is_connected: nextState,
          permitted_protocols: nextState ? ["101.1-ONLINE", "WALLET_DIRECT"] : ["201.3-OFFLINE"],
          offline_outbox_queue_status: "READY"
        }, null, 2),
        nextState ? 'success' : 'warning',
        'SYSTEM'
      );
      
      triggerToast(
        nextState 
          ? "Back online! 101.1 Clearing Handshake is now ACTIVE." 
          : "Offline mode active. GPay 201.3 Acoustic & QR protocols engaged.",
        nextState ? 'success' : 'warning'
      );
      return nextState;
    });
  };

  // --- RESET ALL STORAGE BACK TO MOCK DEFAULTS ---
  const handleResetData = async () => {
    if (window.confirm("Are you sure you want to reset all mock databases and balances to default?")) {
      if (currentUser) {
        setIsSyncingWithCloud(true);
        try {
          await seedUserData(currentUser.uid);
          const cloudMethods = await fetchUserPaymentMethods(currentUser.uid);
          const cloudTransactions = await fetchUserTransactions(currentUser.uid);
          const cloudLogs = await fetchUserLogs(currentUser.uid);
          
          setPaymentMethods(cloudMethods);
          setTransactions(cloudTransactions);
          setLogs(cloudLogs);
          triggerToast("Cloud vault reset & seed completed!", "info");
        } catch (e) {
          console.error(e);
          triggerToast("Cloud reset failed.", "warning");
        } finally {
          setIsSyncingWithCloud(false);
        }
      } else {
        localStorage.removeItem('gpay_methods');
        localStorage.removeItem('gpay_contacts');
        localStorage.removeItem('gpay_transactions');
        localStorage.removeItem('gpay_seq');
        
        setPaymentMethods(INITIAL_PAYMENT_METHODS);
        setContacts(INITIAL_CONTACTS);
        setTransactions(INITIAL_TRANSACTIONS);
        setOfflineSequence(12);

        const resetLog: ProtocolLog = {
          id: `log_${generateUUID()}`,
          timestamp: new Date().toISOString(),
          protocol: 'SYSTEM',
          step: 'Mock Database Reset & Vault Balance Restored',
          payload: JSON.stringify({
            action: "RESET_DATABASE",
            wallet_balance_restored: "$248.50",
            payment_methods_relinked: 3,
            transaction_history_cleared: true
          }, null, 2),
          type: 'warning'
        };
        setLogs([resetLog]);
        triggerToast("Sandbox reset completed successfully!", "info");
      }
    }
  };

  // --- INTERACTIVE ACTIONS TRIGGERS ---
  const handleQuickAction = (actionType: 'scan' | 'phone' | 'upi' | 'bank' | 'self' | 'bills') => {
    if (actionType === 'scan') {
      setSelectedContact(null);
      setIsPaymentModalOpen(true);
    } else if (actionType === 'phone' || actionType === 'upi') {
      triggerToast("Scroll down and click on any friend or merchant card to pay!", "info");
    } else if (actionType === 'bank' || actionType === 'self') {
      // Pick first non-merchant contact as default bank target
      const target = contacts.find(c => !c.isMerchant) || null;
      setSelectedContact(target);
      setIsPaymentModalOpen(true);
    } else if (actionType === 'bills') {
      // Simulate water/power billing
      const biller: Contact = {
        id: 'contact_utility',
        name: 'City Power & Grid',
        phone: '1-800-POWER',
        upiId: 'citypower@okicici',
        avatarColor: 'from-amber-500 to-orange-600',
        isMerchant: true,
        avatarText: '⚡'
      };
      setSelectedContact(biller);
      setIsPaymentModalOpen(true);
    }
  };

  // --- ADD LINKED PAYMENT METHOD ---
  const handleAddPaymentMethod = async (newMethod: Omit<PaymentMethod, 'id'>) => {
    const fresh: PaymentMethod = {
      ...newMethod,
      id: `method_${generateUUID()}`
    };
    const updated = [...paymentMethods, fresh];
    setPaymentMethods(updated);

    if (currentUser) {
      await addPaymentMethodToCloud(currentUser.uid, fresh);
    } else {
      localStorage.setItem('gpay_methods', JSON.stringify(updated));
    }

    addProtocolLog(
      `Linked new method: ${fresh.name}`,
      JSON.stringify({
        method_type: fresh.type,
        provider: fresh.provider,
        account_mask: fresh.number,
        routing_handshake: "ECDH_VERIFIED_SUCCESS"
      }, null, 2),
      'success',
      'SYSTEM'
    );
    triggerToast(`Successfully linked ${fresh.name}!`);
  };

  // --- LOAD MONEY INTO GPAY WALLET ---
  const handleTopUpWallet = async (amount: number, bankMethodId: string): Promise<boolean> => {
    const sourceBank = paymentMethods.find(m => m.id === bankMethodId);
    if (!sourceBank || sourceBank.balance === undefined || sourceBank.balance < amount) {
      triggerToast("Insufficient funds in the selected source bank account!", "warning");
      return false;
    }

    const walletMethod = paymentMethods.find(m => m.type === 'wallet');
    const newBankBalance = (sourceBank.balance ?? 0) - amount;
    const newWalletBalance = ((walletMethod?.balance) ?? 0) + amount;

    // Subtract from bank, add to wallet
    const updatedMethods = paymentMethods.map(m => {
      if (m.id === bankMethodId) {
        return { ...m, balance: newBankBalance };
      }
      if (m.type === 'wallet') {
        return { ...m, balance: newWalletBalance };
      }
      return m;
    });

    setPaymentMethods(updatedMethods);

    if (currentUser) {
      // Async write to Firestore
      updatePaymentMethodBalanceInCloud(currentUser.uid, bankMethodId, newBankBalance).catch(console.error);
      if (walletMethod) {
        updatePaymentMethodBalanceInCloud(currentUser.uid, walletMethod.id, newWalletBalance).catch(console.error);
      }
    } else {
      localStorage.setItem('gpay_methods', JSON.stringify(updatedMethods));
    }

    // Register a load transaction
    const loadTx: Transaction = {
      id: `tx_load_${generateUUID()}`,
      senderId: bankMethodId,
      senderName: sourceBank.name,
      receiverId: 'user_current',
      receiverName: 'You (GPay Wallet)',
      receiverAvatar: 'Wallet',
      amount,
      timestamp: new Date().toISOString(),
      protocol: 'online_101_1',
      status: 'success',
      paymentMethodId: bankMethodId,
      paymentMethodName: sourceBank.name,
      category: 'Top Up',
      note: 'Loaded cash to wallet',
      userId: currentUser ? currentUser.uid : 'user_current',
      protocolDetails: {
        handshakeLatency: 140,
        signature: 'SIG_LOAD_' + Math.random().toString(36).substring(3, 11).toUpperCase()
      }
    };

    const updatedTx = [loadTx, ...transactions];
    setTransactions(updatedTx);

    if (currentUser) {
      await addTransactionToCloud(currentUser.uid, loadTx);
    } else {
      localStorage.setItem('gpay_transactions', JSON.stringify(updatedTx));
    }

    addProtocolLog(
      `Wallet Cash Load: $${amount}`,
      JSON.stringify({
        source_account: sourceBank.name,
        target_account: "GPay Secure Balance",
        transfer_amount: amount,
        clearing_auth_ref: loadTx.id
      }, null, 2),
      'success',
      '101.1'
    );

    triggerToast(`Loaded $${amount.toFixed(2)} to GPay Balance!`);
    return true;
  };

  // --- EXECUTE TRANSACTION (FROM PAYMENT MODAL) ---
  const handlePaymentComplete = async (
    amount: number,
    contact: Contact,
    methodId: string,
    protocol: ProtocolType,
    note: string,
    extraDetails: any,
    status: 'success' | 'pending_sync'
  ) => {
    // 1. Subtract balance from payment method if applicable
    const methodSelected = paymentMethods.find(m => m.id === methodId);
    let updatedMethods = [...paymentMethods];
    let newBalance = 0;
    
    if (methodSelected && methodSelected.balance !== undefined) {
      newBalance = Math.max(0, (methodSelected.balance ?? 0) - amount);
      updatedMethods = paymentMethods.map(m => {
        if (m.id === methodId) {
          return { ...m, balance: newBalance };
        }
        return m;
      });
      setPaymentMethods(updatedMethods);
      
      if (currentUser) {
        if (status === 'success') {
          updatePaymentMethodBalanceInCloud(currentUser.uid, methodId, newBalance).catch(console.error);
        }
      } else {
        localStorage.setItem('gpay_methods', JSON.stringify(updatedMethods));
      }
    }

    // 2. Generate Transaction row
    const newTx: Transaction = {
      id: `tx_${generateUUID()}`,
      senderId: 'user_current',
      senderName: 'You',
      receiverId: contact.id,
      receiverName: contact.name,
      receiverAvatar: contact.avatarText,
      amount,
      timestamp: new Date().toISOString(),
      protocol,
      status,
      paymentMethodId: methodId,
      paymentMethodName: methodSelected ? methodSelected.name : 'GPay Wallet',
      category: contact.isMerchant ? 'Shopping & Utilities' : 'Friends',
      note: note || undefined,
      userId: currentUser ? currentUser.uid : 'user_current',
      protocolDetails: extraDetails
    };

    const updatedTx = [newTx, ...transactions];
    setTransactions(updatedTx);

    if (currentUser) {
      await addTransactionToCloud(currentUser.uid, newTx);
    } else {
      localStorage.setItem('gpay_transactions', JSON.stringify(updatedTx));
    }

    // 3. Update sequence if offline protocol was used
    if (protocol === 'offline_201_3') {
      const nextSeq = offlineSequence + 1;
      setOfflineSequence(nextSeq);
      localStorage.setItem('gpay_seq', nextSeq.toString());
    }

    setIsPaymentModalOpen(false);
    triggerToast(
      status === 'pending_sync'
        ? `Offline payment of $${amount.toFixed(2)} cached! Sync pending.`
        : `Payment of $${amount.toFixed(2)} settled with ${contact.name}!`,
      status === 'pending_sync' ? 'warning' : 'success'
    );
  };

  // --- FORCE OUTBOX CLEAR & SYNC ---
  const handleForceSync = async () => {
    if (!isOnline) {
      triggerToast("Cannot sync! Your device connectivity is OFFLINE. Toggle network to Online.", "warning");
      return;
    }

    setIsSyncing(true);
    addProtocolLog(
      "Initiated Sync Outbox Reconciliation Batch",
      JSON.stringify({
        action: "START_RECONCILIATION_BATCH",
        pending_records_count: transactions.filter(t => t.status === 'pending_sync').length,
        encryption_layer: "AES-256-GCM"
      }, null, 2),
      'info',
      'SYSTEM'
    );

    // Simulate network latency for reconciliations
    await new Promise(r => setTimeout(r, 2200));

    // Shift all pending transactions to success
    let syncCount = 0;
    const syncedTx = transactions.map(tx => {
      if (tx.status === 'pending_sync') {
        syncCount++;
        
        // Log individual verification
        addProtocolLog(
          `Syncing Offline 201.3 Tx - ID: ${tx.id.slice(0, 10)}...`,
          JSON.stringify({
            status: "SIGNATURE_VERIFIED",
            tx_amount: tx.amount,
            receiver: tx.receiverName,
            local_auth_code: tx.protocolDetails.offlineAuthCode,
            cryptographic_signature: tx.protocolDetails.signature,
            reconciled_timestamp: new Date().toISOString()
          }, null, 2),
          'success',
          '201.3'
        );

        if (currentUser) {
          // Sync transaction status to cloud
          updateTransactionStatusToCloud(currentUser.uid, tx.id, 'success').catch(console.error);
          
          // Deduct from balance in cloud now that the transaction is cleared
          const methodSelected = paymentMethods.find(m => m.id === tx.paymentMethodId);
          if (methodSelected && methodSelected.balance !== undefined) {
            const finalBal = Math.max(0, methodSelected.balance - tx.amount);
            updatePaymentMethodBalanceInCloud(currentUser.uid, tx.paymentMethodId, finalBal).catch(console.error);
          }
        }

        return { ...tx, status: 'success' as const };
      }
      return tx;
    });

    setTransactions(syncedTx);

    if (!currentUser) {
      localStorage.setItem('gpay_transactions', JSON.stringify(syncedTx));
    }
    setIsSyncing(false);

    triggerToast(`Sync complete! ${syncCount} offline payments settled.`, 'success');
    addProtocolLog(
      "Sync Reconciliation Batch Complete",
      JSON.stringify({
        status: "COMPLETED",
        records_processed: syncCount,
        integrity_check: "PASS"
      }, null, 2),
      'success',
      'SYSTEM'
    );
  };

  // Count of transactions waiting for sync
  const pendingSyncCount = transactions.filter(t => t.status === 'pending_sync').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 flex flex-col justify-between">
      
      {/* 1. Header (Brand, Network Mode status, Search) */}
      <GPayHeader
        isOnline={isOnline}
        onToggleNetwork={handleToggleNetwork}
        onResetData={handleResetData}
        onOpenScanner={() => {
          setSelectedContact(null);
          setIsPaymentModalOpen(true);
        }}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isSyncingWithCloud={isSyncingWithCloud}
      />

      {/* Floating Status Warning for Offline Mode */}
      {!isOnline && (
        <div className="bg-amber-950 border-b border-amber-800/40 text-amber-300 text-xs px-4 py-2 text-center flex items-center justify-center space-x-2 animate-pulse">
          <AlertCircle size={14} className="text-amber-400" />
          <span>
            <strong>Offline Mode Engaged.</strong> Payments will automatically default to local <strong>201.3 Acoustic/QR Protocol</strong>. Restore internet to settle records.
          </span>
        </div>
      )}

      {/* Main Grid Wrapper */}
      <main className="flex-1 space-y-4 py-4">
        
        {/* 2. Wallet & Balances Card Carousel */}
        <WalletSection
          paymentMethods={paymentMethods}
          onAddMethod={handleAddPaymentMethod}
          onTopUpWallet={handleTopUpWallet}
        />

        {/* 3. Quick Round Actions */}
        <QuickActions onAction={handleQuickAction} />

        {/* 4. Friends and Businesses Grid */}
        <ContactsGrid
          contacts={contacts}
          onSelectContact={(contact) => {
            setSelectedContact(contact);
            setIsPaymentModalOpen(true);
          }}
          searchQuery={searchQuery}
        />

        {/* 5. Cryptographic Protocol Sandbox logs console */}
        <ProtocolDebugger
          logs={logs}
          onClearLogs={() => setLogs([])}
          pendingSyncCount={pendingSyncCount}
          onForceSync={handleForceSync}
          isSyncing={isSyncing}
          isOnline={isOnline}
        />

        {/* 6. Transaction Ledger History list */}
        <TransactionHistory transactions={transactions} />

      </main>

      {/* --- FOOTER DECORATION --- */}
      <footer className="border-t border-slate-900 mt-8 pt-6 pb-2 text-center text-slate-600 max-w-4xl mx-auto w-full px-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-[11px] font-mono leading-none">
          GPay sandbox build v201.3.1 • Safe cryptographies ECDSA-P256
        </p>
        <p className="text-[11px] flex items-center justify-center gap-1">
          <Shield size={12} className="text-blue-500" />
          <span>Frictionless payments for online & offline environments</span>
        </p>
      </footer>

      {/* --- FLOATING TOAST FEEDBACK --- */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 shadow-2xl flex items-center space-x-3 text-sm font-medium animate-in slide-in-from-bottom-5 duration-150 max-w-sm">
          <div className={`p-1.5 rounded-lg ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' 
              : toastMessage.type === 'warning'
                ? 'bg-amber-950 text-amber-400 border border-amber-900/30'
                : 'bg-blue-950 text-blue-400 border border-blue-900/30'
          }`}>
            <Check size={16} />
          </div>
          <span className="text-slate-200">{toastMessage.text}</span>
        </div>
      )}

      {/* --- PAYMENT POPUP MODAL --- */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedContact(null);
        }}
        contacts={contacts}
        paymentMethods={paymentMethods}
        selectedContact={selectedContact}
        isOnline={isOnline}
        onPaymentComplete={handlePaymentComplete}
        onAddLog={addProtocolLog}
        offlineSequence={offlineSequence}
      />

      {/* --- PROTOCOL HELP REFERENCE --- */}
      <ProtocolHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

    </div>
  );
}
