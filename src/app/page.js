'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Logo from '@/components/Logo';
import { motion } from 'framer-motion';

export default function HomePage() {
    const { user, guest, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user || guest) {
                router.replace('/discover');
            } else {
                router.replace('/auth/login');
            }
        }
    }, [user, guest, loading, router]);

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center bg-bg-dark">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-6"
            >
                <Logo size={80} />
                <h1 className="text-2xl font-bold text-gradient">Genuine Sugar Mummies</h1>
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </motion.div>
        </div>
    );
}
