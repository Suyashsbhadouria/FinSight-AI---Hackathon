import React, { useState } from 'react';
import { Check } from 'lucide-react';

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
    <div className="w-full max-w-4xl mx-auto py-6 animate-fade">
      {/* Header Section */}
      <div className="mb-8">
        <h2 className="text-headline-lg font-headline-lg text-primary font-bold mb-2">Filing Upload & Ingestion</h2>
        <p className="text-on-surface-variant text-body-md">Ingest regulatory SEC filings for deep risk analysis and AI-powered extraction.</p>
      </div>

      {/* Upload Zone */}
      {!uploading ? (
        <label className="group border-2 border-dashed border-outline-variant bg-surface-container-low hover:border-primary/50 hover:bg-surface-container transition-all duration-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer min-h-[320px] mb-6 block">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[40px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
          </div>
          <p className="text-headline-md font-headline-md mb-2">Drag and drop filing PDF here</p>
          <p className="text-on-surface-variant text-body-sm mb-6">Supports standard SEC PDF disclosures (Max 500MB)</p>
          <span className="px-8 py-2.5 bg-surface-container-highest border border-outline-variant text-on-surface rounded-lg font-body-md hover:bg-surface-bright transition-colors">
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
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center animate-pulse-custom">
                <span className="material-symbols-outlined text-primary">description</span>
              </div>
              <div>
                <p className="font-data-mono text-body-sm text-primary uppercase">FILE: {fileId}</p>
                <p className="text-headline-md font-headline-md font-bold">Ingesting Annual Report</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-data-mono text-headline-md text-primary text-xl font-bold">{Math.floor(progress)}%</p>
              <p className="text-label-caps font-label-caps text-on-surface-variant">PROCESSING LAYOUT</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="relative w-full mb-8">
            <div className="flex items-center justify-between relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 1 ? 'bg-positive' : 'bg-primary ring-4 ring-primary/20'}`}>
                  {currentStep > 1 ? <Check size={14} className="text-background-deep font-bold" /> : <span className="text-xs">1</span>}
                </div>
                <span className={`text-[10px] font-label-caps ${currentStep >= 1 ? 'text-primary' : 'text-on-surface-variant'}`}>Upload</span>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 2 ? 'bg-positive' : currentStep === 2 ? 'bg-primary ring-4 ring-primary/20' : 'bg-surface-container-highest'}`}>
                  {currentStep > 2 ? <Check size={14} className="text-background-deep font-bold" /> : <span className="text-xs">2</span>}
                </div>
                <span className={`text-[10px] font-label-caps ${currentStep >= 2 ? 'text-primary' : 'text-on-surface-variant'}`}>Parse</span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 3 ? 'bg-positive' : currentStep === 3 ? 'bg-primary ring-4 ring-primary/20' : 'bg-surface-container-highest'}`}>
                  {currentStep > 3 ? <Check size={14} className="text-background-deep font-bold" /> : <span className="text-xs">3</span>}
                </div>
                <span className={`text-[10px] font-label-caps ${currentStep >= 3 ? 'text-primary' : 'text-on-surface-variant'}`}>Extraction</span>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep > 4 ? 'bg-positive' : currentStep === 4 ? 'bg-primary ring-4 ring-primary/20 animate-pulse' : 'bg-surface-container-highest'}`}>
                  {currentStep > 4 ? <Check size={14} className="text-background-deep font-bold" /> : <span className="text-xs">4</span>}
                </div>
                <span className={`text-[10px] font-label-caps ${currentStep >= 4 ? 'text-primary' : 'text-on-surface-variant'}`}>Risk Index</span>
              </div>

              {/* Step 5 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-background-deep ${currentStep === 5 ? 'bg-positive ring-4 ring-positive/20' : 'bg-surface-container-highest'}`}>
                  <span className="text-xs">5</span>
                </div>
                <span className={`text-[10px] font-label-caps ${currentStep === 5 ? 'text-positive font-bold' : 'text-on-surface-variant'}`}>Ready</span>
              </div>
            </div>

            {/* Progress line */}
            <div className="absolute top-4 left-0 w-full h-[2px] bg-surface-container-highest -z-0">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(currentStep - 1) * 25}%` }}></div>
            </div>
          </div>

          {/* Status Console */}
          <div className="bg-background-deep/50 rounded-lg p-4 ai-purple-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <p className="font-data-mono text-body-sm text-on-surface">Console Telemetry Log</p>
            </div>
            <div className="space-y-1 pl-5 font-data-mono text-body-sm text-on-surface-variant max-h-32 overflow-y-auto">
              {logs.map((log, index) => (
                <p key={index} className={index === logs.length - 1 ? "text-primary" : "opacity-60"}>{log}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-critical/10 border border-critical/20 rounded-xl p-4 flex items-center gap-3 text-critical text-body-sm mb-6">
          <span className="material-symbols-outlined">alert_circle</span>
          <span>{error}</span>
        </div>
      )}

      {/* Bento Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-secondary">security</span>
            <h3 className="text-body-md font-bold">Encrypted Isolation</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            All uploaded filings are protected in transit and at rest. Documents are siloed per analyst profile and are never processed for public model training.
          </p>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-tertiary">bolt</span>
            <h3 className="text-body-md font-bold">Auto-Extraction</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            Our parser automatically categorizes sections (Item 1, 1A, 7, 8) so you don't have to search manually. Embeddings populate immediate context tools.
          </p>
        </div>
      </div>
    </div>
  );
};
