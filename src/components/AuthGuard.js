'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Logo from '@/components/Logo';

export default function AuthGuard({ children }) {
    const { user, loading, sessionChecked, signOut } = useAuth();
    /*
      Wait for the server session check before deciding anyone is signed out.

      This used to redirect as soon as `loading` went false and `user` was null —
      but `user` comes from localStorage, so a member holding a perfectly valid
      Supabase session was bounced to the login screen the moment local storage
      was empty. AuthContext now asks the server who it thinks you are;
      `sessionChecked` is what says that answer has arrived.
    */
    const settling = loading || !sessionChecked;
    const router = useRouter();
    const pathname = usePathname();
    const restricted = Boolean(
        user?.access_blocked ||
        user?.is_banned ||
        user?.is_suspended ||
        user?.account_deleted_at ||
        ['banned', 'suspended', 'deleted'].includes(String(user?.account_status || '').toLowerCase())
    );

    useEffect(() => {
        if (settling) return;
        if (!user) {
            router.replace('/auth/login');
            return;
        }
        if (restricted) {
            signOut?.().finally(() => router.replace('/auth/login'));
            return;
        }
        // No longer lock the app for incomplete profiles —
        // ProfileCompletionModal handles this gracefully
    }, [user, settling, restricted, router, pathname, signOut]);

    if (settling) {
        return (
            <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <Logo size={48} />
                    <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!user || restricted) return null;

    return children;
}
