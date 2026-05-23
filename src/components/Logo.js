'use client';

export default function Logo({ size = 180, className = '' }) {
    return (
        <img
            src="/genuine-logo.png"
            alt="Genuine Sugarmummies"
            className={`object-contain ${className}`}
            style={{ width: size, height: 'auto', maxHeight: '50px' }}
        />
    );
}
