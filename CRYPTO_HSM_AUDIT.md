# PayG Protocol: Cryptographic & HSM Configuration Audit

**Date:** 2026-07-07  
**Scope:** `src/utils/crypto.ts`, `.env.example`, environment variables, HSM integration  
**Status:** ⚠️ REQUIRES ENHANCEMENTS  
**Prepared for:** Production Deployment

---

## Executive Summary

The PayG Protocol currently has **robust environment variable scaffolding** for HSM and cryptographic configuration, but implementation has **critical gaps**:

| Aspect | Status | Impact |
|--------|--------|--------|
| Environment variable structure | ✅ Good | Well-organized, VITE_ prefixes used |
| Algorithm configuration | ✅ Good | Supports Ed25519, ECDSA-P256, RSA-PSS-3072 |
| HSM provider selection | ✅ Good | AWS CloudHSM, Gemalto, Thales options |
| **Actual HSM integration** | ❌ Missing | Only reading config, never calling HSM |
| **Cryptographic operations** | ❌ Simulated | Using fake hashing, not real signatures |
| **Signature verification** | ❌ Unenforced | Logged but never validated |
| **HSM health checks** | ❌ Missing | No validation on startup |
| **Key rotation** | ❌ Missing | Configuration exists, logic absent |
| **FIPS-140-2 enforcement** | ❌ Optional | Should be mandatory for production |
| **Sensitive key redaction** | ❌ Exposed | Gateway key visible in `.env.example` |

**Risk Level:** 🔴 **HIGH** — Production-grade system with simulated cryptography

---

## Current Architecture Analysis

### 1. Environment Configuration (`src/utils/crypto.ts` lines 4-29)

**Current State:**
```typescript
export const PAYG_PRIMARY_ALGORITHM = metaEnv.VITE_PAYG_PRIMARY_ALGORITHM || "AES-256-GCM";
export const PAYG_SIGNATURE_ALGORITHM = metaEnv.VITE_PAYG_SIGNATURE_ALGORITHM || "Ed25519";
export const ENCLAVE_SIGNING_CO_PROCESSOR = metaEnv.VITE_ENCLAVE_SIGNING_CO_PROCESSOR || "AWS_NITRO";
export const HSM_PROVIDER = metaEnv.VITE_HSM_PROVIDER || "AWS_CLOUDHSM";
export const HSM_KEY_LABEL = metaEnv.VITE_HSM_KEY_LABEL || "PAYG_SIGNING_KEY";
export const GATEWAY_AUTHENTICATION_KEY = metaEnv.VITE_GATEWAY_AUTHENTICATION_KEY || "";
```

**Issues:**
- Configuration is read but **never validated**
- No type safety — all values are strings
- No default fallback strategy
- HSM endpoint URL not configurable
- HSM PIN/credentials not supported
- No detection of required vs. optional HSM

### 2. Cryptographic Operations (`src/utils/crypto.ts` lines 32-48)

**Current `calculateSimulatedHash()` Implementation:**
```typescript
export function calculateSimulatedHash(input: string, key: string = "gpay_secret_key"): string {
  let hash1 = 0;
  let hash2 = 0;
  const combined = input + key;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash1 = (hash1 << 5) - hash1 + char;
    hash1 |= 0;
    hash2 = (hash2 << 7) - hash2 + char * 1.5;
    hash2 |= 0;
  }
  
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const part2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return `SIG_${part1}${part2}`.toUpperCase();
}
```

**Problems:**
- ❌ **Not cryptographically secure** — custom hash function vulnerable to collisions
- ❌ **Not reversible verification** — can't verify signatures later
- ❌ **No key derivation** — key parameter unused in output
- ❌ **Deterministic but weak** — same input always produces same output
- ⚠️ **Misleading naming** — called "SIG_" but is not a real signature

**Real signatures require:**
- HMAC-SHA256, Ed25519, or ECDSA operations
- Private/public key cryptography
- Verifiable output format (JWS, DER, PEM)
- Tamper detection

### 3. Protocol Handshake (`src/utils/crypto.ts` lines 58-165)

**101.1 Online Protocol Flow:**
1. Handshake Init → logs to console
2. Challenge Received → sends simulated seed
3. Challenge Solved & Signed → **calls `calculateSimulatedHash()` ❌**
4. Gateway Verification Success → **approves fake signature ✅**

**Issue:** Transaction signed with fake hash, then immediately "verified" without real cryptography.

**Where it's used:**
- `CardTransferEngine.tsx` — calls `simulateOnline101Handshake()`
- `PaymentModal.tsx` — receives fake signature
- `App.tsx` — logs fake signature to protocol debugger

### 4. Offline Protocol (`src/utils/crypto.ts` lines 169-243)

**201.3 Offline Mode:**
```typescript
const signature = calculateSimulatedHash(offlineString, "LOCAL_DEVICE_SECURE_ENCLAVE_KEY");
```

**Problem:** Same simulated hash issue, but used for offline QR codes and acoustic tokens.

### 5. Protocol Logs (Missing HSM Status)

**In `App.tsx` lines 98-110:**
```typescript
addProtocolLog(
  `Environment switched to ${live ? 'LIVE (PRODUCTION)' : 'DEMO (SANDBOX)'}`,
  JSON.stringify({
    action: "ENVIRONMENT_STATE_CHANGE",
    is_live: live,
    enclave_provider: live ? "AWS_CLOUD_HSM_v3" : "SANDBOX_MOCK_VAULT",
    security_level: live ? "FIPS_140-2_LEVEL_3" : "SANDBOX_LEVEL_1",
    // ... claims FIPS compliance but doesn't verify it
  }, null, 2),
```

**Problem:** Logs claim "HSM_v3" and "FIPS_140-2_LEVEL_3" but never actually check if HSM is available.

---

## Critical Issues (🔴 Must Fix Before Production)

### Issue #1: No HSM Implementation
**Severity:** CRITICAL  
**Location:** `src/utils/crypto.ts` (entire file)  
**Current:** Reads HSM config but never calls any HSM APIs  
**Risk:** All "cryptographically signed" transactions are actually fake

**Recommendation:**
```typescript
// CURRENT (WRONG):
const clientSignature = calculateSimulatedHash(payloadToSign, "CLIENT_PRIVATE_KEY");

// SHOULD BE:
const clientSignature = await signWithHSM(payloadToSign, HSM_KEY_LABEL);

async function signWithHSM(payload: string, keyLabel: string): Promise<string> {
  if (ENCLAVE_SIGNING_CO_PROCESSOR !== "HSM") {
    throw new Error("HSM not configured as required");
  }
  
  try {
    // Call actual HSM provider
    const signature = await hsmClient.sign({
      keyLabel,
      message: payload,
      algorithm: PAYG_SIGNATURE_ALGORITHM,
      hashAlgorithm: PAYG_SIGNATURE_HASH
    });
    return signature;
  } catch (error) {
    if (PAYG_SIGNATURE_FAIL_POLICY === "DENY") {
      throw new Error(`HSM signing failed: ${error.message}`);
    }
    console.error("HSM signing failed, falling back to software:", error);
    return signWithSoftware(payload, keyLabel);
  }
}
```

---

### Issue #2: No Signature Verification
**Severity:** CRITICAL  
**Location:** `CardTransferEngine.tsx`, `PaymentModal.tsx`  
**Current:** Signatures generated but never verified  
**Risk:** Any transaction is accepted regardless of signature validity

**Recommendation:**
```typescript
// Add verification step in transaction execution
async function verifyTransactionSignature(transaction: Transaction): Promise<boolean> {
  const { signature, amount, senderId, receiverId, timestamp } = transaction;
  
  const payload = JSON.stringify({
    amount,
    senderId,
    receiverId,
    timestamp
  });
  
  try {
    const isValid = await verifySignatureWithHSM(payload, signature);
    
    if (!isValid && PAYG_SIGNATURE_FAIL_POLICY === "DENY") {
      throw new Error("Signature verification failed. Transaction REJECTED.");
    }
    
    if (PAYG_SIGNATURE_LOGGING === "ENABLED") {
      await logCryptoAudit({
        operation: "verify",
        txId: transaction.id,
        success: isValid,
        algorithm: PAYG_SIGNATURE_ALGORITHM
      });
    }
    
    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// In PaymentModal.tsx:
const isSignatureValid = await verifyTransactionSignature(newTx);
if (!isSignatureValid) {
  triggerToast("Transaction signature invalid. Payment rejected.", "warning");
  return;
}
```

---

### Issue #3: FIPS-140-2 Optional (Should be Mandatory)
**Severity:** CRITICAL  
**Location:** `.env.example` line 48, `crypto.ts` line 26  
**Current:** `PAYG_SIGNATURE_FIPS_MODE="Optional"`  
**Risk:** Production deployments could skip FIPS compliance

**Recommendation:**
```dotenv
# .env.example - Change to:
VITE_PAYG_SIGNATURE_FIPS_MODE="REQUIRED"

# crypto.ts - Add validation:
export const PAYG_SIGNATURE_FIPS_MODE = 
  (metaEnv.VITE_PAYG_SIGNATURE_FIPS_MODE || "REQUIRED") as "REQUIRED" | "OPTIONAL";

// On app initialization:
function validateFIPSCompliance(): void {
  if (PAYG_SIGNATURE_FIPS_MODE === "REQUIRED") {
    if (ENCLAVE_SIGNING_CO_PROCESSOR !== "HSM") {
      throw new Error(
        "FIPS-140-2 compliance REQUIRED but HSM not configured. " +
        "Set VITE_ENCLAVE_SIGNING_CO_PROCESSOR=HSM"
      );
    }
    
    // Verify HSM is FIPS-certified
    const hsmCertified = ["AWS_CLOUDHSM", "GEMALTO", "THALES", "YUBIHSM_FIPS"]
      .includes(HSM_PROVIDER);
    
    if (!hsmCertified) {
      throw new Error(
        `HSM Provider '${HSM_PROVIDER}' is not FIPS-140-2 certified. ` +
        `Use: AWS_CLOUDHSM, GEMALTO, THALES, or YUBIHSM_FIPS`
      );
    }
  }
}

// Call in App.tsx on mount:
useEffect(() => {
  try {
    validateFIPSCompliance();
  } catch (error) {
    setAuthErrorModal({
      isOpen: true,
      type: "other",
      message: `Crypto validation failed: ${error.message}`
    });
  }
}, []);
```

---

### Issue #4: Gateway Key Exposed in `.env.example`
**Severity:** CRITICAL  
**Location:** `.env.example` line 34  
**Current:**
```dotenv
GATEWAY_AUTHENTICATION_KEY="gpay_secure_live_key_99348"
```
**Risk:** Real production gateway key might be committed

**Recommendation:**
```bash
# .env.example
VITE_GATEWAY_AUTHENTICATION_KEY="<INJECT_VIA_CI_SECRETS>"

# Create .env.production.example (for ops team)
VITE_GATEWAY_AUTHENTICATION_KEY="<ask_security_team>"
VITE_HSM_PROVIDER_ENDPOINT="<ask_platform_team>"
VITE_HSM_PIN="<ask_vault>"

# Add to .gitignore:
.env.local
.env.production.local
.env.*.local
```

---

## High-Priority Issues (🟡 Fix Before Production Use)

### Issue #5: No HSM Health Check
**Location:** `App.tsx`, `src/lib/firebase.ts`  
**Current:** App doesn't verify HSM is available before allowing transactions

**Fix:**
```typescript
// src/lib/hsmValidator.ts (new file)
import { HSM_PROVIDER, ENCLAVE_SIGNING_CO_PROCESSOR } from '../utils/crypto';

export interface HSMHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  provider: string;
  keyLabel: string;
  lastChecked: string;
  latency: number;
  error?: string;
}

export async function checkHSMHealth(): Promise<HSMHealthStatus> {
  const start = performance.now();
  
  if (ENCLAVE_SIGNING_CO_PROCESSOR !== "HSM") {
    return {
      status: 'healthy',
      provider: ENCLAVE_SIGNING_CO_PROCESSOR,
      keyLabel: 'N/A (software mode)',
      lastChecked: new Date().toISOString(),
      latency: 0
    };
  }
  
  try {
    // Attempt to connect to HSM and verify key exists
    const hsmStatus = await verifyHSMConnection();
    
    return {
      status: hsmStatus ? 'healthy' : 'degraded',
      provider: HSM_PROVIDER,
      keyLabel: hsmStatus?.keyLabel || 'UNKNOWN',
      lastChecked: new Date().toISOString(),
      latency: performance.now() - start
    };
  } catch (error) {
    return {
      status: 'unavailable',
      provider: HSM_PROVIDER,
      keyLabel: 'ERROR',
      lastChecked: new Date().toISOString(),
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function verifyHSMConnection(): Promise<{ keyLabel: string } | null> {
  // TODO: Implement actual HSM connection test
  // Example for AWS CloudHSM:
  // const client = new AWS.CloudHSM.Client({...});
  // return await client.DescribeKey({ KeyLabel: HSM_KEY_LABEL });
  
  throw new Error("HSM connection test not yet implemented");
}

// In App.tsx:
useEffect(() => {
  const validateHSM = async () => {
    const status = await checkHSMHealth();
    
    if (status.status === 'unavailable') {
      setAuthErrorModal({
        isOpen: true,
        type: "other",
        message: `HSM health check failed: ${status.error}. Transactions disabled.`
      });
      // Block transactions
      setPaymentMethods([]);
    } else if (status.status === 'degraded') {
      triggerToast(`⚠️ HSM degraded. Latency: ${status.latency}ms`, 'warning');
    }
  };
  
  validateHSM();
}, []);
```

---

### Issue #6: No Key Rotation Implementation
**Location:** `src/utils/crypto.ts` lines 24-25  
**Current:** Configuration exists (`PAYG_SIGNATURE_ROTATION_DAYS=90`) but no logic

**Fix:**
```typescript
// src/lib/keyRotation.ts (new file)
import { PAYG_SIGNATURE_ROTATION_DAYS, HSM_KEY_LABEL } from '../utils/crypto';
import { db, auth } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface KeyRotationLog {
  id: string;
  rotatedAt: string;
  keyLabel: string;
  previousKeyLabel?: string;
  rotationIntervalDays: number;
  nextRotationScheduledFor: string;
  initiatedBy: string;
  status: 'success' | 'failed';
  error?: string;
}

export async function checkKeyRotationRequired(): Promise<boolean> {
  const lastRotation = await getLastKeyRotation();
  if (!lastRotation) return false;
  
  const daysSinceRotation = 
    (Date.now() - new Date(lastRotation.rotatedAt).getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSinceRotation > PAYG_SIGNATURE_ROTATION_DAYS;
}

export async function getLastKeyRotation(): Promise<KeyRotationLog | null> {
  try {
    const rotationLog = localStorage.getItem('payg_last_key_rotation');
    return rotationLog ? JSON.parse(rotationLog) : null;
  } catch {
    return null;
  }
}

export async function rotateSigningKey(): Promise<KeyRotationLog> {
  const rotationLog: KeyRotationLog = {
    id: `rotation_${Date.now()}`,
    rotatedAt: new Date().toISOString(),
    keyLabel: HSM_KEY_LABEL,
    rotationIntervalDays: PAYG_SIGNATURE_ROTATION_DAYS,
    nextRotationScheduledFor: new Date(
      Date.now() + PAYG_SIGNATURE_ROTATION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
    initiatedBy: auth.currentUser?.uid || 'system',
    status: 'success'
  };
  
  try {
    // TODO: Call HSM key rotation endpoint
    console.log(`🔄 Rotating signing key: ${HSM_KEY_LABEL}`);
    // const response = await hsmClient.rotateKey({ 
    //   keyLabel: HSM_KEY_LABEL 
    // });
    
    // Save rotation record
    localStorage.setItem('payg_last_key_rotation', JSON.stringify(rotationLog));
    
    // Log to Firestore
    if (auth.currentUser) {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid, 'keyRotationLogs', rotationLog.id),
        rotationLog
      );
    }
    
    return rotationLog;
  } catch (error) {
    rotationLog.status = 'failed';
    rotationLog.error = error instanceof Error ? error.message : String(error);
    
    localStorage.setItem('payg_last_key_rotation', JSON.stringify(rotationLog));
    throw error;
  }
}

// In App.tsx - check on app load:
useEffect(() => {
  const checkRotation = async () => {
    if (await checkKeyRotationRequired()) {
      console.warn("⚠️ Key rotation required");
      try {
        await rotateSigningKey();
        triggerToast("🔄 Signing keys rotated successfully", "success");
      } catch (error) {
        triggerToast(`Key rotation failed: ${error}`, "warning");
      }
    }
  };
  
  checkRotation();
}, []);
```

---

### Issue #7: No Transaction Signature Audit Trail
**Location:** Entire codebase  
**Current:** Crypto operations logged to console, not persisted

**Fix:**
```typescript
// src/types.ts - add new interface
export interface CryptoAuditLog {
  id: string;
  timestamp: string;
  operation: 'sign' | 'verify' | 'key_rotation' | 'handshake';
  transactionId?: string;
  success: boolean;
  algorithm: string;
  provider: string;
  latency?: number;
  errorMessage?: string;
  userId?: string;
}

// src/lib/cryptoAudit.ts (new file)
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { doc, collection, addDoc } from 'firebase/firestore';
import { CryptoAuditLog } from '../types';

export async function logCryptoOperation(audit: Omit<CryptoAuditLog, 'id'>): Promise<void> {
  try {
    const auditLog: CryptoAuditLog = {
      ...audit,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId: auth.currentUser?.uid
    };
    
    if (auth.currentUser) {
      await addDoc(
        collection(db, 'users', auth.currentUser.uid, 'cryptoAuditLogs'),
        auditLog
      );
    }
    
    console.log('[CRYPTO AUDIT]', auditLog);
  } catch (error) {
    console.error('Failed to log crypto audit:', error);
  }
}

// Usage in crypto.ts:
export async function simulateOnline101Handshake(
  amount: number,
  senderName: string,
  receiverName: string,
  paymentMethod: string,
  onLog: (step: string, payload: string, type: 'info' | 'success' | 'warning' | 'crypto') => void
): Promise<{ signature: string; latency: number; seed: string; fingerprint: string }> {
  const t0 = performance.now();
  
  try {
    // ... existing handshake code ...
    
    const t1 = performance.now();
    const latency = Math.round(t1 - t0);
    
    await logCryptoOperation({
      timestamp: new Date().toISOString(),
      operation: 'handshake',
      success: true,
      algorithm: PAYG_SIGNATURE_ALGORITHM,
      provider: ENCLAVE_SIGNING_CO_PROCESSOR,
      latency
    });
    
    return { signature, latency, seed, fingerprint };
  } catch (error) {
    await logCryptoOperation({
      timestamp: new Date().toISOString(),
      operation: 'handshake',
      success: false,
      algorithm: PAYG_SIGNATURE_ALGORITHM,
      provider: ENCLAVE_SIGNING_CO_PROCESSOR,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
```

---

## Medium-Priority Issues (🟡 Fix Within 1-2 Weeks)

### Issue #8: Replace Simulated Hashing with Real Cryptography

**Recommendation:** Install `@noble/hashes` and `tweetnacl-js`

```bash
npm install @noble/hashes tweetnacl-js @types/tweetnacl-js
```

Replace `calculateSimulatedHash()`:

```typescript
// src/utils/crypto.ts
import { sha512 } from '@noble/hashes/sha512';
import { ed25519 } from '@noble/curves/ed25519';

// Generate real Ed25519 signatures
export function generateEd25519Signature(payload: string, privateKeyHex: string): string {
  try {
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    const signature = ed25519.sign(Buffer.from(payload), privateKey);
    return Buffer.from(signature).toString('hex');
  } catch (error) {
    throw new Error(`Ed25519 signing failed: ${error}`);
  }
}

// Verify Ed25519 signatures
export function verifyEd25519Signature(
  payload: string,
  signature: string,
  publicKeyHex: string
): boolean {
  try {
    const sig = Buffer.from(signature, 'hex');
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    return ed25519.verify(sig, Buffer.from(payload), publicKey);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// HMAC-SHA512 for payload integrity
export function calculateHMACSHA512(payload: string, key: string): string {
  const keyBytes = Buffer.from(key, 'utf8');
  const payloadBytes = Buffer.from(payload, 'utf8');
  
  // For production, use crypto.subtle or libsodium
  // This is simplified example:
  const hash = sha512.create();
  hash.update(keyBytes);
  hash.update(payloadBytes);
  return hash.hex();
}

// Replace OLD calculateSimulatedHash calls with:
// const signature = generateEd25519Signature(payload, HSM_PRIVATE_KEY);
```

---

### Issue #9: Inconsistent Environment Variable Naming

**Current:**
```dotenv
PAYG_PRIMARY_ALGORITHM
PAYG_SIGNATURE_ALGORITHM
HANDSHAKE_LATENCY_DELAY_MS (no prefix)
ENCLAVE_SIGNING_CO_PROCESSOR (no PAYG_ prefix)
HSM_PROVIDER (no PAYG_ prefix)
```

**Standardize to:**
```dotenv
VITE_PAYG_PRIMARY_ALGORITHM
VITE_PAYG_SIGNATURE_ALGORITHM
VITE_PAYG_HANDSHAKE_LATENCY_DELAY_MS
VITE_PAYG_ENCLAVE_SIGNING_CO_PROCESSOR
VITE_PAYG_HSM_PROVIDER
VITE_PAYG_HSM_KEY_LABEL
VITE_PAYG_HSM_PROVIDER_ENDPOINT
```

---

### Issue #10: Missing TypeScript Interfaces

Add to `src/types.ts`:

```typescript
// Cryptographic Configuration
export interface HSMConfig {
  provider: 'AWS_CLOUDHSM' | 'GEMALTO' | 'THALES' | 'YUBIHSM' | 'YUBIHSM_FIPS';
  keyLabel: string;
  endpoint?: string;
  pin?: string;
  isRequired: boolean;
  fipsMode: 'REQUIRED' | 'OPTIONAL';
}

export interface SignatureSpec {
  algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-PSS-3072';
  hash: 'SHA-256' | 'SHA-512';
  keySize: number;
  encoding: 'Base64URL' | 'Hex' | 'DER' | 'PEM';
  verification: 'STRICT' | 'WARN' | 'PERMISSIVE';
  failPolicy: 'DENY' | 'WARN' | 'IGNORE';
}

export interface CryptoConfig {
  primaryAlgorithm: string;
  signatureSpec: SignatureSpec;
  hsmConfig: HSMConfig;
  rotationDays: number;
  enableLogging: boolean;
}

export interface SignatureResult {
  signature: string;
  timestamp: string;
  algorithm: string;
  verified: boolean;
  latency: number;
}

export interface HSMHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  provider: string;
  keyLabel: string;
  lastChecked: string;
  latency: number;
  error?: string;
}
```

---

## Updated `.env.example` (Comprehensive)

See comprehensive environment documentation in next file.

---

## Implementation Roadmap

### Week 1 (Immediate)
- [ ] Create `CRYPTO_HSM_AUDIT.md` (this document) ✅
- [ ] Update `.env.example` with full documentation
- [ ] Redact sensitive keys from repository
- [ ] Create HSM configuration validator (`src/lib/hsmValidator.ts`)
- [ ] Add FIPS-140-2 validation to app initialization

### Week 2
- [ ] Create `src/lib/keyRotation.ts` for key rotation logic
- [ ] Create `src/lib/cryptoAudit.ts` for audit logging
- [ ] Create `src/components/HSMStatusPanel.tsx` for HSM monitoring
- [ ] Add TypeScript interfaces to `src/types.ts`
- [ ] Replace simulated hashing with real cryptography

### Week 3
- [ ] Implement HSM integration with AWS CloudHSM SDK
- [ ] Add signature verification in transaction flow
- [ ] Create comprehensive `CRYPTO_CONFIG.md` guide
- [ ] Add environment validation scripts

### Week 4+
- [ ] Penetration testing of crypto implementation
- [ ] FIPS-140-2 compliance certification
- [ ] Security audit by third party
- [ ] Production deployment checklist

---

## Testing Checklist

- [ ] HSM health check passes on app start
- [ ] Real signatures generated for all transactions
- [ ] Fake signatures are rejected in STRICT mode
- [ ] Key rotation logic triggers after N days
- [ ] FIPS-140-2 enforcement prevents non-FIPS signings
- [ ] Gateway key cannot be extracted from config
- [ ] Audit trails logged for all crypto operations
- [ ] Signature verification never silently fails
- [ ] Fallback signing works when HSM unavailable (if configured)
- [ ] All environment variables properly injected in CI/CD

---

## Conclusion

The PayG Protocol has **excellent cryptographic scaffolding and configuration structure**, but **critical gaps** in implementation prevent it from being production-ready.

**Risk Level: CRITICAL — Do not deploy to production in current state.**

Following this audit will transform PayG Protocol into a **production-grade, HSM-backed, FIPS-140-2-compliant payment system**.

---

## References

- **AWS CloudHSM:** https://docs.aws.amazon.com/cloudhsm/
- **FIPS-140-2:** https://csrc.nist.gov/publications/detail/fips/140/2/final
- **Ed25519 Standard:** https://ed25519.cr.yp.to/
- **libsodium:** https://doc.libsodium.org/
- **@noble/hashes:** https://github.com/paulmillr/noble-hashes
- **tweetnacl.js:** https://github.com/dchest/tweetnacl-js
