'use client';

export default function Logo({ size = 40, className = '', showText = false }) {
    return (
        <div className={`flex items-center gap-2 ${className}`} style={{ lineHeight: 0 }}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
            >
                {/* Background circle for maskable icon */}
                <defs>
                    <linearGradient id="arcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="50%" stopColor="#F97316" />
                        <stop offset="100%" stopColor="#EA580C" />
                    </linearGradient>
                    <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2196F3" />
                        <stop offset="100%" stopColor="#1976D2" />
                    </linearGradient>
                    <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FF5722" />
                        <stop offset="100%" stopColor="#E64A19" />
                    </linearGradient>
                </defs>

                {/* Sweeping orange arc */}
                <path
                    d="M60 380 C60 380 100 180 200 130 C280 90 350 120 380 160 C430 225 420 310 350 370 C310 400 240 430 180 440 C130 448 80 430 60 380Z"
                    fill="none"
                    stroke="url(#arcGrad)"
                    strokeWidth="38"
                    strokeLinecap="round"
                    opacity="0.9"
                />

                {/* Letter G */}
                <text
                    x="95"
                    y="340"
                    fontFamily="'Inter', 'Arial Black', sans-serif"
                    fontWeight="900"
                    fontSize="260"
                    fill="url(#gGrad)"
                    letterSpacing="-8"
                >
                    G
                </text>

                {/* Letter S */}
                <text
                    x="235"
                    y="365"
                    fontFamily="'Inter', 'Arial Black', sans-serif"
                    fontWeight="900"
                    fontSize="240"
                    fill="url(#sGrad)"
                    letterSpacing="-5"
                >
                    S
                </text>

                {/* Gold stars */}
                <g fill="#F59E0B">
                    <polygon points="390,75 396,93 415,93 400,105 406,123 390,112 374,123 380,105 365,93 384,93" />
                    <polygon points="430,45 434,57 447,57 437,65 440,77 430,69 420,77 423,65 413,57 426,57" transform="scale(0.7) translate(220, 15)" />
                    <polygon points="440,110 443,119 453,119 445,125 448,134 440,128 432,134 435,125 427,119 437,119" transform="scale(0.6) translate(310, 20)" />
                </g>
            </svg>
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
