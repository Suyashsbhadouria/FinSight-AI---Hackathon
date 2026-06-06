import { useState, useEffect } from 'react';
import { SectionViewer } from './components/SectionViewer';
import { RiskAnalysis } from './components/RiskAnalysis';
import { CompetitorAnalysis } from './components/CompetitorAnalysis';
import { Chatbot } from './components/Chatbot';
import { GuardrailLogs } from './components/GuardrailLogs';
import { FilingUpload } from './components/FilingUpload';
import { MapReduceAnalysis } from './components/MapReduceAnalysis';
import { Dashboard, EmptyDashboard } from './components/Dashboard';
import { 
  LayoutDashboard, 
  Upload, 
  Compass, 
  AlertTriangle, 
  Layers, 
  MessageSquare, 
  TrendingUp, 
  ShieldAlert, 
  Settings, 
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

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
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg active:scale-95 transition-all text-left relative group ${
      activeTab === tab
        ? 'text-burnt-orange font-semibold bg-vivid-red/10'
        : 'text-text-muted hover:bg-primary-plum/20 hover:text-text-light'
    }`;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresDoc: false },
    { id: 'upload', label: 'Ingest Filing', icon: Upload, requiresDoc: false },
    { id: 'explorer', label: 'Filing Explorer', icon: Compass, requiresDoc: true },
    { id: 'risks', label: 'Risk Analysis', icon: AlertTriangle, requiresDoc: true },
    { id: 'map-reduce', label: 'Map-Reduce', icon: Layers, requiresDoc: true },
    { id: 'assistant', label: 'AI Assistant', icon: MessageSquare, requiresDoc: true },
    { id: 'competitors', label: 'Competitors', icon: TrendingUp, requiresDoc: true },
    { id: 'guardrails', label: 'Guardrails', icon: ShieldAlert, requiresDoc: false },
  ];

  return (
    <div className="flex bg-transparent text-text-light font-body-md overflow-hidden h-screen w-screen relative">
      {/* Sidebar */}
      <aside 
        className={`h-screen fixed left-0 top-0 flex flex-col border-r border-border-divider bg-near-black z-50 transition-all duration-300 ${
          sidebarExpanded ? 'w-[240px]' : 'w-[68px]'
        }`}
      >
        {/* Left gradient accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary-plum via-brand-crimson via-vivid-red to-burnt-orange"></div>
        
        <div className="flex flex-col h-full pl-[3px]">
          {/* Logo / Brand area */}
          <div className="flex items-center justify-between px-4 py-6 border-b border-border-divider">
            {sidebarExpanded ? (
              <div className="flex items-center gap-2">
                <span className="font-serif-display text-xl font-bold tracking-tight text-text-light">
                  FinSight<span className="text-burnt-orange">.</span>
                </span>
                <span className="px-1.5 py-0.5 text-[8px] bg-brand-crimson/30 text-burnt-orange rounded uppercase tracking-widest font-sans-brand font-bold">AI</span>
              </div>
            ) : (
              <div className="font-serif-display text-xl font-bold text-text-light mx-auto">
                F<span className="text-burnt-orange">.</span>
              </div>
            )}
            
            {sidebarExpanded && (
              <button 
                onClick={() => setSidebarExpanded(false)}
                className="p-1 hover:bg-primary-plum/30 rounded text-text-muted hover:text-text-light transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {!sidebarExpanded && (
            <div className="flex justify-center py-2">
              <button 
                onClick={() => setSidebarExpanded(true)}
                className="p-1.5 hover:bg-primary-plum/30 rounded text-text-muted hover:text-text-light transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 mt-4 px-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const disabled = item.requiresDoc && !docDetails;
              if (disabled) return null;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as TabId)}
                  className={navClass(item.id as TabId)}
                  title={!sidebarExpanded ? item.label : undefined}
                >
                  {/* Active background pill indicator */}
                  {activeTab === item.id && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-vivid-red"></div>
                  )}
                  
                  <div className="flex items-center justify-center">
                    <Icon size={18} className={activeTab === item.id ? 'text-burnt-orange' : 'text-text-muted'} />
                  </div>
                  
                  {sidebarExpanded && (
                    <span className="font-sans-brand text-sm transition-opacity duration-200">
                      {item.label}
                    </span>
                  )}
                  
                  {/* Collapsed Tooltip */}
                  {!sidebarExpanded && (
                    <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all duration-150 origin-left bg-near-black border border-primary-plum text-text-light text-xs rounded py-1 px-2.5 z-[99] shadow-lg pointer-events-none whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom section (User Avatar, settings and logout) */}
          <div className="p-4 border-t border-border-divider flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-crimson to-burnt-orange p-[2px] shrink-0">
                <div className="w-full h-full rounded-full bg-near-black flex items-center justify-center text-xs font-bold text-text-light font-sans-brand">
                  AN
                </div>
              </div>
              
              {sidebarExpanded && (
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-text-light truncate">Analyst User</div>
                  <div className="text-[10px] text-text-muted truncate">enterprise@finsight.ai</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-around text-text-muted">
              <button className="hover:text-text-light transition-colors p-1" title="Settings">
                <Settings size={16} />
              </button>
              <button className="hover:text-critical transition-colors p-1" title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className={`flex flex-col flex-1 h-screen overflow-hidden transition-all duration-300`}
        style={{ marginLeft: sidebarExpanded ? '240px' : '68px' }}
      >
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-border-divider bg-near-black/85 backdrop-blur-md z-40 w-full">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="font-serif-display text-lg text-text-light font-bold">
              {docDetails ? (
                <span>
                  {docDetails.company_name} <span className="text-text-muted text-xs font-normal">({docDetails.filename})</span>
                </span>
              ) : (
                <span className="text-text-muted text-sm">No filing loaded</span>
              )}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-text-muted hover:text-text-light transition-colors">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-burnt-orange rounded-full"></span>
            </button>

            <button
              onClick={() => navigate('upload')}
              className="flex items-center gap-2 bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light px-4 py-1.5 rounded-full hover:brightness-110 transition-all font-sans-brand text-xs font-bold shadow-md"
            >
              <Upload size={14} />
              <span>Upload Filing</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-transparent relative">
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
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-vivid-red to-burnt-orange text-text-light rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group z-50"
        >
          <MessageSquare size={20} />
        </button>
      )}
    </div>
  );
}

export default App;
