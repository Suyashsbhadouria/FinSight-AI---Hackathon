import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';

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
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-fade">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-headline-lg font-headline-lg text-primary font-bold">Guardrails &amp; Observability</h2>
          <p className="text-on-surface-variant">Real-time safety telemetry from live guardrail checks.</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="bg-surface-container hover:bg-surface-container-high border border-outline-variant p-2 rounded-lg"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-3 glass-card p-4 rounded-lg">
          <span className="font-label-caps text-label-caps text-on-surface-variant">INJECTIONS BLOCKED</span>
          <div className="font-headline-lg text-critical font-bold text-2xl mt-2">{stats?.injections_blocked ?? 0}</div>
        </div>
        <div className="col-span-12 md:col-span-3 glass-card p-4 rounded-lg">
          <span className="font-label-caps text-label-caps text-on-surface-variant">PII REDACTED</span>
          <div className="font-headline-lg text-on-surface font-bold text-2xl mt-2">{stats?.pii_redacted ?? 0}</div>
        </div>
        <div className="col-span-12 md:col-span-3 glass-card p-4 rounded-lg">
          <span className="font-label-caps text-label-caps text-on-surface-variant">TOXICITY BLOCKS</span>
          <div className="font-headline-lg text-on-surface font-bold text-2xl mt-2">{stats?.toxicity_blocks ?? 0}</div>
        </div>
        <div className="col-span-12 md:col-span-3 glass-card p-4 rounded-lg border-l-2 border-primary">
          <span className="font-label-caps text-label-caps text-on-surface-variant">TOTAL CHECKS</span>
          <div className="font-headline-lg text-primary font-bold text-2xl mt-2">{stats?.total_checks ?? 0}</div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-lg flex flex-col h-[420px] overflow-hidden">
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-4">Live Compliance Logs</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30 font-body-sm text-on-surface-variant">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted">
              <ShieldCheck size={28} />
              <p>No guardrail events recorded yet.</p>
            </div>
          ) : (
            logs.slice().reverse().map((log, index) => (
              <div key={index} className="py-3 flex flex-col gap-1.5 px-2">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${
                    log.passed ? 'bg-positive/10 text-positive border-positive/20' : 'bg-critical/10 text-critical border-critical/20'
                  }`}>
                    {log.stage}
                  </span>
                  <span className="text-[10px] font-data-mono">{log.timestamp}</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-on-surface">
                  {log.passed ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                  <span>{log.reason}</span>
                </div>
                {log.details && <p className="text-[11px] opacity-75">{log.details}</p>}
                <p className="text-[10px] text-muted italic truncate font-data-mono">Snippet: "{log.raw_text}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
