import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import IncomingCallManager from '@/components/IncomingCallManager';
import LocationPermissionManager from '@/components/LocationPermissionManager';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';

/**
 * Everything in this route group is behind AuthGuard, which runs on the client —
 * a crawler still receives the shell. Declaring noindex here covers the whole
 * signed-in area in one place and belts-and-braces the robots.txt disallow.
 */
export const metadata = {
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

export default function MainLayout({ children }) {
    return (
        <AuthGuard>
            <div className="min-h-dvh app-shell pb-20">
                <TopBar />
                <main className="app-main">
                    {children}
                </main>
                <LocationPermissionManager />
                <IncomingCallManager />
                <ProfileCompletionModal />
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
