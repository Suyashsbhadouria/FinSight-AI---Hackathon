import { useState, useEffect } from 'react';

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
  const highCount = risks.filter((r) => r.severity >= 5 && r.severity < 8).length;
  const mediumCount = risks.filter((r) => r.severity < 5).length;
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
    if (severity >= 8) return 'bg-critical/10 text-critical border-critical/20';
    if (severity >= 5) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-positive/10 text-positive border-positive/20';
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4 bg-surface-container border border-outline-variant p-4 rounded-xl flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-headline-md text-headline-md text-primary font-bold">{doc.company_name}</h2>
              <span className="px-2 py-0.5 bg-positive/10 text-positive text-[10px] font-bold border border-positive/20 rounded uppercase">Processed</span>
            </div>
            <div className="space-y-3 font-body-sm text-on-surface-variant">
              <div className="flex justify-between border-b border-outline-variant/30 pb-2">
                <span>Sections Indexed</span>
                <span className="font-data-mono text-on-surface font-semibold">{doc.sections.length}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/30 pb-2">
                <span>Filing Scope</span>
                <span className="font-data-mono text-on-surface font-semibold">{doc.total_pages} Pages</span>
              </div>
              <div className="flex justify-between">
                <span>Document ID</span>
                <span className="font-data-mono text-on-surface font-semibold truncate max-w-[180px]">{doc.filename}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onNavigate('upload')}
              className="flex-1 py-2 border border-outline-variant rounded-lg text-body-sm hover:bg-surface-container-highest transition-colors text-on-surface"
            >
              Replace Filing
            </button>
            <button
              onClick={() => onNavigate('explorer')}
              className="flex-1 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-body-sm font-bold"
            >
              Explore Sections
            </button>
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 glass-purple border border-white/5 p-6 rounded-xl flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            <h3 className="font-headline-md text-headline-md font-bold text-secondary">AI Executive Summary</h3>
          </div>
          <p className="text-lg text-on-surface leading-relaxed mb-6 font-semibold">{summaryText}</p>
          {topRisk && (
            <div className="flex gap-6 mt-auto">
              <div className="flex items-center gap-2">
                <div className="w-1 h-8 bg-warning rounded-full"></div>
                <div>
                  <div className="text-[9px] font-label-caps text-warning font-bold">PRIMARY CONCERN</div>
                  <div className="text-body-sm font-bold text-on-surface">{topRisk.title}</div>
                </div>
              </div>
              {secondRisk && (
                <div className="flex items-center gap-2">
                  <div className="w-1 h-8 bg-critical rounded-full"></div>
                  <div>
                    <div className="text-[9px] font-label-caps text-critical font-bold">SECONDARY RISK</div>
                    <div className="text-body-sm font-bold text-on-surface">{secondRisk.title}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
          <div className="text-[10px] font-label-caps text-on-surface-variant mb-1 font-bold">RISKS EXTRACTED</div>
          <div className="text-xl lg:text-2xl font-bold font-data-mono text-on-surface">{risks.length}</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
          <div className="text-[10px] font-label-caps text-on-surface-variant mb-1 font-bold">AVG SEVERITY</div>
          <div className="text-xl lg:text-2xl font-bold font-data-mono text-on-surface">{avgSeverity}</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
          <div className="text-[10px] font-label-caps text-on-surface-variant mb-1 font-bold">CRITICAL ITEMS</div>
          <div className="text-xl lg:text-2xl font-bold font-data-mono text-critical">{criticalCount}</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
          <div className="text-[10px] font-label-caps text-on-surface-variant mb-1 font-bold">SECTIONS AVAILABLE</div>
          <div className="text-xl lg:text-2xl font-bold font-data-mono text-on-surface">{doc.sections.length}</div>
        </div>
      </div>

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-warning text-body-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-5 bg-surface-container border border-outline-variant p-5 rounded-xl">
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-6">Risk Distribution Profile</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-surface-container-low border border-outline-variant/30 font-data-mono">
              <div className="text-critical font-bold text-sm">{criticalCount}</div>
              <div className="text-[10px] text-on-surface-variant font-semibold">Critical</div>
            </div>
            <div className="text-center p-2 rounded bg-surface-container-low border border-outline-variant/30 font-data-mono">
              <div className="text-warning font-bold text-sm">{highCount}</div>
              <div className="text-[10px] text-on-surface-variant font-semibold">High</div>
            </div>
            <div className="text-center p-2 rounded bg-surface-container-low border border-outline-variant/30 font-data-mono">
              <div className="text-on-surface font-bold text-sm">{mediumCount}</div>
              <div className="text-[10px] text-on-surface-variant font-semibold">Medium</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Key Risk Factors Identified</h3>
            <button onClick={() => onNavigate('risks')} className="text-primary text-body-sm font-bold">
              Full Matrix
            </button>
          </div>
          <div className="flex-1">
            {loading ? (
              <p className="p-8 text-on-surface-variant text-body-sm">Loading extracted risks...</p>
            ) : risks.length === 0 ? (
              <p className="p-8 text-on-surface-variant text-body-sm">No risks extracted yet for this filing.</p>
            ) : (
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-label-caps text-on-surface-variant">
                    <th className="px-5 py-3 font-normal">Risk</th>
                    <th className="px-5 py-3 font-normal">Description</th>
                    <th className="px-5 py-3 font-normal">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface-variant">
                  {risks.slice(0, 5).map((risk, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-highest/20">
                      <td className="px-5 py-4 font-bold text-on-surface">{risk.title}</td>
                      <td className="px-5 py-4">{risk.description}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 border rounded font-bold text-[9px] uppercase ${severityClass(risk.severity)}`}>
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
      </div>

      {topRisk && (
        <div className="bg-surface-container border border-outline-variant p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary">chat_bubble</span>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Suggested Analyst Questions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('assistant')}
              className="p-4 bg-background-deep border border-outline-variant rounded-lg hover:border-primary transition-colors cursor-pointer"
            >
              <div className="text-label-caps font-label-caps text-primary mb-1">TOP RISK</div>
              <div className="text-body-md text-on-surface font-semibold mb-2">
                "Explain the impact of {topRisk.title.toLowerCase()} on operations."
              </div>
            </div>
            {secondRisk && (
              <div
                onClick={() => onNavigate('assistant')}
                className="p-4 bg-background-deep border border-outline-variant rounded-lg hover:border-primary transition-colors cursor-pointer"
              >
                <div className="text-label-caps font-label-caps text-primary mb-1">FOLLOW-UP</div>
                <div className="text-body-md text-on-surface font-semibold mb-2">
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
    <div className="p-6 max-w-3xl mx-auto mt-24 text-center space-y-6 animate-fade">
      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-3xl">upload_file</span>
      </div>
      <h2 className="text-headline-lg font-bold text-on-surface">No Filing Loaded</h2>
      <p className="text-on-surface-variant text-body-md">
        Upload a SEC 10-K or 10-Q PDF to begin risk analysis, document exploration, and AI-assisted research.
      </p>
      <button
        onClick={() => onNavigate('upload')}
        className="px-6 py-3 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 transition-all"
      >
        Ingest Filing
      </button>
    </div>
  );
}
