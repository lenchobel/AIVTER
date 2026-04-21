import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isToday, isTomorrow, isPast, isFuture, startOfDay, compareAsc } from 'date-fns';
import { Search, Inbox, ChevronDown } from 'lucide-react';
import { BookingCard } from './BookingCard';
import { apiService } from '../services/api';

const FilterPill = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);
  
  React.useEffect(() => {
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
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-full transition-all duration-200 focus:outline-none focus-visible:border-white/[0.18]"
      >
        <span className="text-zinc-300 group-hover:text-zinc-200 transition-colors duration-200">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 group-hover:text-zinc-400 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-40 bg-[#0a0a0b] border border-white/[0.08] rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in" style={{ transformOrigin: 'top left' }}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                value === option.value 
                  ? 'text-zinc-100 bg-white/[0.06]' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GroupHeader = ({ title, count }) => (
  <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0 px-1">
    <h3 className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">{title}</h3>
    <span className="text-[11px] font-medium text-zinc-700">
      {count}
    </span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
      <Inbox className="w-5 h-5 text-zinc-600" />
    </div>
    <h3 className="text-sm font-medium text-zinc-500">No bookings yet</h3>
    <p className="text-xs text-zinc-600 mt-1 max-w-[200px]">
      Appointments appear here when created
    </p>
  </div>
);

export const BookingsFeed = ({ selectedBookingId, onSelectBooking, searchQuery, setSearchQuery, statusFilter, setStatusFilter, dateFilter, setDateFilter }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiService.getBookings(),
  });

  const bookings = data?.bookings || [];

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          booking.name?.toLowerCase().includes(query) ||
          booking.service?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        return false;
      }
      
      // Date filter
      if (dateFilter !== 'all') {
        const bookingDate = parseISO(booking.date);
        const today = startOfDay(new Date());
        
        switch (dateFilter) {
          case 'today':
            return isToday(bookingDate);
          case 'upcoming':
            return isFuture(bookingDate) && !isToday(bookingDate);
          case 'past':
            return isPast(bookingDate) && !isToday(bookingDate);
          default:
            return true;
        }
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by date, then by time
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      const dateCompare = compareAsc(dateA, dateB);
      if (dateCompare !== 0) return dateCompare;
      return a.time?.localeCompare(b.time || '');
    });
  }, [bookings, searchQuery, statusFilter, dateFilter]);

  // Group bookings
  const groupedBookings = useMemo(() => {
    const groups = {
      today: [],
      tomorrow: [],
      upcoming: [],
      past: []
    };
    
    filteredBookings.forEach(booking => {
      const bookingDate = parseISO(booking.date);
      
      if (isToday(bookingDate)) {
        groups.today.push(booking);
      } else if (isTomorrow(bookingDate)) {
        groups.tomorrow.push(booking);
      } else if (isFuture(bookingDate)) {
        groups.upcoming.push(booking);
      } else {
        groups.past.push(booking);
      }
    });
    
    return groups;
  }, [filteredBookings]);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'pending', label: 'Pending' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const dateOptions = [
    { value: 'all', label: 'All Dates' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
  ];

  const totalCount = bookings.length;
  const filteredCount = filteredBookings.length;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
          <div className="h-9 bg-zinc-800 rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-rose-400">Failed to load bookings</p>
          <p className="text-xs text-zinc-500 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#09090B]">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white tracking-tight">Bookings</h2>
          <span className="text-xs text-zinc-600 font-mono">
            {filteredCount}/{totalCount}
          </span>
        </div>
        
        <div className="flex items-start gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              type="text"
              placeholder="Search patients or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.16] focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all duration-200"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <FilterPill 
              value={statusFilter} 
              onChange={setStatusFilter} 
              options={statusOptions}
            />
            <FilterPill 
              value={dateFilter} 
              onChange={setDateFilter} 
              options={dateOptions}
            />
          </div>
        </div>
      </div>

      {/* Booking List */}
      <div className="flex-1 overflow-y-auto">
        {filteredBookings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4 p-2">
            {/* Today */}
            {groupedBookings.today.length > 0 && (
              <div>
                <GroupHeader title="Today" count={groupedBookings.today.length} />
                <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                  {groupedBookings.today.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isSelected={booking.id === selectedBookingId}
                      onClick={() => onSelectBooking(booking.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow */}
            {groupedBookings.tomorrow.length > 0 && (
              <div>
                <GroupHeader title="Tomorrow" count={groupedBookings.tomorrow.length} />
                <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                  {groupedBookings.tomorrow.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isSelected={booking.id === selectedBookingId}
                      onClick={() => onSelectBooking(booking.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {groupedBookings.upcoming.length > 0 && (
              <div>
                <GroupHeader title="Upcoming" count={groupedBookings.upcoming.length} />
                <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                  {groupedBookings.upcoming.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isSelected={booking.id === selectedBookingId}
                      onClick={() => onSelectBooking(booking.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {groupedBookings.past.length > 0 && (
              <div>
                <GroupHeader title="Past" count={groupedBookings.past.length} />
                <div className="rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04] opacity-50">
                  {groupedBookings.past.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isSelected={booking.id === selectedBookingId}
                      onClick={() => onSelectBooking(booking.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingsFeed;
