import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Activity, Search, Filter, ChevronDown } from 'lucide-react';
import { apiService } from '../services/api';

const StatusBadge = ({ status }) => {
  const styles = {
    success: 'status-badge status-success',
    failed: 'status-badge status-failed',
    pending: 'status-badge status-pending',
    duplicate: 'status-badge bg-blue-500/10 text-blue-400 border border-blue-500/20',
  };

  const icons = {
    success: CheckCircle2,
    failed: XCircle,
    pending: Clock,
    duplicate: Activity,
  };

  const Icon = icons[status] || Clock;
  const style = styles[status] || styles.pending;

  return (
    <span className={style}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
};

const shortenId = (id) => {
  if (!id || id === 'unknown') return '—';
  return id.length > 12 ? `${id.slice(0, 8)}...` : id;
};

const CallCard = ({ flow, isSelected, onClick, index }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-white/[0.06] transition-all duration-200 ease-in-out hover:bg-white/[0.03] hover:translate-x-[2px] ${
        isSelected ? 'bg-indigo-500/[0.08] border-l-2 border-l-indigo-500' : 'bg-transparent'
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-400">{shortenId(flow.callId)}</span>
            <StatusBadge status={flow.status} />
          </div>
          <div className="text-sm font-medium text-slate-200 truncate">
            {flow.summary?.name || 'Unknown'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {flow.summary?.service || 'No service'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">
            {flow.createdAt && formatDistanceToNow(new Date(flow.createdAt), { addSuffix: true })}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1">
            {flow.durationMs}ms
          </div>
        </div>
      </div>
    </button>
  );
};

const CustomDropdown = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedLabel = options.find(opt => opt.value === value)?.label || 'Select';
  
  return (
    <div ref={dropdownRef} className={`custom-dropdown ${isOpen ? 'open' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 bg-zinc-900/50 border border-white/10 rounded-md hover:border-indigo-500/30 hover:text-zinc-200 transition-all duration-200 focus:outline-none focus:border-indigo-500/50"
      >
        <Filter className="w-3 h-3" />
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className="custom-dropdown-menu">
        {options.map((option) => (
          <div
            key={option.value}
            className={`custom-dropdown-item ${value === option.value ? 'active' : ''}`}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CallList = ({ selectedCallId, onSelectCall }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['flows'],
    queryFn: () => apiService.getFlows(100, 0),
  });
  
  const filterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
  ];

  const filteredFlows = useMemo(() => {
    if (!data?.flows) return [];
    
    return data.flows.filter(flow => {
      if (statusFilter !== 'all' && flow.status !== statusFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          flow.callId?.toLowerCase().includes(query) ||
          flow.summary?.name?.toLowerCase().includes(query) ||
          flow.summary?.service?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [data?.flows, statusFilter, searchQuery]);

  const stats = data?.stats || {};

  return (
    <div className="h-full flex flex-col panel">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Request Flows</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-xs text-zinc-500 font-medium">Live</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-white/[0.06] hover:border-white/[0.1] transition-colors duration-200">
            <div className="text-zinc-500 font-medium mb-0.5">Total</div>
            <div className="font-bold text-zinc-200 text-lg leading-none">{stats.total || 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 hover:border-emerald-500/30 transition-colors duration-200">
            <div className="text-emerald-400/80 font-medium mb-0.5">Success</div>
            <div className="font-bold text-emerald-400 text-lg leading-none">{stats.successful || 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/[0.08] border border-rose-500/20 hover:border-rose-500/30 transition-colors duration-200">
            <div className="text-rose-400/80 font-medium mb-0.5">Failed</div>
            <div className="font-bold text-rose-400 text-lg leading-none">{stats.failed || 0}</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search callId, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-xs bg-zinc-900/50 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-200"
          />
        </div>

        {/* Filter */}
        <CustomDropdown 
          value={statusFilter} 
          onChange={setStatusFilter} 
          options={filterOptions} 
        />
      </div>

      {/* Flow List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <div className="text-xs text-zinc-500">Loading flows...</div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="text-xs text-rose-400 mb-2 font-medium">⚠ Connection Error</div>
            <div className="text-xs text-zinc-500">Backend may be offline</div>
            <div className="text-xs text-zinc-600 mt-2 font-mono">{error.message}</div>
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-900/50 flex items-center justify-center text-xl">📭</div>
            <div className="text-xs text-zinc-400 mb-1 font-medium">No flows found</div>
            <div className="text-xs text-zinc-600">Make a VAPI call to see data</div>
          </div>
        ) : (
          <div>
            {filteredFlows.map((flow, index) => (
              <CallCard
                key={flow.callId}
                flow={flow}
                isSelected={flow.callId === selectedCallId}
                onClick={() => onSelectCall(flow.callId)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallList;
