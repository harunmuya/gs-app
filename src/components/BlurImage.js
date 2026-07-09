'use client';

import { useState, useRef } from 'react';
import { fallbackProfileImageSrc } from '@/lib/profileImages';

/**
 * BlurImage â€” lazy-loaded image with blur-up placeholder effect.
 * Uses purple-tinted placeholder for .com branding.
 */
export default function BlurImage({
    src,
    alt = '',
    className = '',
    style = {},
    fill = false,
    priority = false,
    ...props
}) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);

    // Purple-tinted placeholder for .com branding
    const placeholderBg = 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 50%, #fce7f3 100%)';

    if (error || !src) {
        return (
            <div
                className={`blur-image-wrapper ${className}`}
                style={{
                    ...style,
                    position: fill ? 'absolute' : 'relative',
                    inset: fill ? 0 : undefined,
                    overflow: 'hidden',
                    background: placeholderBg,
                }}
                {...props}
            >
                <img
                    src={fallbackProfileImageSrc(alt || 'Profile')}
                    alt={alt}
                    loading={priority ? 'eager' : 'lazy'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        );
    }

    return (
        <div
            className={`blur-image-wrapper ${className}`}
            style={{
                ...style,
                position: fill ? 'absolute' : 'relative',
                inset: fill ? 0 : undefined,
                overflow: 'hidden',
                background: placeholderBg,
            }}
            {...props}
        >
            {/* Shimmer placeholder */}
            {!loaded && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                        zIndex: 1,
                    }}
                />
            )}

            <img
                ref={imgRef}
                src={src}
                alt={alt}
                loading={priority ? 'eager' : 'lazy'}
                onLoad={() => setLoaded(true)}
                onError={(e) => {
                    console.error('[BlurImage Error] Failed to load:', src);
                    setError(true);
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'filter 0.5s ease, opacity 0.5s ease',
                    filter: loaded ? 'blur(0)' : 'blur(20px)',
                    opacity: loaded ? 1 : 0.6,
                    transform: loaded ? 'scale(1)' : 'scale(1.05)',
                }}
            />
        </div>
    );
}

