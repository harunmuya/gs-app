'use client';

/**
 * Contact buttons for connecting with profiles via admin Mary G.
 * Priority: Telegram (recommended) → SMS (recommended) → WhatsApp
 * Removed: Phone Call, Email
 */
export default function ContactButtons({ profileName }) {
    const name = profileName || 'this person';
    const connectionMsg = encodeURIComponent(`Hi Admin Mary G, I need a match connection with ${name} from GS App.`);

    return (
        <div className="w-full rounded-2xl bg-bg-card overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
            {/* Title */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-semibold text-text-primary leading-snug">
                    To Hookup or Connect with <span className="text-gradient">{name}</span>,
                    request connection from admin <span className="text-text-primary font-bold">Mary G</span>
                </p>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2 p-3">
                {/* Telegram - Recommended #1 */}
                <a
                    href={`https://t.me/GSADMINMARYGAGENCY?text=${connectionMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    style={{ backgroundColor: '#26A5E4', color: 'white' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">Telegram</span>
                        <span className="block text-[10px] opacity-80 font-medium flex items-center gap-0.5">
                            <Star size={8} /> Recommended
                        </span>
                    </div>
                </a>

                {/* SMS - Recommended #2 */}
                <a
                    href={`sms:+254738871048?body=${connectionMsg}`}
                    className="group flex items-center gap-2.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    style={{ backgroundColor: '#34B7F1', color: 'white' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">SMS</span>
                        <span className="block text-[10px] opacity-80 font-medium flex items-center gap-0.5">
                            <Star size={8} /> Recommended
                        </span>
                    </div>
                </a>

                {/* WhatsApp - Active! */}
                <a
                    href={`https://wa.me/254738871048?text=${connectionMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 group flex items-center gap-2.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    style={{ backgroundColor: '#25D366', color: 'white' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                    <div className="min-w-0">
                        <span className="block text-sm font-bold leading-tight">WhatsApp</span>
                        <span className="block text-[10px] opacity-80 font-medium">Chat with Admin Mary G</span>
                    </div>
                </a>
            </div>
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
