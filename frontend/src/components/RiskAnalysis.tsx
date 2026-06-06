import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface Risk {
  title: string;
  description: string;
  severity: number;
  evidence: string;
  location: string;
}

export const RiskAnalysis: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState('');

  const fetchRisks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/risks');
      if (response.ok) {
        const data = await response.json();
        setRisks(data.risks || []);
      } else {
        const err = await response.json();
        setError(err.detail || 'Failed to extract risks from the filing.');
        setRisks([]);
      }
    } catch {
      setError('Failed to load risks from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, []);

  const criticalCount = risks.filter((r) => r.severity >= 8).length;
  const highCount = risks.filter((r) => r.severity >= 5 && r.severity < 8).length;
  const stableCount = risks.filter((r) => r.severity < 5).length;
  const aggregateRisk = risks.length
    ? (risks.reduce((sum, r) => sum + Number(r.severity), 0) / risks.length).toFixed(1)
    : '—';

  const getSeverityText = (severity: number) => {
    if (severity >= 8) return 'CRITICAL';
    if (severity >= 5) return 'WARNING';
    return 'STABLE';
  };

  const criticalPct = risks.length ? Math.round((criticalCount / risks.length) * 100) : 0;
  const highPct = risks.length ? Math.round((highCount / risks.length) * 100) : 0;
  const stablePct = risks.length ? Math.round((stableCount / risks.length) * 100) : 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-fade">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-headline-lg font-headline-lg text-primary font-bold">Risk Intelligence Hub</h2>
          <p className="text-on-surface-variant font-body-md">Deep semantic extraction and algorithmic risk categorization.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-surface-container px-3 py-1.5 border border-outline-variant rounded-lg flex items-center gap-3">
            <div className="text-right">
              <p className="text-label-caps font-label-caps text-on-surface-variant">AGGREGATE RISK</p>
              <p className="text-headline-md font-headline-md text-critical font-bold">{aggregateRisk} / 10</p>
            </div>
          </div>
          <button
            onClick={fetchRisks}
            disabled={loading}
            className="bg-surface-container hover:bg-surface-container-high border border-outline-variant px-3 py-2 rounded-lg text-body-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-warning text-body-sm">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-4 bg-surface-container border border-outline-variant p-5 rounded-xl">
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-6">Severity Breakdown</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-critical font-bold text-xl">{criticalCount}</div>
              <div className="text-[10px] text-on-surface-variant">Critical ({criticalPct}%)</div>
            </div>
            <div>
              <div className="text-warning font-bold text-xl">{highCount}</div>
              <div className="text-[10px] text-on-surface-variant">High ({highPct}%)</div>
            </div>
            <div>
              <div className="text-positive font-bold text-xl">{stableCount}</div>
              <div className="text-[10px] text-on-surface-variant">Stable ({stablePct}%)</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 bg-surface-container border border-outline-variant p-5 rounded-xl">
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-4">Extracted Risk Feed</h3>
          {loading ? (
            <p className="text-on-surface-variant text-body-sm">Extracting filing risk factors...</p>
          ) : risks.length === 0 ? (
            <p className="text-on-surface-variant text-body-sm">No risks extracted for the current filing.</p>
          ) : (
            <div className="divide-y divide-outline-variant/30 max-h-48 overflow-y-auto custom-scrollbar">
              {risks.map((risk, idx) => (
                <div key={idx} className="py-3 flex justify-between gap-4">
                  <div>
                    <p className="text-body-sm font-semibold text-on-surface">{risk.title}</p>
                    <p className="text-[11px] text-on-surface-variant">{risk.location}</p>
                  </div>
                  <span className="font-data-mono text-sm text-critical shrink-0">{Number(risk.severity).toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-headline-md text-headline-md font-bold px-1 text-on-surface">Critical Findings</h3>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 bg-surface-container border border-outline-variant rounded-xl">
            <div className="w-6 h-6 border-2 border-white/5 border-t-primary rounded-full animate-spin"></div>
            <p className="text-body-sm text-on-surface-variant">Extracting filing risk factors...</p>
          </div>
        ) : risks.length === 0 ? (
          <div className="p-8 text-center bg-surface-container border border-outline-variant rounded-xl text-on-surface-variant text-body-sm">
            No risk vectors loaded. Upload a filing with risk disclosures to proceed.
          </div>
        ) : (
          risks.map((risk, index) => (
            <div key={index} className="glass-ai-card p-5 rounded-xl border border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-headline-md text-headline-md text-on-surface font-bold">{risk.title}</h4>
                  <span className="text-[9px] font-bold uppercase text-primary">{getSeverityText(risk.severity)}</span>
                </div>
                <p className="font-data-mono font-bold text-critical">{Number(risk.severity).toFixed(1)}</p>
              </div>
              <p className="text-body-md text-on-surface-variant mb-4">{risk.description}</p>
              <blockquote className="bg-background-deep/50 p-4 rounded-lg border border-outline-variant/30 italic text-on-surface-variant text-body-md">
                "{risk.evidence}"
                <div className="mt-2 text-right text-[10px] text-primary uppercase">LOCATION: {risk.location}</div>
              </blockquote>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
