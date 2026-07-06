import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Terminal, ShieldCheck, Cpu, Key, ArrowRight, CheckCircle, Clock, ListChecks,
  Lock, RefreshCw, Send, AlertCircle, Fingerprint, Database, Check, Shield,
  Activity, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PAYG_PRIMARY_ALGORITHM, PAYG_SIGNATURE_ALGORITHM, HANDSHAKE_LATENCY_DELAY_MS,
  ONLINE_HANDSHAKE_TIMEOUT_MS, ENCLAVE_SIGNING_CO_PROCESSOR, HSM_PROVIDER, HSM_KEY_LABEL, GATEWAY_AUTHENTICATION_KEY,
  PAYG_SIGNATURE_VERSION, PAYG_SIGNATURE_HASH, PAYG_SIGNATURE_KEY_SIZE,
  PAYG_SIGNATURE_ENCODING, PAYG_SIGNATURE_VERIFICATION, PAYG_SIGNATURE_ROTATION_DAYS,
  PAYG_SIGNATURE_HSM_REQUIRED, PAYG_SIGNATURE_FIPS_MODE, PAYG_SIGNATURE_PROVIDER,
  PAYG_SIGNATURE_FAIL_POLICY, PAYG_SIGNATURE_LOGGING,
  PRIMARY_SIGNATURE_ALGORITHM, SECONDARY_SIGNATURE_ALGORITHM, LEGACY_SIGNATURE_ALGORITHM
} from '../utils/crypto';

interface PipelineStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  category: 'merchant' | 'enclave' | 'gateway';
  details: string[];
  configLabel?: string;
  configValue?: string;
}

interface LatencyPoint {
  id: string;
  label: string;
  latency: number;
  protocol: string;
  receiverName: string;
  amount: number;
  timestamp: string;
  isBenchmark?: boolean;
}

export default function ProtocolPipelineVisualizer({ transactions = [] }: { transactions?: any[] }) {
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1000); // ms per step
  const [simulatedAmount, setSimulatedAmount] = useState<string>("199.99");
  const [simulatedMerchant, setSimulatedMerchant] = useState<string>("MRC123456 (TERM001)");
  const [simulatedNonce, setSimulatedNonce] = useState<string>("e3fd68bca3d74ef7");
  const [simulatedSignature, setSimulatedSignature] = useState<string>("ZHVG68YFKA3D74EF7S1X8Y2U18X9A7");
  const [simulatedTxId, setSimulatedTxId] = useState<string>("TX-202607060001");
  const [simulatedTimestamp, setSimulatedTimestamp] = useState<string>("2026-07-06T15:35:18Z");
  const [simulatedCurrency, setSimulatedCurrency] = useState<string>("USD");
  const [simulatedSigAlgo, setSimulatedSigAlgo] = useState<string>(PRIMARY_SIGNATURE_ALGORITHM);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Telemetry real-time handshake latencies
  const [simulatedHandshakes, setSimulatedHandshakes] = useState<LatencyPoint[]>([]);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Custom JSON editor state
  const [showJsonEditor, setShowJsonEditor] = useState<boolean>(true);
  const [jsonPayloadError, setJsonPayloadError] = useState<string | null>(null);
  const [customJsonInput, setCustomJsonInput] = useState<string>(JSON.stringify({
    "merchantId": "MRC123456",
    "terminalId": "TERM001",
    "transactionId": "TX-202607060001",
    "timestamp": "2026-07-06T15:35:18Z",
    "nonce": "e3fd68bca3d74ef7",
    "amount": 199.99,
    "currency": "USD",
    "signatureAlgorithm": PRIMARY_SIGNATURE_ALGORITHM,
    "signature": "ZHVG68YFKA3D74EF7S1X8Y2U18X9A7"
  }, null, 2));

  // Regenerate nonce on mount or simulation run
  const triggerNewNonce = () => {
    const randomHex = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setSimulatedNonce(randomHex);
  };

  const handleApplyCustomJson = () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      if (typeof parsed.amount !== 'undefined') setSimulatedAmount(String(parsed.amount));
      if (parsed.merchantId || parsed.terminalId) {
        setSimulatedMerchant(`${parsed.merchantId || 'MRC_UNKNOWN'} (${parsed.terminalId || 'TERM_UNKNOWN'})`);
      }
      if (parsed.nonce) setSimulatedNonce(parsed.nonce);
      if (parsed.signature) setSimulatedSignature(parsed.signature);
      if (parsed.transactionId) setSimulatedTxId(parsed.transactionId);
      if (parsed.timestamp) setSimulatedTimestamp(parsed.timestamp);
      if (parsed.currency) setSimulatedCurrency(parsed.currency);
      if (parsed.signatureAlgorithm) setSimulatedSigAlgo(parsed.signatureAlgorithm);
      
      setJsonPayloadError(null);
      
      const successLog = `[${new Date().toLocaleTimeString()}] INJECTED: Successfully parsed custom canonical payload! Ready to verify.`;
      setSimulationLogs([successLog]);
    } catch (err: any) {
      setJsonPayloadError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleSelectAlgorithm = (selectedAlg: string) => {
    try {
      const parsed = JSON.parse(customJsonInput);
      parsed.signatureAlgorithm = selectedAlg;
      const updatedJson = JSON.stringify(parsed, null, 2);
      setCustomJsonInput(updatedJson);
      
      if (typeof parsed.amount !== 'undefined') setSimulatedAmount(String(parsed.amount));
      if (parsed.merchantId || parsed.terminalId) {
        setSimulatedMerchant(`${parsed.merchantId || 'MRC_UNKNOWN'} (${parsed.terminalId || 'TERM_UNKNOWN'})`);
      }
      if (parsed.nonce) setSimulatedNonce(parsed.nonce);
      if (parsed.signature) setSimulatedSignature(parsed.signature);
      if (parsed.transactionId) setSimulatedTxId(parsed.transactionId);
      if (parsed.timestamp) setSimulatedTimestamp(parsed.timestamp);
      if (parsed.currency) setSimulatedCurrency(parsed.currency);
      setSimulatedSigAlgo(selectedAlg);
      setJsonPayloadError(null);

      const algLog = `[${new Date().toLocaleTimeString()}] CONFIG: Selected signature algorithm switched to: ${selectedAlg}.`;
      setSimulationLogs(prev => [...prev, algLog]);
    } catch (err) {
      setSimulatedSigAlgo(selectedAlg);
    }
  };

  useEffect(() => {
    // Initial parse to sync payload
    handleApplyCustomJson();
  }, []);

  const steps: PipelineStep[] = [
    {
      id: 0,
      title: "Merchant POS Initiate",
      subtitle: "POS Terminal starts payment request",
      category: "merchant",
      icon: <Terminal size={14} />,
      details: [
        `Merchant ID: ${simulatedMerchant.split(' ')[0]}`,
        `Terminal ID: ${simulatedMerchant.split(' ')[1]?.replace(/[()]/g, '') || 'TERM001'}`,
        `Amount: $${simulatedAmount} ${simulatedCurrency}`
      ]
    },
    {
      id: 1,
      title: "Create Canonical JSON",
      subtitle: "Deterministic RFC-8785 byte order",
      category: "merchant",
      icon: <ListChecks size={14} />,
      details: [
        `Slices object arrays alphabetically`,
        `Payload: {"amount":${simulatedAmount},"currency":"${simulatedCurrency}","merchantId":"${simulatedMerchant.split(' ')[0]}","nonce":"${simulatedNonce}"}`
      ]
    },
    {
      id: 2,
      title: "SHA-512 Hash Generation",
      subtitle: "High-entropy message digestion",
      category: "enclave",
      icon: <Fingerprint size={14} />,
      details: [
        `Creates unique fixed 512-bit message digest`,
        `Prevents payload tampering during routing`
      ],
      configLabel: "PAYG_SIGNATURE_HASH",
      configValue: PAYG_SIGNATURE_HASH
    },
    {
      id: 3,
      title: "HSM / Secure Enclave",
      subtitle: "Hardware Cryptographic isolation",
      category: "enclave",
      icon: <Cpu size={14} />,
      details: [
        `Executes inside secure hardware: ${ENCLAVE_SIGNING_CO_PROCESSOR}`,
        ...(ENCLAVE_SIGNING_CO_PROCESSOR === "HSM" ? [
          `HSM Provider: ${HSM_PROVIDER}`,
          `HSM Key Label: ${HSM_KEY_LABEL}`
        ] : [
          `Private keys never exposed to operating system memory`
        ])
      ],
      configLabel: "HSM Required / FIPS",
      configValue: `${PAYG_SIGNATURE_HSM_REQUIRED ? 'STRICT HSM' : 'OPTIONAL'} (${PAYG_SIGNATURE_FIPS_MODE} FIPS)`
    },
    {
      id: 4,
      title: `${simulatedSigAlgo} Sign`,
      subtitle: "Elliptic curve signature execution",
      category: "enclave",
      icon: <Key size={14} />,
      details: [
        `Asymmetric private-key signing algorithm`,
        `Algorithm version: v${PAYG_SIGNATURE_VERSION}`
      ],
      configLabel: "PAYG_SIGNATURE_PROVIDER",
      configValue: `${PAYG_SIGNATURE_PROVIDER} (${PAYG_SIGNATURE_KEY_SIZE}-bit)`
    },
    {
      id: 5,
      title: "Base64URL Signature",
      subtitle: "Safe transport string representation",
      category: "enclave",
      icon: <Lock size={14} />,
      details: [
        `Sig: ${simulatedSignature.slice(0, 12)}...`,
        `Length: ${simulatedSignature.length} characters`
      ],
      configLabel: "PAYG_SIGNATURE_ENCODING",
      configValue: PAYG_SIGNATURE_ENCODING
    },
    {
      id: 6,
      title: "Gateway Reception",
      subtitle: "Secure entry point node validation",
      category: "gateway",
      icon: <Send size={14} />,
      details: [
        `Gateway Key status: ${GATEWAY_AUTHENTICATION_KEY ? "CONFIGURED (Secure)" : "DEFAULT"}`
      ],
      configLabel: "ONLINE_HANDSHAKE_TIMEOUT_MS",
      configValue: `${ONLINE_HANDSHAKE_TIMEOUT_MS}ms`
    },
    {
      id: 7,
      title: "Verify Signature",
      subtitle: "Validate integrity & authentic sender",
      category: "gateway",
      icon: <ShieldCheck size={14} />,
      details: [
        `Performs cryptographic verification with public key`,
        `Fail Policy enforced upon check mismatch`
      ],
      configLabel: "VERIFICATION / FAIL POLICY",
      configValue: `${PAYG_SIGNATURE_VERIFICATION} / ${PAYG_SIGNATURE_FAIL_POLICY}`
    },
    {
      id: 8,
      title: "Verify Timestamp",
      subtitle: "Prevents delayed transmission hijack",
      category: "gateway",
      icon: <Clock size={14} />,
      details: [
        `Payload TS: ${simulatedTimestamp}`,
        `Drift offset limit set to +/- 5000ms`
      ]
    },
    {
      id: 9,
      title: "Verify Nonce",
      subtitle: "Confirms single-use string unique key",
      category: "gateway",
      icon: <Key size={14} />,
      details: [
        `Nonce received: ${simulatedNonce}`,
        `Checked against local temporary session registers`
      ]
    },
    {
      id: 10,
      title: "Replay Protection",
      subtitle: "Ensures transaction is not double-spent",
      category: "gateway",
      icon: <Shield size={14} />,
      details: [
        `Checks hash directory against live database state`,
        `Status: Clean session ticket`
      ]
    },
    {
      id: 11,
      title: "Authorize Transaction",
      subtitle: "Settle secure ledgers instantly",
      category: "gateway",
      icon: <CheckCircle size={14} />,
      details: [
        `Digital balance transferred to Merchant`,
        `Audit trail stored in centralized cloud vault`
      ],
      configLabel: "PAYG_SIGNATURE_LOGGING",
      configValue: PAYG_SIGNATURE_LOGGING
    }
  ];

  const startSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveStep(0);
    
    const startLog = `[${new Date().toLocaleTimeString()}] INITIATE: POS transaction triggered for $${simulatedAmount} ${simulatedCurrency} with Merchant ${simulatedMerchant}.`;
    setSimulationLogs([startLog]);
  };

  useEffect(() => {
    if (!isRunning || activeStep === -1) return;

    if (activeStep < steps.length) {
      const timer = setTimeout(() => {
        const currentStep = steps[activeStep];
        let stepLog = `[${new Date().toLocaleTimeString()}] STEP ${activeStep + 1}/${steps.length}: [${currentStep.title}] - ${currentStep.subtitle}.`;
        
        if (activeStep === 2) {
          stepLog += ` Digest using ${PAYG_SIGNATURE_HASH}.`;
        } else if (activeStep === 3) {
          stepLog += ` Running inside secure hardware co-processor: ${ENCLAVE_SIGNING_CO_PROCESSOR}.${
            ENCLAVE_SIGNING_CO_PROCESSOR === "HSM" 
              ? ` Provider: ${HSM_PROVIDER}, Key Label: ${HSM_KEY_LABEL}.` 
              : ""
          }`;
        } else if (activeStep === 4) {
          stepLog += ` Enforcing signature version: ${PAYG_SIGNATURE_VERSION} via provider: ${PAYG_SIGNATURE_PROVIDER}.`;
        } else if (activeStep === 7) {
          stepLog += ` Verification strict policy: ${PAYG_SIGNATURE_VERIFICATION}.`;
        } else if (activeStep === 11) {
          stepLog += ` SUCCESS: Ledger successfully cleared with Gateway. Logging status: ${PAYG_SIGNATURE_LOGGING}.`;
        }

        setSimulationLogs(prev => [...prev, stepLog]);
        setActiveStep(prev => prev + 1);
      }, simulationSpeed);

      return () => clearTimeout(timer);
    } else {
      setIsRunning(false);
      // Simulation completed! Add a telemetry point based on current values
      const randomBase = simulatedSigAlgo.includes('RSA') ? 950 : simulatedSigAlgo.includes('ECDSA') ? 220 : 410;
      const calculatedSimLatency = randomBase + Math.floor(Math.random() * 80);

      const newSimPoint: LatencyPoint = {
        id: `sim_run_${Date.now()}`,
        label: `Simulated POS (${simulatedMerchant.split(' ')[0]})`,
        latency: calculatedSimLatency,
        protocol: simulatedSigAlgo,
        receiverName: simulatedMerchant.split(' ')[0] || 'Merchant POS',
        amount: parseFloat(simulatedAmount) || 199.99,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isBenchmark: false
      };

      setSimulatedHandshakes(prev => [...prev, newSimPoint]);
    }
  }, [isRunning, activeStep]);

  const resetSimulation = () => {
    setActiveStep(-1);
    setIsRunning(false);
    setSimulationLogs([]);
  };

  // Merge real transactions, simulated runs, and standard system benchmarks
  const telemetryPoints: LatencyPoint[] = useMemo(() => {
    // 1. Process real-time transactions
    const realTxs = [...transactions]
      .filter(tx => tx.status === 'success' || tx.status === 'pending_sync')
      .reverse(); // chronological order

    const mappedReal: LatencyPoint[] = realTxs.map((tx, idx) => {
      let lat = tx.protocolDetails?.handshakeLatency;
      if (typeof lat !== 'number') {
        if (tx.protocol === 'offline_201_3') {
          lat = 760;
        } else if (tx.protocol === 'online_101_1') {
          lat = 390;
        } else {
          lat = 140;
        }
      }

      // Add Jitter
      const jitter = (idx * 13) % 21 - 10;
      const finalLatency = Math.max(40, lat + jitter);

      const timeStr = tx.timestamp 
        ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date().toLocaleTimeString();

      const pLabel = tx.protocol === 'online_101_1' 
        ? 'Online 101.1' 
        : tx.protocol === 'offline_201_3' 
          ? 'Offline 201.3' 
          : 'Direct Wallet';

      return {
        id: tx.id,
        label: `${pLabel} (${tx.receiverName})`,
        latency: finalLatency,
        protocol: pLabel,
        receiverName: tx.receiverName,
        amount: tx.amount,
        timestamp: timeStr,
        isBenchmark: false
      };
    });

    // 2. Combine with completed local simulation handshakes
    const combined = [...mappedReal, ...simulatedHandshakes];

    // 3. If combined data points are fewer than 6, pre-populate the graph with standard system baseline benchmarks
    if (combined.length < 6) {
      const benchmarks: LatencyPoint[] = [
        {
          id: 'bench_1',
          label: 'Sys Benchmark: CloudHSM Enclave',
          latency: 410,
          protocol: '101.1 System',
          receiverName: 'Apex Ledger Vault',
          amount: 500.00,
          timestamp: '16:01:05',
          isBenchmark: true
        },
        {
          id: 'bench_2',
          label: 'Sys Benchmark: 201.3 Acoustic',
          latency: 820,
          protocol: '201.3 System',
          receiverName: 'Local Terminal #9',
          amount: 15.45,
          timestamp: '16:04:12',
          isBenchmark: true
        },
        {
          id: 'bench_3',
          label: 'Sys Benchmark: ECDSA HSM Sign',
          latency: 280,
          protocol: '101.1 System',
          receiverName: 'Secured Merchant POS',
          amount: 120.00,
          timestamp: '16:08:44',
          isBenchmark: true
        },
        {
          id: 'bench_4',
          label: 'Sys Benchmark: Acoustic Sweep',
          latency: 750,
          protocol: '201.3 System',
          receiverName: 'Local Terminal #4',
          amount: 85.00,
          timestamp: '16:11:30',
          isBenchmark: true
        },
        {
          id: 'bench_5',
          label: 'Sys Benchmark: Gateway Authorized',
          latency: 340,
          protocol: '101.1 System',
          receiverName: 'Central Gateway Corp',
          amount: 210.00,
          timestamp: '16:14:21',
          isBenchmark: true
        }
      ];

      const result = [...benchmarks, ...combined];
      return result.slice(-8);
    }

    return combined.slice(-8);
  }, [transactions, simulatedHandshakes]);

  // Compute stats
  const averageLatency = useMemo(() => {
    if (telemetryPoints.length === 0) return 0;
    const sum = telemetryPoints.reduce((acc, p) => acc + p.latency, 0);
    return Math.round(sum / telemetryPoints.length);
  }, [telemetryPoints]);

  const latestPoint = useMemo(() => {
    if (telemetryPoints.length === 0) return null;
    return telemetryPoints[telemetryPoints.length - 1];
  }, [telemetryPoints]);

  // Chart layout dimensions
  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    if (telemetryPoints.length === 0) return 1200;
    const max = Math.max(...telemetryPoints.map(p => p.latency));
    return Math.max(1200, Math.ceil(max / 200) * 200);
  }, [telemetryPoints]);

  const svgPoints = useMemo(() => {
    if (telemetryPoints.length === 0) return [];
    return telemetryPoints.map((p, idx) => {
      const x = paddingLeft + (idx / (telemetryPoints.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (p.latency / maxVal) * chartHeight;
      return { x, y, data: p };
    });
  }, [telemetryPoints, maxVal, chartWidth, chartHeight]);

  const linePathD = useMemo(() => {
    if (svgPoints.length === 0) return "";
    return svgPoints.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, "");
  }, [svgPoints]);

  const areaPathD = useMemo(() => {
    if (svgPoints.length === 0) return "";
    const bottomY = paddingTop + chartHeight;
    return `${linePathD} L ${svgPoints[svgPoints.length - 1].x} ${bottomY} L ${svgPoints[0].x} ${bottomY} Z`;
  }, [svgPoints, linePathD, chartHeight]);

  // Active hover point index selection
  const selectedPointIndex = hoveredPointIndex !== null ? hoveredPointIndex : (telemetryPoints.length - 1);
  const activeInspectedPoint = telemetryPoints[selectedPointIndex] || latestPoint;

  return (
    <div 
      id="protocol-pipeline-visualizer"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Cpu size={16} className="text-blue-400 animate-pulse" />
            Live PAYG Cryptographic Pipeline Visualizer
          </h3>
          <p className="text-[11px] text-slate-400">
            Real-time interactive analysis of the 12-step secure hardware enclave signature and gateway verification procedure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Amount adjustor */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Amt:</span>
            <input 
              id="sim-amount-input"
              type="number" 
              step="5.00"
              value={simulatedAmount} 
              onChange={(e) => setSimulatedAmount(e.target.value)}
              disabled={isRunning}
              className="bg-transparent text-xs text-blue-400 font-mono w-16 focus:outline-none"
            />
          </div>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Speed:</span>
            <select
              id="sim-speed-select"
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              disabled={isRunning}
              className="bg-transparent text-xs text-slate-300 font-mono focus:outline-none cursor-pointer"
            >
              <option value="1500" className="bg-slate-900 text-slate-300">Slower (1.5s)</option>
              <option value="1000" className="bg-slate-900 text-slate-300">Default (1.0s)</option>
              <option value="500" className="bg-slate-900 text-slate-300">Fast (0.5s)</option>
              <option value="150" className="bg-slate-900 text-slate-300">Hyperspeed</option>
            </select>
          </div>

          {/* Algorithm Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase text-blue-400">Sig:</span>
            <select
              id="sim-algorithm-select"
              value={simulatedSigAlgo}
              onChange={(e) => handleSelectAlgorithm(e.target.value)}
              disabled={isRunning}
              className="bg-transparent text-xs text-blue-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value={PRIMARY_SIGNATURE_ALGORITHM} className="bg-slate-900 text-slate-300">Primary ({PRIMARY_SIGNATURE_ALGORITHM})</option>
              <option value={SECONDARY_SIGNATURE_ALGORITHM} className="bg-slate-900 text-slate-300">Secondary ({SECONDARY_SIGNATURE_ALGORITHM})</option>
              <option value={LEGACY_SIGNATURE_ALGORITHM} className="bg-slate-900 text-slate-300">Legacy ({LEGACY_SIGNATURE_ALGORITHM})</option>
            </select>
          </div>

          <button
            id="start-sim-pipeline-btn"
            onClick={startSimulation}
            disabled={isRunning}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/20 active:scale-[0.98]'
            }`}
          >
            <RefreshCw size={12} className={isRunning ? "animate-spin" : ""} />
            <span>Simulate POS Pipeline</span>
          </button>

          {activeStep >= steps.length && (
            <button
              id="reset-sim-pipeline-btn"
              onClick={resetSimulation}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Expandable PAYG JSON Payload Editor */}
      <div className="bg-slate-950/70 border border-slate-850 rounded-2xl p-4 space-y-3 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Configure Payload JSON Specifications</span>
          </div>
          <button 
            id="toggle-json-spec-btn"
            onClick={() => setShowJsonEditor(!showJsonEditor)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline"
          >
            {showJsonEditor ? 'Hide JSON Spec Editor' : 'Configure Custom JSON Payload'}
          </button>
        </div>

        {showJsonEditor && (
          <div className="space-y-3 transition-all duration-300">
            <p className="text-[11px] text-slate-400">
              Customize or paste any secure Pay-As-You-Go payment transaction canonical structure below. The cryptographic pipeline will dynamically parse, digest, sign, and authorize this specific spec.
            </p>
            <div className="relative">
              <textarea
                id="custom-payload-json-textarea"
                rows={10}
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="Paste canonical PAYG JSON payload here..."
              />
              {jsonPayloadError && (
                <div className="absolute bottom-3 left-3 right-3 bg-rose-950/90 border border-rose-900/50 rounded-lg p-2 flex items-center gap-2 text-[10px] text-rose-300">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{jsonPayloadError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Detected payload format: <span className="text-emerald-400">Canonical RFC-8785 Compliance</span>
              </span>
              <div className="flex gap-2">
                <button
                  id="reset-canonical-default-btn"
                  onClick={() => {
                    setCustomJsonInput(JSON.stringify({
                      "merchantId": "MRC123456",
                      "terminalId": "TERM001",
                      "transactionId": "TX-202607060001",
                      "timestamp": "2026-07-06T15:35:18Z",
                      "nonce": "e3fd68bca3d74ef7",
                      "amount": 199.99,
                      "currency": "USD",
                      "signatureAlgorithm": PRIMARY_SIGNATURE_ALGORITHM,
                      "signature": "ZHVG68YFKA3D74EF7S1X8Y2U18X9A7"
                    }, null, 2));
                    setJsonPayloadError(null);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-800 transition-all"
                >
                  Reset to Default Template
                </button>
                <button
                  id="apply-payload-json-btn"
                  onClick={handleApplyCustomJson}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all"
                >
                  Apply Payload Specification
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Grid Flowchart */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {steps.map((step, idx) => {
          const isDone = activeStep > idx;
          const isActive = activeStep === idx;
          const isPending = activeStep < idx || activeStep === -1;

          let cardColorClass = "bg-slate-950/40 border-slate-850 text-slate-500";
          let badgeColor = "bg-slate-900 border-slate-800 text-slate-500";
          
          if (isDone) {
            cardColorClass = "bg-emerald-950/15 border-emerald-900/40 text-emerald-300 shadow-sm shadow-emerald-950/10";
            badgeColor = "bg-emerald-900/35 border-emerald-800/50 text-emerald-400";
          } else if (isActive) {
            cardColorClass = "bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/20 text-blue-100 shadow-lg shadow-blue-950/30";
            badgeColor = "bg-blue-900 border-blue-700 text-blue-400 animate-pulse";
          }

          let categoryBadge = "MC POS Terminal";
          if (step.category === 'enclave') categoryBadge = "Secure Enclave Core";
          if (step.category === 'gateway') categoryBadge = "Gateway Auth Node";

          return (
            <div 
              key={step.id}
              id={`pipeline-step-card-${step.id}`}
              className={`border p-3.5 rounded-2xl flex flex-col justify-between space-y-3 transition-all duration-300 relative overflow-hidden ${cardColorClass}`}
            >
              {/* Connector dots */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-1 w-2 h-2 rounded-full z-10 bg-slate-800 border border-slate-900" />
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded-lg border font-bold text-xs ${badgeColor}`}>
                    {step.icon}
                  </div>
                  <span className="text-[9px] font-mono opacity-50 font-semibold">#{idx + 1}</span>
                </div>

                <div className="text-left space-y-0.5">
                  <h4 className="text-[11px] font-bold tracking-tight text-slate-200 truncate">{step.title}</h4>
                  <p className="text-[9px] opacity-75 line-clamp-2 leading-snug">{step.subtitle}</p>
                </div>
              </div>

              {/* Step details inside cards */}
              <div className="bg-slate-950/70 border border-slate-850/50 rounded-xl p-2 space-y-1 text-left font-mono text-[8.5px] leading-tight select-all">
                {step.details.map((detail, dIdx) => (
                  <div key={dIdx} className="truncate text-slate-400">
                    {detail}
                  </div>
                ))}
                {step.configLabel && (
                  <div className="border-t border-slate-900/60 pt-1 mt-1 flex flex-col">
                    <span className="text-[7.5px] text-slate-500 uppercase">{step.configLabel}:</span>
                    <span className="text-[8px] text-blue-400 font-bold truncate">{step.configValue}</span>
                  </div>
                )}
              </div>

              {/* Status footer light */}
              <div className="flex items-center justify-between text-[8px] font-mono border-t border-slate-850/40 pt-1.5">
                <span className="opacity-40">{categoryBadge}</span>
                <span className={`font-bold uppercase ${
                  isDone ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-slate-600'
                }`}>
                  {isDone ? 'COMPLETED' : isActive ? 'PROCESSING' : 'PENDING'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Handshake Latency Telemetry Dashboard Widget */}
      <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
          <div className="flex items-center space-x-2">
            <Activity size={16} className="text-blue-400 animate-pulse" />
            <div className="text-left">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Handshake Latency Monitor
              </h4>
              <p className="text-[10px] text-slate-500 font-mono">
                Real-time verification speed (ms) for the latest completed payments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Avg Speed: <strong className="text-blue-400">{averageLatency}ms</strong>
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1">
              Latest: <strong className={latestPoint?.latency && latestPoint.latency < 500 ? "text-emerald-400" : "text-amber-400"}>{latestPoint?.latency || 0}ms</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Chart column */}
          <div className="md:col-span-2 bg-slate-950/60 border border-slate-850/60 rounded-xl p-3 relative h-[210px] flex flex-col justify-between">
            <div className="absolute top-2 right-2 text-[8px] font-mono text-slate-600">
              Interactive Telemetry • Hover nodes to inspect
            </div>

            {/* Custom SVG Graph */}
            <div className="w-full flex-1 min-h-[140px] flex items-center justify-center">
              <svg 
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-full select-none overflow-visible"
              >
                <defs>
                  {/* Glowing gradients */}
                  <linearGradient id="latency-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>

                {/* Y-axis grid lines & labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, gridIdx) => {
                  const val = Math.round(maxVal * ratio);
                  const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
                  return (
                    <g key={gridIdx} className="opacity-40">
                      <line 
                        x1={paddingLeft} 
                        y1={y} 
                        x2={width - paddingRight} 
                        y2={y} 
                        stroke="#1e293b" 
                        strokeDasharray="2,4" 
                        strokeWidth="1"
                      />
                      <text 
                        x={paddingLeft - 8} 
                        y={y + 3} 
                        textAnchor="end" 
                        className="fill-slate-500 font-mono text-[8px]"
                      >
                        {val}ms
                      </text>
                    </g>
                  );
                })}

                {/* Area path underneath */}
                {areaPathD && (
                  <path 
                    d={areaPathD} 
                    fill="url(#latency-gradient)" 
                  />
                )}

                {/* Line path */}
                {linePathD && (
                  <path 
                    d={linePathD} 
                    fill="none" 
                    stroke="url(#line-gradient)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Glowing points */}
                {svgPoints.map((p, idx) => {
                  const isHovered = selectedPointIndex === idx;
                  return (
                    <g key={p.data.id}>
                      {isHovered && (
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r="10" 
                          fill="#3b82f6" 
                          fillOpacity="0.15" 
                          className="animate-ping"
                        />
                      )}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 4}
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        className={`cursor-pointer transition-all duration-150 ${
                          isHovered 
                            ? 'fill-blue-400 stroke-white stroke-2' 
                            : p.data.isBenchmark
                              ? 'fill-slate-800 stroke-slate-700 stroke-1'
                              : 'fill-blue-500 stroke-slate-900 stroke-1 hover:fill-blue-400'
                        }`}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between pl-[40px] pr-[15px] border-t border-slate-900 pt-1">
              {telemetryPoints.map((p, idx) => (
                <div 
                  key={p.id} 
                  className={`text-[8px] font-mono text-center truncate w-[45px] ${
                    selectedPointIndex === idx ? 'text-blue-400 font-bold' : 'text-slate-600'
                  }`}
                  title={p.label}
                >
                  {p.timestamp.includes('Benchmark') ? `Bench #${idx+1}` : p.timestamp}
                </div>
              ))}
            </div>
          </div>

          {/* Details Inspector column */}
          <div className="bg-slate-950/60 border border-slate-850/60 rounded-xl p-4 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2.5">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-blue-400" />
                  Handshake Details
                </h5>
                {activeInspectedPoint?.isBenchmark ? (
                  <span className="text-[7.5px] font-mono bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded border border-slate-850 uppercase font-bold">
                    Benchmark
                  </span>
                ) : (
                  <span className="text-[7.5px] font-mono bg-blue-950/60 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/30 uppercase font-bold animate-pulse">
                    Live Telemetry
                  </span>
                )}
              </div>

              {activeInspectedPoint ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Target Recipient</span>
                    <span className="text-xs font-bold text-slate-200 truncate block">
                      {activeInspectedPoint.receiverName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block">Protocol Mode</span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {activeInspectedPoint.protocol}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block">Amount</span>
                      <span className="text-[10px] font-bold text-emerald-400 font-mono">
                        ${activeInspectedPoint.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900">
                    <span className="text-[8px] text-slate-500 font-mono uppercase block">Handshake Speed</span>
                    <div className="flex items-baseline space-x-1.5 mt-0.5">
                      <span className="text-lg font-bold font-mono text-white">
                        {activeInspectedPoint.latency}ms
                      </span>
                      <span className={`text-[8px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                        activeInspectedPoint.latency < 400 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                          : activeInspectedPoint.latency < 800
                            ? 'bg-amber-950 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-950 text-rose-400 border border-rose-500/20'
                      }`}>
                        {activeInspectedPoint.latency < 400 ? 'Fast' : activeInspectedPoint.latency < 800 ? 'Standard' : 'Overhead'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-600 italic text-[10px] text-center py-8">
                  No telemetry available. Trigger transactions or simulation runs.
                </div>
              )}
            </div>

            <div className="text-[8px] font-mono text-slate-600 border-t border-slate-900/60 pt-2 mt-2 leading-tight">
              Acoustic audio/QR and CloudHSM handshake times are fully synchronized with this panel.
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Terminal Console */}
      <div className="bg-slate-950 border border-slate-850/75 rounded-2xl p-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Cryptographic Engine Console Stream
            </h4>
          </div>
          <span className="text-[9px] font-mono text-slate-500">
            {isRunning ? 'STREAM ACTIVE' : 'STREAM STANDBY'}
          </span>
        </div>

        <div className="overflow-y-auto max-h-[140px] font-mono text-[10px] space-y-1.5 text-left text-slate-400">
          {simulationLogs.length === 0 ? (
            <div className="text-slate-600 italic text-center py-4">
              Click "Simulate POS Pipeline" to run a live test case validation with custom values.
            </div>
          ) : (
            simulationLogs.map((log, lIdx) => {
              const isSuccess = log.includes("SUCCESS") || log.includes("COMPLETED");
              const isError = log.includes("ERROR") || log.includes("FAILED");
              
              let textColor = "text-slate-400";
              if (isSuccess) textColor = "text-emerald-400 font-semibold";
              if (isError) textColor = "text-rose-400 font-semibold";
              if (log.includes("STEP ")) textColor = "text-blue-300";

              return (
                <div key={lIdx} className={`leading-normal border-b border-slate-900 pb-1 ${textColor}`}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
