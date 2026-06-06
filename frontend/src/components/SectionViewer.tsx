import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  FileJson, 
  Search, 
  LayoutGrid, 
  List, 
  Upload, 
  Download, 
  Share, 
  RefreshCw
} from 'lucide-react';

interface SectionViewerProps {
  sections: string[];
  activeSection: string | null;
  setActiveSection: (sec: string | null) => void;
}

// Virtual File System Definition
interface VirtualFile {
  name: string;
  type: 'text' | 'json' | 'code' | 'pdf';
  size: string;
  modified: string;
  sectionKey: string; // Map back to actual document sections if needed
  content?: string;
}

interface VirtualFolder {
  name: string;
  isOpen: boolean;
  files: VirtualFile[];
}

export const SectionViewer: React.FC<SectionViewerProps> = ({
  sections,
  activeSection,
  setActiveSection,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [highlightKeyword, setHighlightKeyword] = useState<string>('');
  const [popupEntity, setPopupEntity] = useState<{ name: string; x: number; y: number } | null>(null);

  // File Explorer Layout state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [treeSearch, setTreeSearch] = useState<string>('');
  
  // Virtual Folders/Files mapping based on the loaded filing sections
  const [folders, setFolders] = useState<VirtualFolder[]>([
    {
      name: 'Item Disclosures',
      isOpen: true,
      files: []
    },
    {
      name: 'Financial Statements',
      isOpen: true,
      files: [
        { name: 'balance_sheet_telemetry.json', type: 'json', size: '12.4 KB', modified: '2 hours ago', sectionKey: 'Financial Statements' },
        { name: 'income_statement_draft.py', type: 'code', size: '4.8 KB', modified: '4 hours ago', sectionKey: 'Financial Statements' }
      ]
    },
    {
      name: 'System Logs',
      isOpen: false,
      files: [
        { name: 'pipeline_logger.ndjson', type: 'json', size: '245 KB', modified: '10 mins ago', sectionKey: 'Risk Factors' }
      ]
    }
  ]);

  const [selectedFile, setSelectedFile] = useState<VirtualFile | null>(null);

  // Sync loaded filing sections with explorer tree
  useEffect(() => {
    if (sections && sections.length > 0) {
      const filingFiles = sections.map(sec => ({
        name: `${sec.toLowerCase().replace(/[^a-z0-9]/g, '_')}_disclosure.txt`,
        type: 'text' as const,
        size: '14.2 KB',
        modified: 'Just now',
        sectionKey: sec
      }));
      
      setFolders(prev => [
        {
          name: 'Item Disclosures',
          isOpen: true,
          files: filingFiles
        },
        ...prev.slice(1)
      ]);

      // Default select the first file/section
      if (!activeSection && filingFiles.length > 0) {
        setSelectedFile(filingFiles[0]);
        setActiveSection(filingFiles[0].sectionKey);
      }
    }
  }, [sections]);

  // Fetch section contents when selectedFile changes
  useEffect(() => {
    if (!selectedFile) return;

    const fetchSection = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/document/section/${encodeURIComponent(selectedFile.sectionKey)}`);
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
  }, [selectedFile]);



  const showPopup = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupEntity({
      name,
      x: rect.left,
      y: rect.bottom + window.scrollY + 8
    });
  };

  const toggleFolder = (folderName: string) => {
    setFolders(prev => prev.map(f => f.name === folderName ? { ...f, isOpen: !f.isOpen } : f));
  };

  const handleSelectFile = (file: VirtualFile) => {
    setSelectedFile(file);
    setActiveSection(file.sectionKey);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'json': return <FileJson size={14} className="text-burnt-orange shrink-0" />;
      case 'code': return <FileCode size={14} className="text-vivid-red shrink-0" />;
      default: return <FileText size={14} className="text-text-muted shrink-0" />;
    }
  };

  const renderContent = () => {
    if (!content) return null;

    let text = content;
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
      highlightedText = highlightedText.replace(regex, `<mark class="bg-burnt-orange/30 text-text-light px-0.5 rounded border-b border-burnt-orange">$1</mark>`);
    } else {
      replacements.forEach(rep => {
        const regex = new RegExp(`\\b(${rep.term})\\b`, 'g');
        if (rep.type === "interactive") {
          highlightedText = highlightedText.replace(regex, `<span class="interactive-tag px-1 rounded bg-primary-plum/30 border-b border-dashed border-burnt-orange cursor-pointer hover:bg-primary-plum/50 transition-all font-medium text-burnt-orange">$1</span>`);
        } else {
          highlightedText = highlightedText.replace(regex, `<span class="risk-tag px-1 rounded bg-vivid-red/10 border-b border-dashed border-vivid-red cursor-pointer hover:bg-vivid-red/20 transition-all font-medium text-vivid-red">$1</span>`);
        }
      });
    }

    if (selectedFile?.type === 'json') {
      return (
        <pre className="text-burnt-orange font-data-mono text-sm p-4 bg-near-black border border-border-divider rounded-lg overflow-x-auto">
          {`{
  "document_id": "${selectedFile.name}",
  "section": "${selectedFile.sectionKey}",
  "size": "${selectedFile.size}",
  "status": "categorized_indexes",
  "word_count": ${content.split(/\s+/).filter(Boolean).length},
  "entities_detected": ["TSMC", "concentration risk", "advanced packaging"],
  "vector_store_indexed": true
}`}
        </pre>
      );
    }

    if (selectedFile?.type === 'code') {
      return (
        <pre className="text-text-muted font-data-mono text-sm p-4 bg-near-black border border-border-divider rounded-lg overflow-x-auto space-y-1">
          <div><span className="text-vivid-red">import</span> os, sys</div>
          <div><span className="text-vivid-red">def</span> <span className="text-burnt-orange">analyze_balance_sheet</span>():</div>
          <div className="pl-4 text-text-light"># Segment analytics for {selectedFile.sectionKey}</div>
          <div className="pl-4">content = <span className="text-primary-plum">"{content.slice(0, 100)}..."</span></div>
          <div className="pl-4"><span className="text-vivid-red">return</span> len(content.split())</div>
        </pre>
      );
    }

    return (
      <div 
        className="text-text-muted font-sans-brand text-sm leading-relaxed space-y-6 select-text"
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
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden animate-stagger-1 font-sans-brand" onClick={() => setPopupEntity(null)}>
      {/* 1. Left Tree Panel (280px) */}
      <section className="w-[280px] border-r border-border-divider bg-near-black flex flex-col shrink-0">
        {/* Search top of tree */}
        <div className="p-3 border-b border-border-divider relative">
          <div className="flex items-center gap-2 bg-[#140910] border border-border-divider rounded px-2.5 py-1">
            <Search size={12} className="text-text-muted" />
            <input 
              type="text" 
              placeholder="Search files..."
              className="bg-transparent border-none text-[11px] text-text-light placeholder:text-text-muted w-full focus:ring-0 focus:outline-none p-0.5"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
          <div className="text-[10px] font-bold text-burnt-orange uppercase tracking-wider px-2">Workspace Nodes</div>
          
          <div className="space-y-1">
            {folders.map(folder => {
              const matchesSearch = folder.files.some(f => f.name.toLowerCase().includes(treeSearch.toLowerCase()));
              if (treeSearch && !matchesSearch && !folder.name.toLowerCase().includes(treeSearch.toLowerCase())) {
                return null;
              }
              
              return (
                <div key={folder.name} className="space-y-0.5">
                  {/* Folder Row */}
                  <button 
                    onClick={() => toggleFolder(folder.name)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-text-muted hover:bg-primary-plum/20 transition-all text-xs"
                  >
                    {folder.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {folder.isOpen ? <FolderOpen size={14} className="text-brand-crimson" /> : <Folder size={14} className="text-text-muted" />}
                    <span className="font-bold text-text-light">{folder.name}</span>
                  </button>

                  {/* Indented Files */}
                  {folder.isOpen && (
                    <div className="pl-4 border-l border-dashed border-border-divider/50 ml-3.5 space-y-0.5">
                      {folder.files
                        .filter(f => f.name.toLowerCase().includes(treeSearch.toLowerCase()))
                        .map(file => {
                          const isSelected = selectedFile?.name === file.name;
                          return (
                            <button
                              key={file.name}
                              onClick={() => handleSelectFile(file)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all text-xs relative ${
                                isSelected 
                                  ? 'bg-primary-plum text-text-light font-semibold' 
                                  : 'text-text-muted hover:bg-[#511845]/15'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-vivid-red"></div>
                              )}
                              {getFileIcon(file.type)}
                              <span className="truncate">{file.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick focus panel at bottom */}
        <div className="p-3 border-t border-border-divider bg-transparent">
          <div className="text-[11px] font-bold text-text-muted uppercase mb-2">Tag Highlight</div>
          <div className="flex flex-wrap gap-1.5">
            {["Supply Chain", "Taiwan", "Export Controls", "Cyber"].map(kw => (
              <span 
                key={kw} 
                onClick={() => setHighlightKeyword(kw)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer border transition-all ${
                  highlightKeyword === kw 
                    ? 'border-vivid-red bg-vivid-red/10 text-text-light' 
                    : 'border-border-divider bg-near-black text-text-muted hover:border-burnt-orange'
                }`}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Middle Content Area (File Details and Viewer) */}
      <section className="flex-1 flex flex-col bg-transparent overflow-hidden">
        {/* Top Toolbar */}
        <div className="h-12 border-b border-border-divider px-6 flex justify-between items-center bg-transparent backdrop-blur-md">
          {/* Left Path Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold font-data-mono">
            <span className="text-primary-plum">Workspace</span>
            <span className="text-text-muted">/</span>
            {selectedFile ? (
              <>
                <span className="text-text-muted">Item Disclosures</span>
                <span className="text-text-muted">/</span>
                <span className="text-text-light">{selectedFile.name}</span>
              </>
            ) : (
              <span className="text-text-muted">Empty</span>
            )}
          </div>

          {/* Right View controls */}
          <div className="flex items-center gap-2">
            <div className="flex border border-border-divider rounded overflow-hidden">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary-plum text-text-light' : 'text-text-muted hover:bg-near-black'}`}
                title="Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary-plum text-text-light' : 'text-text-muted hover:bg-near-black'}`}
                title="List View"
              >
                <List size={13} />
              </button>
            </div>
            
            <button className="flex items-center gap-1 border border-border-divider hover:border-vivid-red px-2.5 py-1 rounded text-[11px] font-bold transition-all">
              <Upload size={11} />
              <span>Import file</span>
            </button>
          </div>
        </div>

        {/* Dynamic Inner Display */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0D080C]/25">
          {selectedFile ? (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex justify-between items-center border-b border-border-divider/50 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-burnt-orange uppercase tracking-widest font-data-mono">WORKSPACE SOURCE TEXT</span>
                  <h1 className="text-2xl font-serif-display font-bold text-text-light mt-1">{selectedFile.sectionKey}</h1>
                </div>
                
                {/* Search / highlight tool */}
                <div className="flex items-center bg-[#140910] border border-border-divider rounded px-3 py-1 text-xs">
                  <Search size={12} className="text-text-muted mr-1.5" />
                  <input
                    type="text"
                    placeholder="Highlight/Filter terms..."
                    className="bg-transparent border-none focus:ring-0 focus:outline-none p-0.5 text-text-light placeholder:text-text-muted w-40"
                    value={highlightKeyword}
                    onChange={(e) => setHighlightKeyword(e.target.value)}
                  />
                  {highlightKeyword && (
                    <button onClick={() => setHighlightKeyword('')} className="text-[10px] text-burnt-orange hover:underline ml-2">Clear</button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <RefreshCw size={24} className="animate-spin text-burnt-orange" />
                  <p className="text-xs text-text-muted">Loading workspace document stream...</p>
                </div>
              ) : (
                renderContent()
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-lg border border-dashed border-border-divider flex items-center justify-center text-text-muted mb-4">
                <FileText size={24} />
              </div>
              <h2 className="text-sm font-bold text-text-light">No File Selected</h2>
              <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">
                Click on folders and choose a disclosure file in the tree panel to verify sources.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Right Detail Panel (when file selected) */}
      {selectedFile && (
        <section className="w-[300px] border-l border-border-divider bg-near-black flex flex-col shrink-0 p-4 justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-burnt-orange uppercase tracking-wider">Node Telemetry</span>
              <h3 className="text-xl font-serif-display font-bold text-text-light mt-1 break-words">{selectedFile.name}</h3>
            </div>

            {/* Meta Tags Details */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-sm pb-2 border-b border-border-divider/50">
                <span className="text-text-muted">Document Type:</span>
                <span className="font-bold text-text-light uppercase text-xs px-2 py-0.5 bg-primary-plum/30 rounded border border-brand-crimson/20">
                  {selectedFile.type}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2 border-b border-border-divider/50">
                <span className="text-text-muted">File Size:</span>
                <span className="font-bold text-text-light font-data-mono">{selectedFile.size}</span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2 border-b border-border-divider/50">
                <span className="text-text-muted">Modified Date:</span>
                <span className="font-bold text-text-light">{selectedFile.modified}</span>
              </div>
            </div>

            {/* Statistics */}
            <div className="p-3 bg-primary-plum/10 border border-border-divider rounded-lg">
              <div className="text-xs font-bold text-burnt-orange uppercase mb-1">Index Metrics</div>
              <div className="text-sm text-text-muted space-y-1 font-data-mono">
                <div>Character count: {content.length.toLocaleString()}</div>
                <div>Status: vector_store_active</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5">
            <button className="w-full py-2 bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light font-bold text-xs rounded hover:brightness-110 transition-all flex items-center justify-center gap-1.5">
              <Download size={12} />
              <span>Download File</span>
            </button>
            <button className="w-full py-2 border border-border-divider text-text-muted font-bold text-xs rounded hover:border-burnt-orange hover:text-text-light transition-all flex items-center justify-center gap-1.5">
              <Share size={12} />
              <span>Share Link</span>
            </button>
          </div>
        </section>
      )}

      {/* Entity popup profile card */}
      {popupEntity && (
        <div 
          className="absolute glass-panel p-4 rounded-xl w-64 shadow-2xl z-50 text-left animate-fade"
          style={{ left: `${Math.max(10, popupEntity.x - 280)}px`, top: `${popupEntity.y - 120}px` }}
        >
          <div className="flex items-center justify-between mb-3 border-b border-border-divider/30 pb-2">
            <span className="text-[9px] font-bold text-burnt-orange uppercase tracking-wider">ENTITY METADATA</span>
            <span 
              className="text-text-muted text-xs cursor-pointer hover:text-text-light font-bold"
              onClick={() => setPopupEntity(null)}
            >
              Close
            </span>
          </div>
          <div className="text-sm font-bold text-text-light mb-1">{popupEntity.name}</div>
          <div className="text-[10px] text-text-muted mb-3">SEC concentration tracking profile</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Exposure Index:</span>
              <span className="text-vivid-red font-bold">Critical</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Mention Frequency:</span>
              <span className="text-burnt-orange font-bold">High (+40% YoY)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
