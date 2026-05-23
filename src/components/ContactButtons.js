'use client';

/**
 * Premium Contact Buttons for connecting with profiles via Admin Mary G.
 * Features: gradient backgrounds, glass card, pulse animation, micro-interactions.
 * Priority: Telegram (recommended) → SMS → WhatsApp → Phone Call
 */
export default function ContactButtons({ profileName }) {
    const name = profileName || 'this person';
    const connectionMsg = encodeURIComponent(
        `Hi Admin Mary G, I need a match connection with ${name} from GS App.`
    );

    return (
        <div
            className="w-full rounded-3xl overflow-hidden shadow-sm"
            style={{
                background: 'var(--color-bg-card)',
                border: 'var(--card-border)',
            }}
        >
            {/* ── Header ── */}
            <div
                className="px-5 py-4"
                style={{ borderBottom: 'var(--card-border)' }}
            >
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base font-bold text-text-primary leading-tight">
                        Connect via Admin Mary G
                    </span>
                    {/* Verified badge */}
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ flexShrink: 0 }}
                    >
                        <circle cx="12" cy="12" r="10" fill="#3B82F6" />
                        <path
                            d="M9 12l2 2 4-4"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
                <p className="text-xs text-text-secondary leading-snug" style={{ opacity: 0.75 }}>
                    To hookup or connect with{' '}
                    <span className="text-gradient font-semibold">{name}</span>, choose a
                    channel below
                </p>
            </div>

            {/* ── Buttons Grid ── */}
            <div className="grid grid-cols-2 gap-2.5 p-4">
                {/* Telegram – Recommended (with pulse) */}
                <a
                    href={`https://t.me/GSADMINMARYGAGENCY?text=${connectionMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] animate-telegram-pulse"
                    style={{
                        background: 'linear-gradient(135deg, #2AABEE 0%, #1E96D1 100%)',
                        color: 'white',
                        boxShadow: '0 4px 14px rgba(38,165,228,0.35)',
                    }}
                >
                    {/* Telegram icon 28px */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">Telegram</span>
                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ opacity: 0.85 }}>
                            <Star size={9} /> Recommended
                        </span>
                    </div>
                </a>

                {/* SMS */}
                <a
                    href={`sms:+254738871048?body=${connectionMsg}`}
                    className="group flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                        background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
                        color: 'white',
                        boxShadow: '0 4px 14px rgba(14,165,233,0.30)',
                    }}
                >
                    {/* SMS icon 28px */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">SMS</span>
                        <span className="block text-[10px] font-medium" style={{ opacity: 0.85 }}>
                            Text Admin Mary G
                        </span>
                    </div>
                </a>

                {/* WhatsApp */}
                <a
                    href={`https://wa.me/254738871048?text=${connectionMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        color: 'white',
                        boxShadow: '0 4px 14px rgba(37,211,102,0.30)',
                    }}
                >
                    {/* WhatsApp icon 28px */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">WhatsApp</span>
                        <span className="block text-[10px] font-medium" style={{ opacity: 0.85 }}>
                            Chat with Admin
                        </span>
                    </div>
                </a>

                {/* Phone Call */}
                <a
                    href="tel:+254738871048"
                    className="group flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        color: 'white',
                        boxShadow: '0 4px 14px rgba(34,197,94,0.30)',
                    }}
                >
                    {/* Phone icon 28px */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">Phone Call</span>
                        <span className="block text-[10px] font-medium" style={{ opacity: 0.85 }}>
                            Call Admin Mary G
                        </span>
                    </div>
                </a>
            </div>

            {/* ── Trust Signal ── */}
            <div
                className="flex items-center justify-center gap-1.5 px-4 pb-4 pt-1"
            >
                {/* Shield icon */}
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: '#22C55E', flexShrink: 0 }}
                >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-secondary, #6B7280)' }}
                >
                    Secure Connection
                </span>
            </div>

            {/* Pulse animation for Telegram button */}
            <style jsx>{`
                @keyframes telegram-pulse {
                    0%, 100% { box-shadow: 0 4px 14px rgba(38,165,228,0.35); }
                    50%      { box-shadow: 0 4px 24px rgba(38,165,228,0.55), 0 0 0 4px rgba(38,165,228,0.10); }
                }
                .animate-telegram-pulse {
                    animation: telegram-pulse 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

function Star({ size = 10 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}
