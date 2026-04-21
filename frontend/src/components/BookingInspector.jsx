import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { X, Copy, Check, Calendar, Clock, User, Briefcase, FileText, Activity, ArrowRight } from 'lucide-react';
import { apiService } from '../services/api';

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900/50 hover:bg-zinc-800 rounded-md transition-all duration-200"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    confirmed: 'bg-emerald-500/[0.15] text-emerald-400',
    pending: 'bg-amber-500/[0.15] text-amber-400',
    cancelled: 'bg-rose-500/[0.15] text-rose-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${styles[status] || styles.pending}`}>
      <span className="capitalize">{status}</span>
    </span>
  );
};

const Section = ({ title, icon: Icon, children }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-zinc-500" />
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</h4>
    </div>
    {children}
  </div>
);

const DetailRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
    {Icon && <Icon className="w-4 h-4 text-zinc-600 mt-0.5" />}
    <div className="flex-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200 mt-0.5">{value || '—'}</p>
    </div>
  </div>
);

export const BookingInspector = ({ bookingId, onClose, onNavigateToDebug }) => {
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiService.getBookingById(bookingId),
    enabled: !!bookingId,
  });

  if (!bookingId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-500">Select a booking</p>
          <p className="text-xs text-zinc-600 mt-1">Click a card to view details</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
            <X className="w-7 h-7 text-rose-500" />
          </div>
          <p className="text-sm font-medium text-rose-400">Failed to load booking</p>
          <p className="text-xs text-zinc-500 mt-1">{error?.message || 'Booking not found'}</p>
        </div>
      </div>
    );
  }

  const bookingDate = booking?.date ? parseISO(booking.date) : null;
  const hasFlow = booking?.callId || booking?.toolCallId;

  return (
    <div className="h-full flex flex-col bg-[#09090B] border-l border-white/[0.08] shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/[0.08] bg-[#09090B]/80 backdrop-blur-md">
        <div className="flex-1 min-w-0 pr-4">
          <StatusBadge status={booking.status} />
          <h2 className="text-xl font-semibold text-white mt-3 truncate tracking-tight">
            {booking.name}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {bookingDate && format(bookingDate, 'EEEE, MMMM d')} · {booking.time}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Service */}
        <Section title="Service Details" icon={Briefcase}>
          <div className="bg-zinc-900/30 rounded-lg p-3 border border-white/[0.04]">
            <DetailRow 
              label="Service"
              value={booking.service}
              icon={Briefcase}
            />
            {booking.notes && (
              <DetailRow 
                label="Notes"
                value={booking.notes}
                icon={FileText}
              />
            )}
          </div>
        </Section>

        {/* Booking Info */}
        <Section title="Booking Info" icon={Calendar}>
          <div className="bg-zinc-900/30 rounded-lg p-3 border border-white/[0.04]">
            <DetailRow 
              label="Booking ID"
              value={booking.id}
              icon={FileText}
            />
            {booking.createdAt && (
              <DetailRow 
                label="Created"
                value={format(parseISO(booking.createdAt), 'MMM d, yyyy · h:mm a')}
                icon={Clock}
              />
            )}
          </div>
          <div className="mt-2">
            <CopyButton text={booking.id} label="Copy ID" />
          </div>
        </Section>

        {/* Debug Link */}
        {hasFlow && (
          <Section title="Debug" icon={Activity}>
            <button
              onClick={() => onNavigateToDebug(booking.callId || booking.toolCallId)}
              className="w-full flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500/15 hover:border-indigo-500/30 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">View Execution Trace</span>
              </div>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
            <p className="text-xs text-zinc-600 mt-2">
              View the VAPI flow that created this booking
            </p>
          </Section>
        )}

        {/* Actions */}
        <Section title="Actions" icon={FileText}>
          <div className="space-y-2">
            <button
              className="w-full py-2.5 px-3 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all duration-200"
            >
              Reschedule
            </button>
            {booking.status !== 'cancelled' && (
              <button
                className="w-full py-2.5 px-3 rounded-lg text-sm font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/15 transition-all duration-200"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
};

export default BookingInspector;
