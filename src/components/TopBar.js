'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Bell, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { messages, activity } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  // Initialize dark mode from localStorage (default: light/white)
  useEffect(() => {
    const saved = localStorage.getItem('gs_dark_mode');
    if (saved === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gs_dark_mode', String(newMode));
  };

  const unreadMessages = (messages || []).filter(m => !m.read).length;
  const unreadActivity = (activity || []).filter(a => !a.read).length;
  const totalUnread = unreadMessages + unreadActivity;

  const handleLogoClick = () => {
    if (pathname === '/discover') {
      window.location.reload();
    } else {
      router.push('/discover');
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border" style={{ background: 'var(--color-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14">
        {/* GS Logo */}
        <button onClick={handleLogoClick} className="flex items-center gap-2 active:scale-95 transition-transform">
          <img src="/gs.png" alt="GS" className="h-7 w-7 object-contain" />
          <img src="/genuine-logo.png" alt="Genuine Sugarmummies" className="h-6 object-contain" />
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-full transition-colors"
            style={{ background: darkMode ? 'rgba(212,175,55,0.1)' : 'transparent' }}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <Sun size={18} className="text-gold" />
            ) : (
              <Moon size={18} className="text-text-secondary" />
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => router.push('/alerts')}
            className="relative p-2.5 rounded-full transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-text-secondary" />
            {totalUnread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--color-danger)', color: 'white' }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
