'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch('/api/admin/auth');
                if (res.ok) {
                    router.replace('/admin');
                }
            } catch {
            } finally {
                setCheckingSession(false);
            }
        }
        checkSession();
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                router.replace('/admin');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Securing session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-login-container flex-1 flex items-center justify-center min-h-screen bg-slate-950 p-6 relative overflow-hidden">
            {/* Ambient gradients */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative z-10 space-y-6"
            >
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-500 shadow-lg shadow-rose-500/5">
                        <ShieldAlert size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mt-4">GS Control Panel</h1>
                    <p className="text-sm text-slate-400">Sign in with administrator credentials</p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2"
                        >
                            <ShieldCheck size={16} className="shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 ml-1">Admin Email</label>
                        <div className="relative">
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@genuinesugarmummies.co.ke"
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                            />
                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                            />
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/15 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                        {loading ? 'Authenticating...' : 'Access Dashboard'}
                        {!loading && <ArrowRight size={16} />}
                    </button>
                </form>

                {/* Info Note */}
                <div className="text-center pt-2">
                    <p className="text-[10px] text-slate-500">
                        Authorized access only. All operations are logged.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
