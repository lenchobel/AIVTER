import React, { useState } from 'react';
import { Copy, Check, AlertCircle, User, Briefcase, Calendar, Clock, Hash, FileJson } from 'lucide-react';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-white/5 rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
    </button>
  );
};

const Section = ({ title, icon: Icon, children, isError }) => (
  <div className={`mb-4 rounded-xl border transition-all duration-200 hover:border-white/[0.08] ${isError ? 'border-rose-500/20 bg-rose-500/[0.03]' : 'border-white/[0.06] bg-zinc-900/50'}`}>
    <div className={`px-4 py-2.5 border-b rounded-t-xl ${isError ? 'border-rose-500/20 bg-rose-500/[0.05]' : 'border-white/[0.06] bg-zinc-900/80'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${isError ? 'text-rose-400' : 'text-zinc-500'}`} />
        <span className={`text-xs font-semibold tracking-wide ${isError ? 'text-rose-400' : 'text-zinc-300'}`}>{title}</span>
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const DataRow = ({ label, value, isMono = false }) => (
  <div className="flex items-start justify-between py-2 border-b border-white/[0.04] last:border-0 transition-colors duration-200 hover:bg-white/[0.02] -mx-4 px-4">
    <span className="text-xs text-zinc-500 font-medium">{label}</span>
    <span className={`text-xs text-zinc-300 text-right ${isMono ? 'font-mono' : ''}`}>
      {value || '—'}
    </span>
  </div>
);

export const Inspector = ({ flow, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <div className="text-xs text-zinc-500">Loading details...</div>
        </div>
      </div>
    );
  }
  
  if (!flow) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-900/50 flex items-center justify-center">
            <FileJson className="w-5 h-5 text-zinc-600" />
          </div>
          <div className="text-sm font-medium text-zinc-400">Select a call</div>
          <div className="text-xs text-zinc-600 mt-1">View detailed execution timeline</div>
        </div>
      </div>
    );
  }
  
  const summary = flow.summary || {};
  const hasError = flow.status === 'failed' || flow.status === 'error';
  
  // JSON syntax highlighting
  const formatJSON = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(
      /(".*?"):\s*(".*?"|\d+|true|false|null)/g,
      '<span class="json-key">$1</span>: <span class="json-string">$2</span>'
    ).replace(
      /(".*?"):\s*(\d+)/g,
      '<span class="json-key">$1</span>: <span class="json-number">$2</span>'
    ).replace(
      /(".*?"):\s*(true|false)/g,
      '<span class="json-key">$1</span>: <span class="json-boolean">$2</span>'
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-white/[0.06]">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Call Metadata */}
        <Section title="Call Metadata" icon={Hash}>
          <DataRow label="callId" value={flow.callId} isMono />
          <DataRow label="toolCallId" value={flow.toolCallId} isMono />
          <DataRow label="Status" value={flow.status} />
          <DataRow label="Duration" value={`${flow.durationMs}ms`} />
          <DataRow label="Stages" value={flow.stageCount} />
        </Section>
        
        {/* Booking Details */}
        {(summary.name || summary.service) && (
          <Section title="Booking Details" icon={Briefcase}>
            <DataRow label="Name" value={summary.name} />
            <DataRow label="Service" value={summary.service} />
            <DataRow label="Date" value={summary.date} />
            <DataRow label="Time" value={summary.time} />
            {summary.bookingId && (
              <DataRow label="Booking ID" value={summary.bookingId} isMono />
            )}
          </Section>
        )}
        
        {/* Error Section */}
        {hasError && summary.errorReason && (
          <Section title="Error Details" icon={AlertCircle} isError>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-rose-400">{summary.errorReason}</div>
                <div className="text-xs text-rose-400/60 mt-1 font-mono">
                  Failed at: {flow.timeline?.find(s => s.status === 'failed')?.label || 'Unknown stage'}
                </div>
              </div>
            </div>
          </Section>
        )}
        
        {/* Raw Payload */}
        {summary.rawPayload && (
          <Section title="Raw VAPI Payload" icon={FileJson}>
            <div className="relative group">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <CopyButton text={JSON.stringify(summary.rawPayload, null, 2)} />
              </div>
              <pre 
                className="text-xs overflow-x-auto bg-zinc-950 p-3 rounded-lg max-h-48 overflow-y-auto font-mono leading-relaxed border border-white/[0.04]"
                dangerouslySetInnerHTML={{ __html: formatJSON(summary.rawPayload) }}
              />
            </div>
          </Section>
        )}
        
        {/* Full Flow JSON */}
        <Section title="Complete Flow Data" icon={FileJson}>
          <div className="relative group">
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <CopyButton text={JSON.stringify(flow, null, 2)} />
            </div>
            <pre 
              className="text-xs overflow-x-auto bg-zinc-950 p-3 rounded-lg max-h-64 overflow-y-auto font-mono leading-relaxed border border-white/[0.04]"
              dangerouslySetInnerHTML={{ __html: formatJSON(flow) }}
            />
          </div>
        </Section>
      </div>
    </div>
  );
};

export default Inspector;
