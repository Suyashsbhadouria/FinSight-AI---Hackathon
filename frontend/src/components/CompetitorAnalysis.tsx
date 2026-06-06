import React, { useState } from 'react';
import { Globe, Scale, RefreshCw } from 'lucide-react';

interface Competitor {
  name: string;
  revenue: string;
  growth: string;
  margin: string;
  risks: string;
  initiatives: string;
}

interface CompetitorAnalysisProps {
  companyName: string;
}

export const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ companyName }) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    if (!companyName) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName })
      });
      if (response.ok) {
        const data = await response.json();
        setCompetitors(data.competitors || []);
      } else {
        const err = await response.json();
        setError(err.detail || 'Competitor analysis failed.');
        setCompetitors([]);
      }
    } catch {
      setError('Network error during competitor analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-stagger-1 font-sans-brand">
      {/* Header Row */}
      <div className="flex justify-between items-center pb-4 border-b border-border-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">BENCHMARKING</span>
          <h2 className="text-3xl font-serif-display text-text-light font-bold mt-1">Competitor Benchmarking</h2>
        </div>
        <button 
          className="bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light font-bold text-xs px-4 py-2 rounded flex items-center gap-2 shadow-lg transition-all hover:brightness-110"
          onClick={runAnalysis}
          disabled={loading || !companyName}
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Globe size={12} />}
          <span>{loading ? 'Gathering Intelligence...' : 'Benchmark Competitors'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 glass-panel rounded-xl">
          <RefreshCw size={24} className="animate-spin text-burnt-orange" />
          <p className="text-xs text-text-muted">Scanning market databases, news feeds, and competitor filings...</p>
        </div>
      ) : competitors.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center gap-4 bg-near-black/50">
          <Scale size={42} className="text-text-muted" />
          <p className="text-text-muted text-xs max-w-sm leading-relaxed">
            Click "Benchmark Competitors" to run live web search and SLM extraction for {companyName}.
          </p>
          {error && <p className="text-vivid-red text-xs">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6 animate-fade">
          {/* Comparison Matrix Table */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border-divider bg-[#140910]">
              <h3 className="text-sm font-bold text-text-light">Financial Benchmarking Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-divider text-[10px] uppercase tracking-wider text-text-muted bg-primary-plum/10">
                    <th className="px-5 py-3 font-bold">Company</th>
                    <th className="px-5 py-3 font-bold">Revenue</th>
                    <th className="px-5 py-3 font-bold">YoY Growth</th>
                    <th className="px-5 py-3 font-bold">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="text-text-muted">
                  <tr className="border-b border-border-divider/30 bg-primary-plum/20">
                    <td className="px-5 py-4 font-bold text-burnt-orange">{companyName} (Target)</td>
                    <td className="px-5 py-4 text-text-muted" colSpan={3}>Metrics sourced from uploaded filing analysis</td>
                  </tr>
                  {competitors.map((comp, idx) => (
                    <tr key={idx} className="border-b border-border-divider/10 hover:bg-primary-plum/10 transition-colors">
                      <td className="px-5 py-4 font-bold text-text-light">{comp.name}</td>
                      <td className="px-5 py-4 font-data-mono">{comp.revenue}</td>
                      <td className="px-5 py-4 font-data-mono">{comp.growth}</td>
                      <td className="px-5 py-4 font-data-mono">{comp.margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Competitor initiatives cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {competitors.map((comp, idx) => (
              <div key={idx} className="glass-panel p-5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4 border-b border-border-divider pb-2">
                  <h4 className="text-sm font-bold text-text-light">{comp.name}</h4>
                  <span className="w-2 h-2 bg-burnt-orange rounded-full"></span>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-bold text-burnt-orange uppercase tracking-wider block mb-1">Strategic Initiatives</span>
                    <p className="text-xs text-text-muted leading-relaxed">{comp.initiatives}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-vivid-red uppercase tracking-wider block mb-1">Core Risks</span>
                    <p className="text-xs text-text-muted leading-relaxed">{comp.risks}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-text-muted/60 italic font-sans-brand font-medium">
            * All data is extracted and summarized dynamically from RAG indexes and DuckDuckGo web results. Estimates are marked with an asterisk (*).
          </div>
        </div>
      )}
    </div>
  );
};
