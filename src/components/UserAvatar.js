'use client';

import { getProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';

export default function UserAvatar({ name, src, size = 40, className = '', isSeed = false, label = '' }) {
    const member = { name, avatarUrl: src, isSeedProfile: isSeed, profileLabel: label };
    const imageSrc = getProfileImageSrc(member);

    return (
        <div className={`relative shrink-0 rounded-full overflow-hidden ${className}`}
            style={{ width: size, height: size }}>
            <img
                src={imageSrc}
                alt={name || 'Member'}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(event) => useProfileImageFallback(event, name, label, isSeed)}
            />
        </div>
    );
}

