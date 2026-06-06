import { useState, useEffect } from 'react';
import { SectionViewer } from './components/SectionViewer';
import { RiskAnalysis } from './components/RiskAnalysis';
import { CompetitorAnalysis } from './components/CompetitorAnalysis';
import { Chatbot } from './components/Chatbot';
import { GuardrailLogs } from './components/GuardrailLogs';
import { FilingUpload } from './components/FilingUpload';
import { MapReduceAnalysis } from './components/MapReduceAnalysis';
import { Dashboard, EmptyDashboard } from './components/Dashboard';

interface DocumentDetails {
  filename: string;
  company_name: string;
  total_pages: number;
  sections: string[];
}

type TabId = 'dashboard' | 'upload' | 'explorer' | 'risks' | 'assistant' | 'competitors' | 'guardrails' | 'map-reduce';

function App() {
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const checkDocStatus = async () => {
    try {
      const response = await fetch('/api/document/status');
      if (response.ok) {
        const data = await response.json();
        if (data.uploaded) {
          setDocDetails({
            filename: data.document.filename,
            company_name: data.document.company_name,
            total_pages: data.document.total_pages,
            sections: data.document.sections,
          });
        } else {
          setDocDetails(null);
        }
      }
    } catch (err) {
      console.error('Failed to query document details:', err);
    }
  };

  useEffect(() => {
    checkDocStatus();
  }, []);

  const handleUploadSuccess = (details: DocumentDetails) => {
    setDocDetails(details);
    setActiveTab('dashboard');
  };

  const navigate = (tab: TabId) => setActiveTab(tab);

  const navClass = (tab: TabId) =>
    `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg active:scale-95 transition-all text-left ${
      activeTab === tab
        ? 'bg-secondary-container text-on-secondary-container font-semibold'
        : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
    }`;

  return (
    <div className="flex bg-background-deep text-on-surface font-body-md overflow-hidden h-screen w-screen relative">
      <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col border-r border-outline-variant bg-surface-container-low p-stack-default z-50">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-4 py-6 border-b border-outline-variant/30">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-primary">FinSight AI</h1>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-[9px] opacity-70">Enterprise Intelligence</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 mt-4 px-2 overflow-y-auto custom-scrollbar">
            <button onClick={() => navigate('dashboard')} className={navClass('dashboard')}>
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-body-md">Dashboard</span>
            </button>
            <button onClick={() => navigate('upload')} className={navClass('upload')}>
              <span className="material-symbols-outlined">upload_file</span>
              <span className="font-body-md">Ingest Filing</span>
            </button>
            <button onClick={() => docDetails && navigate('explorer')} className={navClass('explorer')}>
              <span className="material-symbols-outlined">search_insights</span>
              <span className="font-body-md">Filing Explorer</span>
            </button>
            <button onClick={() => docDetails && navigate('risks')} className={navClass('risks')}>
              <span className="material-symbols-outlined">warning</span>
              <span className="font-body-md">Risk Analysis</span>
            </button>
            <button onClick={() => docDetails && navigate('map-reduce')} className={navClass('map-reduce')}>
              <span className="material-symbols-outlined">layers</span>
              <span className="font-body-md">Map-Reduce Analyzer</span>
            </button>
            <button onClick={() => docDetails && navigate('assistant')} className={navClass('assistant')}>
              <span className="material-symbols-outlined">psychology</span>
              <span className="font-body-md">AI Assistant</span>
            </button>
            <button onClick={() => docDetails && navigate('competitors')} className={navClass('competitors')}>
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-body-md">Competitor Analysis</span>
            </button>
            <div className="pt-4 pb-2 px-3"><div className="h-px bg-outline-variant w-full"></div></div>
            <button onClick={() => navigate('guardrails')} className={navClass('guardrails')}>
              <span className="material-symbols-outlined">security</span>
              <span className="font-body-md">Guardrails</span>
            </button>
          </nav>
        </div>
      </aside>

      <div className="flex flex-col flex-1 h-screen overflow-hidden ml-64">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant bg-surface/80 backdrop-blur-md z-40 w-full">
          <div className="flex items-center gap-4 flex-1">
            <p className="text-body-sm text-on-surface-variant">
              {docDetails ? `${docDetails.company_name} · ${docDetails.filename}` : 'No filing loaded'}
            </p>
          </div>
          <button
            onClick={() => navigate('upload')}
            className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            <span className="font-label-caps text-label-caps">Upload Filing</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-background-deep relative">
          {activeTab === 'dashboard' && (
            docDetails ? (
              <Dashboard doc={docDetails} onNavigate={(tab) => navigate(tab)} />
            ) : (
              <EmptyDashboard onNavigate={() => navigate('upload')} />
            )
          )}

          {activeTab === 'upload' && (
            <div className="p-6">
              <FilingUpload onUploadSuccess={handleUploadSuccess} />
            </div>
          )}

          {activeTab === 'explorer' && docDetails && (
            <SectionViewer
              sections={docDetails.sections}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
            />
          )}

          {activeTab === 'risks' && docDetails && (
            <div className="p-6"><RiskAnalysis /></div>
          )}

          {activeTab === 'map-reduce' && docDetails && (
            <div className="p-6"><MapReduceAnalysis activeDoc={docDetails} /></div>
          )}

          {activeTab === 'assistant' && docDetails && <Chatbot />}

          {activeTab === 'competitors' && docDetails && (
            <div className="p-6"><CompetitorAnalysis companyName={docDetails.company_name} /></div>
          )}

          {activeTab === 'guardrails' && (
            <div className="p-6"><GuardrailLogs /></div>
          )}
        </main>
      </div>

      {activeTab === 'dashboard' && docDetails && (
        <button
          onClick={() => navigate('assistant')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group z-50"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        </button>
      )}
    </div>
  );
}

export default App;
