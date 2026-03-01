'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Heart, MessageCircle, Users, Bell, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
    { href: '/discover', label: 'Discover', icon: Home },
    { href: '/matches', label: 'Matches', icon: Heart },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/members', label: 'Members', icon: Users },
    { href: '/profile', label: 'Account', icon: User },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { conversations } = useAuth();

    // Count unread messages
    const unreadCount = (conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // Don't show on chat conversation detail pages
    if (pathname?.startsWith('/chat/')) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass" style={{ borderTop: 'var(--card-border)' }}>
            <div className="max-w-md mx-auto flex items-center justify-around py-1.5 px-2">
                {navItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    const Icon = item.icon;
                    const showBadge = item.href === '/chat' && unreadCount > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-300"
                        >
                            <div className="relative">
                                <Icon
                                    size={22}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    className={`transition-colors duration-300 ${isActive ? 'text-primary' : 'text-text-muted'}`}
                                />
                                {isActive && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full gradient-primary"
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                )}
                                {showBadge && (
                                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[9px] font-medium transition-colors duration-300 ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
