'use client';

export default function Logo({ size = 180, className = '' }) {
    return (
        <>
            {/* Light mode: dark text logo */}
            <img
                src="/genuine-logo.png?v=6"
                alt="Genuine Sugarmummies"
                className={`object-contain dark:hidden ${className}`}
                style={{ width: size, height: 'auto', maxHeight: '50px' }}
            />
            {/* Dark mode: light text logo */}
            <img
                src="/genuine-logo-alt.png?v=6"
                alt="Genuine Sugarmummies"
                className={`object-contain hidden dark:block ${className}`}
                style={{ width: size, height: 'auto', maxHeight: '50px' }}
            />
        </>
    );
}
