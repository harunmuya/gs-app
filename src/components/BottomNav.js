'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CircleUserRound, Compass, MessageSquareText, RadioTower, Sparkles, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
    { href: '/discover', label: 'Home', icon: Compass },
    { href: '/matches', label: 'Matches', icon: Sparkles },
    { href: '/messages', label: 'Chat', icon: MessageSquareText },
    { href: '/live', label: 'Live', icon: RadioTower },
    { href: '/members', label: 'Members', icon: UsersRound },
    { href: '/profile', label: 'Account', icon: CircleUserRound },
];

function unreadValue(item) {
    return Math.max(0, Number(item?.unreadCount || 0)) || (item?.read ? 0 : 1);
}

export default function BottomNav() {
    const pathname = usePathname();
    const { activity, messages } = useAuth();
    const unreadAlerts = (activity || []).filter((item) => !item.read).length;
    const unreadMessages = (messages || []).reduce((total, item) => total + unreadValue(item), 0);
    const totalUnread = unreadAlerts + unreadMessages;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass" style={{ borderTop: '1px solid rgba(155,44,94,0.08)' }}>
            <div className="app-main flex items-center justify-around py-1.5 px-2">
                {navItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    const Icon = item.icon;
                    const showBadge = item.href === '/messages' && totalUnread > 0;

                    return (
                        <Link key={item.href} href={item.href} className="relative flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-2xl transition-all duration-300" style={isActive ? { background: 'rgba(155,44,94,0.1)' } : {}}>
                            <div className="relative">
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.6} className={`transition-all duration-300 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                                {showBadge && (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white px-1 gradient-primary" style={{ boxShadow: '0 2px 8px rgba(155,44,94,0.3)' }}>
                                        {totalUnread > 99 ? '99+' : totalUnread}
                                    </motion.span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive ? 'text-primary' : 'text-text-muted'}`}>{item.label}</span>
                            {isActive && <motion.div layoutId="navIndicator" className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full gradient-primary" style={{ boxShadow: '0 0 8px rgba(155,44,94,0.4)' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />}
                        </Link>
                    );
                })}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
