import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Activity, LayoutGrid, Users } from 'lucide-react';
import { BookingsFeed } from '../components/BookingsFeed';
import { BookingInspector } from '../components/BookingInspector';

const BookingsPage = () => {
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const navigate = useNavigate();

  const handleNavigateToDebug = (callId) => {
    navigate(`/debug?callId=${callId}`);
  };

  return (
    <div className="h-screen flex flex-col bg-[#09090B] text-zinc-200 font-sans">
      {/* Header */}
      <header className="h-14 bg-[#09090B]/80 backdrop-blur-md border-b border-white/[0.08] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Bookings</h1>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-emerald-400 font-medium">Live</span>
          </div>
          <button
            onClick={() => navigate('/debug')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Flow Inspector</span>
          </button>
        </div>
      </header>

      {/* 3-Zone Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT - Optional narrow sidebar */}
        <aside className="w-14 shrink-0 border-r border-white/[0.08] bg-[#09090B] h-full flex flex-col items-center py-3 gap-2">
          <button
            disabled
            title="Coming soon"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-700 bg-transparent cursor-not-allowed"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            disabled
            title="Coming soon"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-700 bg-transparent cursor-not-allowed"
          >
            <Users className="w-4 h-4" />
          </button>
        </aside>

        {/* CENTER - Primary content */}
        <main className="flex-1 h-full overflow-hidden">
          <BookingsFeed 
            selectedBookingId={selectedBookingId}
            onSelectBooking={setSelectedBookingId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
          />
        </main>

        {/* RIGHT - Context inspector drawer */}
        {selectedBookingId && (
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200"
            onClick={() => setSelectedBookingId(null)}
            aria-label="Close inspector"
          />
        )}

        <div
          className={`absolute top-0 right-0 h-full w-[420px] bg-[#09090B] border-l border-white/[0.08] transform transition-transform duration-300 ease-out will-change-transform ${
            selectedBookingId ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <BookingInspector 
            bookingId={selectedBookingId}
            onClose={() => setSelectedBookingId(null)}
            onNavigateToDebug={handleNavigateToDebug}
          />
        </div>
      </div>
    </div>
  );
};

export default BookingsPage;
