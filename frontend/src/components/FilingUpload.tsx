import React, { useState } from 'react';
import { Check, UploadCloud, FileText, AlertTriangle, Shield, Zap } from 'lucide-react';

interface FilingUploadProps {
  onUploadSuccess: (details: {
    filename: string;
    company_name: string;
    total_pages: number;
    sections: string[];
  }) => void;
}

export const FilingUpload: React.FC<FilingUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileId, setFileId] = useState('');
  const [currentStep, setCurrentStep] = useState(1); // 1 to 5
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([
    "System standby. Waiting for document upload..."
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF documents are supported currently.');
      return;
    }

    setUploading(true);
    setError('');
    setFileId(file.name);
    setLogs([]);
    addLog(`Initiating upload of file: ${file.name}`);
    
    // Step 1: Uploading
    setCurrentStep(1);
    setProgress(15);

    const formData = new FormData();
    formData.append('file', file);

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev < 40) return prev + 8;
        if (prev < 65) {
          setCurrentStep(2); // Parsing
          return prev + 5;
        }
        if (prev < 85) {
          setCurrentStep(3); // Extraction
          return prev + 4;
        }
        return prev;
      });
    }, 450);

    try {
      addLog("Transmitting byte streams to platform storage...");
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressTimer);

      if (response.ok) {
        setProgress(90);
        setCurrentStep(4); // Risk Analysis
        addLog("PDF segments successfully uploaded. Parsing layout headers...");
        
        const data = await response.json();
        
        addLog(`Layout matched. Company identified: ${data.company_name}`);
        addLog(`Extracted ${data.sections_extracted.length} sections across ${data.total_pages} pages.`);
        addLog("Generating dense vectors and populating RAG index...");

        // Auto trigger risk analysis backend compilation
        setTimeout(async () => {
          try {
            addLog("Executing AI Risk Analysis Engine...");
            const riskResponse = await fetch('/api/risks');
            if (riskResponse.ok) {
              addLog("AI risk vectors mapped successfully.");
            }
          } catch (err) {
            addLog("Warning: Risk pre-calculation timed out, will lazy-load.");
          }
          
          setProgress(100);
          setCurrentStep(5); // Finalizing
          addLog("All stages completed. System indexed and ready for queries.");
          
          setTimeout(() => {
            setUploading(false);
            onUploadSuccess({
              filename: data.filename,
              company_name: data.company_name,
              total_pages: data.total_pages,
              sections: data.sections_extracted
            });
          }, 800);
        }, 1200);

      } else {
        const errData = await response.json();
        setError(errData.detail || 'Filing processing error.');
        addLog("Error: Parsing pipeline returned a non-200 state.");
        setUploading(false);
      }
    } catch (err) {
      clearInterval(progressTimer);
      setError('Connection failure uploading PDF document.');
      addLog("Error: Connection timeout.");
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 animate-stagger-1 font-sans-brand">
      {/* Header Section */}
      <div className="mb-8 pb-4 border-b border-border-divider">
        <span className="text-[10px] uppercase font-bold tracking-widest text-burnt-orange">INGESTION PANEL</span>
        <h2 className="text-3xl font-serif-display text-text-light font-bold mt-1">Filing Upload & Ingestion</h2>
      </div>

      {/* Upload Zone */}
      {!uploading ? (
        <label className="group border-2 border-dashed border-border-divider bg-near-black hover:border-vivid-red hover:bg-[#1A0F14]/40 transition-all duration-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer min-h-[320px] mb-6 block">
          <div className="w-16 h-16 rounded-full bg-primary-plum/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-all border border-brand-crimson/20">
            <UploadCloud size={28} className="text-burnt-orange" />
          </div>
          <p className="text-sm font-bold text-text-light mb-2">Drag and drop filing PDF here</p>
          <p className="text-text-muted text-[11px] mb-6">Supports standard SEC PDF disclosures (Max 500MB)</p>
          <span className="px-6 py-2 bg-[#0F0A0D] border border-border-divider text-text-light rounded font-bold text-xs hover:border-burnt-orange transition-all">
            Browse Files
          </span>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>
      ) : (
        /* Active Processing State */
        <div className="glass-panel rounded-xl p-6 mb-6 overflow-hidden relative">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-plum/30 rounded-lg flex items-center justify-center border border-brand-crimson/20">
                <FileText size={20} className="text-burnt-orange" />
              </div>
              <div>
                <p className="font-data-mono text-[10px] text-burnt-orange uppercase">FILE: {fileId}</p>
                <p className="text-base font-bold text-text-light">Ingesting Annual Report</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-data-mono text-text-light text-xl font-bold">{Math.floor(progress)}%</p>
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">PROCESSING LAYOUT</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="relative w-full mb-8 px-4">
            <div className="flex items-center justify-between relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 1 ? 'bg-primary-plum text-text-light' : 'bg-[#FF5733] text-text-light ring-4 ring-[#FF5733]/20'}`}>
                  {currentStep > 1 ? <Check size={12} className="font-bold" /> : <span className="text-xs font-bold">1</span>}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${currentStep >= 1 ? 'text-burnt-orange' : 'text-text-muted'}`}>Upload</span>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 2 ? 'bg-primary-plum text-text-light' : currentStep === 2 ? 'bg-[#FF5733] text-text-light ring-4 ring-[#FF5733]/20' : 'bg-near-black text-text-muted'}`}>
                  {currentStep > 2 ? <Check size={12} className="font-bold" /> : <span className="text-xs font-bold">2</span>}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${currentStep >= 2 ? 'text-burnt-orange' : 'text-text-muted'}`}>Parse</span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 3 ? 'bg-primary-plum text-text-light' : currentStep === 3 ? 'bg-[#FF5733] text-text-light ring-4 ring-[#FF5733]/20' : 'bg-near-black text-text-muted'}`}>
                  {currentStep > 3 ? <Check size={12} className="font-bold" /> : <span className="text-xs font-bold">3</span>}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${currentStep >= 3 ? 'text-burnt-orange' : 'text-text-muted'}`}>Extraction</span>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 4 ? 'bg-primary-plum text-text-light' : currentStep === 4 ? 'bg-[#FF5733] text-text-light ring-4 ring-[#FF5733]/20 animate-pulse' : 'bg-near-black text-text-muted'}`}>
                  {currentStep > 4 ? <Check size={12} className="font-bold" /> : <span className="text-xs font-bold">4</span>}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${currentStep >= 4 ? 'text-burnt-orange' : 'text-text-muted'}`}>Risk Index</span>
              </div>

              {/* Step 5 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep === 5 ? 'bg-primary-plum text-text-light ring-4 ring-primary-plum/20' : 'bg-near-black text-text-muted'}`}>
                  <span className="text-xs font-bold">5</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${currentStep === 5 ? 'text-text-light font-bold' : 'text-text-muted'}`}>Ready</span>
              </div>
            </div>

            {/* Progress line */}
            <div className="absolute top-4 left-0 w-full h-[2px] bg-border-divider -z-0">
              <div className="h-full bg-gradient-to-r from-vivid-red to-burnt-orange transition-all duration-300" style={{ width: `${(currentStep - 1) * 25}%` }}></div>
            </div>
          </div>

          {/* Status Console */}
          <div className="bg-[#0A060A] rounded-lg p-4 border border-border-divider">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-pulse"></div>
              <p className="font-data-mono text-[10px] text-text-light uppercase tracking-wider">Console Telemetry Log</p>
            </div>
            <div className="space-y-1 pl-3 font-data-mono text-[11px] text-text-muted max-h-32 overflow-y-auto custom-scrollbar">
              {logs.map((log, index) => (
                <p key={index} className={index === logs.length - 1 ? "text-burnt-orange" : "opacity-60"}>{log}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-vivid-red/10 border border-vivid-red/20 rounded-xl p-4 flex items-center gap-2.5 text-vivid-red text-xs mb-6">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bento Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3 text-text-light">
            <Shield size={16} className="text-burnt-orange" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Encrypted Isolation</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            All uploaded filings are protected in transit and at rest. Documents are siloed per analyst profile and are never processed for public model training.
          </p>
        </div>
        
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3 text-text-light">
            <Zap size={16} className="text-burnt-orange" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Auto-Extraction</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Our parser automatically categorizes sections (Item 1, 1A, 7, 8) so you don't have to search manually. Embeddings populate immediate context tools.
          </p>
        </div>
      </div>
    </div>
  );
};
