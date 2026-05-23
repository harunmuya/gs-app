'use client';

import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }) {
    const pathname = usePathname();
    const isChatRoom = pathname?.startsWith('/chat/');

    return (
        <AuthGuard>
            <div className={`min-h-dvh bg-bg ${isChatRoom ? '' : 'pb-20 pt-14'}`}>
                {!isChatRoom && <TopBar />}
                <main className={`max-w-lg mx-auto ${isChatRoom ? 'px-0' : 'px-1'}`}>
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
