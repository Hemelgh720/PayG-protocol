import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { PaymentMethod, Transaction, Contact, ProtocolLog } from '../types';
import { 
  INITIAL_PAYMENT_METHODS, 
  INITIAL_CONTACTS, 
  INITIAL_TRANSACTIONS 
} from '../data/mockData';

// --- SEED SEEDING CORES ---
export async function seedUserData(userId: string) {
  try {
    const batch = writeBatch(db);

    // 1. Seed Payment Methods
    for (const pm of INITIAL_PAYMENT_METHODS) {
      const pmRef = doc(db, 'paymentMethods', pm.id);
      batch.set(pmRef, { ...pm, userId });
    }

    // 2. Seed Transactions
    for (const tx of INITIAL_TRANSACTIONS) {
      const txRef = doc(db, 'transactions', tx.id);
      batch.set(txRef, { ...tx, userId });
    }

    // 3. Seed Contacts (Global if not exists, but we can seed in user scope or shared)
    // To comply with rules, contacts can be written so they are readable by all signed-in users.
    for (const c of INITIAL_CONTACTS) {
      const contactRef = doc(db, 'contacts', c.id);
      batch.set(contactRef, c);
    }

    // 4. Seed initial logs
    const initialLogs: ProtocolLog[] = [
      {
        id: 'log_init_1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        protocol: 'SYSTEM',
        step: 'GPay Cloud Database Sync Initialized',
        payload: JSON.stringify({
          database: "FIRESTORE_ENTERPRISE",
          region: "SECURE_GOOGLE_CLOUD",
          encryption: "AES_256_GCM",
          status: "SUCCESSFULLY_SYNCHRONIZED_WITH_CLOUD"
        }, null, 2),
        type: 'success'
      },
      {
        id: 'log_init_2',
        timestamp: new Date(Date.now() - 4000).toISOString(),
        protocol: 'SYSTEM',
        step: 'Security Rules & Gateway Verified',
        payload: JSON.stringify({
          rule_version: "v2_FORTRESS",
          integrity_hash: "SHA-256_VERIFIED",
          auth_provider: "GOOGLE_OAUTH_OIDC"
        }, null, 2),
        type: 'info'
      }
    ];

    for (const l of initialLogs) {
      const logRef = doc(db, 'protocolLogs', l.id);
      batch.set(logRef, { ...l, userId });
    }

    await batch.commit();
    console.log("Seeding user defaults to Firestore completed successfully.");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
}

// --- FETCHING ACTIONS ---
export async function fetchUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const path = 'paymentMethods';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Seed first time
      await seedUserData(userId);
      const reSnapshot = await getDocs(q);
      return reSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
    }

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function fetchUserTransactions(userId: string): Promise<Transaction[]> {
  const path = 'transactions';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function fetchUserLogs(userId: string): Promise<ProtocolLog[]> {
  const path = 'protocolLogs';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProtocolLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function fetchContacts(): Promise<Contact[]> {
  const path = 'contacts';
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      // Seed default contacts
      const batch = writeBatch(db);
      for (const c of INITIAL_CONTACTS) {
        batch.set(doc(db, 'contacts', c.id), c);
      }
      await batch.commit();
      return INITIAL_CONTACTS;
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// --- PERSISTENCE MUTATORS ---
export async function addPaymentMethodToCloud(userId: string, method: PaymentMethod) {
  const path = `paymentMethods/${method.id}`;
  try {
    await setDoc(doc(db, 'paymentMethods', method.id), {
      ...method,
      userId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePaymentMethodFromCloud(userId: string, methodId: string) {
  const path = `paymentMethods/${methodId}`;
  try {
    await deleteDoc(doc(db, 'paymentMethods', methodId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updatePaymentMethodBalanceInCloud(userId: string, methodId: string, newBalance: number) {
  const path = `paymentMethods/${methodId}`;
  try {
    await updateDoc(doc(db, 'paymentMethods', methodId), {
      balance: newBalance
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTransactionToCloud(userId: string, tx: Transaction) {
  const path = `transactions/${tx.id}`;
  try {
    await setDoc(doc(db, 'transactions', tx.id), {
      ...tx,
      userId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTransactionStatusToCloud(userId: string, txId: string, status: 'success' | 'failed') {
  const path = `transactions/${txId}`;
  try {
    await updateDoc(doc(db, 'transactions', txId), {
      status
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addProtocolLogToCloud(userId: string, log: ProtocolLog) {
  const path = `protocolLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'protocolLogs', log.id), {
      ...log,
      userId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
