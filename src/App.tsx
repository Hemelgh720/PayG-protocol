import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
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
import { 
  generateUUID,
  PAYG_PRIMARY_ALGORITHM,
  PAYG_SIGNATURE_ALGORITHM,
  HANDSHAKE_LATENCY_DELAY_MS,
  ONLINE_HANDSHAKE_TIMEOUT_MS,
  ENCLAVE_SIGNING_CO_PROCESSOR,
  HSM_PROVIDER,
  HSM_KEY_LABEL,
  GATEWAY_AUTHENTICATION_KEY
} from './utils/crypto';
import GPayHeader from './components/GPayHeader';
import WalletSection from './components/WalletSection';
import QuickActions from './components/QuickActions';
import CardTransferEngine from './components/CardTransferEngine';
import ContactsGrid from './components/ContactsGrid';
import TransactionHistory from './components/TransactionHistory';
import ProtocolDebugger from './components/ProtocolDebugger';
import ProtocolPipelineVisualizer from './components/ProtocolPipelineVisualizer';
import PaymentModal from './components/PaymentModal';
import ProtocolHelpModal from './components/ProtocolHelpModal';
import AuthErrorModal from './components/AuthErrorModal';
import PaymentTerminal from './components/PaymentTerminal';
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

  // --- LIVE PRODUCTION ENCLAVE STATES ---
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    return localStorage.getItem('gpay_live_mode') === 'true';
  });
  const [liveWalletBalance, setLiveWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem('gpay_live_balance');
    return saved ? parseFloat(saved) : 1250.00;
  });

  // Dynamic override mapping for wallet balance in UI components
  const activePaymentMethods = paymentMethods.map(m => {
    if (m.id === 'method_wallet') {
      return { ...m, balance: isLiveMode ? liveWalletBalance : m.balance };
    }
    return m;
  });

  // Trigger local storage save whenever live mode toggles
  const handleToggleLiveMode = (live: boolean) => {
    setIsLiveMode(live);
    localStorage.setItem('gpay_live_mode', String(live));
    
    addProtocolLog(
      `Environment switched to ${live ? 'LIVE (PRODUCTION)' : 'DEMO (SANDBOX)'}`,
      JSON.stringify({
        action: "ENVIRONMENT_STATE_CHANGE",
        is_live: live,
        enclave_provider: live ? "AWS_CLOUD_HSM_v3" : "SANDBOX_MOCK_VAULT",
        security_level: live ? "FIPS_140-2_LEVEL_3" : "SANDBOX_LEVEL_1",
        signing_key_slot: live ? "PAYG_PROD_SIGN_01" : "PAYG_TEST_SIGN_01",
        gateway_endpoint: live ? "https://gateway-live.gpay.secure/v3" : "https://gateway.gpay.secure/v3"
      }, null, 2),
      live ? 'success' : 'warning',
      'SYSTEM'
    );

    triggerToast(
      live 
        ? "Switched to HSM Enclave Production Environment! Secure live mode active." 
        : "Switched back to local Demo Sandbox environment.",
      live ? 'success' : 'info'
    );
  };

  // --- FIREBASE SECURITY & AUTH STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);
  const [authErrorModal, setAuthErrorModal] = useState<{ isOpen: boolean; message: string; type: 'closed' | 'blocked' | 'other' } | null>(null);

  // --- GOOGLE SIGN IN & LOGOUT HANDLERS ---
  const handleLogin = async () => {
    try {
      setIsSyncingWithCloud(true);
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const isPopupClosed = e.code === 'auth/popup-closed-by-user' || 
                            e.message?.includes('popup-closed-by-user') ||
                            e.message?.includes('cancelled-by-user') ||
                            e.message?.includes('popup closed') ||
                            e.message?.includes('popup-closed');
      
      const isPopupBlocked = e.code === 'auth/popup-blocked' || 
                             e.message?.includes('popup-blocked') ||
                             e.message?.includes('popup blocked');

      if (isPopupClosed || isPopupBlocked) {
        console.warn("Firebase auth warning (popup closed or blocked):", e.message || e);
      } else {
        console.error("Firebase auth error:", e);
      }

      const isIframe = window.self !== window.top;

      if (isPopupClosed) {
        setAuthErrorModal({
          isOpen: true,
          type: 'closed',
          message: isIframe 
            ? "The authentication popup was closed or blocked. Because you are currently viewing this application inside the AI Studio preview iframe, browser safety constraints frequently prevent the Google Sign-In popup from opening."
            : "The authentication popup was closed before completing the sign-in flow. Please ensure you keep the Google window open until sign-in completes."
        });
        triggerToast("Sign in cancelled or blocked.", "warning");
      } else if (isPopupBlocked) {
        setAuthErrorModal({
          isOpen: true,
          type: 'blocked',
          message: "Your browser's popup blocker stopped the Google Sign-In window from launching. Please allow popups for this site, or open this application in a new tab."
        });
        triggerToast("Popup blocked by browser.", "warning");
      } else {
        setAuthErrorModal({
          isOpen: true,
          type: 'other',
          message: e.message || "An unexpected error occurred during cloud synchronization handshake. Please check your network or try again."
        });
        triggerToast("Authentication error occurred.", "warning");
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
    let unsubPaymentMethods: (() => void) | null = null;
    let unsubTransactions: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let unsubContacts: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubPaymentMethods) { unsubPaymentMethods(); unsubPaymentMethods = null; }
      if (unsubTransactions) { unsubTransactions(); unsubTransactions = null; }
      if (unsubLogs) { unsubLogs(); unsubLogs = null; }
      if (unsubContacts) { unsubContacts(); unsubContacts = null; }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      cleanupListeners();

      if (user) {
        setIsSyncingWithCloud(true);
        try {
          // Pre-seed if collections are empty so we have initial mock data seeded to this user's Cloud project
          await fetchUserPaymentMethods(user.uid);
          await fetchContacts();

          // Set up real-time listeners
          unsubPaymentMethods = onSnapshot(
            query(collection(db, 'paymentMethods'), where('userId', '==', user.uid)),
            (snapshot) => {
              const methods = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
              if (methods.length > 0) {
                setPaymentMethods(methods);
                const wallet = methods.find(m => m.id === 'method_wallet');
                if (wallet && wallet.balance !== undefined) {
                  setLiveWalletBalance(wallet.balance);
                  localStorage.setItem('gpay_live_balance', wallet.balance.toString());
                }
              }
            },
            (error) => handleFirestoreError(error, OperationType.GET, 'paymentMethods')
          );

          unsubTransactions = onSnapshot(
            query(collection(db, 'transactions'), where('userId', '==', user.uid)),
            (snapshot) => {
              const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
              txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setTransactions(txs);
            },
            (error) => handleFirestoreError(error, OperationType.GET, 'transactions')
          );

          unsubLogs = onSnapshot(
            query(collection(db, 'protocolLogs'), where('userId', '==', user.uid)),
            (snapshot) => {
              const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProtocolLog));
              logsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setLogs(logsData);
            },
            (error) => handleFirestoreError(error, OperationType.GET, 'protocolLogs')
          );

          unsubContacts = onSnapshot(
            collection(db, 'contacts'),
            (snapshot) => {
              const cts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contact));
              if (cts.length > 0) {
                setContacts(cts);
              }
            },
            (error) => handleFirestoreError(error, OperationType.GET, 'contacts')
          );

          triggerToast(`Secured real-time cloud vault loaded for ${user.displayName || 'user'}!`, 'success');
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
              enclave_signing_co_processor: ENCLAVE_SIGNING_CO_PROCESSOR,
              ...(ENCLAVE_SIGNING_CO_PROCESSOR === "HSM" ? {
                hsm_provider: HSM_PROVIDER,
                hsm_key_label: HSM_KEY_LABEL
              } : {}),
              primary_algorithm: PAYG_PRIMARY_ALGORITHM,
              signature_algorithm: PAYG_SIGNATURE_ALGORITHM,
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
              active_channels: ["101.1_ONLINE_SETTLE"],
              handshake_timeout_ms: ONLINE_HANDSHAKE_TIMEOUT_MS,
              handshake_latency_delay_ms: HANDSHAKE_LATENCY_DELAY_MS,
              gateway_key_configured: !!GATEWAY_AUTHENTICATION_KEY
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

    return () => {
      unsubscribeAuth();
      cleanupListeners();
    };
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
          : "Offline mode active. PayG 201.3 Acoustic & QR protocols engaged.",
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
    const sourceMethod = paymentMethods.find(m => m.id === bankMethodId);
    if (!sourceMethod || sourceMethod.balance === undefined || sourceMethod.balance < amount) {
      const sourceLabel = sourceMethod?.type === 'bank_account' ? 'bank account' : 'card';
      triggerToast(`Insufficient funds in the selected source ${sourceLabel}!`, "warning");
      return false;
    }

    if (isLiveMode) {
      const newSourceBalance = (sourceMethod.balance ?? 0) - amount;
      const newLiveBalance = liveWalletBalance + amount;

      setLiveWalletBalance(newLiveBalance);
      localStorage.setItem('gpay_live_balance', newLiveBalance.toString());

      const updatedMethods = paymentMethods.map(m => {
        if (m.id === bankMethodId) {
          return { ...m, balance: newSourceBalance };
        }
        return m;
      });
      setPaymentMethods(updatedMethods);

      if (currentUser) {
        updatePaymentMethodBalanceInCloud(currentUser.uid, bankMethodId, newSourceBalance).catch(console.error);
      } else {
        localStorage.setItem('gpay_methods', JSON.stringify(updatedMethods));
      }

      const loadTx: Transaction = {
        id: `tx_load_${generateUUID()}`,
        senderId: bankMethodId,
        senderName: sourceMethod.name,
        receiverId: 'user_current',
        receiverName: 'You (PayG Wallet - LIVE)',
        receiverAvatar: 'Wallet',
        amount,
        timestamp: new Date().toISOString(),
        protocol: 'online_101_1',
        status: 'success',
        paymentMethodId: bankMethodId,
        paymentMethodName: sourceMethod.name,
        category: 'Top Up',
        note: 'Live Enclave Cash Load',
        userId: currentUser ? currentUser.uid : 'user_current',
        protocolDetails: {
          handshakeLatency: 45,
          signature: 'SIG_LIVE_HSM_' + Math.random().toString(36).substring(3, 11).toUpperCase()
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
        `[LIVE HSM CLEARING] Wallet Cash Load: $${amount}`,
        JSON.stringify({
          source_account: sourceMethod.name,
          source_type: sourceMethod.type,
          target_account: "Live PayG Secure Balance",
          transfer_amount: amount,
          hardware_security_module: "AWS_CloudHSM_FIPS_140-2",
          key_identifier: "PAYG_PROD_SIGN_01",
          clearing_auth_ref: loadTx.id
        }, null, 2),
        'success',
        '101.1'
      );

      triggerToast(`Successfully loaded $${amount.toFixed(2)} to Live PayG Secure Balance!`, "success");
      return true;
    }

    const walletMethod = paymentMethods.find(m => m.type === 'wallet');
    const newSourceBalance = (sourceMethod.balance ?? 0) - amount;
    const newWalletBalance = ((walletMethod?.balance) ?? 0) + amount;

    // Subtract from source, add to wallet
    const updatedMethods = paymentMethods.map(m => {
      if (m.id === bankMethodId) {
        return { ...m, balance: newSourceBalance };
      }
      if (m.type === 'wallet') {
        return { ...m, balance: newWalletBalance };
      }
      return m;
    });

    setPaymentMethods(updatedMethods);

    if (currentUser) {
      // Async write to Firestore
      updatePaymentMethodBalanceInCloud(currentUser.uid, bankMethodId, newSourceBalance).catch(console.error);
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
      senderName: sourceMethod.name,
      receiverId: 'user_current',
      receiverName: 'You (PayG Wallet)',
      receiverAvatar: 'Wallet',
      amount,
      timestamp: new Date().toISOString(),
      protocol: 'online_101_1',
      status: 'success',
      paymentMethodId: bankMethodId,
      paymentMethodName: sourceMethod.name,
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
        source_account: sourceMethod.name,
        source_type: sourceMethod.type,
        target_account: "PayG Secure Balance",
        transfer_amount: amount,
        clearing_auth_ref: loadTx.id
      }, null, 2),
      'success',
      '101.1'
    );

    triggerToast(`Loaded $${amount.toFixed(2)} to PayG Balance!`);
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
        if (isLiveMode && methodId === 'method_wallet') {
          newBalance = Math.max(0, liveWalletBalance - amount);
          setLiveWalletBalance(newBalance);
          localStorage.setItem('gpay_live_balance', newBalance.toString());
          
          if (currentUser) {
            updatePaymentMethodBalanceInCloud(currentUser.uid, 'method_wallet', newBalance).catch(console.error);
          }
        } else {
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
      paymentMethodName: methodSelected ? methodSelected.name : 'PayG Wallet',
      category: contact.isMerchant ? 'Shopping & Utilities' : 'Friends',
      note: note || undefined,
      userId: currentUser ? currentUser.uid : 'user_current',
      mode: extraDetails.mode || 'sale',
      approvalCode: extraDetails.approvalCode || `AP_GPAY_${Math.floor(Math.random() * 900000 + 100000)}`,
      isCaptured: extraDetails.isCaptured !== undefined ? extraDetails.isCaptured : true,
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
      extraDetails.mode === 'pre_auth'
        ? `Pre-Authorization hold of $${amount.toFixed(2)} generated successfully!`
        : status === 'pending_sync'
          ? `Offline payment of $${amount.toFixed(2)} cached! Sync pending.`
          : `Payment of $${amount.toFixed(2)} settled with ${contact.name}!`,
      status === 'pending_sync' ? 'warning' : 'success'
    );
  };

  // --- CAPTURE PRE-AUTH TRANSACTION ---
  const handleCaptureTransaction = async (txId: string) => {
    const updatedTx = transactions.map(tx => {
      if (tx.id === txId) {
        addProtocolLog(
          `Captured Authorization: ${tx.approvalCode}`,
          JSON.stringify({
            status: "CAPTURED",
            original_amount: tx.amount,
            captured_amount: tx.amount,
            approval_code: tx.approvalCode,
            clearing_ledger: "SUCCESSFUL_SETTLEMENT"
          }, null, 2),
          'success',
          tx.protocol === 'offline_201_3' ? '201.3' : '101.1'
        );
        return { ...tx, isCaptured: true };
      }
      return tx;
    });
    setTransactions(updatedTx);
    if (currentUser) {
      const captured = updatedTx.find(t => t.id === txId);
      if (captured) {
        addTransactionToCloud(currentUser.uid, captured).catch(console.error);
      }
    } else {
      localStorage.setItem('gpay_transactions', JSON.stringify(updatedTx));
    }
    triggerToast("Authorization captured successfully! Funds settled.", "success");
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
          paymentMethods={activePaymentMethods}
          onAddMethod={handleAddPaymentMethod}
          onTopUpWallet={handleTopUpWallet}
          isLiveMode={isLiveMode}
          onToggleLiveMode={handleToggleLiveMode}
          liveWalletBalance={liveWalletBalance}
        />

        {/* 3. Quick Round Actions */}
        <QuickActions onAction={handleQuickAction} />

        {/* PayG Multi-Route Clearing Engine */}
        <CardTransferEngine
          paymentMethods={activePaymentMethods}
          onAddTransaction={handlePaymentComplete}
          onAddLog={addProtocolLog}
          triggerToast={triggerToast}
          isOnline={isOnline}
        />

        {/* 3b. Real-time Multi-Mode Secure Payment Terminal */}
        <PaymentTerminal
          paymentMethods={activePaymentMethods}
          transactions={transactions}
          onAddTransaction={handlePaymentComplete}
          onCaptureTransaction={handleCaptureTransaction}
          onAddLog={addProtocolLog}
          triggerToast={triggerToast}
          isOnline={isOnline}
          contacts={contacts}
        />

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

        {/* 5b. Interactive Cryptographic Signature & Verification Pipeline Visualizer */}
        <section className="px-4 py-1 max-w-4xl mx-auto font-sans">
          <ProtocolPipelineVisualizer transactions={transactions} />
        </section>

        {/* 6. Transaction Ledger History list */}
        <TransactionHistory transactions={transactions} onCapture={handleCaptureTransaction} />

      </main>

      {/* --- FOOTER DECORATION --- */}
      <footer className="border-t border-slate-900 mt-8 pt-6 pb-2 text-center text-slate-600 max-w-4xl mx-auto w-full px-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-[11px] font-mono leading-none">
          PayG sandbox build v201.3.1 • Safe cryptographies ECDSA-P256
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
        paymentMethods={activePaymentMethods}
        selectedContact={selectedContact}
        isOnline={isOnline}
        onPaymentComplete={handlePaymentComplete}
        onAddLog={addProtocolLog}
        offlineSequence={offlineSequence}
        isLiveMode={isLiveMode}
      />

      {/* --- PROTOCOL HELP REFERENCE --- */}
      <ProtocolHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* --- CLOUD SIGN-IN ERROR HANDLERS --- */}
      {authErrorModal && (
        <AuthErrorModal
          isOpen={authErrorModal.isOpen}
          type={authErrorModal.type}
          message={authErrorModal.message}
          onClose={() => setAuthErrorModal(null)}
        />
      )}

    </div>
  );
}
