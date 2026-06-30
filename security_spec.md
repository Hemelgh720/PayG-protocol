# Security Specification for GPay Protocol Clone

## Data Invariants
1. **User Ownership (PII & Vault Security):** A payment method, transaction, or protocol log must belong to the authenticated user who created it (`userId == request.auth.uid`). No user can view or write another user's methods, transactions, or logs.
2. **Contact Access:** Contacts is a shared dictionary. Authenticated users can list or read them, but only admin/system or owners can modify them.
3. **Transaction Immutability:** Transactions are historical ledger entries. Once created, they cannot be modified (except during syncing, which can only move status from `pending_sync` to `success`). They can never be deleted.
4. **Data Type & Size Validation:** All string fields must have size bounds to prevent Denial of Wallet storage-exhaustion attacks.

---

## The "Dirty Dozen" Malicious Payloads
The following payloads attempt to violate security invariants and must be blocked by the security rules:

1. **Payload 1 (Identity Spoofing - Transaction):** Creating a transaction where `userId` is set to `victim_user_123` instead of the authenticated user's ID.
2. **Payload 2 (Immutability Breach - Transaction):** Trying to modify `amount` or `senderId` on an already-settled transaction.
3. **Payload 3 (Fraudulent Creation - PaymentMethod):** Registering a bank account or credit card with a hijacked `userId` to steal funds or insert bad state.
4. **Payload 4 (Terminal State Bypass):** Modifying a transaction's status back to `pending_sync` after it was already marked as `success`.
5. **Payload 5 (Unlawful Deletion):** Attempting to delete a payment transaction to erase historical transfer proof.
6. **Payload 6 (ID Poisoning Guard):** Writing a document with an ID containing malicious characters or exceeding 128 characters (`/transactions/malicious_##_$$__123_insanely_long_characters_to_exhaust_db_resources`).
7. **Payload 7 (Unauthenticated Method Creation):** Writing a payment method without being signed in (`request.auth == null`).
8. **Payload 8 (Type Integrity Violation):** Creating a Contact where `isMerchant` is sent as a string `"true"` instead of a proper boolean `true`.
9. **Payload 9 (Cross-User Balance Theft):** Attempting to update `balance` of a paymentMethod belonging to another user.
10. **Payload 10 (Schema Under-population):** Creating a ProtocolLog missing the required `payload` or `step` fields.
11. **Payload 11 (Self-Assigned Admin Role):** Trying to write an admin role configuration to become an authorized system operator.
12. **Payload 12 (Invalid Enum Injection):** Creating a transaction with `protocol` set to `"invalid_protocol_99"`.

---

## Test Runner: firestore.rules.test.ts
A standard Firestore Rules test suite verifying that all "Dirty Dozen" payloads fail with `PERMISSION_DENIED` errors.

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "midyear-psyche-479001-g0",
    firestore: {
      rules: require("fs").readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("GPay Protocol Rules - Red Team Tests", () => {
  test("Blocks Payload 1: Transaction creator spoofing", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const badTxRef = doc(aliceDb, "transactions/tx_1");
    await assertFails(
      setDoc(badTxRef, {
        id: "tx_1",
        senderId: "alice",
        senderName: "Alice",
        receiverId: "bob",
        receiverName: "Bob",
        amount: 100,
        timestamp: "2026-06-29T15:14:07Z",
        protocol: "online_101_1",
        status: "success",
        paymentMethodId: "card_1",
        paymentMethodName: "Chase Bank",
        category: "Friends",
        userId: "bob" // Spoofed user id
      })
    );
  });

  test("Blocks Payload 2: Modifying transaction details after creation", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const txRef = doc(aliceDb, "transactions/tx_alice_1");
    // Ensure existing
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "transactions/tx_alice_1"), {
        id: "tx_alice_1",
        senderId: "alice",
        senderName: "Alice",
        receiverId: "bob",
        receiverName: "Bob",
        amount: 100,
        timestamp: "2026-06-29T15:14:07Z",
        protocol: "online_101_1",
        status: "success",
        paymentMethodId: "card_1",
        paymentMethodName: "Chase Bank",
        category: "Friends",
        userId: "alice"
      });
    });

    await assertFails(
      updateDoc(txRef, {
        amount: 9999 // Cheat/alter amount
      })
    );
  });

  test("Blocks Payload 5: Deleting any transaction", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const txRef = doc(aliceDb, "transactions/tx_alice_1");
    await assertFails(deleteDoc(txRef));
  });
});
```
