import { ProtocolLog } from '../types';

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
      channel: "SSL/TLS_V1.3_SECURE"
    }, null, 2),
    "info"
  );
  
  await new Promise(r => setTimeout(r, 150)); // Network delay

  // Step 2: Challenge Seed
  const challengeSeed = `SEED_${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
  onLog(
    "101.1 [Handshake Phase 2/4] - Challenge Received",
    JSON.stringify({
      status: "CHALLENGE_ISSUED",
      received_from: "PAYMENT_GATEWAY_PRIMARY",
      server_seed: challengeSeed,
      challenge_token: `CHALLENGE_${generateUUID().slice(5, 13).toUpperCase()}`,
      supported_algorithms: ["ECDSA_P256", "HMAC_SHA256"]
    }, null, 2),
    "crypto"
  );
  
  await new Promise(r => setTimeout(r, 180)); // Verification and solve

  // Step 3: Solve Challenge & Sign Transaction
  const payloadToSign = `${amount}:${senderName}:${receiverName}:${paymentMethod}:${challengeSeed}`;
  const clientSignature = calculateSimulatedHash(payloadToSign, "CLIENT_PRIVATE_KEY");
  
  onLog(
    "101.1 [Handshake Phase 3/4] - Challenge Solved & Signed",
    JSON.stringify({
      action: "SOLVE_CHALLENGE",
      signed_payload: payloadToSign,
      crypto_signature: clientSignature,
      sign_method: "ECDSA_P256_WITH_SHA256"
    }, null, 2),
    "crypto"
  );

  await new Promise(r => setTimeout(r, 120));

  // Step 4: Verify & Authorize
  const txRefId = `AUTH_${Math.floor(Math.random() * 900000 + 100000)}`;
  onLog(
    "101.1 [Handshake Phase 4/4] - Gateway Verification Success",
    JSON.stringify({
      status: "AUTHORIZED",
      authorization_code: txRefId,
      settlement_status: "CLEARED",
      ledger_update: "SUCCESS"
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
      device_battery_status: "SECURE"
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
      verification_protocol: "ECC_CURVE_25519"
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
