import React from 'react';

const StatsPanel = ({ totalBookings, latestBooking, isLoading }) => {
  const getLatestName = () => {
    if (isLoading) return 'Loading...';
    if (!latestBooking) return 'No bookings';
    return latestBooking.name || 'Unknown';
  };

  const getLatestTime = () => {
    if (isLoading) return 'Loading...';
    if (!latestBooking) return 'No bookings';
    if (latestBooking.time) return latestBooking.time;
    if (latestBooking.createdAt) return new Date(latestBooking.createdAt).toLocaleTimeString();
    return 'Unknown';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="text-2xl font-bold text-blue-600">
          {isLoading ? '...' : totalBookings}
        </div>
        <div className="text-sm text-gray-600 mt-1">Total Bookings</div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="text-lg font-semibold text-green-600">
          {getLatestName()}
        </div>
        <div className="text-sm text-gray-600 mt-1">Latest Booking Name</div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="text-lg font-semibold text-purple-600">
          {getLatestTime()}
        </div>
        <div className="text-sm text-gray-600 mt-1">Latest Booking Time</div>
      </div>
    </div>
  );
};

export default StatsPanel;
