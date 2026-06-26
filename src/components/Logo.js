'use client';

export default function Logo({ size = 180, className = '' }) {
    return (
        <img
            src="/gs-logo.png?v=7"
            alt="GS"
            className={`object-contain ${className}`}
            style={{ width: size, height: 'auto', maxHeight: '50px' }}
        />
    );
}
