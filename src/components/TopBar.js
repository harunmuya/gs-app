'use client';

import Logo from '@/components/Logo';

export default function TopBar() {
    return (
        <header className="sticky top-0 z-40 w-full bg-white" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 max-w-lg mx-auto">
                <div className="flex items-center gap-2">
                    <Logo size={28} />
                    <div>
                        <h1 className="text-sm font-bold text-text-primary leading-tight">Genuine Sugar Mummies</h1>
                        <p className="text-[9px] text-text-muted leading-none">v3.0.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] font-medium text-primary">Live</span>
                </div>
            </div>
        </header>
    );
}
