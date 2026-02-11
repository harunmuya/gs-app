'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Heart, Bell, User } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
    { href: '/discover', label: 'Home', icon: Home },
    { href: '/matches', label: 'Matches', icon: Heart },
    { href: '/alerts', label: 'Alerts', icon: Bell },
    { href: '/profile', label: 'Account', icon: User },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass" style={{ borderTop: 'var(--card-border)' }}>
            <div className="max-w-md mx-auto flex items-center justify-around py-2 px-4">
                {navItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition-all duration-300"
                        >
                            <div className="relative">
                                <Icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    className={`transition-colors duration-300 ${isActive ? 'text-primary' : 'text-text-muted'
                                        }`}
                                />
                                {isActive && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full gradient-primary"
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </div>
                            <span
                                className={`text-[10px] font-medium transition-colors duration-300 ${isActive ? 'text-primary' : 'text-text-muted'
                                    }`}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
            {/* Safe area spacing for iPhones */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
