import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, AlertCircle, ShieldAlert } from 'lucide-react';

interface GuardLog {
  timestamp: string;
  stage: string;
  raw_text: string;
  passed: boolean;
  reason: string;
  details?: string;
}

interface GuardStats {
  total_checks: number;
  injections_blocked: number;
  pii_redacted: number;
  toxicity_blocks: number;
  checks_passed: number;
}

export const GuardrailLogs: React.FC = () => {
  const [logs, setLogs] = useState<GuardLog[]>([]);
  const [stats, setStats] = useState<GuardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/guardrails/logs'),
        fetch('/api/guardrails/stats'),
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch security guard logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-stagger-1 font-sans-brand">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-border-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">COMPLIANCE &amp; OBSERVABILITY</span>
          <h2 className="text-3xl font-serif-display text-text-light font-bold mt-1">Guardrails &amp; Safety Logs</h2>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 border border-border-divider hover:border-burnt-orange rounded text-text-light hover:bg-[#511845]/15 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Injections Blocked</span>
          <div className="text-3xl font-serif-display text-vivid-red font-bold mt-1">{stats?.injections_blocked ?? 0}</div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">PII Redacted</span>
          <div className="text-3xl font-serif-display text-text-light font-bold mt-1">{stats?.pii_redacted ?? 0}</div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Toxicity Blocks</span>
          <div className="text-3xl font-serif-display text-text-light font-bold mt-1">{stats?.toxicity_blocks ?? 0}</div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-l-2 border-l-vivid-red">
          <span className="text-[10px] font-bold text-burnt-orange uppercase tracking-wider">Total Checks Run</span>
          <div className="text-3xl font-serif-display text-burnt-orange font-bold mt-1">{stats?.total_checks ?? 0}</div>
        </div>
      </div>

      {/* Compliance Log list */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-[450px] overflow-hidden">
        <h3 className="text-sm font-bold text-text-light mb-4 pb-2 border-b border-border-divider uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert size={15} className="text-burnt-orange" />
          <span>Compliance Operations Stream</span>
        </h3>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border-divider/30 text-xs text-text-muted pr-2">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <ShieldCheck size={28} className="text-burnt-orange animate-pulse" />
              <p className="text-xs text-text-muted">Compliance framework active. No security anomalies observed.</p>
            </div>
          ) : (
            logs.slice().reverse().map((log, index) => (
              <div key={index} className="py-3 flex flex-col gap-1.5 hover:bg-[#511845]/10 px-2 rounded transition-all">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${
                    log.passed ? 'bg-primary-plum/30 text-text-light border-primary-plum/40' : 'bg-vivid-red/10 text-vivid-red border-vivid-red/20'
                  }`}>
                    {log.stage}
                  </span>
                  <span className="text-[10px] font-data-mono">{log.timestamp}</span>
                </div>
                
                <div className="flex items-center gap-2 font-bold text-text-light">
                  {log.passed ? <ShieldCheck size={14} className="text-burnt-orange" /> : <AlertCircle size={14} className="text-vivid-red" />}
                  <span>{log.reason}</span>
                </div>
                
                {log.details && <p className="text-[11px] text-text-muted/80">{log.details}</p>}
                <p className="text-[10px] text-text-muted/60 italic truncate font-data-mono bg-near-black/50 p-1.5 rounded border border-border-divider/30">
                  Raw input stream snippet: "{log.raw_text}"
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
