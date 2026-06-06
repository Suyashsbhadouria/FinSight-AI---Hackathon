import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

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

  const getSeverityBadgeClass = (severity: number) => {
    if (severity >= 8) return 'bg-vivid-red/10 text-vivid-red border-vivid-red/20';
    if (severity >= 5) return 'bg-burnt-orange/10 text-burnt-orange border-burnt-orange/20';
    return 'bg-[#511845]/30 text-text-light border-primary-plum/30';
  };

  const criticalPct = risks.length ? Math.round((criticalCount / risks.length) * 100) : 0;
  const highPct = risks.length ? Math.round((highCount / risks.length) * 100) : 0;
  const stablePct = risks.length ? Math.round((stableCount / risks.length) * 100) : 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-stagger-1 font-sans-brand">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-border-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">RISK METRICS</span>
          <h2 className="text-3xl font-serif-display text-text-light font-bold mt-1">Risk Intelligence Hub</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-[#140910] border border-border-divider px-4 py-2 rounded-lg flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] font-bold text-text-muted uppercase">AGGREGATE EXPOSURE</p>
              <p className="text-lg font-serif-display text-vivid-red font-bold">{aggregateRisk} / 10</p>
            </div>
            <ShieldAlert className="text-vivid-red" size={20} />
          </div>
          
          <button
            onClick={fetchRisks}
            disabled={loading}
            className="p-2 border border-border-divider hover:border-burnt-orange rounded text-text-light hover:bg-[#511845]/15 transition-all"
            title="Refresh Scan"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-vivid-red/10 border border-vivid-red/20 rounded-xl p-4 text-vivid-red text-xs">
          {error}
        </div>
      )}

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 glass-panel p-5 rounded-xl flex flex-col justify-between">
          <h3 className="text-xs font-bold text-text-light uppercase tracking-wider mb-4 border-b border-border-divider pb-2">Severity Breakdown</h3>
          <div className="grid grid-cols-3 gap-2 text-center my-auto">
            <div className="bg-near-black/50 p-3 rounded border border-border-divider">
              <div className="text-vivid-red font-bold text-xl font-serif-display">{criticalCount}</div>
              <div className="text-[9px] text-text-muted mt-1 uppercase font-bold">Critical ({criticalPct}%)</div>
            </div>
            <div className="bg-near-black/50 p-3 rounded border border-border-divider">
              <div className="text-burnt-orange font-bold text-xl font-serif-display">{highCount}</div>
              <div className="text-[9px] text-text-muted mt-1 uppercase font-bold">High ({highPct}%)</div>
            </div>
            <div className="bg-near-black/50 p-3 rounded border border-border-divider">
              <div className="text-text-light font-bold text-xl font-serif-display">{stableCount}</div>
              <div className="text-[9px] text-text-muted mt-1 uppercase font-bold">Stable ({stablePct}%)</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 glass-panel p-5 rounded-xl flex flex-col justify-between">
          <h3 className="text-xs font-bold text-text-light uppercase tracking-wider mb-4 border-b border-border-divider pb-2">Extracted Risk Feed</h3>
          {loading ? (
            <p className="text-text-muted text-xs p-4">Running risk extraction modules...</p>
          ) : risks.length === 0 ? (
            <p className="text-text-muted text-xs p-4">No risk data active. Ingest a document to scan.</p>
          ) : (
            <div className="divide-y divide-border-divider/30 max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-1">
              {risks.map((risk, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center gap-4 hover:bg-[#511845]/10 px-2 rounded transition-all">
                  <div>
                    <p className="text-xs font-bold text-text-light leading-tight">{risk.title}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{risk.location}</p>
                  </div>
                  <span className="font-data-mono text-xs text-vivid-red font-bold">{Number(risk.severity).toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Critical Findings Detail Matrix */}
      <div className="space-y-4">
        <h3 className="text-base font-serif-display font-bold text-text-light px-1">Filing Risk Profiles</h3>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 glass-panel rounded-xl">
            <RefreshCw size={24} className="animate-spin text-burnt-orange" />
            <p className="text-xs text-text-muted">Analyzing filing disclosures...</p>
          </div>
        ) : risks.length === 0 ? (
          <div className="p-8 text-center glass-panel rounded-xl text-text-muted text-xs">
            No risk profiles compiled yet. Please load a PDF document.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {risks.map((risk, index) => (
              <div key={index} className="glass-panel p-5 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-4 mb-3 pb-2 border-b border-border-divider/50">
                    <div>
                      <h4 className="text-sm font-bold text-text-light leading-tight">{risk.title}</h4>
                      <span className={`inline-block px-2 py-0.5 border rounded-full text-[8px] font-bold uppercase tracking-wider mt-1.5 ${getSeverityBadgeClass(risk.severity)}`}>
                        {getSeverityText(risk.severity)}
                      </span>
                    </div>
                    <div className="text-lg font-serif-display text-vivid-red font-bold font-data-mono shrink-0">
                      {Number(risk.severity).toFixed(1)}
                    </div>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">{risk.description}</p>
                </div>

                <blockquote className="bg-near-black/50 p-3.5 rounded border border-border-divider italic text-text-muted text-xs leading-relaxed relative">
                  "{risk.evidence}"
                  <div className="mt-2 text-right text-[9px] text-burnt-orange font-bold uppercase tracking-wider font-data-mono">
                    LOCATION: {risk.location}
                  </div>
                </blockquote>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
