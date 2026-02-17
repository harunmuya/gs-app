'use client';

import Image from 'next/image';

export default function Logo({ size = 40, className = '', showText = false }) {
    return (
        <div className={`flex items-center gap-2 ${className}`} style={{ lineHeight: 0 }}>
            <Image
                src="/gs-logo.png"
                alt="GS Logo"
                width={size}
                height={size}
                priority
                style={{ display: 'block', objectFit: 'contain' }}
            />
            {showText && (
                <span
                    className="font-extrabold tracking-tight"
                    style={{
                        fontSize: size * 0.35,
                        background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}
                >
                    Genuine Sugarmummies
                </span>
            )}
        </div>
    );
}
