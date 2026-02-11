import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';

export default function MainLayout({ children }) {
    return (
        <AuthGuard>
            <div className="min-h-dvh bg-bg-dark pb-20">
                <main className="max-w-md mx-auto">
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
