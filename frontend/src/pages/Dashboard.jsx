import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Terminal } from 'lucide-react';
import { CallList } from '../components/CallList';
import { Timeline } from '../components/Timeline';
import { Inspector } from '../components/Inspector';
import { apiService } from '../services/api';

const Dashboard = () => {
  const [selectedCallId, setSelectedCallId] = useState(null);

  // Fetch selected flow details
  const { data: flowData, isLoading: flowLoading } = useQuery({
    queryKey: ['flow', selectedCallId],
    queryFn: () => apiService.getFlowByCallId(selectedCallId),
    enabled: !!selectedCallId,
  });

  const selectedFlow = flowData?.flow;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-200 font-sans">
      {/* Header */}
      <header className="h-14 bg-zinc-900/80 backdrop-blur-md border-b border-white/[0.06] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">VAPI Flow Inspector</h1>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-emerald-400 font-medium">Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Terminal className="w-3.5 h-3.5" />
            <span>Polling 3s</span>
          </div>
        </div>
      </header>

      {/* 3-Panel Layout - Consistent Height */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Call List */}
        <div className="w-[320px] shrink-0 border-r border-white/[0.06] bg-zinc-900/30 h-full">
          <CallList 
            selectedCallId={selectedCallId}
            onSelectCall={setSelectedCallId}
          />
        </div>

        {/* Center Panel - Timeline */}
        <div className="flex-1 border-r border-white/[0.06] min-w-[400px] bg-zinc-950 h-full">
          <Timeline 
            flow={selectedFlow}
            isLoading={flowLoading}
          />
        </div>

        {/* Right Panel - Inspector */}
        <div className="w-[380px] shrink-0 bg-zinc-900/30 h-full">
          <Inspector 
            flow={selectedFlow}
            isLoading={flowLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
