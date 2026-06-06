import React, { useState, useEffect } from 'react';
import { Search, TrendingUp } from 'lucide-react';

interface SearchResult {
  section: string;
  page: number;
  text: string;
  score: number;
}

interface SectionViewerProps {
  sections: string[];
  activeSection: string | null;
  setActiveSection: (sec: string | null) => void;
}

export const SectionViewer: React.FC<SectionViewerProps> = ({
  sections,
  activeSection,
  setActiveSection,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [highlightKeyword, setHighlightKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'keyword' | 'semantic'>('keyword');
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [popupEntity, setPopupEntity] = useState<{ name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!activeSection) {
      // Set first section active by default if none selected
      if (sections.length > 0) {
        setActiveSection(sections[0]);
      }
      return;
    }

    const fetchSection = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/document/section/${encodeURIComponent(activeSection)}`);
        if (response.ok) {
          const data = await response.json();
          setContent(data.content);
        } else {
          setContent('Error: Section text could not be loaded.');
        }
      } catch (err) {
        setContent('Error: Network exception fetching section.');
      } finally {
        setLoading(false);
      }
    };

    fetchSection();
  }, [activeSection, sections, setActiveSection]);

  const runSemanticSearch = async () => {
    if (!highlightKeyword.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: highlightKeyword,
          search_type: 'semantic',
          k: 5,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSemanticResults(data.results || []);
      } else {
        setSearchError('Semantic search failed.');
        setSemanticResults([]);
      }
    } catch {
      setSearchError('Unable to reach search API.');
      setSemanticResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'semantic' && highlightKeyword.trim().length > 2) {
      const timer = setTimeout(runSemanticSearch, 400);
      return () => clearTimeout(timer);
    }
    if (activeTab === 'keyword') {
      setSemanticResults([]);
    }
  }, [activeTab, highlightKeyword]);

  const showPopup = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupEntity({
      name,
      x: rect.left,
      y: rect.bottom + window.scrollY + 8
    });
  };

  const renderContent = () => {
    if (!content) return null;

    // Inject custom interactive classes for TSMC, ASML, packaging, and concentration risk
    let text = content;
    
    // We will parse the text and highlight entities like TSMC, ASML, packaging, export controls
    // To do this simply, we replace them with HTML. In React, we can dangerouslySetInnerHTML
    // or do text splits. Let's do a replace of key terms with styled wrappers for high visual impact!
    const replacements = [
      { term: "TSMC", type: "interactive", label: "TSMC" },
      { term: "ASML", type: "interactive", label: "ASML" },
      { term: "Taiwan", type: "interactive", label: "Taiwan" },
      { term: "export controls", type: "risk", label: "export controls" },
      { term: "concentration risk", type: "risk", label: "concentration risk" },
      { term: "cybersecurity", type: "risk", label: "cybersecurity" },
      { term: "advanced packaging", type: "interactive", label: "advanced packaging" }
    ];

    let highlightedText = text;
    
    if (highlightKeyword.trim()) {
      const escaped = highlightKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      highlightedText = highlightedText.replace(regex, `<mark class="bg-warning/30 text-white px-0.5 rounded">$1</mark>`);
    } else {
      // Run entity tag highlighting
      replacements.forEach(rep => {
        const regex = new RegExp(`\\b(${rep.term})\\b`, 'g');
        if (rep.type === "interactive") {
          highlightedText = highlightedText.replace(regex, `<span class="interactive-tag px-1 rounded bg-primary/10 border-b border-dashed border-primary cursor-pointer hover:bg-primary/20 transition-all font-medium">$1</span>`);
        } else {
          highlightedText = highlightedText.replace(regex, `<span class="risk-tag px-1 rounded bg-critical/10 border-b border-dashed border-critical cursor-pointer hover:bg-critical/20 transition-all font-medium text-critical">$1</span>`);
        }
      });
    }

    return (
      <div 
        className="text-on-surface-variant font-body-md text-body-md leading-relaxed space-y-6"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('interactive-tag') || target.classList.contains('risk-tag')) {
            showPopup(e, target.innerText);
          } else {
            setPopupEntity(null);
          }
        }}
        dangerouslySetInnerHTML={{ __html: highlightedText }}
      />
    );
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-10rem)] overflow-hidden animate-fade" onClick={() => setPopupEntity(null)}>
      {/* 3-Column Layout: Left Sidebar Navigator */}
      <section className="w-72 border-r border-outline-variant bg-surface-container-lowest flex flex-col">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-on-surface-variant">Document Navigator</span>
          <span className="material-symbols-outlined text-on-surface-variant text-base cursor-pointer">filter_list</span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          <div className="px-3 py-1 text-xs text-outline uppercase font-bold">Filing Structure</div>
          {sections.map((sec) => (
            <div
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                activeSection === sec 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium' 
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">description</span>
              <span className="text-body-sm truncate">{sec}</span>
            </div>
          ))}
        </div>

        <div className="p-4 bg-surface-container-low border-t border-outline-variant">
          <div className="flex justify-between items-center mb-2">
            <span className="text-label-caps font-label-caps text-on-surface-variant">Quick Focus</span>
            <span className="text-[10px] text-primary hover:underline cursor-pointer" onClick={() => setHighlightKeyword('')}>Reset</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Supply Chain", "Regulatory", "Taiwan", "Revenue"].map(kw => (
              <span 
                key={kw} 
                onClick={() => setHighlightKeyword(kw)}
                className={`px-2 py-0.5 bg-surface-container-high rounded text-[10px] text-on-surface-variant border border-outline-variant cursor-pointer hover:border-primary transition-all ${highlightKeyword === kw ? 'border-primary text-primary bg-primary/5' : ''}`}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Middle: Text Container */}
      <section className="flex-1 overflow-y-auto custom-scrollbar bg-background-deep relative px-12 py-10">
        {activeSection && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <div className="text-label-caps font-label-caps text-primary tracking-widest mb-1">COMPANY DISCLOSURE WORKSPACE</div>
              <h1 className="text-headline-lg font-headline-lg text-on-surface font-bold mb-2">{activeSection}</h1>
              <div className="h-1 w-20 bg-primary rounded-full mb-6"></div>
              
              {/* Highlight Toolbar */}
              <div className="flex gap-4 items-center justify-between bg-surface-container-low p-2 rounded-lg border border-outline-variant">
                <div className="flex items-center gap-2 bg-background-deep px-3 py-1 rounded border border-outline-variant max-w-xs w-full">
                  <Search size={14} className="text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder={activeTab === 'semantic' ? 'Semantic search across filing...' : 'Search/Highlight keywords...'}
                    className="bg-transparent border-none text-body-sm w-full focus:ring-0 placeholder:text-muted py-0.5 text-on-surface"
                    value={highlightKeyword}
                    onChange={(e) => setHighlightKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && activeTab === 'semantic') {
                        e.preventDefault();
                        runSemanticSearch();
                      }
                    }}
                  />
                </div>
                <div className="flex bg-surface-container-high rounded p-0.5">
                  <button 
                    onClick={() => setActiveTab('keyword')}
                    className={`px-3 py-1 text-label-caps font-label-caps rounded transition-all ${activeTab === 'keyword' ? 'bg-surface-container-highest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    Keyword
                  </button>
                  <button 
                    onClick={() => setActiveTab('semantic')}
                    className={`px-3 py-1 text-label-caps font-label-caps rounded transition-all ${activeTab === 'semantic' ? 'bg-surface-container-highest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    Semantic
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32">
                <div className="w-8 h-8 border-4 border-white/5 border-t-primary rounded-full animate-spin"></div>
                <p className="text-body-sm text-on-surface-variant">Extracting section layout...</p>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        )}

        {/* Entity popup profile card */}
        {popupEntity && (
          <div 
            className="absolute glass-panel p-4 rounded-xl w-64 shadow-2xl z-50 text-left animate-fade"
            style={{ left: `${Math.max(10, popupEntity.x - 280)}px`, top: `${popupEntity.y - 120}px` }}
          >
            <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-2">
              <span className="text-label-caps font-label-caps text-primary">ENTITY TELEMETRY</span>
              <span 
                className="material-symbols-outlined text-on-surface-variant text-sm cursor-pointer hover:text-on-surface"
                onClick={() => setPopupEntity(null)}
              >
                close
              </span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface font-bold mb-1">{popupEntity.name}</div>
            <div className="text-body-sm text-on-surface-variant mb-4">Regulatory dependency tracking profile</div>
            <div className="space-y-2 font-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Exposure Index:</span>
                <span className="text-critical font-medium">Critical</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Mention Frequency:</span>
                <span className="text-warning font-medium">High (+40% YoY)</span>
              </div>
            </div>
            <button className="w-full mt-4 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded text-body-sm font-bold transition-colors">
              Analyze Network Nodes
            </button>
          </div>
        )}
      </section>

      {/* Right Column: AI Insights */}
      <section className="w-80 border-l border-outline-variant bg-surface-container-low flex flex-col p-4 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-tertiary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-tertiary-container" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
          <h3 className="font-headline-md text-headline-md font-bold">AI Insights</h3>
        </div>

        <div className="glass-panel p-4 rounded-xl mb-6 border-l-4 border-l-tertiary bg-tertiary-container/5">
          <div className="text-label-caps font-label-caps text-tertiary mb-2">
            {activeTab === 'semantic' ? 'SEMANTIC SEARCH' : 'SECTION STATS'}
          </div>
          {activeTab === 'semantic' ? (
            searchLoading ? (
              <p className="text-body-sm text-on-surface-variant">Searching indexed filing chunks...</p>
            ) : searchError ? (
              <p className="text-body-sm text-critical">{searchError}</p>
            ) : semanticResults.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Enter a topic to find semantically related disclosures.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {semanticResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSection(result.section)}
                    className="w-full text-left p-2 rounded border border-outline-variant/30 hover:border-primary/40 transition-colors"
                  >
                    <div className="text-[10px] text-primary font-bold">{result.section} · Page {result.page}</div>
                    <p className="text-[11px] text-on-surface-variant line-clamp-3 mt-1">{result.text}</p>
                    <div className="text-[10px] text-on-surface-variant mt-1">Score: {result.score.toFixed(3)}</div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-body-sm text-on-surface leading-relaxed">
              {content
                ? `${content.split(/\s+/).filter(Boolean).length.toLocaleString()} words in this section. Use keyword mode to highlight terms in the text.`
                : 'Select a section to view disclosure statistics.'}
            </p>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <div className="text-label-caps font-label-caps text-on-surface-variant opacity-60">ENTITY MENTIONS</div>
          {['TSMC', 'export controls', 'cybersecurity', 'revenue'].map((term) => {
            const count = content ? (content.match(new RegExp(term, 'gi')) || []).length : 0;
            return (
              <div key={term} className="flex gap-3 group">
                <div className="mt-1 text-warning"><TrendingUp size={16} /></div>
                <div>
                  <div className="text-body-sm font-semibold text-on-surface">{term}</div>
                  <div className="text-[11px] text-on-surface-variant leading-snug">{count} mention{count === 1 ? '' : 's'} in this section</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <div className="p-4 bg-surface-container-high rounded-xl border border-outline-variant">
            <div className="text-label-caps font-label-caps text-on-surface-variant mb-3">SECTION LENGTH</div>
            <div className="text-on-surface font-data-mono text-sm">{content.length.toLocaleString()} characters</div>
          </div>
        </div>
      </section>
    </div>
  );
};
