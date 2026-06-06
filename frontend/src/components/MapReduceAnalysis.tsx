import React, { useState, useEffect, useRef } from 'react';
import { Layers, Copy, Check, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Play, BookOpen } from 'lucide-react';

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
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-fade">
      {/* Page Header */}
      <div className="mb-2">
        <h2 className="text-headline-lg font-headline-lg text-primary font-bold">Document Map-Reduce Analyzer</h2>
        <p className="text-on-surface-variant font-body-md">
          Run page-by-page mapping and synthesis using SLM client pipelines to extract structured insights from lengthy filing sheets.
        </p>
      </div>

      {/* Control Panel Bento Box */}
      <div className="grid grid-cols-12 gap-gutter">
        {/* Settings Column */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container border border-outline-variant p-6 rounded-xl space-y-6">
          <div className="space-y-2">
            <label className="text-label-caps font-label-caps text-on-surface-variant">ANALYST FOCUS TOPIC / QUERY</label>
            <textarea
              className="w-full bg-background-deep border border-outline-variant rounded-lg p-3 text-body-md focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-text-muted text-on-surface"
              rows={2}
              placeholder="What specific topic, disclosure, or metric would you like to map-reduce over this document?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* Quick Templates */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant self-center mr-1">TEMPLATES:</span>
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-bright text-[10px] text-primary border border-outline-variant/30 rounded-md transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode Selector */}
            <div className="space-y-3">
              <label className="text-label-caps font-label-caps text-on-surface-variant">ANALYSIS SCOPE MODE</label>
              <div className="space-y-2.5">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="scope_mode"
                    checked={mode === 'smart_search'}
                    onChange={() => setMode('smart_search')}
                    className="text-primary focus:ring-0"
                  />
                  <div>
                    <p className="text-body-sm font-semibold text-on-surface">Smart Search Filter <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold ml-1 uppercase">Recommended</span></p>
                    <p className="text-[10px] text-on-surface-variant leading-snug">Uses semantic index to map only the top N relevant pages.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="scope_mode"
                    checked={mode === 'page_range'}
                    onChange={() => setMode('page_range')}
                    className="text-primary focus:ring-0"
                  />
                  <div>
                    <p className="text-body-sm font-semibold text-on-surface">Specific Page Range</p>
                    <p className="text-[10px] text-on-surface-variant leading-snug">Scan a custom page offset range (e.g. Pages 12 to 24).</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="scope_mode"
                    checked={mode === 'section'}
                    onChange={() => setMode('section')}
                    className="text-primary focus:ring-0"
                  />
                  <div>
                    <p className="text-body-sm font-semibold text-on-surface">By Document Section</p>
                    <p className="text-[10px] text-on-surface-variant leading-snug">Run analysis strictly on pages of a specific section (e.g. Risk Factors).</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Mode Parameters */}
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col justify-center">
              {mode === 'smart_search' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-label-caps text-on-surface-variant font-semibold">RELEVANCE LIMIT (PAGES)</span>
                      <span className="text-body-sm font-data-mono font-bold text-primary">{limit} Pages</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={12}
                      step={1}
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value))}
                      className="w-full accent-primary bg-surface-container-highest rounded-lg appearance-none h-1.5"
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant italic leading-relaxed">
                    Higher limits ensure thoroughness but consume more model API tokens and increase latency.
                  </p>
                </div>
              )}

              {mode === 'page_range' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-label-caps text-on-surface-variant block mb-1">START PAGE</span>
                      <input
                        type="number"
                        min={1}
                        max={activeDoc.total_pages}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-background-deep border border-outline-variant rounded p-2 text-body-sm text-center text-on-surface focus:ring-1 focus:ring-primary focus:outline-none font-data-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-label-caps text-on-surface-variant block mb-1">END PAGE</span>
                      <input
                        type="number"
                        min={startPage}
                        max={activeDoc.total_pages}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(activeDoc.total_pages, Math.max(startPage, parseInt(e.target.value) || startPage)))}
                        className="w-full bg-background-deep border border-outline-variant rounded p-2 text-body-sm text-center text-on-surface focus:ring-1 focus:ring-primary focus:outline-none font-data-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-on-surface-variant italic">
                    Filing contains {activeDoc.total_pages} total pages.
                  </p>
                </div>
              )}

              {mode === 'section' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-label-caps text-on-surface-variant block mb-1">TARGET SECTION</span>
                    <select
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      className="w-full bg-background-deep border border-outline-variant rounded p-2 text-body-sm text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      {activeDoc.sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-on-surface-variant italic">
                    Only maps pages containing disclosures categorized under this Item block.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-outline-variant/30 pt-4">
            <div className="flex items-center gap-2 text-on-surface-variant text-[11px]">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>Scanning document: <strong className="text-on-surface">{activeDoc.filename}</strong></span>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading || !query.trim()}
              className="bg-primary text-on-primary hover:bg-primary-fixed-dim border border-transparent disabled:opacity-50 disabled:pointer-events-none px-6 py-2.5 rounded-lg text-body-sm font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              {loading ? 'Processing Pipeline...' : 'Run Map-Reduce'}
            </button>
          </div>
        </div>

        {/* Ingestion Info Panel */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container border border-outline-variant p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-secondary font-bold mb-4 flex items-center gap-2">
              <Layers size={18} />
              Map-Reduce Details
            </h3>
            <div className="space-y-4 text-body-sm text-on-surface-variant leading-relaxed">
              <p>
                <strong>Map-Reduce analysis</strong> divides large texts into isolated page blocks, executes context extraction in parallel, and merges summaries.
              </p>
              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">1</div>
                  <span><strong>Map Phase:</strong> Parallel workers process page texts extracts. Filters out irrelevant pages.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">2</div>
                  <span><strong>Reduce Phase:</strong> The SLM client compiles individual summaries into a consolidated Investment Report.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl mt-6">
            <div className="text-[10px] font-label-caps text-on-surface-variant font-bold mb-1">CURRENT DOCUMENT</div>
            <div className="text-body-md font-bold text-on-surface mb-0.5">{activeDoc.company_name}</div>
            <div className="text-body-sm text-on-surface-variant font-data-mono">{activeDoc.total_pages} pages parsed</div>
          </div>
        </div>
      </div>

      {/* Loading & Telemetry Pane */}
      {loading && (
        <div className="bg-surface-container border border-outline-variant p-6 rounded-xl animate-pulse-custom">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin text-primary" />
                Executing Pipeline Nodes...
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">Telemetry log of model execution across workers.</p>
            </div>
            <span className="font-data-mono text-xs text-primary px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              {progressStep === 1 && 'STEP 1/3: SEARCHING'}
              {progressStep === 2 && `STEP 2/3: MAPPING (${pagesMapped}/${totalPagesToMap})`}
              {progressStep === 3 && 'STEP 3/3: SYNTHESIZING'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-background-deep h-2 rounded-full overflow-hidden mb-6 border border-outline-variant/30">
            <div
              className="h-full bg-primary transition-all duration-300"
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

          {/* Stepper Status Logs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-data-mono text-body-sm">
            <div className={`p-3 rounded-lg border ${progressStep >= 1 ? 'bg-primary/5 border-primary/20 text-on-surface' : 'bg-surface-container-low border-outline-variant/20 opacity-50'}`}>
              <div className="font-bold mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                1. Page Selection
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {progressStep === 1 ? 'Locating key document partitions...' : 'Partition boundaries identified.'}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${progressStep >= 2 ? 'bg-primary/5 border-primary/20 text-on-surface' : 'bg-surface-container-low border-outline-variant/20 opacity-50'}`}>
              <div className="font-bold mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                2. Parallel Page Maps
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {progressStep === 2 ? `Mapping query. Worker threads: ${pagesMapped}/${totalPagesToMap} pages.` : progressStep > 2 ? 'Page extractions completed.' : 'Waiting to execute...'}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${progressStep >= 3 ? 'bg-primary/5 border-primary/20 text-on-surface' : 'bg-surface-container-low border-outline-variant/20 opacity-50'}`}>
              <div className="font-bold mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                3. Synthesis (Reduce)
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {progressStep === 3 ? 'Synthesizing final executive summary...' : 'Synthesized report ready.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-critical/10 border border-critical/20 rounded-xl p-5 flex items-start gap-3 text-critical">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-body-md font-bold">Pipeline Execution Interrupted</p>
            <p className="text-body-sm opacity-90 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {report && (
        <div className="grid grid-cols-12 gap-gutter animate-fade">
          {/* Executive Report Card */}
          <div className="col-span-12 lg:col-span-7 bg-surface-container border border-outline-variant rounded-xl flex flex-col min-h-[500px]">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary">
                  <BookOpen size={14} />
                </div>
                <div>
                  <h3 className="text-headline-md font-bold text-on-surface">Synthesized Report</h3>
                  <span className="text-[10px] font-label-caps text-on-surface-variant">REDUCED CONTEXT SYNTESIS</span>
                </div>
              </div>
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-background-deep border border-outline-variant rounded-lg text-body-sm flex items-center gap-2 hover:bg-surface-container-high transition-colors"
              >
                {copied ? <Check size={14} className="text-positive" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto max-h-[600px] custom-scrollbar bg-background-deep/30">
              <MarkdownRenderer content={report} />
            </div>
          </div>

          {/* Intermediate Page Summaries Accordion List */}
          <div className="col-span-12 lg:col-span-5 bg-surface-container border border-outline-variant rounded-xl flex flex-col">
            <div className="p-5 border-b border-outline-variant bg-surface-container-low">
              <h3 className="text-headline-md font-bold text-on-surface">Intermediate Disclosures</h3>
              <p className="text-body-sm text-on-surface-variant">Page-by-page extractions mapping the focus topic</p>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-3 custom-scrollbar">
              <div className="px-2 pb-1 text-[11px] font-label-caps text-on-surface-variant font-bold">
                PAGES ANALYZED ({pagesAnalyzed.length}): {pagesAnalyzed.join(', ')}
              </div>
              
              {intermediateSummaries.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-body-sm border border-dashed border-outline-variant/30 rounded-xl bg-background-deep/10">
                  No page-specific disclosures matched the query filter.
                </div>
              ) : (
                intermediateSummaries.map((item) => (
                  <div
                    key={item.page_num}
                    className="border border-outline-variant/40 rounded-xl overflow-hidden bg-background-deep/20"
                  >
                    <button
                      onClick={() => setExpandedPage(expandedPage === item.page_num ? null : item.page_num)}
                      className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-data-mono text-xs font-bold">
                          {item.page_num}
                        </span>
                        <span className="text-body-sm font-semibold text-on-surface">Page {item.page_num} Disclosures</span>
                      </div>
                      {expandedPage === item.page_num ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {expandedPage === item.page_num && (
                      <div className="px-4 pb-4 pt-1 border-t border-outline-variant/20 text-body-sm text-on-surface-variant leading-relaxed animate-fade bg-surface-container-lowest/40 whitespace-pre-wrap">
                        {item.summary}
                      </div>
                    )}
                  </div>
                ))
              )}
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
    <div className="space-y-4 text-on-surface-variant leading-relaxed font-body-md text-body-md">
      {paragraphs.map((p, idx) => {
        const text = p.trim();
        if (!text) return null;

        // Headers
        if (text.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-headline-md font-bold text-primary mt-6 mb-2">
              {text.replace('### ', '')}
            </h4>
          );
        }
        if (text.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-xl font-bold text-primary mt-8 mb-3 border-b border-outline-variant/30 pb-1">
              {text.replace('## ', '')}
            </h3>
          );
        }
        if (text.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-2xl font-bold text-primary mt-10 mb-4">
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
                    className="text-body-md"
                    dangerouslySetInnerHTML={{ __html: parseMarkdownInlines(cleanLine) }}
                  />
                );
              })}
            </ul>
          );
        }

        // Numbered list
        if (/^\d+\.\s+/.test(text)) {
          const lines = text.split('\n');
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-2 my-3">
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^\d+\.\s+/, '');
                return (
                  <li
                    key={lIdx}
                    className="text-body-md"
                    dangerouslySetInnerHTML={{ __html: parseMarkdownInlines(cleanLine) }}
                  />
                );
              })}
            </ol>
          );
        }

        return (
          <p
            key={idx}
            className="text-body-md"
            dangerouslySetInnerHTML={{ __html: parseMarkdownInlines(text) }}
          />
        );
      })}
    </div>
  );
};

const parseMarkdownInlines = (text: string) => {
  // Bold **text**
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-bold">$1</strong>');
  // Bold *text*
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-on-surface">$1</em>');
  // Citations like (Page X) or (Pages X, Y)
  html = html.replace(/\((Pages?\s+\d+.*?)\)/gi, '<span class="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold font-data-mono mx-0.5 border border-primary/20">$1</span>');
  return html;
};
