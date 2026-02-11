'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();

        const handleCallback = async () => {
            const { error } = await supabase.auth.exchangeCodeForSession(
                window.location.href
            );

            if (error) {
                console.error('Auth callback error:', error);
                router.push('/auth/login?error=callback_failed');
            } else {
                router.push('/discover');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-dvh flex items-center justify-center bg-bg-dark">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-text-secondary">Completing sign in...</p>
            </div>
        </div>
    );
}
