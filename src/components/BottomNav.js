'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CircleUserRound, Compass, HeartHandshake, MessageSquareText, RadioTower, UsersRound } from '@/components/icons';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { unreadActivityValue, unreadMessageValue } from '@/lib/inboxCounts';

const navItems = [
    { href: '/discover', label: 'Home', icon: Compass },
    { href: '/matches', label: 'Matches', icon: HeartHandshake },
    { href: '/messages', label: 'Chat', icon: MessageSquareText },
    { href: '/live', label: 'Live', icon: RadioTower },
    { href: '/members', label: 'Members', icon: UsersRound },
    { href: '/profile', label: 'Account', icon: CircleUserRound },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { activity, messages } = useAuth();
    const unreadAlerts = (activity || []).reduce((total, item) => total + unreadActivityValue(item), 0);
    const unreadMessages = (messages || []).reduce((total, item) => total + unreadMessageValue(item), 0);
    const totalUnread = unreadAlerts + unreadMessages;

    return (
        <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-50 glass" style={{ borderTop: '1px solid rgba(155,44,94,0.08)' }}>
            <div className="app-main flex items-center justify-around py-1.5 px-2">
                {navItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    const Icon = item.icon;
                    const showBadge = item.href === '/messages' && totalUnread > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            // Announces the current page to screen readers, which a
                            // colour change alone does not.
                            aria-current={isActive ? 'page' : undefined}
                            className="relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 transition-colors duration-200"
                            style={isActive ? { background: 'rgba(155,44,94,0.1)' } : {}}
                        >
                            <div className="relative">
                                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.6} className={isActive ? 'text-primary' : 'text-text-muted'} />
                                {showBadge && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        aria-hidden="true"
                                        className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white gradient-primary"
                                        style={{ boxShadow: '0 2px 8px rgba(155,44,94,0.3)' }}
                                    >
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </motion.span>
                                )}
                            </div>
                            {/* The badge is decorative; the count is announced here instead,
                                so it reads as "Chat, 3 unread" rather than a bare number. */}
                            <span className={`type-micro ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                                {item.label}
                            </span>
                            {showBadge && <span className="sr-only">{`${totalUnread} unread`}</span>}
                            {isActive && (
                                <motion.div
                                    layoutId="navIndicator"
                                    className="absolute -bottom-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full gradient-primary"
                                    style={{ boxShadow: '0 0 8px rgba(155,44,94,0.4)' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
