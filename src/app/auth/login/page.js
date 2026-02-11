'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, User } from 'lucide-react';

export default function LoginPage() {
    const { signInWithGoogle, skipLogin } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Google login failed');
            setLoading(false);
        }
    };

    const handleSkip = () => {
        skipLogin();
        router.push('/discover');
    };

    return (
        <div className="min-h-dvh flex flex-col bg-bg-dark overflow-hidden">
            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Logo + Title */}
                <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center mb-12"
                >
                    <Logo size={80} className="mb-6" />
                    <h1 className="text-3xl font-extrabold text-gradient mb-2 text-center">
                        Genuine Sugar Mummies
                    </h1>
                    <p className="text-text-secondary text-sm flex items-center gap-1.5">
                        <Sparkles size={14} className="text-gold" />
                        Find your perfect match today
                    </p>
                </motion.div>

                {/* Auth Card */}
                <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="w-full max-w-sm space-y-4"
                >
                    {/* Google Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white bg-surface-light hover:bg-surface-light/80 transition-all active:scale-[0.98] group"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0 transition-transform group-hover:scale-110">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 px-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Skip Login Button */}
                    <button
                        onClick={handleSkip}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 active:scale-[0.98] group"
                    >
                        <User size={20} className="shrink-0" />
                        Skip Login & Browse
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </button>

                    {/* Terms */}
                    <p className="text-center text-xs text-text-muted mt-6 px-4 leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="#" className="underline hover:text-text-secondary">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="underline hover:text-text-secondary">Privacy Policy</a>
                    </p>

                    {/* Error display */}
                    <AnimatePresence>
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mt-3 text-sm text-center text-white bg-danger/80 rounded-xl py-2 px-4 shadow-lg"
                            >
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
