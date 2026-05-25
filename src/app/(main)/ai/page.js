'use client';

import { useState, useRef } from 'react';
import { Zap, RefreshCw, ExternalLink, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AiPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const iframeRef = useRef(null);

    const queryParams = user ? `?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.display_name)}` : '';
    const iframeSrc = `https://gs-ai-ten.vercel.app/${queryParams}`;

    const handleRefresh = () => {
        setLoading(true);
        if (iframeRef.current) {
            iframeRef.current.src = iframeSrc;
        }
    };

    return (
        <div className={`flex flex-col w-full relative ${fullscreen ? 'fixed inset-0 z-[100]' : 'h-[calc(100vh-8.5rem)]'}`} style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <div className="flex items-center gap-2">
                    <Zap size={16} style={{ color: 'var(--color-primary)' }} />
                    <h1 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>GS AI Assistant</h1>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,90,95,0.1)', color: 'var(--color-primary)' }}>
                        Live
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Refresh AI"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setFullscreen(!fullscreen)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <a
                        href={iframeSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Open in new tab"
                    >
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Warning Banner for Google OAuth limitations */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
                    <strong>Note:</strong> Google sign-in is blocked in embedded windows. If you need to Login or Register on GS AI, tap the <strong>Open in new tab (↗)</strong> button to log in, then refresh this page.
                </p>
            </div>

            {/* Loading State — zoom pulse */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ background: 'var(--color-bg)', top: 40 }}>
                    <img
                        src="/gs.png"
                        alt="Loading AI"
                        className="w-14 h-14 object-contain animate-pulse-zoom"
                    />
                    <p className="text-xs mt-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Connecting to GS AI...</p>
                </div>
            )}

            {/* AI Iframe — loads directly */}
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                className="flex-1 w-full border-none"
                style={{ minHeight: fullscreen ? '100vh' : 'calc(100vh - 11rem)' }}
                onLoad={() => setLoading(false)}
                title="GS AI Assistant"
                allow="clipboard-read; clipboard-write; microphone; camera; geolocation"
            />
        </div>
    );
}
