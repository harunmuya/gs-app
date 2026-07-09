'use client';

import { fallbackProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';

export default function UserAvatar({ name, src, size = 40, className = '' }) {
    const imageSrc = src || fallbackProfileImageSrc(name);

    return (
        <div className={`relative shrink-0 rounded-full overflow-hidden ${className}`}
            style={{ width: size, height: size }}>
            <img
                src={imageSrc}
                alt={name || 'Member'}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(event) => useProfileImageFallback(event, name)}
            />
        </div>
    );
}
