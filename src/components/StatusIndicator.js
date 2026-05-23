'use client';

import { formatLastSeen } from '@/lib/utils';

export default function StatusIndicator({ 
  lastSeen, 
  isRegisteredUser = false, 
  showLabel = true, 
  size = 'sm',
  className = '' 
}) {
  // For WordPress profiles (not registered users), show "Available" 
  if (!isRegisteredUser) {
    return showLabel ? (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`rounded-full bg-online/60 ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
        <span className="text-xs text-online/80">Available</span>
      </span>
    ) : (
      <span className={`rounded-full bg-online/60 ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'} ${className}`} />
    );
  }

  const status = formatLastSeen(lastSeen);
  const isOnline = status === 'Online';
  const isAway = status.startsWith('Active');

  const dotColor = isOnline ? 'bg-online' : isAway ? 'bg-away' : 'bg-offline';
  const textColor = isOnline ? 'text-online' : isAway ? 'text-away' : 'text-offline';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return showLabel ? (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`rounded-full ${dotColor} ${dotSize} ${isOnline ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${textColor}`}>{status}</span>
    </span>
  ) : (
    <span className={`rounded-full ${dotColor} ${dotSize} ${isOnline ? 'animate-pulse' : ''} ${className}`} />
  );
}
