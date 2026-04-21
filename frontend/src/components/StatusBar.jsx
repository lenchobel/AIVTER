import React from 'react';

const StatusBar = ({ isConnected, isPolling, lastUpdate }) => {
  const statusColor = isConnected ? 'bg-green-500' : 'bg-red-500';
  const statusText = isConnected ? 'Connected' : 'Disconnected';
  const pollingText = isPolling ? 'Live syncing...' : 'Not syncing';

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`}></div>
            <span className="text-sm font-medium">{statusText}</span>
          </div>
          <div className="text-sm text-gray-300">
            {pollingText}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
