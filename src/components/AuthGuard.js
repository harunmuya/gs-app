'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthGuard({ children }) {
    const { user, loading, needsOnboarding } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/auth/login');
        } else if (!loading && user && needsOnboarding) {
            router.replace('/onboarding');
        }
    }, [user, loading, needsOnboarding, router]);

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
                <div className="flex flex-col items-center gap-3">
                    <img
                        src="/gs.png"
                        alt="Loading"
                        className="w-14 h-14 object-contain animate-pulse-zoom"
                    />
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (user?.isBanned) {
        return (
            <div className="min-h-dvh flex items-center justify-center p-6 text-center" style={{ background: 'var(--color-bg)' }}>
                <div className="max-w-md w-full rounded-3xl p-8 space-y-6 shadow-xl border border-danger/20" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto text-danger">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 animate-bounce">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-text-primary animate-pulse">Account Suspended</h2>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Your account has been banned due to violations of our community guidelines or terms of service.
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl text-left space-y-2 text-xs" style={{ background: 'var(--color-surface)' }}>
                        <p className="font-semibold text-text-primary">Why did this happen?</p>
                        <p className="text-text-secondary">We ban profiles that share fake verification details, abuse chat privileges, or violate our safety policies.</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <a href="https://t.me/GSADMINMARYGAGENCY?text=Appeal%20GS%20App%20Suspension" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center py-3 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20">
                            Appeal on Telegram
                        </a>
                        <button onClick={() => window.location.reload()} className="w-full py-3 rounded-2xl font-semibold text-text-muted hover:text-text-primary">
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return children;
}
