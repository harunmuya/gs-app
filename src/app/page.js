'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Logo from '@/components/Logo';
import { motion } from 'framer-motion';

export default function HomePage() {
    const { user, guest, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user || guest) {
                router.replace('/discover');
            } else {
                router.replace('/auth/login');
            }
        }
    }, [user, guest, loading, router]);

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center bg-bg-dark relative overflow-hidden">
            {/* Floating background accents */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute rounded-full animate-pulse-soft"
                    style={{
                        width: 200, height: 200,
                        background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
                        top: '10%', right: '-5%',
                    }}
                />
                <div
                    className="absolute rounded-full animate-pulse-soft"
                    style={{
                        width: 150, height: 150,
                        background: 'radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%)',
                        bottom: '15%', left: '-3%',
                        animationDelay: '1s',
                    }}
                />
            </div>

            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-5 relative z-10"
            >
                {/* GS Logo — large and prominent */}
                <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Logo size={100} />
                </motion.div>

                {/* Brand text */}
                <div className="text-center">
                    <h1
                        className="text-2xl font-extrabold tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Genuine Sugarmummies
                    </h1>
                    <p className="text-xs text-text-muted mt-1 tracking-wide">
                        Kenya&apos;s #1 Dating Platform
                    </p>
                </div>

                {/* Spinner */}
                <div className="flex flex-col items-center gap-3 mt-2">
                    <div
                        className="w-8 h-8 rounded-full animate-spin"
                        style={{
                            border: '3px solid rgba(234, 88, 12, 0.15)',
                            borderTopColor: '#EA580C',
                        }}
                    />
                    <p className="text-[11px] text-text-muted animate-pulse">
                        Loading your matches...
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
