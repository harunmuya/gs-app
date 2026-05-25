'use client';

export default function Logo({ size = 180, className = '' }) {
    return (
        <>
            <img
                src="/genuine-logo.png?v=5"
                alt="Genuine Sugarmummies"
                className={`object-contain dark:hidden ${className}`}
                style={{ width: size, height: 'auto', maxHeight: '50px' }}
            />
            <img
                src="/genuine-logo-alt.png?v=5"
                alt="Genuine Sugarmummies"
                className={`object-contain hidden dark:block ${className}`}
                style={{ width: size, height: 'auto', maxHeight: '50px' }}
            />
        </>
    );
}
