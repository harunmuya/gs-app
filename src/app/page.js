'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 1200);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!loading && minTimeElapsed) {
            if (user) {
                router.replace('/discover');
            } else {
                router.replace('/auth/login');
            }
        }
    }, [loading, minTimeElapsed, user]);

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, #0F0F14 0%, #1a1025 50%, #0F0F14 100%)',
            color: '#F0F0F5',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Ambient glow */}
            <div style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,90,95,0.15) 0%, transparent 70%)',
                filter: 'blur(60px)',
                pointerEvents: 'none',
            }} />

            {/* GS Icon */}
            <img
                src="/gs.png"
                alt="GS"
                style={{
                    width: 80,
                    height: 80,
                    objectFit: 'contain',
                    marginBottom: 20,
                    animation: 'splashZoom 1.2s ease-in-out infinite',
                }}
            />

            {/* Brand Logo */}
            <img
                src="/genuine-logo-alt.png"
                alt="Genuine Sugarmummies"
                style={{
                    height: 32,
                    objectFit: 'contain',
                    marginBottom: 8,
                    filter: 'brightness(1.1)',
                }}
            />

            <p style={{ fontSize: 12, opacity: 0.5, letterSpacing: '0.5px', fontWeight: 500 }}>
                Kenya&apos;s #1 Dating Platform
            </p>

            <style>{`
                @keyframes splashZoom {
                    0%, 100% { transform: scale(0.85); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
