export default function Logo({ size = 40, className = '' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e11d48" />
                    <stop offset="50%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fda4af" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Background circle */}
            <circle cx="50" cy="50" r="48" fill="url(#heartGradient)" opacity="0.15" />
            <circle cx="50" cy="50" r="48" stroke="url(#heartGradient)" strokeWidth="2" fill="none" opacity="0.4" />

            {/* Heart shape */}
            <path
                d="M50 82C50 82 18 62 18 38C18 28 26 20 36 20C42 20 47 23 50 28C53 23 58 20 64 20C74 20 82 28 82 38C82 62 50 82 50 82Z"
                fill="url(#heartGradient)"
                filter="url(#glow)"
            />

            {/* Inner shimmer */}
            <path
                d="M50 75C50 75 25 58 25 40C25 32 31 26 38 26C43 26 47 29 50 33"
                fill="url(#shimmerGradient)"
                opacity="0.5"
            />

            {/* Location pin */}
            <circle cx="50" cy="45" r="6" fill="white" opacity="0.9" />
            <circle cx="50" cy="45" r="3" fill="url(#heartGradient)" />
        </svg>
    );
}
