'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Search } from '@/components/icons';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';

export default function TopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { activity } = useAuth();
    const unreadAlerts = (activity || []).filter((item) => !item.read).length;

    const handleLogoClick = () => {
        if (pathname === '/discover') window.location.reload();
        else router.push('/discover');
    };

    return (
        /*
          The row was `flex-wrap` with a wordmark that is 12.82:1. At size 32 it
          asks for about 410px, which is wider than a 375px phone once the two
          icons are allowed for, so the icons wrapped onto a second line and the
          header silently became two rows tall.

          Nothing wraps now: the logo takes the space that is left and scales
          down inside it, and the icons keep their size. The border was a maroon
          that belonged to the retired palette.
        */
        <header className="sticky top-0 z-40 w-full glass" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
            <div className="flex flex-nowrap items-center justify-between gap-2 px-4 py-2 app-main">
                <button onClick={handleLogoClick} className="flex min-w-0 flex-1 items-center cursor-pointer transition-opacity active:opacity-70 rounded-2xl" aria-label="Go to homepage">
                    <Logo size={32} maxWidth="100%" />
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Link href="/members" className="p-2 rounded-xl transition-all active:scale-90" style={{ color: 'var(--color-text-muted)' }}>
                        <Search size={20} strokeWidth={2} />
                    </Link>
                    <Link href="/alerts" className="relative p-2 rounded-xl transition-all active:scale-90" style={{ color: 'var(--color-text-muted)' }}>
                        <Bell size={20} strokeWidth={2} />
                        {unreadAlerts > 0 && (
                            <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white px-0.5 gradient-primary" style={{ boxShadow: '0 2px 6px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </header>
    );
}
