import React from 'react';
import { CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const StageIcon = ({ status }) => {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-rose-500" />;
  return <Clock className="w-5 h-5 text-zinc-500" />;
};

const StageRow = ({ stage, index, total, isExpanded, onToggle }) => {
  const isLast = index === total - 1;
  
  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-24px)] bg-zinc-800" />
      )}
      
      <div 
        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-all duration-200"
        onClick={onToggle}
      >
        {/* Icon column - vertically centered */}
        <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-200 ${
            stage.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_12px_rgba(34,197,94,0.25)]' :
            stage.status === 'failed' ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]' :
            'bg-zinc-900 border-zinc-700'
          }`}>
            <StageIcon status={stage.status} />
          </div>
        </div>
        
        {/* Content - vertically aligned with icon */}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{stage.label}</span>
              <span className="text-xs text-zinc-600 font-mono">({stage.stage})</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{stage.description}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-mono text-zinc-600">{stage.durationMs}ms</span>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform duration-200" /> : <ChevronRight className="w-4 h-4 text-zinc-500 transition-transform duration-200" />}
          </div>
        </div>
      </div>
      
      {/* Expanded metadata */}
      {isExpanded && stage.metadata && Object.keys(stage.metadata).length > 0 && (
        <div className="ml-[52px] mt-2 p-3 bg-zinc-900/50 rounded-lg border border-white/[0.06] animate-fade-in">
          <div className="text-xs font-medium text-zinc-500 mb-2">Metadata:</div>
          <pre className="text-xs text-zinc-400 overflow-x-auto font-mono leading-relaxed">
            {JSON.stringify(stage.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export const Timeline = ({ flow, isLoading }) => {
  const [expandedStages, setExpandedStages] = useState(new Set());
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading flow details...</div>
      </div>
    );
  }
  
  if (!flow) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-slate-500 mb-1">Select a call from the list</div>
          <div className="text-xs text-slate-400">View detailed execution timeline</div>
        </div>
      </div>
    );
  }
  
  const toggleStage = (stageName) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageName)) {
      newExpanded.delete(stageName);
    } else {
      newExpanded.add(stageName);
    }
    setExpandedStages(newExpanded);
  };
  
  const statusColor = flow.status === 'success' ? 'text-emerald-500' : 
                     flow.status === 'failed' ? 'text-rose-500' : 'text-amber-500';
  
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Execution Timeline</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{flow.stageCount} stages completed</p>
          </div>
          <div className={`text-sm font-semibold uppercase tracking-wider ${statusColor}`}>
            {flow.status}
          </div>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {flow.timeline?.map((stage, index) => (
          <StageRow
            key={stage.stage}
            stage={stage}
            index={index}
            total={flow.timeline.length}
            isExpanded={expandedStages.has(stage.stage)}
            onToggle={() => toggleStage(stage.stage)}
          />
        ))}
        
        {/* Summary footer */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Total Duration</span>
            <span className="font-mono font-medium text-zinc-300">{flow.durationMs}ms</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
            <span>Started</span>
            <span className="text-zinc-400">{new Date(flow.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
