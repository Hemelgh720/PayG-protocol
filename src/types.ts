export type ProtocolType = 'online_101_1' | 'offline_201_3' | 'wallet_direct';

export type PaymentMethodType = 'wallet' | 'bank_account' | 'credit_card' | 'debit_card';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  number: string;
  balance?: number;
  provider: string; // e.g. "Chase", "Visa", "Mastercard", "GPay"
}

export interface Transaction {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  amount: number;
  timestamp: string;
  protocol: ProtocolType;
  status: 'success' | 'pending_sync' | 'failed';
  paymentMethodId: string;
  paymentMethodName: string;
  category: string;
  note?: string;
  userId?: string;
  mode?: 'sale' | 'pre_auth' | 'bank_transfer';
  approvalCode?: string;
  isCaptured?: boolean;
  protocolDetails: {
    handshakeLatency?: number; // ms
    signature: string;
    tokenSeed?: string;
    offlineAuthCode?: string;
    payloadSize?: number; // bytes
    deviceFingerprint?: string;
    sequence?: number;
  };
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  upiId: string;
  avatarColor: string;
  isMerchant: boolean;
  avatarText: string;
  recentAmount?: number;
}

export interface ProtocolLog {
  id: string;
  timestamp: string;
  protocol: '101.1' | '201.3' | 'SYSTEM';
  step: string;
  payload: string;
  type: 'info' | 'success' | 'warning' | 'crypto';
}
