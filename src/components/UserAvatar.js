'use client';

import { useMemo } from 'react';
import StatusIndicator from './StatusIndicator';

const GRADIENT_COLORS = [
  ['#FF6B6B', '#EE5A24'],
  ['#A29BFE', '#6C5CE7'],
  ['#55EFC4', '#00B894'],
  ['#FDCB6E', '#E17055'],
  ['#74B9FF', '#0984E3'],
  ['#FD79A8', '#E84393'],
  ['#81ECEC', '#00CEC9'],
  ['#FAB1A0', '#E17055'],
];

export default function UserAvatar({ 
  name, 
  image, 
  size = 40, 
  showStatus = false, 
  lastSeen, 
  isRegisteredUser = false,
  className = '' 
}) {
  const letter = (name || '?')[0].toUpperCase();
  
  // Use unique ID based on name + random to avoid SVG gradient collisions
  const gradientId = useMemo(() => 
    `avatar-${letter}-${Math.random().toString(36).substr(2, 6)}`, 
    [letter]
  );
  
  const colorIdx = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % GRADIENT_COLORS.length;
  }, [name]);

  const [color1, color2] = GRADIENT_COLORS[colorIdx];

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {image ? (
        <img
          src={image}
          alt={name || 'User'}
          className="w-full h-full rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <circle cx={size/2} cy={size/2} r={size/2} fill={`url(#${gradientId})`} />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="white" fontSize={size * 0.4} fontWeight="700">
            {letter}
          </text>
        </svg>
      )}
      
      {showStatus && (
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusIndicator lastSeen={lastSeen} isRegisteredUser={isRegisteredUser} showLabel={false} size="sm" />
        </div>
      )}
    </div>
  );
}
