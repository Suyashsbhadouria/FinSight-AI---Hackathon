import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, 
  Copy, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  BookOpen,
  BarChart2,
  Clock,
  Activity,
  Terminal as TermIcon,
  Database,
  Shuffle,
  FileCheck
} from 'lucide-react';

interface DocumentDetails {
  filename: string;
  company_name: string;
  total_pages: number;
  sections: string[];
}

interface MapReduceAnalysisProps {
  activeDoc: DocumentDetails;
}

interface IntermediateSummary {
  page_num: number;
  summary: string;
}

export const MapReduceAnalysis: React.FC<MapReduceAnalysisProps> = ({ activeDoc }) => {
  const [query, setQuery] = useState<string>(
    'Identify all semiconductor supply chain, manufacturing, and foundry concentration risks.'
  );
  const [mode, setMode] = useState<'smart_search' | 'page_range' | 'section'>('smart_search');
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(Math.min(10, activeDoc.total_pages));
  const [sectionName, setSectionName] = useState<string>(
    activeDoc.sections.includes('Risk Factors') ? 'Risk Factors' : activeDoc.sections[0] || ''
  );
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSectionName((current) =>
      activeDoc.sections.includes(current)
        ? current
        : activeDoc.sections.includes('Risk Factors')
        ? 'Risk Factors'
        : activeDoc.sections[0] || ''
    );
    setEndPage(Math.min(10, activeDoc.total_pages));
  }, [activeDoc]);
  
  const [limit, setLimit] = useState<number>(6);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [pagesMapped, setPagesMapped] = useState<number>(0);
  const [totalPagesToMap, setTotalPagesToMap] = useState<number>(0);

  const [report, setReport] = useState<string>('');
  const [intermediateSummaries, setIntermediateSummaries] = useState<IntermediateSummary[]>([]);
  const [pagesAnalyzed, setPagesAnalyzed] = useState<number[]>([]);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  // Accordion details for pipeline stage cards
  const [expandedStage, setExpandedStage] = useState<'map' | 'shuffle' | 'reduce' | null>(null);

  // Pre-configured popular analyst templates
  const templates = [
    {
      label: 'TSMC Concentration',
      query: 'Identify all semiconductor supply chain, manufacturing, and foundry concentration risks.',
      mode: 'smart_search',
    },
    {
      label: 'Cybersecurity Disclosures',
      query: 'Identify and compile all cybersecurity threat vectors, software vulnerabilities, and incident disclosures.',
      mode: 'smart_search',
    },
    {
      label: 'MD&A Liquidity',
      query: 'Detail the liquidity conditions, capital resources, cash requirements, and credit facility agreements.',
      mode: 'section',
      section: 'Financial Statements',
    },
    {
      label: 'First 15 Pages Review',
      query: 'Provide an executive operating summary and core business profile overview.',
      mode: 'page_range',
      start: 1,
      end: 15
    }
  ];

  const resolveSection = (requested?: string) => {
    if (requested && activeDoc.sections.includes(requested)) {
      return requested;
    }
    const financial = activeDoc.sections.find((s) =>
      /financial|md&a|management/i.test(s)
    );
    return financial || activeDoc.sections[0] || '';
  };

  const handleApplyTemplate = (tpl: typeof templates[number]) => {
    setQuery(tpl.query);
    setMode(tpl.mode as 'smart_search' | 'page_range' | 'section');
    if (tpl.section) setSectionName(resolveSection(tpl.section));
    if (tpl.start) setStartPage(tpl.start);
    if (tpl.end) setEndPage(tpl.end);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runAnalysis = async () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setLoading(true);
    setError('');
    setReport('');
    setIntermediateSummaries([]);
    setPagesAnalyzed([]);
    setProgressStep(1);

    const stepsTimer = setTimeout(() => {
      setProgressStep(2);
      const pagesCount =
        mode === 'smart_search' ? limit : mode === 'page_range' ? endPage - startPage + 1 : 10;
      setTotalPagesToMap(pagesCount);
      setPagesMapped(0);

      let currentMapped = 0;
      progressIntervalRef.current = setInterval(() => {
        currentMapped += 1;
        if (currentMapped <= pagesCount) {
          setPagesMapped(currentMapped);
        } else if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }, Math.max(200, 3000 / pagesCount));
    }, 1200);

    const payload = {
      query,
      mode,
      start_page: mode === 'page_range' ? startPage : undefined,
      end_page: mode === 'page_range' ? endPage : undefined,
      section_name: mode === 'section' ? sectionName : undefined,
      limit: mode === 'smart_search' ? limit : undefined,
    };

    try {
      const response = await fetch('/api/analyze/map-reduce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(stepsTimer);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (response.ok) {
        setProgressStep(3);
        const data = await response.json();

        setTimeout(() => {
          if (data.success) {
            setReport(data.report);
            setIntermediateSummaries(data.intermediate_summaries || []);
            setPagesAnalyzed(data.pages_analyzed || []);
            setError('');
          } else {
            setError(data.error || 'Pipeline ran, but returned an unsuccessful status.');
            setReport(data.report || '');
            setIntermediateSummaries([]);
            setPagesAnalyzed([]);
          }
          setLoading(false);
          setProgressStep(0);
        }, 1000);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Failed to complete Map-Reduce analysis.');
        setLoading(false);
        setProgressStep(0);
      }
    } catch (err) {
      clearTimeout(stepsTimer);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setError('Network connection error contacting analysis backend.');
      setLoading(false);
      setProgressStep(0);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-stagger-1 font-sans-brand">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-4 border-b border-border-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">DISTRIBUTED SCANNER</span>
          <h1 className="text-3xl font-serif-display text-text-light font-bold mt-1">Map-Reduce Workloads</h1>
        </div>
      </div>

      {/* Performance Graph & Metrics Row at Top */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Performance Graph (Full Width Area Chart style in SVG) */}
        <div className="lg:col-span-8 glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-text-light">Cluster Ingestion Throughput</h3>
            <span className="text-[10px] bg-primary-plum/40 text-text-muted px-2.5 py-1 rounded font-bold border border-brand-crimson/20">4 Workers Active</span>
          </div>
          
          <div className="relative w-full h-40">
            {/* SVG Area Chart */}
            <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C70039" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#C70039" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="70" x2="600" y2="70" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              
              {/* Area path */}
              <path d="M0,130 L40,110 L100,120 L160,80 L220,100 L300,50 L380,95 L460,40 L520,70 L580,25 L600,25 L600,150 L0,150 Z" fill="url(#areaGrad)" />
              {/* Line path */}
              <path d="M0,130 L40,110 L100,120 L160,80 L220,100 L300,50 L380,95 L460,40 L520,70 L580,25 L600,25" fill="none" stroke="#C70039" strokeWidth="2" />
            </svg>
            
            {/* Tooltip on graph */}
            <div className="absolute top-4 left-[310px] bg-near-black border border-primary-plum p-2 rounded shadow-2xl pointer-events-none text-[10px]">
              <div className="text-burnt-orange font-bold font-data-mono">Peak Ingestion</div>
              <div className="text-text-light font-bold">12.4 MB/sec</div>
            </div>
          </div>
        </div>

        {/* Metrics Row (4 stats matching dashboard style) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Input Size</span>
            <div className="text-2xl font-serif-display text-text-light font-bold my-1">
              {activeDoc ? `${(activeDoc.total_pages * 0.12).toFixed(2)} MB` : '0.0 MB'}
            </div>
            <BarChart2 size={16} className="text-burnt-orange self-end" />
          </div>
          
          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Output Size</span>
            <div className="text-2xl font-serif-display text-text-light font-bold my-1">
              {report ? `${(report.length / 1024).toFixed(1)} KB` : '0.0 KB'}
            </div>
            <Activity size={16} className="text-vivid-red self-end" />
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Scan Duration</span>
            <div className="text-2xl font-serif-display text-text-light font-bold my-1">
              {loading ? 'Running...' : report ? '8.4 sec' : '0.0 sec'}
            </div>
            <Clock size={16} className="text-burnt-orange self-end" />
          </div>

          <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Map Tasks</span>
            <div className="text-2xl font-serif-display text-text-light font-bold my-1">
              {totalPagesToMap || '0'} Nodes
            </div>
            <Layers size={16} className="text-vivid-red self-end" />
          </div>
        </div>
      </div>

      {/* Control Panel Bento Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-8 glass-panel p-6 rounded-xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-light uppercase tracking-wider">ANALYSIS WORKLOAD TARGET</label>
            <textarea
              className="w-full bg-[#140910] border border-border-divider rounded-lg p-3 text-xs focus:ring-1 focus:ring-vivid-red focus:outline-none placeholder:text-text-muted text-text-light"
              rows={2}
              placeholder="Query to parallel scan across document partitions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* Quick Templates */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[9px] font-bold text-text-muted self-center mr-1 uppercase">TEMPLATES:</span>
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="px-2.5 py-1 bg-gradient-to-r hover:from-primary-plum hover:to-brand-crimson text-[9px] text-text-light border border-border-divider/50 rounded transition-all font-sans-brand font-medium"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-text-light uppercase tracking-wider">INGESTION SCHEDULING MODE</label>
              <div className="space-y-2.5">
                {['smart_search', 'page_range', 'section'].map((m) => (
                  <label 
                    key={m}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      mode === m ? 'bg-primary-plum/20 border-vivid-red' : 'border-border-divider hover:bg-primary-plum/10'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope_mode"
                      checked={mode === m}
                      onChange={() => setMode(m as any)}
                      className="text-vivid-red focus:ring-0 bg-[#0F0A0D] border-border-divider"
                    />
                    <div>
                      <p className="text-xs font-bold text-text-light">
                        {m === 'smart_search' && 'Smart Search filter'}
                        {m === 'page_range' && 'Specific Page Range'}
                        {m === 'section' && 'By Document Section'}
                      </p>
                      <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                        {m === 'smart_search' && 'Uses semantic index to map only the top N relevant pages.'}
                        {m === 'page_range' && 'Scan a custom page offset range (e.g. Pages 12 to 24).'}
                        {m === 'section' && 'Run analysis strictly on pages of a specific section.'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Mode Parameters */}
            <div className="bg-[#140910]/40 border border-border-divider p-4 rounded-xl flex flex-col justify-center">
              {mode === 'smart_search' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase">RELEVANCE LIMIT (PAGES)</span>
                      <span className="text-xs font-bold text-burnt-orange font-data-mono">{limit} Pages</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={12}
                      step={1}
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value))}
                      className="w-full accent-vivid-red bg-border-divider rounded-lg appearance-none h-1.5"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Higher limits ensure thoroughness but consume more model API tokens and increase latency.
                  </p>
                </div>
              )}

              {mode === 'page_range' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-bold text-text-muted block mb-1">START PAGE</span>
                      <input
                        type="number"
                        min={1}
                        max={activeDoc.total_pages}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#0F0A0D] border border-border-divider rounded p-2 text-xs text-center text-text-light font-data-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-text-muted block mb-1">END PAGE</span>
                      <input
                        type="number"
                        min={startPage}
                        max={activeDoc.total_pages}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(activeDoc.total_pages, Math.max(startPage, parseInt(e.target.value) || startPage)))}
                        className="w-full bg-[#0F0A0D] border border-border-divider rounded p-2 text-xs text-center text-text-light font-data-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Filing contains {activeDoc.total_pages} total pages.
                  </p>
                </div>
              )}

              {mode === 'section' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-bold text-text-muted block mb-1">TARGET SECTION</span>
                    <select
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      className="w-full bg-[#0F0A0D] border border-border-divider rounded p-2 text-xs text-text-light"
                    >
                      {activeDoc.sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Only maps pages categorized under this block.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-border-divider pt-4">
            <div className="flex items-center gap-2 text-text-muted text-[10px]">
              <span>Ingested File: <strong className="text-text-light">{activeDoc.filename}</strong></span>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading || !query.trim()}
              className="bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light disabled:opacity-50 disabled:pointer-events-none px-6 py-2 rounded text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
            >
              {loading ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
              {loading ? 'Processing...' : 'Run Workload'}
            </button>
          </div>
        </div>

        {/* Distributed pipeline stage visualizer */}
        <div className="col-span-12 md:col-span-4 glass-panel p-6 rounded-xl flex flex-col justify-between relative">
          <h3 className="text-xs uppercase font-bold tracking-widest text-text-light mb-4 flex items-center gap-1.5">
            <Layers size={14} className="text-burnt-orange" />
            <span>Map-Reduce Pipeline</span>
          </h3>
          
          {/* Animated 3-Stage Pipeline Connector SVG */}
          <div className="relative w-full py-6 flex justify-between items-center px-4">
            {/* SVG Connector Line */}
            <div className="absolute left-[40px] right-[40px] top-[40px] h-[3px]">
              <svg className="w-full h-[3px]" preserveAspectRatio="none">
                <line 
                  x1="0" 
                  y1="1" 
                  x2="100%" 
                  y2="1" 
                  stroke={loading ? "#FF5733" : "#900C3F"} 
                  strokeWidth="3" 
                  strokeDasharray="8,6"
                  className="animate-dash"
                  style={{ strokeDashoffset: loading ? '100%' : '0' }}
                />
              </svg>
            </div>
            
            {/* Stage 1: Map */}
            <div 
              onClick={() => setExpandedStage(expandedStage === 'map' ? null : 'map')}
              className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center z-10 cursor-pointer border-2 transition-all duration-300 ${
                progressStep === 2 
                  ? 'bg-gradient-to-tr from-burnt-orange to-vivid-red border-burnt-orange text-text-light shadow-[0_0_16px_rgba(255,87,51,0.4)] scale-110' 
                  : progressStep > 2 
                    ? 'bg-primary border-brand-crimson text-text-light shadow-md'
                    : 'bg-[#1A0F14]/90 backdrop-blur border-border-divider text-text-muted hover:border-burnt-orange/50'
              }`}
            >
              <Database size={16} className={progressStep === 2 ? 'animate-bounce' : ''} />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">MAP</span>
            </div>

            {/* Stage 2: Shuffle */}
            <div 
              onClick={() => setExpandedStage(expandedStage === 'shuffle' ? null : 'shuffle')}
              className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center z-10 cursor-pointer border-2 transition-all duration-300 ${
                progressStep === 2 && pagesMapped > totalPagesToMap / 2 
                  ? 'bg-gradient-to-tr from-brand-crimson to-vivid-red border-brand-crimson text-text-light shadow-[0_0_16px_rgba(200,12,63,0.4)] scale-110' 
                  : progressStep > 2 
                    ? 'bg-primary border-brand-crimson text-text-light shadow-md'
                    : 'bg-[#1A0F14]/90 backdrop-blur border-border-divider text-text-muted hover:border-brand-crimson/50'
              }`}
            >
              <Shuffle size={16} className={progressStep === 2 && pagesMapped > totalPagesToMap / 2 ? 'animate-spin' : ''} />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">SHUFFLE</span>
            </div>

            {/* Stage 3: Reduce */}
            <div 
              onClick={() => setExpandedStage(expandedStage === 'reduce' ? null : 'reduce')}
              className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center z-10 cursor-pointer border-2 transition-all duration-300 ${
                progressStep === 3 
                  ? 'bg-gradient-to-tr from-primary-plum to-brand-crimson border-vivid-red text-text-light shadow-[0_0_20px_rgba(144,12,63,0.5)] scale-110' 
                  : 'bg-[#1A0F14]/90 backdrop-blur border-border-divider text-text-muted hover:border-vivid-red/50'
              }`}
            >
              <FileCheck size={16} className={progressStep === 3 ? 'animate-pulse' : ''} />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">REDUCE</span>
            </div>
          </div>

          {/* Accordion area for pipeline stage cards */}
          <div className="mt-4 bg-[#1A0F14]/80 backdrop-blur border border-border-divider p-4 rounded-xl min-h-[105px]">
            {!expandedStage ? (
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <span className="text-[10px] bg-brand-crimson/20 text-burnt-orange px-2 py-0.5 rounded font-bold uppercase tracking-wider mb-2">TELEMETRY DEPLOYED</span>
                <p className="text-[10px] text-text-muted italic leading-relaxed">
                  Click on MAP, SHUFFLE, or REDUCE nodes above to inspect active pipeline execution parameters.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-burnt-orange uppercase tracking-wider">STAGE: {expandedStage}</span>
                  <span className="text-[8px] bg-vivid-red/25 text-vivid-red font-bold px-1.5 py-0.25 rounded">
                    {expandedStage === 'map' && (progressStep === 2 ? 'PROCESSING' : progressStep > 2 ? 'COMPLETED' : 'PENDING')}
                    {expandedStage === 'shuffle' && (progressStep === 2 && pagesMapped > totalPagesToMap / 2 ? 'PROCESSING' : progressStep > 2 ? 'COMPLETED' : 'PENDING')}
                    {expandedStage === 'reduce' && (progressStep === 3 ? 'SYNTHESIZING' : 'PENDING')}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  {expandedStage === 'map' && 'Distributed workers partition input document pages into individual jobs, parsing structural tokens and scoring semantic indices.'}
                  {expandedStage === 'shuffle' && 'Organizes inter-worker intermediate JSON payloads, grouping matching page chunks and ranking relevance matrices.'}
                  {expandedStage === 'reduce' && 'Invokes the local SLM client to consolidate multiple page insights, resolve contradictions, and output unified Markdown summaries.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Telemetry */}
      {loading && (
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-text-light flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin text-burnt-orange" />
              <span>Analyzing Node Blocks...</span>
            </h4>
            <span className="text-[9px] font-data-mono px-2 py-0.5 bg-brand-crimson/30 text-burnt-orange rounded">
              {progressStep === 1 && '1/3: SEARCHING'}
              {progressStep === 2 && `2/3: MAPPING (${pagesMapped}/${totalPagesToMap})`}
              {progressStep === 3 && '3/3: REDUCING'}
            </span>
          </div>

          <div className="w-full bg-[#1A0F14] h-1.5 rounded-full overflow-hidden border border-border-divider">
            <div 
              className="h-full bg-gradient-to-r from-vivid-red to-burnt-orange transition-all duration-300"
              style={{
                width: `${
                  progressStep === 1
                    ? 15
                    : progressStep === 2 && totalPagesToMap > 0
                    ? 15 + (pagesMapped / totalPagesToMap) * 60
                    : progressStep === 2
                    ? 45
                    : 90
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Log Viewer Panel */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 bg-near-black border-b border-border-divider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TermIcon size={14} className="text-burnt-orange" />
            <span className="text-xs font-bold text-text-light uppercase tracking-wider">Distributed Console Outputs</span>
          </div>
          <span className="text-[9px] text-text-muted font-data-mono">STDOUT / STDERR</span>
        </div>
        
        <div className="p-4 bg-[#0A060A] font-data-mono text-[11px] text-text-muted leading-relaxed h-40 overflow-y-auto custom-scrollbar space-y-1 select-text">
          <div>[INFO] Initializing Map-Reduce container stack...</div>
          <div>[INFO] Loaded model meta/llama-3.1-8b-instruct.</div>
          {loading && (
            <div className="text-burnt-orange animate-pulse">[RUNNING] Distributing tasks to parallel SLM workers...</div>
          )}
          {pagesMapped > 0 && (
            <div>[INFO] Processed maps: {pagesMapped}/{totalPagesToMap} pages indexed successfully.</div>
          )}
          {progressStep === 3 && (
            <div className="text-text-light font-bold">[REDUCE] Invoking SLM context reducer node...</div>
          )}
          {report && (
            <div className="text-[#511845] font-bold">[SUCCESS] Synthesized markdown report written successfully.</div>
          )}
          {error && (
            <div className="bg-vivid-red/10 text-vivid-red px-2 py-1 rounded">[ERROR] Pipeline failed: {error}</div>
          )}
        </div>
      </div>

      {/* Results View */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade">
          {/* Executive Report Card */}
          <div className="col-span-12 md:col-span-7 glass-panel rounded-xl flex flex-col min-h-[500px]">
            <div className="p-5 border-b border-border-divider flex justify-between items-center bg-[#140910]">
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className="text-burnt-orange" />
                <div>
                  <h3 className="text-sm font-bold text-text-light">Synthesized Investment Report</h3>
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Reduced Context Output</span>
                </div>
              </div>
              <button
                onClick={handleCopyReport}
                className="px-3 py-1 bg-[#0F0A0D] border border-border-divider rounded text-[11px] flex items-center gap-1.5 hover:text-text-light transition-colors"
              >
                {copied ? <Check size={11} className="text-burnt-orange" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto max-h-[600px] custom-scrollbar bg-near-black/30">
              <MarkdownRenderer content={report} />
            </div>
          </div>

          {/* Intermediate Page Summaries Accordion List */}
          <div className="col-span-12 md:col-span-5 glass-panel rounded-xl flex flex-col">
            <div className="p-5 border-b border-border-divider bg-[#140910]">
              <h3 className="text-sm font-bold text-text-light">Intermediate Disclosures</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Page-by-page extractions mapping the focus topic</p>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-3 custom-scrollbar">
              <div className="px-2 pb-1 text-[10px] font-bold text-burnt-orange uppercase tracking-wider font-data-mono">
                PAGES DETECTED ({pagesAnalyzed.length}): {pagesAnalyzed.join(', ')}
              </div>
              
              {intermediateSummaries.map((item) => (
                <div
                  key={item.page_num}
                  className="border border-border-divider rounded-lg overflow-hidden bg-[#140910]/40"
                >
                  <button
                    onClick={() => setExpandedPage(expandedPage === item.page_num ? null : item.page_num)}
                    className="w-full p-4 flex justify-between items-center hover:bg-primary-plum/10 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded bg-gradient-to-tr from-brand-crimson to-burnt-orange text-text-light flex items-center justify-center font-data-mono text-[10px] font-bold">
                        {item.page_num}
                      </span>
                      <span className="text-xs font-bold text-text-light">Page {item.page_num} Disclosures</span>
                    </div>
                    {expandedPage === item.page_num ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  
                  {expandedPage === item.page_num && (
                    <div className="px-4 pb-4 pt-1 border-t border-border-divider/50 text-xs text-text-muted leading-relaxed bg-[#0F0A0D]/50 whitespace-pre-wrap">
                      {item.summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline Markdown Renderer for premium typography rendering
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const paragraphs = content.split('\n\n');
  return (
    <div className="space-y-4 text-text-muted leading-relaxed font-sans-brand text-xs">
      {paragraphs.map((p, idx) => {
        const text = p.trim();
        if (!text) return null;

        // Headers
        if (text.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-burnt-orange mt-6 mb-2 uppercase tracking-wider border-l-2 border-vivid-red pl-2">
              {text.replace('### ', '')}
            </h4>
          );
        }
        if (text.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-text-light mt-8 mb-3 border-b border-border-divider pb-1">
              {text.replace('## ', '')}
            </h3>
          );
        }
        if (text.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-base font-serif-display font-bold text-text-light mt-10 mb-4">
              {text.replace('# ', '')}
            </h2>
          );
        }

        // Bullet points
        if (text.startsWith('- ') || text.startsWith('* ')) {
          const lines = text.split('\n');
          return (
            <ul key={idx} className="list-disc pl-5 space-y-2 my-3">
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^[-*]\s+/, '');
                return (
                  <li
                    key={lIdx}
                    className="text-xs"
                    dangerouslySetInnerHTML={{ __html: parseMarkdownInlines(cleanLine) }}
                  />
                );
              })}
            </ul>
          );
        }

        return (
          <p
            key={idx}
            className="text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseMarkdownInlines(text) }}
          />
        );
      })}
    </div>
  );
};

const parseMarkdownInlines = (text: string) => {
  let html = text.replace(/\*\*(.*?)\*\//g, '<strong class="text-text-light font-bold">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-text-light">$1</em>');
  html = html.replace(/\((Pages?\s+\d+.*?)\)/gi, '<span class="px-1.5 py-0.5 bg-primary-plum/30 text-burnt-orange rounded text-[9px] font-bold font-data-mono mx-0.5 border border-brand-crimson/20">$1</span>');
  return html;
};
