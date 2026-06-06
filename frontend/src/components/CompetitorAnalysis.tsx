import React, { useState } from 'react';
import { Globe, Scale } from 'lucide-react';

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
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-fade">
      {/* Header Row */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-headline-lg font-headline-lg text-primary font-bold">Competitor Benchmarking</h2>
          <p className="text-on-surface-variant font-body-md">Benchmark financial indexes and strategic alignments against market rivals.</p>
        </div>
        <button 
          className="bg-primary text-on-primary hover:brightness-110 font-bold text-body-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all"
          onClick={runAnalysis}
          disabled={loading || !companyName}
        >
          <Globe size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Gathering Intelligence...' : 'Benchmark Competitors'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-32 bg-surface-container border border-outline-variant rounded-xl">
          <div className="w-8 h-8 border-4 border-white/5 border-t-primary rounded-full animate-spin"></div>
          <p className="text-body-sm text-on-surface-variant">Scanning market databases, news feeds, and competitor filings...</p>
        </div>
      ) : competitors.length === 0 ? (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center flex flex-col items-center gap-4">
          <Scale size={42} className="text-muted" />
          <p className="text-on-surface-variant text-body-md">Click "Benchmark Competitors" to run live web search and SLM extraction for {companyName}.</p>
          {error && <p className="text-critical text-body-sm">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6 animate-fade">
          {/* Comparison Matrix Table */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Financial Benchmarking Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-label-caps text-on-surface-variant">
                    <th className="px-5 py-3 font-normal">Company</th>
                    <th className="px-5 py-3 font-normal">Revenue</th>
                    <th className="px-5 py-3 font-normal">YoY Growth</th>
                    <th className="px-5 py-3 font-normal">Gross Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-outline-variant/30 bg-primary/5">
                    <td className="px-5 py-4 font-bold text-primary">{companyName} (Target)</td>
                    <td className="px-5 py-4 text-on-surface-variant" colSpan={3}>Metrics sourced from uploaded filing analysis</td>
                  </tr>
                  {competitors.map((comp, idx) => (
                    <tr key={idx} className="border-b border-outline-variant/10 hover:bg-surface-container-highest transition-colors">
                      <td className="px-5 py-4 font-semibold text-on-surface">{comp.name}</td>
                      <td className="px-5 py-4 font-data-mono text-on-surface-variant">{comp.revenue}</td>
                      <td className="px-5 py-4 font-data-mono text-on-surface-variant">{comp.growth}</td>
                      <td className="px-5 py-4 font-data-mono text-on-surface-variant">{comp.margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Competitor initiatives cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {competitors.map((comp, idx) => (
              <div key={idx} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:bg-surface-container-high transition-colors">
                <div className="flex justify-between items-center mb-4 border-b border-outline-variant/30 pb-2">
                  <h4 className="font-headline-md text-headline-md font-bold text-primary">{comp.name}</h4>
                  <span className="w-2.5 h-2.5 bg-secondary rounded-full"></span>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-label-caps text-secondary font-bold uppercase block mb-1">Strategic Initiatives</span>
                    <p className="text-body-sm text-on-surface-variant leading-relaxed">{comp.initiatives}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-label-caps text-critical font-bold uppercase block mb-1">Core Risks</span>
                    <p className="text-body-sm text-on-surface-variant leading-relaxed">{comp.risks}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-outline font-body-sm italic">
            * All data is extracted and summarized dynamically from RAG indexes and DuckDuckGo web results. Estimates are marked with an asterisk (*).
          </div>
        </div>
      )}
    </div>
  );
};
