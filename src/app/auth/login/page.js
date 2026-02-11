'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, User, Mail, Heart } from 'lucide-react';

export default function LoginPage() {
    const { signIn, skipLogin } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailLogin = (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email');
            return;
        }

        setLoading(true);
        try {
            signIn(email, displayName);
            router.push('/discover');
        } catch (err) {
            setError('Login failed. Please try again.');
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
                <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-gold/5 rounded-full blur-[80px]" />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Logo + Welcome */}
                <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center mb-10"
                >
                    <div className="relative mb-6">
                        <Logo size={80} />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-2 -right-2"
                        >
                            <Heart size={20} className="text-primary" fill="currentColor" />
                        </motion.div>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gradient mb-2 text-center">
                        Welcome to
                    </h1>
                    <h2 className="text-2xl font-extrabold text-white mb-3 text-center">
                        Genuine Sugar Mummies
                    </h2>
                    <p className="text-text-secondary text-sm flex items-center gap-1.5 text-center max-w-xs">
                        <Sparkles size={14} className="text-gold shrink-0" />
                        Kenya&apos;s #1 dating app for real connections
                    </p>
                </motion.div>

                {/* Login Form */}
                <motion.form
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    onSubmit={handleEmailLogin}
                    className="w-full max-w-sm space-y-4"
                >
                    {/* Display Name Input */}
                    <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Your name (optional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full py-4 pl-12 pr-4 rounded-2xl bg-surface-light text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    {/* Email Input */}
                    <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full py-4 pl-12 pr-4 rounded-2xl bg-surface-light text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 active:scale-[0.98] group disabled:opacity-60"
                    >
                        <Heart size={18} fill="currentColor" className="shrink-0" />
                        {loading ? 'Signing in...' : 'Start Finding Matches'}
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 px-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Skip Login Button */}
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white bg-surface-light hover:bg-surface-light/80 transition-all active:scale-[0.98] group"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <User size={20} className="shrink-0" />
                        Browse as Guest
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
                </motion.form>
            </div>
        </div>
    );
}
