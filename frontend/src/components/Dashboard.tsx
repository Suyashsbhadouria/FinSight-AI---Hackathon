import { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  BookOpen, 
  Activity, 
  Calendar, 
  MessageSquare,
  Upload,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface DocumentDetails {
  filename: string;
  company_name: string;
  total_pages: number;
  sections: string[];
}

interface Risk {
  title: string;
  description: string;
  severity: number;
  evidence: string;
  location: string;
}

interface DashboardProps {
  doc: DocumentDetails;
  onNavigate: (tab: 'explorer' | 'risks' | 'assistant' | 'upload') => void;
}

export function Dashboard({ doc, onNavigate }: DashboardProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/risks');
        if (response.ok) {
          const data = await response.json();
          setRisks(data.risks || []);
        } else {
          const err = await response.json();
          setError(err.detail || 'Risk extraction unavailable for this filing.');
          setRisks([]);
        }
      } catch {
        setError('Failed to load risk analysis from the server.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [doc.filename]);

  const criticalCount = risks.filter((r) => r.severity >= 8).length;
  const avgSeverity = risks.length
    ? (risks.reduce((sum, r) => sum + Number(r.severity), 0) / risks.length).toFixed(1)
    : '—';
  const topRisk = risks.length
    ? [...risks].sort((a, b) => b.severity - a.severity)[0]
    : null;
  const secondRisk = risks.length > 1
    ? [...risks].sort((a, b) => b.severity - a.severity)[1]
    : null;

  const summaryText = topRisk
    ? `${doc.company_name} filing analysis highlights "${topRisk.title}" as the primary concern (${topRisk.severity}/10 severity). ${topRisk.description}`
    : loading
    ? 'Generating executive summary from uploaded filing...'
    : 'Upload a filing with risk disclosures to generate an AI executive summary.';

  const severityLabel = (severity: number) => {
    if (severity >= 8) return 'Critical';
    if (severity >= 5) return 'High';
    return 'Medium';
  };

  const severityClass = (severity: number) => {
    if (severity >= 8) return 'bg-vivid-red/10 text-vivid-red border-vivid-red/20';
    if (severity >= 5) return 'bg-burnt-orange/10 text-burnt-orange border-burnt-orange/20';
    return 'bg-primary-plum/30 text-text-light border-primary-plum/40';
  };

  // Static activity logs to simulate feed
  const recentActivities = [
    { text: "Successfully completed map-reduce scanning", time: "2 mins ago", color: "bg-burnt-orange" },
    { text: "Extracted 5 key business risks with LLM", time: "10 mins ago", color: "bg-vivid-red" },
    { text: "Competitor analysis fetched for peer group", time: "1 hr ago", color: "bg-brand-crimson" },
    { text: "Initial SEC filing ingestion parsed successfully", time: "2 hrs ago", color: "bg-primary-plum" }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-stagger-1 font-sans-brand">
      {/* Header bar */}
      <div className="flex justify-between items-center pb-4 border-b border-border-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">ANALYTICS ENGINE</span>
          <h1 className="text-3xl font-serif-display text-text-light font-bold mt-1">Filing Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card-bg px-3 py-1.5 rounded-full border border-border-divider text-xs text-text-muted">
            <Calendar size={13} className="text-burnt-orange" />
            <span>June 2026</span>
          </div>
        </div>
      </div>

      {/* Hero & Executive Summary - Asymmetric 12-column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Card: 4 Columns (Metadata) */}
        <div className="col-span-12 md:col-span-4 glass-panel p-5 rounded-xl flex flex-col justify-between min-h-[240px]">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-serif-display text-xl text-text-light font-bold leading-tight">{doc.company_name}</h2>
              <span className="px-2 py-0.5 bg-primary-plum/40 text-text-light text-[9px] font-bold border border-vivid-red/30 rounded uppercase tracking-wider">Indexed</span>
            </div>
            
            <div className="space-y-3 font-sans-brand text-xs text-text-muted">
              <div className="flex justify-between border-b border-border-divider pb-2">
                <span>Sections Partitioned</span>
                <span className="font-data-mono text-text-light font-semibold">{doc.sections.length}</span>
              </div>
              <div className="flex justify-between border-b border-border-divider pb-2">
                <span>Filing Scope</span>
                <span className="font-data-mono text-text-light font-semibold">{doc.total_pages} Pages</span>
              </div>
              <div className="flex justify-between">
                <span>Filing Source</span>
                <span className="font-data-mono text-burnt-orange font-semibold truncate max-w-[170px]" title={doc.filename}>{doc.filename}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => onNavigate('upload')}
              className="flex-1 py-2 border border-border-divider rounded text-xs hover:bg-primary-plum/30 transition-all text-text-light"
            >
              Ingest New
            </button>
            <button
              onClick={() => onNavigate('explorer')}
              className="flex-1 py-2 bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light rounded text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1"
            >
              <span>Explore</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Right Card: 8 Columns (AI Executive Summary) */}
        <div className="col-span-12 md:col-span-8 glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[240px] relative overflow-hidden">
          {/* Subtle decoration gradient glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-vivid-red/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-burnt-orange" />
            <h3 className="font-serif-display text-lg font-bold text-text-light">AI Executive Summary</h3>
          </div>
          
          <p className="text-base text-text-light leading-relaxed mb-6 font-serif-body">{summaryText}</p>
          
          {topRisk && (
            <div className="flex flex-wrap gap-6 mt-auto pt-4 border-t border-border-divider/50">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-8 bg-burnt-orange rounded-full"></div>
                <div>
                  <div className="text-[9px] font-bold text-burnt-orange uppercase tracking-wider">PRIMARY CONCERN</div>
                  <div className="text-xs font-bold text-text-light">{topRisk.title}</div>
                </div>
              </div>
              {secondRisk && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-8 bg-vivid-red rounded-full"></div>
                  <div>
                    <div className="text-[9px] font-bold text-vivid-red uppercase tracking-wider">SECONDARY RISK</div>
                    <div className="text-xs font-bold text-text-light">{secondRisk.title}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row - 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Risks Extracted</span>
            <div className="w-6 h-6 rounded bg-vivid-red/15 flex items-center justify-center text-vivid-red">
              <AlertOctagon size={12} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-4xl font-serif-display text-text-light font-bold">{risks.length}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-20 h-6">
              <svg className="w-full h-full" viewBox="0 0 100 30">
                <path d="M0,25 Q15,10 30,22 T60,8 T90,20 T100,5" fill="none" stroke="#FF5733" strokeWidth="1.5"></path>
              </svg>
            </div>
            <span className="text-[10px] text-burnt-orange font-bold font-data-mono">Active Scan</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Avg Severity</span>
            <div className="w-6 h-6 rounded bg-vivid-red/15 flex items-center justify-center text-burnt-orange">
              <Activity size={12} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-4xl font-serif-display text-text-light font-bold">{avgSeverity}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-20 h-6">
              <svg className="w-full h-full" viewBox="0 0 100 30">
                <path d="M0,15 Q20,25 40,10 T80,18 T100,8" fill="none" stroke="#FF5733" strokeWidth="1.5"></path>
              </svg>
            </div>
            <span className="text-[10px] text-text-muted font-bold font-data-mono">Scale 1-10</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Critical Items</span>
            <div className="w-6 h-6 rounded bg-vivid-red/15 flex items-center justify-center text-vivid-red">
              <ShieldAlert size={12} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-4xl font-serif-display text-vivid-red font-bold">{criticalCount}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-20 h-6">
              <svg className="w-full h-full" viewBox="0 0 100 30">
                <path d="M0,28 L20,28 L40,15 L60,15 L80,5 L100,5" fill="none" stroke="#C70039" strokeWidth="1.5"></path>
              </svg>
            </div>
            <span className="text-[10px] text-vivid-red font-bold font-data-mono">High Risk</span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Sections Scanned</span>
            <div className="w-6 h-6 rounded bg-vivid-red/15 flex items-center justify-center text-text-muted">
              <BookOpen size={12} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-4xl font-serif-display text-text-light font-bold">{doc.sections.length}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-20 h-6">
              <svg className="w-full h-full" viewBox="0 0 100 30">
                <rect x="0" y="22" width="12" height="8" fill="#FF5733" opacity="0.4" />
                <rect x="18" y="15" width="12" height="15" fill="#FF5733" opacity="0.6" />
                <rect x="36" y="8" width="12" height="22" fill="#FF5733" opacity="0.8" />
                <rect x="54" y="18" width="12" height="12" fill="#FF5733" />
                <rect x="72" y="5" width="12" height="25" fill="#C70039" />
                <rect x="90" y="10" width="12" height="20" fill="#C70039" />
              </svg>
            </div>
            <span className="text-[10px] text-text-muted font-bold font-data-mono">100% Ingestion</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-brand-crimson/20 border border-vivid-red/30 rounded-xl p-4 text-burnt-orange text-xs">
          {error}
        </div>
      )}

      {/* Main Analysis Section: Charts & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: 7 Columns (Risk Matrix & Table) */}
        <div className="lg:col-span-7 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border-divider flex justify-between items-center bg-near-black/50">
            <h3 className="font-serif-display text-base font-bold text-text-light">Key Risk Disclosures</h3>
            <button 
              onClick={() => onNavigate('risks')}
              className="text-burnt-orange hover:text-text-light text-xs font-bold transition-colors"
            >
              Analyze Full Matrix
            </button>
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar">
            {loading ? (
              <p className="p-8 text-text-muted text-xs">Loading extracted risks...</p>
            ) : risks.length === 0 ? (
              <p className="p-8 text-text-muted text-xs">No risks extracted yet for this filing.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-divider/50 text-[10px] uppercase tracking-wider text-text-muted bg-primary-plum/10">
                    <th className="px-5 py-3 font-bold">Filing Risk Factor</th>
                    <th className="px-5 py-3 font-bold">Impact Summary</th>
                    <th className="px-5 py-3 font-bold text-center">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-divider/30 text-text-muted">
                  {risks.slice(0, 4).map((risk, idx) => (
                    <tr key={idx} className="hover:bg-primary-plum/10 transition-colors">
                      <td className="px-5 py-4 font-bold text-text-light whitespace-nowrap max-w-[160px] truncate">{risk.title}</td>
                      <td className="px-5 py-4 line-clamp-2 mt-2 max-w-[280px]">{risk.description}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 border rounded-full font-bold text-[9px] uppercase tracking-wider ${severityClass(risk.severity)}`}>
                          {severityLabel(risk.severity)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: 5 Columns (Recent Activity Feed) */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-serif-display text-base font-bold text-text-light mb-4 pb-2 border-b border-border-divider">Recent Activity Feed</h3>
            <div className="space-y-4">
              {recentActivities.map((act, index) => (
                <div 
                  key={index}
                  className="flex gap-3 items-start p-2 rounded transition-all hover:bg-brand-crimson/12 duration-200 cursor-pointer"
                >
                  <div className={`w-2 h-2 rounded-full ${act.color} mt-1.5 shrink-0`}></div>
                  <div className="flex-1">
                    <p className="text-xs text-text-light font-bold leading-tight">{act.text}</p>
                    <span className="text-[10px] text-text-muted mt-1 block">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-border-divider mt-4">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>System Telemetry</span>
              <span className="text-burnt-orange font-bold font-data-mono">ONLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Analyst Questions */}
      {topRisk && (
        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-burnt-orange" />
            <h3 className="font-serif-display text-base font-bold text-text-light">Suggested Analyst Queries</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('assistant')}
              className="p-4 bg-near-black/50 border border-border-divider rounded hover:border-vivid-red transition-all cursor-pointer group"
            >
              <div className="text-[9px] font-bold text-burnt-orange mb-1 uppercase tracking-widest">QUERY LEVEL 1</div>
              <div className="text-xs text-text-light font-bold mb-2 group-hover:text-burnt-orange transition-colors">
                "Explain the impact of {topRisk.title.toLowerCase()} on operations."
              </div>
            </div>
            {secondRisk && (
              <div
                onClick={() => onNavigate('assistant')}
                className="p-4 bg-near-black/50 border border-border-divider rounded hover:border-vivid-red transition-all cursor-pointer group"
              >
                <div className="text-[9px] font-bold text-vivid-red mb-1 uppercase tracking-widest">QUERY LEVEL 2</div>
                <div className="text-xs text-text-light font-bold mb-2 group-hover:text-vivid-red transition-colors">
                  "What mitigations are disclosed for {secondRisk.title.toLowerCase()}?"
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmptyDashboard({ onNavigate }: { onNavigate: (tab: 'upload') => void }) {
  return (
    <div className="p-8 max-w-lg mx-auto mt-24 text-center space-y-6 glass-panel rounded-xl py-12">
      <div className="w-16 h-16 mx-auto rounded-full bg-primary-plum/30 flex items-center justify-center text-burnt-orange border border-vivid-red/30">
        <Upload size={24} />
      </div>
      <h2 className="text-xl font-serif-display font-bold text-text-light">No SEC Filing Loaded</h2>
      <p className="text-text-muted text-xs leading-relaxed max-w-sm mx-auto">
        Ingest a company 10-K or 10-Q PDF to run semantic search pipelines, Map-Reduce workloads, and automated risk profiling.
      </p>
      <button
        onClick={() => onNavigate('upload')}
        className="px-6 py-2.5 bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light rounded font-bold hover:brightness-110 transition-all text-xs"
      >
        Ingest Document
      </button>
    </div>
  );
}
