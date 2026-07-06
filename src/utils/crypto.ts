import { ProtocolLog } from '../types';

// Environment Variable Configurations with Fallbacks
const metaEnv = (import.meta as any).env || {};
export const PAYG_PRIMARY_ALGORITHM = metaEnv.VITE_PAYG_PRIMARY_ALGORITHM || metaEnv.PAYG_PRIMARY_ALGORITHM || "AES-256-GCM";
export const PAYG_SIGNATURE_ALGORITHM = metaEnv.VITE_PAYG_SIGNATURE_ALGORITHM || metaEnv.PAYG_SIGNATURE_ALGORITHM || "Ed25519";
export const HANDSHAKE_LATENCY_DELAY_MS = parseInt(metaEnv.VITE_HANDSHAKE_LATENCY_DELAY_MS || metaEnv.HANDSHAKE_LATENCY_DELAY_MS || "100", 10) || 100;
export const ONLINE_HANDSHAKE_TIMEOUT_MS = parseInt(metaEnv.VITE_ONLINE_HANDSHAKE_TIMEOUT_MS || metaEnv.ONLINE_HANDSHAKE_TIMEOUT_MS || "10000", 10) || 10000;
export const ENCLAVE_SIGNING_CO_PROCESSOR = metaEnv.VITE_ENCLAVE_SIGNING_CO_PROCESSOR || metaEnv.ENCLAVE_SIGNING_CO_PROCESSOR || "AWS_NITRO";
export const HSM_PROVIDER = metaEnv.VITE_HSM_PROVIDER || metaEnv.HSM_PROVIDER || "AWS_CLOUDHSM";
export const HSM_KEY_LABEL = metaEnv.VITE_HSM_KEY_LABEL || metaEnv.HSM_KEY_LABEL || "PAYG_SIGNING_KEY";
export const GATEWAY_AUTHENTICATION_KEY = metaEnv.VITE_GATEWAY_AUTHENTICATION_KEY || metaEnv.GATEWAY_AUTHENTICATION_KEY || "";

// New Digital Signature Specifications
export const PRIMARY_SIGNATURE_ALGORITHM = metaEnv.VITE_PRIMARY_SIGNATURE_ALGORITHM || metaEnv.PRIMARY_SIGNATURE_ALGORITHM || "Ed25519";
export const SECONDARY_SIGNATURE_ALGORITHM = metaEnv.VITE_SECONDARY_SIGNATURE_ALGORITHM || metaEnv.SECONDARY_SIGNATURE_ALGORITHM || "ECDSA-P256";
export const LEGACY_SIGNATURE_ALGORITHM = metaEnv.VITE_LEGACY_SIGNATURE_ALGORITHM || metaEnv.LEGACY_SIGNATURE_ALGORITHM || "RSA-PSS-3072";

export const PAYG_SIGNATURE_VERSION = metaEnv.VITE_PAYG_SIGNATURE_VERSION || metaEnv.PAYG_SIGNATURE_VERSION || "1.0";
export const PAYG_SIGNATURE_HASH = metaEnv.VITE_PAYG_SIGNATURE_HASH || metaEnv.PAYG_SIGNATURE_HASH || "SHA-512";
export const PAYG_SIGNATURE_KEY_SIZE = parseInt(metaEnv.VITE_PAYG_SIGNATURE_KEY_SIZE || metaEnv.PAYG_SIGNATURE_KEY_SIZE || "256", 10) || 256;
export const PAYG_SIGNATURE_ENCODING = metaEnv.VITE_PAYG_SIGNATURE_ENCODING || metaEnv.PAYG_SIGNATURE_ENCODING || "Base64URL";
export const PAYG_SIGNATURE_VERIFICATION = metaEnv.VITE_PAYG_SIGNATURE_VERIFICATION || metaEnv.PAYG_SIGNATURE_VERIFICATION || "STRICT";
export const PAYG_SIGNATURE_ROTATION_DAYS = parseInt(metaEnv.VITE_PAYG_SIGNATURE_ROTATION_DAYS || metaEnv.PAYG_SIGNATURE_ROTATION_DAYS || "90", 10) || 90;
export const PAYG_SIGNATURE_HSM_REQUIRED = (metaEnv.VITE_PAYG_SIGNATURE_HSM_REQUIRED || metaEnv.PAYG_SIGNATURE_HSM_REQUIRED || "true") === "true" || metaEnv.PAYG_SIGNATURE_HSM_REQUIRED === true;
export const PAYG_SIGNATURE_FIPS_MODE = metaEnv.VITE_PAYG_SIGNATURE_FIPS_MODE || metaEnv.PAYG_SIGNATURE_FIPS_MODE || "Optional";
export const PAYG_SIGNATURE_PROVIDER = metaEnv.VITE_PAYG_SIGNATURE_PROVIDER || metaEnv.PAYG_SIGNATURE_PROVIDER || "libsodium";
export const PAYG_SIGNATURE_FAIL_POLICY = metaEnv.VITE_PAYG_SIGNATURE_FAIL_POLICY || metaEnv.PAYG_SIGNATURE_FAIL_POLICY || "DENY";
export const PAYG_SIGNATURE_LOGGING = metaEnv.VITE_PAYG_SIGNATURE_LOGGING || metaEnv.PAYG_SIGNATURE_LOGGING || "ENABLED";

// Simple but authentic-looking hashing utility for simulation (mimicking HMAC-SHA256)
export function calculateSimulatedHash(input: string, key: string = "gpay_secret_key"): string {
  let hash1 = 0;
  let hash2 = 0;
  const combined = input + key;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash1 = (hash1 << 5) - hash1 + char;
    hash1 |= 0; // Convert to 32bit integer
    hash2 = (hash2 << 7) - hash2 + char * 1.5;
    hash2 |= 0;
  }
  
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const part2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return `SIG_${part1}${part2}`.toUpperCase();
}

export function generateUUID(): string {
  return 'tx_xxxx_4xxx_yxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 101.1 Online Protocol Handshake Simulator
export async function simulateOnline101Handshake(
  amount: number,
  senderName: string,
  receiverName: string,
  paymentMethod: string,
  onLog: (step: string, payload: string, type: 'info' | 'success' | 'warning' | 'crypto') => void
): Promise<{ signature: string; latency: number; seed: string; fingerprint: string }> {
  const t0 = performance.now();
  const fingerprint = `DEV_FPR_${calculateSimulatedHash(senderName + navigator.userAgent).slice(4, 16)}`;
  
  // Step 1: Handshake Init
  onLog(
    "101.1 [Handshake Phase 1/4] - Init",
    JSON.stringify({
      protocol: "101.1-ONLINE",
      action: "INITIATE_HANDSHAKE",
      timestamp: new Date().toISOString(),
      client_fingerprint: fingerprint,
      channel: "SSL/TLS_V1.3_SECURE",
      handshake_timeout_limit_ms: ONLINE_HANDSHAKE_TIMEOUT_MS
    }, null, 2),
    "info"
  );
  
  // Distribute the dynamic latency across the handshake phases
  const delay1 = Math.max(10, Math.round(HANDSHAKE_LATENCY_DELAY_MS * 0.35));
  const delay2 = Math.max(10, Math.round(HANDSHAKE_LATENCY_DELAY_MS * 0.40));
  const delay3 = Math.max(10, Math.round(HANDSHAKE_LATENCY_DELAY_MS * 0.25));

  await new Promise(r => setTimeout(r, delay1)); // Dynamic Phase 1 delay

  // Step 2: Challenge Seed
  const challengeSeed = `SEED_${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
  onLog(
    "101.1 [Handshake Phase 2/4] - Challenge Received",
    JSON.stringify({
      status: "CHALLENGE_ISSUED",
      received_from: "PAYMENT_GATEWAY_PRIMARY",
      server_seed: challengeSeed,
      challenge_token: `CHALLENGE_${generateUUID().slice(5, 13).toUpperCase()}`,
      supported_algorithms: [PAYG_PRIMARY_ALGORITHM, PAYG_SIGNATURE_ALGORITHM]
    }, null, 2),
    "crypto"
  );
  
  await new Promise(r => setTimeout(r, delay2)); // Dynamic Phase 2 delay

  // Step 3: Solve Challenge & Sign Transaction
  const payloadToSign = `${amount}:${senderName}:${receiverName}:${paymentMethod}:${challengeSeed}`;
  const clientSignature = calculateSimulatedHash(payloadToSign, "CLIENT_PRIVATE_KEY");
  
  onLog(
    "101.1 [Handshake Phase 3/4] - Challenge Solved & Signed",
    JSON.stringify({
      action: "SOLVE_CHALLENGE",
      signed_payload: payloadToSign,
      crypto_signature: clientSignature,
      sign_method: `${PAYG_PRIMARY_ALGORITHM}_WITH_${PAYG_SIGNATURE_ALGORITHM}`,
      secure_enclave: ENCLAVE_SIGNING_CO_PROCESSOR,
      ...(ENCLAVE_SIGNING_CO_PROCESSOR === "HSM" ? {
        hsm_provider: HSM_PROVIDER,
        hsm_key_label: HSM_KEY_LABEL
      } : {}),
      signature_spec: {
        version: PAYG_SIGNATURE_VERSION,
        hash_algorithm: PAYG_SIGNATURE_HASH,
        key_size_bits: PAYG_SIGNATURE_KEY_SIZE,
        encoding: PAYG_SIGNATURE_ENCODING,
        verification_level: PAYG_SIGNATURE_VERIFICATION,
        rotation_cycle_days: PAYG_SIGNATURE_ROTATION_DAYS,
        hsm_enforced: PAYG_SIGNATURE_HSM_REQUIRED,
        fips_compliant: PAYG_SIGNATURE_FIPS_MODE,
        provider: PAYG_SIGNATURE_PROVIDER,
        fail_policy: PAYG_SIGNATURE_FAIL_POLICY,
        system_logging: PAYG_SIGNATURE_LOGGING
      }
    }, null, 2),
    "crypto"
  );

  await new Promise(r => setTimeout(r, delay3)); // Dynamic Phase 3 delay

  // Step 4: Verify & Authorize
  const txRefId = `AUTH_${Math.floor(Math.random() * 900000 + 100000)}`;
  onLog(
    "101.1 [Handshake Phase 4/4] - Gateway Verification Success",
    JSON.stringify({
      status: "AUTHORIZED",
      authorization_code: txRefId,
      settlement_status: "CLEARED",
      ledger_update: "SUCCESS",
      gateway_key_configured: !!GATEWAY_AUTHENTICATION_KEY,
      gateway_key_masked: GATEWAY_AUTHENTICATION_KEY ? `${GATEWAY_AUTHENTICATION_KEY.slice(0, 5)}...` : "INJECTED_DEFAULT"
    }, null, 2),
    "success"
  );

  const t1 = performance.now();
  const latency = Math.round(t1 - t0);

  return {
    signature: clientSignature,
    latency,
    seed: challengeSeed,
    fingerprint
  };
}

// 201.3 Offline Protocol Generator
// Encodes details using a secure off-grid token sequence
export function generateOffline201Token(
  amount: number,
  senderName: string,
  receiverName: string,
  paymentMethod: string,
  sequence: number,
  onLog: (step: string, payload: string, type: 'info' | 'success' | 'warning' | 'crypto') => void
): { token: string; authCode: string; signature: string; payloadSize: number } {
  
  onLog(
    "201.3 [Offline Phase 1/3] - Check Connectivity & Offline Engine Active",
    JSON.stringify({
      protocol: "201.3-OFFLINE",
      internet_connection: "DISCONNECTED",
      offline_engine: "ACTIVE",
      cached_token_sequence: sequence,
      device_battery_status: "SECURE",
      hardware_enclave: ENCLAVE_SIGNING_CO_PROCESSOR
    }, null, 2),
    "info"
  );

  // Generate a dynamic offline authorization code valid for local ledger
  const offlineAuthCode = `OFF_AUTH_${sequence}_${Math.floor(Math.random() * 8999 + 1000)}`;
  
  // Create offline package
  const offlinePackage = {
    amount,
    sender: senderName,
    receiver: receiverName,
    method: paymentMethod,
    seq: sequence,
    authCode: offlineAuthCode,
    timestamp: new Date().toISOString(),
    protocol: "201.3_STORE_AND_FORWARD"
  };

  const offlineString = JSON.stringify(offlinePackage);
  const signature = calculateSimulatedHash(offlineString, "LOCAL_DEVICE_SECURE_ENCLAVE_KEY");

  // Generate dynamic transmission token
  const tokenPayload = btoa(JSON.stringify({
    p: offlineString,
    s: signature
  })).slice(0, 180); // Mimics compressed format for soundwave/high-density QR

  onLog(
    "201.3 [Offline Phase 2/3] - Local Cryptographic Token Assembled",
    JSON.stringify({
      status: "TOKEN_SIGNED_LOCAL_ENCLAVE",
      raw_payload_length_bytes: offlineString.length,
      compressed_token: tokenPayload,
      local_signature: signature,
      verification_protocol: PAYG_SIGNATURE_ALGORITHM
    }, null, 2),
    "crypto"
  );

  onLog(
    "201.3 [Offline Phase 3/3] - Ready for Acoustic Sound/QR Broadcast",
    JSON.stringify({
      transmission_methods: ["ACOUSTIC_SOUNDWAVE_PULSE_201.3", "HIGH_DENSITY_QR_PAYLOAD"],
      frequency_range: "18.5kHz - 19.5kHz (Near-Ultrasonic)",
      broadcast_token: tokenPayload.slice(0, 40) + "..."
    }, null, 2),
    "success"
  );

  return {
    token: tokenPayload,
    authCode: offlineAuthCode,
    signature,
    payloadSize: offlineString.length
  };
}
