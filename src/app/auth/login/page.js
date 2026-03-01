'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, User, Mail, Heart, Lock, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
    const { signIn, signUp, skipLogin } = useAuth();
    const router = useRouter();
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) { setError('Please enter your email'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email'); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }

        if (mode === 'register') {
            if (password !== confirmPassword) { setError('Passwords do not match'); return; }
            if (!displayName.trim()) { setError('Please enter your name'); return; }
        }

        setLoading(true);
        try {
            if (mode === 'register') {
                await signUp(email, password, displayName);
            } else {
                await signIn(email, password);
            }
            router.push('/discover');
        } catch (err) {
            setError(err.message || 'Something went wrong. Try again.');
            setLoading(false);
        }
    };

    const handleSkip = () => {
        skipLogin();
        router.push('/discover');
    };

    const isRegister = mode === 'register';

    return (
        <div className="min-h-dvh flex flex-col bg-white overflow-hidden">
            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-100 rounded-full blur-[120px] opacity-60" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50 rounded-full blur-[100px] opacity-50" />
                <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-orange-50 rounded-full blur-[80px] opacity-40" />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Logo + Welcome */}
                <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center mb-8"
                >
                    <div className="relative mb-4">
                        <Logo size={72} />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-2 -right-2"
                        >
                            <Heart size={18} className="text-primary" fill="currentColor" />
                        </motion.div>
                    </div>
                    <h1 className="text-2xl font-extrabold text-gradient mb-1 text-center">
                        {isRegister ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <h2 className="text-lg font-bold text-text-primary mb-1 text-center">
                        Genuine Sugarmummies
                    </h2>
                    <p className="text-text-secondary text-xs flex items-center gap-1.5 text-center">
                        <Sparkles size={12} className="text-gold shrink-0" />
                        Kenya&apos;s #1 dating app for real connections
                    </p>
                </motion.div>

                {/* Toggle Login/Register */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-sm mb-4"
                >
                    <div className="flex rounded-2xl p-1" style={{ background: 'var(--color-surface)' }}>
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${mode === 'login' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}
                        >
                            <LogIn size={14} /> Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${mode === 'register' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}
                        >
                            <UserPlus size={14} /> Register
                        </button>
                    </div>
                </motion.div>

                {/* Form */}
                <motion.form
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    onSubmit={handleSubmit}
                    className="w-full max-w-sm space-y-3"
                >
                    {/* Display name (register only) */}
                    <AnimatePresence mode="wait">
                        {isRegister && (
                            <motion.div
                                key="name"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="relative overflow-hidden"
                            >
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                                <input
                                    type="text"
                                    placeholder="Your full name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Email */}
                    <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password (min 6 characters)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full py-3.5 pl-12 pr-12 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Confirm password (register only) */}
                    <AnimatePresence mode="wait">
                        {isRegister && (
                            <motion.div
                                key="confirm"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="relative overflow-hidden"
                            >
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 active:scale-[0.98] group disabled:opacity-60 text-sm"
                    >
                        {isRegister ? <UserPlus size={18} /> : <Heart size={18} fill="currentColor" />}
                        {loading ? (isRegister ? 'Creating Account...' : 'Signing In...') : (isRegister ? 'Create Account' : 'Sign In & Find Matches')}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </button>

                    {/* Forgot password */}
                    {!isRegister && (
                        <p className="text-center">
                            <button type="button" className="text-xs text-primary font-medium hover:underline">
                                Forgot your password?
                            </button>
                        </p>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3 px-2 pt-1">
                        <div className="flex-1 h-px bg-black/10" />
                        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">or</span>
                        <div className="flex-1 h-px bg-black/10" />
                    </div>

                    {/* Guest */}
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-text-primary bg-surface hover:bg-surface-light transition-all active:scale-[0.98] group border border-black/8 text-sm"
                    >
                        <User size={18} className="shrink-0" />
                        Browse as Guest
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </button>

                    {/* Terms */}
                    <p className="text-center text-[10px] text-text-muted mt-4 px-4 leading-relaxed">
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
                                className="mt-2 text-xs text-center text-white bg-danger/90 rounded-xl py-2.5 px-4 shadow-lg"
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
