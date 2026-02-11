'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import Logo from '@/components/Logo';

export default function TopBar() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-40 w-full" style={{ background: 'var(--color-bg-dark)', borderBottom: 'var(--card-border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 max-w-lg mx-auto">
                <div className="flex items-center gap-2">
                    <Logo size={28} />
                    <div>
                        <h1 className="text-sm font-bold text-text-primary leading-tight">Genuine Sugar Mummies</h1>
                        <p className="text-[9px] text-text-muted leading-none">v2.1.0</p>
                    </div>
                </div>
                <button
                    onClick={toggleTheme}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? (
                        <Sun size={16} className="text-gold" />
                    ) : (
                        <Moon size={16} className="text-text-secondary" />
                    )}
                </button>
            </div>
        </header>
    );
}
