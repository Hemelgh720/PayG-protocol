import { Contact, PaymentMethod, Transaction } from '../types';

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'method_wallet',
    type: 'wallet',
    name: 'GPay Secure Wallet',
    number: 'Wallet Balance',
    balance: 248.50,
    provider: 'GPay Wallet'
  },
  {
    id: 'method_bank_chase',
    type: 'bank_account',
    name: 'Chase Checking',
    number: '•••• 4820',
    balance: 1450.00,
    provider: 'Chase Bank'
  },
  {
    id: 'method_card_visa',
    type: 'credit_card',
    name: 'Visa Signature Card',
    number: '•••• 8821',
    balance: 5000.00,
    provider: 'Visa'
  },
  {
    id: 'method_card_master',
    type: 'debit_card',
    name: 'Mastercard Debit',
    number: '•••• 1290',
    balance: 2500.00,
    provider: 'Mastercard'
  }
];

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'contact_alice',
    name: 'Alice Smith',
    phone: '+1 (555) 019-2834',
    upiId: 'alicesmith@okaxis',
    avatarColor: 'from-emerald-400 to-teal-500',
    isMerchant: false,
    avatarText: 'AS'
  },
  {
    id: 'contact_bob',
    name: 'Bob Johnson',
    phone: '+1 (555) 014-9921',
    upiId: 'bobjohnson@oksbi',
    avatarColor: 'from-sky-400 to-blue-500',
    isMerchant: false,
    avatarText: 'BJ'
  },
  {
    id: 'contact_charlie',
    name: 'Charlie Davis',
    phone: '+1 (555) 018-7744',
    upiId: 'charlied@okicici',
    avatarColor: 'from-indigo-400 to-violet-500',
    isMerchant: false,
    avatarText: 'CD'
  },
  {
    id: 'contact_starbucks',
    name: 'Starbucks Coffee',
    phone: '1-800-STARBUCKS',
    upiId: 'starbucks@okhdfc',
    avatarColor: 'from-green-600 to-emerald-700',
    isMerchant: true,
    avatarText: '☕'
  },
  {
    id: 'contact_wholefoods',
    name: 'Whole Foods',
    phone: '1-800-WHOLEFOODS',
    upiId: 'wholefoods@okaxis',
    avatarColor: 'from-amber-600 to-orange-700',
    isMerchant: true,
    avatarText: '🥦'
  },
  {
    id: 'contact_shell',
    name: 'Shell Gas Station',
    phone: '1-800-SHELLGAS',
    upiId: 'shellcorp@okicici',
    avatarColor: 'from-yellow-400 to-amber-500',
    isMerchant: true,
    avatarText: '⛽'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_pre_1',
    senderId: 'user_current',
    senderName: 'You',
    receiverId: 'contact_starbucks',
    receiverName: 'Starbucks Coffee',
    receiverAvatar: '☕',
    amount: 14.50,
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    protocol: 'online_101_1',
    status: 'success',
    paymentMethodId: 'method_bank_chase',
    paymentMethodName: 'Chase Checking',
    category: 'Food & Drinks',
    note: 'Morning hazelnut latte and croissant',
    protocolDetails: {
      handshakeLatency: 284,
      signature: 'SIG_A29E88DF01C2F34E',
      tokenSeed: 'SEED_847120',
      deviceFingerprint: 'DEV_FPR_E4D89C1B2A3F'
    }
  },
  {
    id: 'tx_pre_2',
    senderId: 'user_current',
    senderName: 'You',
    receiverId: 'contact_alice',
    receiverName: 'Alice Smith',
    receiverAvatar: 'AS',
    amount: 25.00,
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    protocol: 'wallet_direct',
    status: 'success',
    paymentMethodId: 'method_wallet',
    paymentMethodName: 'GPay Secure Wallet',
    category: 'Friends',
    note: 'Dinner split',
    protocolDetails: {
      signature: 'SIG_F82C9E441D99B1A0'
    }
  },
  {
    id: 'tx_pre_3',
    senderId: 'user_current',
    senderName: 'You',
    receiverId: 'contact_shell',
    receiverName: 'Shell Gas Station',
    receiverAvatar: '⛽',
    amount: 48.00,
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
    protocol: 'offline_201_3',
    status: 'success',
    paymentMethodId: 'method_card_visa',
    paymentMethodName: 'Visa Signature Card',
    category: 'Transport',
    note: 'Gas refueling (offline mode)',
    protocolDetails: {
      signature: 'SIG_D84C1204FF8C25E9',
      offlineAuthCode: 'OFF_AUTH_12_4982',
      payloadSize: 142
    }
  },
  {
    id: 'tx_pre_4',
    senderId: 'contact_bob',
    senderName: 'Bob Johnson',
    receiverId: 'user_current',
    receiverName: 'You',
    receiverAvatar: 'BJ',
    amount: 15.00,
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(), // 3 days ago
    protocol: 'online_101_1',
    status: 'success',
    paymentMethodId: 'method_wallet',
    paymentMethodName: 'GPay Secure Wallet',
    category: 'Transfer',
    note: 'Movie ticket payback',
    protocolDetails: {
      handshakeLatency: 195,
      signature: 'SIG_B11E99D308C2B3E1',
      tokenSeed: 'SEED_129482',
      deviceFingerprint: 'DEV_FPR_C1F4A8B9C1E1'
    }
  }
];
