import React, { useState, useRef, useEffect } from 'react';
import { Plus, Terminal, ArrowUp, ThumbsUp, ThumbsDown, Copy, Share } from 'lucide-react';

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
      content: 'Upload a filing and ask questions about risks, revenue, supply chain, or regulatory disclosures. I will cite filing sections and web sources when available.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [openReasoningIdx, setOpenReasoningIdx] = useState<number | null>(null);

  const [sources, setSources] = useState<string[]>([]);
  const [webSources, setWebSources] = useState<string[]>([]);

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

    // Gather history
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
        
        // Update side panels based on citations
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
          logs: data.logs || []
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
    <div className="flex-1 flex h-[calc(100vh-10rem)] overflow-hidden animate-fade">
      {/* Left Column: Chat History list */}
      <div className="w-64 border-r border-outline-variant bg-surface-container-lowest flex flex-col hidden xl:flex">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-caps font-label-caps text-on-surface-variant font-bold">CHAT HISTORY</span>
          <button className="text-on-surface-variant hover:text-primary transition-all">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {messages.filter((m) => m.role === 'user').length === 0 ? (
            <p className="p-3 text-body-sm text-on-surface-variant">Start a new conversation below.</p>
          ) : (
            messages.filter((m) => m.role === 'user').slice(-3).map((m, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg border border-outline-variant/30">
                <p className="text-body-sm font-semibold text-on-surface line-clamp-2">{m.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center: Conversation View */}
      <div className="flex-1 flex flex-col relative bg-background-deep overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          {messages.map((msg, index) => (
            <div key={index} className="max-w-3xl mx-auto flex gap-6">
              <div className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center border ${
                msg.role === 'user' 
                  ? 'bg-surface-container-high border-outline-variant text-on-surface-variant' 
                  : 'bg-secondary-container text-on-secondary-container'
              }`}>
                <span className="material-symbols-outlined text-sm">
                  {msg.role === 'user' ? 'person' : 'psychology'}
                </span>
              </div>

              <div className="flex-1 space-y-4 pt-1">
                {/* User query and tags */}
                {msg.role === 'user' ? (
                  <div>
                    <h2 className="text-headline-md font-headline-md text-on-surface font-semibold mb-2">{msg.content}</h2>
                    <div className="flex gap-2">
                      {msg.toolsUsed?.map((t, tIdx) => (
                        <span key={tIdx} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                          t.includes('RAG') ? 'bg-secondary-container/20 text-secondary border-secondary/20' : 'bg-tertiary-container/20 text-tertiary border-tertiary/20'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">{t.includes('RAG') ? 'database' : 'public'}</span>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Assistant Output */
                  <div className="space-y-4">
                    {/* Collapsible Reasoning Log */}
                    {msg.logs && msg.logs.length > 0 && (
                      <div className="ai-purple-card p-4 rounded-lg">
                        <button 
                          onClick={() => setOpenReasoningIdx(openReasoningIdx === index ? null : index)}
                          className="flex items-center justify-between w-full text-secondary text-left font-label-caps"
                        >
                          <div className="flex items-center gap-2">
                            <Terminal size={14} />
                            <span>AI REASONING EXECUTION TRACE</span>
                          </div>
                          <span className="text-[11px]">{openReasoningIdx === index ? 'Collapse [-]' : 'Expand [+]'}</span>
                        </button>
                        
                        {openReasoningIdx === index && (
                          <div className="mt-3 space-y-2 border-t border-outline-variant/30 pt-3 max-h-48 overflow-y-auto custom-scrollbar font-data-mono text-body-sm text-on-surface-variant">
                            {msg.logs.map((log, lIdx) => (
                              <div key={lIdx} className="mb-2">
                                <strong className="text-secondary font-bold">[{log.step}]</strong>
                                <pre className="whitespace-pre-wrap pl-3">{log.text}</pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Synthesis answer */}
                    <div className="text-body-md text-on-surface-variant leading-relaxed space-y-4">
                      {msg.content.includes("**Sources & Citations:**") ? (
                        <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />') }} />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {/* Message Actions */}
                    <div className="flex items-center gap-4 pt-4 border-t border-outline-variant text-[11px] text-on-surface-variant">
                      <button className="flex items-center gap-1.5 hover:text-on-surface transition-colors">
                        <ThumbsUp size={12} /> Helpful
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-on-surface transition-colors">
                        <ThumbsDown size={12} /> Unhelpful
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-on-surface transition-colors ml-auto">
                        <Copy size={12} /> Copy
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-on-surface transition-colors">
                        <Share size={12} /> Share
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="max-w-3xl mx-auto flex gap-6">
              <div className="w-8 h-8 rounded bg-secondary-container flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] text-on-secondary animate-pulse">psychology</span>
              </div>
              <div className="flex-1 space-y-2 pt-2">
                <div className="h-4 bg-surface-container rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-surface-container rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-6 bg-background-deep/50 backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto glass-panel rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-2xl">
            <div className="flex items-center px-3 py-2">
              <input 
                type="text" 
                placeholder="Ask follow-up details on debt, supply chains, or revenue targets..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 bg-transparent border-none text-body-md focus:ring-0 text-on-surface placeholder:text-on-surface-variant"
              />
              <button 
                type="submit" 
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-on-primary hover:brightness-110 disabled:opacity-50 transition-all"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </form>
          <p className="text-center text-[10px] text-on-surface-variant mt-4">AI generates summaries. Cross-reference using citations on the right panel.</p>
        </div>
      </div>

      {/* Right Column: Telemetry & Citation Panel */}
      <div className="w-80 border-l border-outline-variant bg-surface-container-low flex flex-col p-4 overflow-y-auto custom-scrollbar">
        <div className="p-2 border-b border-outline-variant/30 mb-4">
          <h2 className="text-label-caps font-bold text-on-surface">SOURCES &amp; EVIDENCE</h2>
        </div>

        <div className="flex-1 space-y-6">
          {/* Filing Sources */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-on-surface-variant uppercase">
              <span>Filing Sources ({sources.length})</span>
            </div>
            <div className="space-y-2">
              {sources.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant p-3">Citations appear here after the assistant retrieves filing context.</p>
              ) : (
                sources.map((s, idx) => (
                <div key={idx} className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1 text-body-sm font-bold text-on-surface">
                    <span>SEC Filing</span>
                    <span className="text-positive text-[10px]">Match Verified</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">{s}</p>
                </div>
              ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-on-surface-variant uppercase">
              <span>Web References ({webSources.length})</span>
            </div>
            <div className="space-y-2">
              {webSources.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant p-3">Web sources appear here when the agent runs a web search.</p>
              ) : (
                webSources.map((ws, idx) => (
                <div key={idx} className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant hover:border-tertiary/40 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1 text-body-sm font-bold text-on-surface">
                    <span>Web Intelligence</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-snug">{ws}</p>
                </div>
              ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
