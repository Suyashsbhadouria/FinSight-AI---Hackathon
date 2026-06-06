import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  Zap, 
  FileText, 
  Database, 
  Sparkles,
  ChevronRight,
  ChevronDown,
  Globe,
  Terminal,
  Paperclip
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  logs?: Array<{ step: string; text: string }>;
  toolsUsed?: string[];
}

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Financial Analyst. Upload a filing and ask questions about risks, revenue, supply chain dependencies, or regulatory disclosures. I will scan indexed document sections and browse live financial datasets to verify findings.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [openReasoningIdx, setOpenReasoningIdx] = useState<number | null>(null);
  
  const [sources, setSources] = useState<string[]>([]);
  const [webSources, setWebSources] = useState<string[]>([]);
  const isContextCollapsed = false;
  
  // Accordion triggers for right panel sections
  const [filingAccordOpen, setFilingAccordOpen] = useState(true);
  const [webAccordOpen, setWebAccordOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input;
    setInput('');
    setLoading(true);

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
    };

    setMessages(prev => [...prev, userMessage]);

    const apiHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          history: apiHistory
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.citations && data.citations.length > 0) {
          const filingCits = data.citations.filter((c: string) => c.includes('Filing'));
          const webCits = data.citations.filter((c: string) => c.includes('Web'));
          if (filingCits.length > 0) setSources(filingCits);
          if (webCits.length > 0) setWebSources(webCits);
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          citations: data.citations || [],
          logs: data.logs || [],
          toolsUsed: data.logs && data.logs.length > 0 ? ['VectorStoreRetrieval', 'SLMInference'] : []
        }]);
      } else {
        const err = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Execution failed: ${err.detail || 'Generic API error.'}`
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Network error connecting to LangGraph server nodes."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden font-sans-brand">
      {/* Left Pane: Chat Thread (65% width by default, adapts dynamically) */}
      <div className={`flex-1 flex flex-col bg-transparent relative border-r border-border-divider transition-all duration-300`}>
        {/* Messages Wrapper */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {messages.length <= 1 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-stagger-1 py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-crimson to-burnt-orange p-[2px] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-near-black flex items-center justify-center text-burnt-orange">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-serif-display font-bold text-text-light">FinSight Assistant</h2>
              <p className="text-xs text-text-muted max-w-sm leading-relaxed">
                Analyze operational risks, perform semantic queries across filings, and inspect automated analysis logs.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-stagger-1`}
            >
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'space-y-1' : 'space-y-3'}`}>
                {/* Message Bubble */}
                <div 
                  className={`p-4 transition-all duration-150 ${
                    msg.role === 'user'
                      ? 'chat-user-bubble text-text-light rounded-[18px_18px_4px_18px]'
                      : 'chat-assistant-card text-text-light rounded-[18px_18px_18px_4px]'
                  }`}
                >
                  <p className="text-xs leading-relaxed font-sans-brand font-medium whitespace-pre-wrap">
                    {msg.content}
                  </p>

                  {/* Inside assistant message action bar */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3 pt-3 border-t border-border-divider/50 mt-3 text-[10px] text-text-muted">
                      <button className="flex items-center gap-1 hover:text-text-light transition-colors">
                        <ThumbsUp size={11} /> Helpful
                      </button>
                      <button className="flex items-center gap-1 hover:text-text-light transition-colors">
                        <ThumbsDown size={11} /> Unhelpful
                      </button>
                      <button className="flex items-center gap-1 hover:text-text-light transition-colors ml-auto">
                        <Copy size={11} /> Copy
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags and reasoning trace */}
                {msg.role === 'assistant' && msg.logs && msg.logs.length > 0 && (
                  <div className="space-y-2">
                    {/* Tool chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.toolsUsed?.map((t, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-crimson to-vivid-red text-text-light text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider shadow">
                          <Zap size={9} className="text-burnt-orange shrink-0 animate-pulse" />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>

                    {/* Collapsible reasoning accordion */}
                    <div className="bg-[#0D080C] border border-border-divider/50 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOpenReasoningIdx(openReasoningIdx === index ? null : index)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-burnt-orange uppercase tracking-wider"
                      >
                        <div className="flex items-center gap-1.5">
                          <Terminal size={11} />
                          <span>AI reasoning execution trace</span>
                        </div>
                        <span className="font-mono text-[9px]">
                          {openReasoningIdx === index ? 'COLLAPSE [-]' : 'EXPAND [+]'}
                        </span>
                      </button>
                      
                      {openReasoningIdx === index && (
                        <div className="p-3 border-t border-border-divider/30 font-data-mono text-[11px] text-text-muted bg-near-black max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                          {msg.logs.map((log, lIdx) => (
                            <div key={lIdx} className="space-y-0.5">
                              <span className="text-vivid-red font-bold">[{log.step}]</span>
                              <pre className="whitespace-pre-wrap font-sans-brand text-xs pl-2 text-text-light">{log.text}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex justify-start animate-pulse">
              <div className="chat-assistant-card p-4 rounded-[18px_18px_18px_4px] flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-bounce"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-6 bg-[#0A060A]/80 backdrop-blur-md border-t border-border-divider">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative group">
            {/* Soft gradient border input wrapper */}
            <div className="rounded-xl p-[1.5px] bg-gradient-to-r from-primary-plum via-brand-crimson via-vivid-red to-burnt-orange focus-within:shadow-[0_0_24px_rgba(255,87,51,0.3)] transition-all">
              <div className="bg-[#12070e] rounded-xl flex items-center px-4 py-2.5">
                <Paperclip size={16} className="text-text-muted hover:text-text-light transition-colors mr-2 cursor-pointer" />
                <input 
                  type="text" 
                  placeholder="Ask about risk vectors, debt profiles, or strategic initiatives..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent border-none text-xs text-text-light focus:ring-0 placeholder:text-text-muted py-1"
                />
                <button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-vivid-red to-burnt-orange text-text-light hover:brightness-110 disabled:opacity-40 transition-all shadow"
                >
                  <ArrowUp size={14} />
                </button>
              </div>
            </div>
          </form>
          <p className="text-center text-[10px] text-text-muted/60 mt-3 font-sans-brand font-medium">
            Enterprise Intelligence Engine. Verified snippets appear in the context panel on the right.
          </p>
        </div>
      </div>

      {/* Right Pane: Context / Tool Panel (35% width) */}
      <div className={`w-96 bg-near-black/80 backdrop-blur-md flex flex-col border-l border-border-divider transition-all duration-300 ${isContextCollapsed ? 'hidden' : 'flex'}`}>
        <div className="p-4 border-b border-border-divider flex items-center justify-between">
          <h3 className="text-xs uppercase font-bold tracking-widest text-text-light flex items-center gap-2">
            <Database size={13} className="text-burnt-orange" />
            <span>Filing Context Panel</span>
          </h3>
          <span className="text-[10px] px-2 py-0.5 bg-primary-plum/30 text-burnt-orange rounded uppercase font-bold border border-brand-crimson/20">LIVE</span>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Accordion 1: Filing Citations */}
          <div className="border border-border-divider/50 rounded-lg overflow-hidden bg-[#140910]/40">
            <button 
              onClick={() => setFilingAccordOpen(!filingAccordOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-primary-plum/10 text-xs font-bold text-text-light border-b border-border-divider/30"
            >
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-burnt-orange" />
                <span>SEC filing disclosures ({sources.length})</span>
              </div>
              {filingAccordOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {filingAccordOpen && (
              <div className="p-3 space-y-2">
                {sources.length === 0 ? (
                  <p className="text-[11px] text-text-muted p-2 text-center">No active disclosures cited in thread.</p>
                ) : (
                  sources.map((s, idx) => (
                    <div key={idx} className="bg-near-black/50 p-2.5 rounded border border-border-divider/40 hover:border-vivid-red/50 transition-all cursor-pointer">
                      <div className="flex justify-between text-[10px] text-burnt-orange font-bold uppercase tracking-wider mb-1">
                        <span>Filing Snippet</span>
                        <span>Doc Section</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-text-muted">{s}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Accordion 2: Web references */}
          <div className="border border-border-divider/50 rounded-lg overflow-hidden bg-[#140910]/40">
            <button 
              onClick={() => setWebAccordOpen(!webAccordOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-primary-plum/10 text-xs font-bold text-text-light border-b border-border-divider/30"
            >
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-burnt-orange" />
                <span>Web intelligence links ({webSources.length})</span>
              </div>
              {webAccordOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {webAccordOpen && (
              <div className="p-3 space-y-2">
                {webSources.length === 0 ? (
                  <p className="text-[11px] text-text-muted p-2 text-center">No external intelligence links active.</p>
                ) : (
                  webSources.map((ws, idx) => (
                    <div key={idx} className="bg-near-black/50 p-2.5 rounded border border-border-divider/40 hover:border-vivid-red/50 transition-all cursor-pointer">
                      <div className="flex justify-between text-[10px] text-burnt-orange font-bold uppercase tracking-wider mb-1">
                        <span>Web Reference</span>
                        <Globe size={10} />
                      </div>
                      <p className="text-[11px] leading-relaxed text-text-muted">{ws}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
