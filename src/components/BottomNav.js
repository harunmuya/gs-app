'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Compass, Heart, MessageCircle, Sparkles, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/discover', icon: Compass, label: 'Discover' },
  { href: '/matches', icon: Heart, label: 'Matches' },
  { href: '/ai', icon: Sparkles, label: 'GS AI' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/profile', icon: UserCircle, label: 'Account' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { conversations, matches, messages } = useAuth();

  // Hide on individual chat pages
  if (pathname?.startsWith('/chat/')) return null;

  const unreadChats = (conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const unreadMatches = (matches || []).filter(m => !m.seen).length;
  const unreadMessages = (messages || []).filter(m => !m.read).length;

  const getBadge = (href) => {
    if (href === '/chat') return unreadChats;
    if (href === '/matches') return unreadMatches;
    if (href === '/profile') return unreadMessages;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[450px] z-50 bg-bg/90 backdrop-blur-xl border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const badge = getBadge(item.href);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-w-[56px]">
              <div className="relative">
                <Icon size={22} className={`transition-colors ${isActive ? 'text-primary' : 'text-text-muted'}`} strokeWidth={isActive ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
