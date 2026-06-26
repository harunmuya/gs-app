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
            <div className={`min-h-dvh bg-bg w-full ${isChatRoom ? '' : 'pb-20'}`}>
                {!isChatRoom && <TopBar />}
                <main className={`w-full max-w-[1180px] mx-auto ${isChatRoom ? 'px-0' : 'px-2 sm:px-4 lg:px-6 pt-14'}`}>
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
