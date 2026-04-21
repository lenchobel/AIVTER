import React from 'react';
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const StatusBadge = ({ status }) => {
  const styles = {
    confirmed: 'bg-emerald-500/[0.15] text-emerald-400',
    pending: 'bg-amber-500/[0.15] text-amber-400',
    cancelled: 'bg-rose-500/[0.15] text-rose-400',
  };

  const icons = {
    confirmed: CheckCircle,
    pending: Clock,
    cancelled: XCircle,
  };

  const Icon = icons[status] || Clock;
  const style = styles[status] || styles.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${style}`}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status}</span>
    </span>
  );
};

export const BookingCard = ({ booking, isSelected, onClick }) => {
  const bookingDate = parseISO(booking.date);
  const isTodayBooking = isToday(bookingDate);
  const isTomorrowBooking = isTomorrow(bookingDate);

  return (
    <div
      onClick={onClick}
      className={`
        group relative py-3 px-4 transition-all duration-200 ease-out cursor-pointer border-b border-white/[0.04] will-change-transform
        ${isSelected 
          ? 'bg-white/[0.05] border-l-2 border-l-indigo-500 border-b-transparent -ml-[1px] pl-[calc(1rem+1px)]' 
          : 'hover:bg-white/[0.03] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
        }
      `}
    >
      {/* Time indicator for today/tomorrow */}
      {(isTodayBooking || isTomorrowBooking) && (
        <div className="absolute top-2 right-2">
          <span className={`
            px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider
            ${isTodayBooking ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-700/50 text-zinc-400'}
          `}>
            {isTodayBooking ? 'Today' : 'Tomorrow'}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pr-16">
          {/* Patient name */}
          <h3 className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
            {booking.name}
          </h3>
          
          {/* Service */}
          <p className="text-xs text-zinc-500 mt-0.5 capitalize">
            {booking.service}
          </p>
          
          {/* Date & Time */}
          <div className="flex items-center gap-2 mt-1.5">
            <Calendar className="w-3 h-3 text-zinc-600" />
            <span className="text-xs text-zinc-500">
              {format(bookingDate, 'MMM d')} · {booking.time}
            </span>
          </div>
        </div>
        
        {/* Status badge */}
        <div className="flex-shrink-0 self-center">
          <StatusBadge status={booking.status} />
        </div>
      </div>
    </div>
  );
};

export default BookingCard;
