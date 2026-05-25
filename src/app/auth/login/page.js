'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, ArrowRight, ArrowLeft, User, Mail, Heart, Lock, Eye, EyeOff,
    UserPlus, LogIn, MapPin, Target, Search, Shield, Users, CheckCircle, Calendar, Send
} from 'lucide-react';

// Kenyan locations for reverse geocode fallback
const KENYAN_CITIES = [
    { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
    { name: 'Mombasa', lat: -4.0435, lng: 39.6682 },
    { name: 'Kisumu', lat: -0.1022, lng: 34.7617 },
    { name: 'Nakuru', lat: -0.3031, lng: 36.0800 },
    { name: 'Eldoret', lat: 0.5143, lng: 35.2698 },
    { name: 'Thika', lat: -1.0396, lng: 37.0900 },
    { name: 'Malindi', lat: -3.2138, lng: 40.1169 },
    { name: 'Kitale', lat: 1.0187, lng: 35.0020 },
    { name: 'Nyeri', lat: -0.4197, lng: 36.9511 },
    { name: 'Machakos', lat: -1.5177, lng: 37.2634 },
    { name: 'Meru', lat: 0.0480, lng: 37.6559 },
    { name: 'Kiambu', lat: -1.1714, lng: 36.8356 },
    { name: 'Ruiru', lat: -1.1489, lng: 36.9606 },
    { name: 'Juja', lat: -1.1004, lng: 37.0131 },
    { name: 'Ngong', lat: -1.3607, lng: 36.6583 },
    { name: 'Rongai', lat: -1.3964, lng: 36.7586 },
    { name: 'Karen', lat: -1.3197, lng: 36.7116 },
    { name: 'Westlands', lat: -1.2636, lng: 36.8036 },
    { name: 'Kilimani', lat: -1.2903, lng: 36.7847 },
    { name: 'Langata', lat: -1.3557, lng: 36.7462 },
    { name: 'Diani', lat: -4.3164, lng: 39.5764 },
    { name: 'Kilifi', lat: -3.6305, lng: 39.8499 },
    { name: 'Naivasha', lat: -0.7172, lng: 36.4310 },
    { name: 'Nanyuki', lat: 0.0067, lng: 37.0722 },
];

function findNearestCity(lat, lng) {
    let nearest = 'Nairobi';
    let minDist = Infinity;
    for (const city of KENYAN_CITIES) {
        const d = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2));
        if (d < minDist) { minDist = d; nearest = city.name; }
    }
    return nearest;
}

function LoginPageInner() {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Mode: login | register | forgot | email_sent
    const [mode, setMode] = useState('login');
    // Registration step: 1=credentials, 2=gender, 3=role, 4=age+location
    const [regStep, setRegStep] = useState(1);

    // Step 1 fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2-4 fields
    const [gender, setGender] = useState('');
    const [lookingFor, setLookingFor] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [isPublic, setIsPublic] = useState(true);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const isRegister = mode === 'register';

    // Check for OAuth error in URL params
    useEffect(() => {
        const errorParam = searchParams?.get('error');
        if (errorParam) {
            setError(decodeURIComponent(errorParam));
        }
    }, [searchParams]);

    // Auto-detect location
    const detectLocation = () => {
        if (!navigator.geolocation) { return; }
        setDetectingLocation(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const city = findNearestCity(pos.coords.latitude, pos.coords.longitude);
                setLocation(city);
                setDetectingLocation(false);
            },
            () => {
                setLocation('Nairobi');
                setDetectingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Auto-set lookingFor based on gender
    useEffect(() => {
        if (gender === 'male') setLookingFor('sugar_mummy');
        else if (gender === 'female') setLookingFor('sugar_daddy');
    }, [gender]);

    // Listen to Google Sign-In Popup events
    useEffect(() => {
        const handleAuthMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'auth-success') {
                router.push(event.data.nextUrl || '/discover');
            } else if (event.data?.type === 'auth-error') {
                setError(event.data.error || 'Authentication failed');
                setGoogleLoading(false);
            }
        };

        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, [router]);

    // Handle Google Sign-In
    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError('');
        try {
            const res = await signInWithGoogle();
            if (res && res.isPopup && res.popup) {
                const checkClosed = setInterval(() => {
                    if (res.popup.closed) {
                        clearInterval(checkClosed);
                        setGoogleLoading(false);
                    }
                }, 1000);
            }
        } catch (err) {
            setError(err.message || 'Google sign-in failed. Please try again.');
            setGoogleLoading(false);
        }
    };

    // Handle step 1 submission
    const handleStep1 = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!email.trim()) { setError('Please enter your email'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email'); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }

        if (isRegister) {
            if (password !== confirmPassword) { setError('Passwords do not match'); return; }
            if (!displayName.trim() || displayName.trim().length < 2) { setError('Please enter your full name (at least 2 characters)'); return; }
            setRegStep(2);
        } else {
            handleLogin();
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        try {
            await signIn(email, password);
            router.push('/discover');
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
                setError('Please verify your email first. Check your inbox for a confirmation link.');
            } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
                setError('Incorrect email or password. Please try again.');
            } else {
                setError(msg || 'Sign in failed. Please try again.');
            }
            setLoading(false);
        }
    };

    // Handle forgot password
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }
        setLoading(true);
        try {
            await resetPassword(email);
            setSuccess('Password reset link sent! Check your email inbox.');
            setLoading(false);
        } catch (err) {
            setError(err.message || 'Failed to send reset email. Please try again.');
            setLoading(false);
        }
    };

    // Handle step 2: gender
    const handleGenderSelect = (g) => {
        setGender(g);
        setError('');
        setTimeout(() => setRegStep(3), 300);
    };

    // Handle step 3: role/lookingFor
    const handleRoleSelect = (role) => {
        setLookingFor(role);
        setError('');
        setTimeout(() => {
            setRegStep(4);
            detectLocation();
        }, 300);
    };

    // Handle step 4: complete registration
    const handleCompleteRegistration = async () => {
        setError('');
        const ageNum = parseInt(age);
        if (!ageNum || ageNum < 18 || ageNum > 80) {
            setError('Please enter a valid age (18–80)');
            return;
        }
        if (!location.trim()) {
            setError('Please select or detect your location');
            return;
        }

        setLoading(true);
        try {
            await signUp(email, password, displayName, {
                gender,
                lookingFor,
                age: ageNum,
                location,
                isPublic,
            });
            // Show email verification notice
            setMode('email_sent');
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('User already registered') || msg.includes('already registered')) {
                setError('An account with this email already exists. Try signing in instead.');
            } else {
                setError(msg || 'Registration failed. Please try again.');
            }
            setLoading(false);
        }
    };

    const goBack = () => {
        setError('');
        setSuccess('');
        if (mode === 'forgot') {
            setMode('login');
        } else if (isRegister && regStep > 1) {
            setRegStep(regStep - 1);
        } else if (mode === 'register') {
            setMode('login');
            setRegStep(1);
        } else {
            setMode('login');
            setRegStep(1);
        }
    };

    // Password strength indicator
    const getPasswordStrength = (pwd) => {
        if (!pwd) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-danger' };
        if (score <= 3) return { level: 2, label: 'Fair', color: 'bg-gold' };
        return { level: 3, label: 'Strong', color: 'bg-success' };
    };

    const pwdStrength = isRegister ? getPasswordStrength(password) : null;

    return (
        <div className="min-h-dvh flex flex-col bg-bg overflow-hidden relative">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25" style={{ background: 'var(--color-primary)' }} />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15" style={{ background: 'var(--color-gold)' }} />
                <div className="absolute top-1/3 left-0 w-[300px] h-[300px] rounded-full blur-[80px] opacity-10" style={{ background: 'var(--color-primary)' }} />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Back button */}
                {(mode === 'forgot' || mode === 'register' || (isRegister && regStep > 1)) && mode !== 'email_sent' && (
                    <button onClick={goBack} className="absolute top-6 left-6 p-2 rounded-full bg-bg-card/80 backdrop-blur-sm shadow-sm z-10 border border-border">
                        <ArrowLeft size={20} className="text-text-primary" />
                    </button>
                )}

                {/* ========== EMAIL SENT SUCCESS ========== */}
                {mode === 'email_sent' && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-sm text-center space-y-5"
                    >
                        <div className="w-20 h-20 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto">
                            <Send size={32} className="text-success" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-primary mb-2">Check Your Email!</h2>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                We sent a verification link to <strong className="text-text-primary">{email}</strong>.
                                Click the link in your email to activate your account, then sign in below.
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-surface border border-border text-xs text-text-secondary space-y-1">
                            <p>✓ Check your inbox and spam/junk folder</p>
                            <p>✓ The link expires in 24 hours</p>
                            <p>✓ After clicking, sign in with your email and password</p>
                        </div>
                        <button
                            onClick={() => { setMode('login'); setRegStep(1); setError(''); setSuccess(''); }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] text-sm"
                        >
                            <LogIn size={18} /> Go to Sign In
                        </button>
                    </motion.div>
                )}

                {/* Logo — shown on all non-email-sent modes */}
                {mode !== 'email_sent' && (
                    <motion.div
                        initial={{ y: -30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className="flex flex-col items-center mb-6"
                    >
                        <div className="mb-3">
                            <img src="/gs.png" alt="GS" className="w-14 h-14 object-contain" />
                        </div>
                        <img src="/genuine-logo.png" alt="Genuine Sugarmummies" className="h-8 object-contain mb-2 dark:hidden" />
                        <img src="/genuine-logo-alt.png" alt="Genuine Sugarmummies" className="h-8 object-contain mb-2 hidden dark:block" />

                        <h1 className="text-lg font-extrabold text-gradient mb-0.5 text-center">
                            {mode === 'forgot' ? 'Reset Password' :
                             isRegister ? (regStep === 1 ? 'Create Account' : regStep === 2 ? 'About You' : regStep === 3 ? 'What Are You Looking For?' : 'Almost Done!') :
                             'Welcome Back'}
                        </h1>

                        {isRegister && regStep > 1 && (
                            <div className="flex items-center gap-1.5 mt-2">
                                {[1, 2, 3, 4].map(s => (
                                    <div key={s} className={`h-1.5 rounded-full transition-all ${s <= regStep ? 'w-6 gradient-primary' : 'w-4 bg-border'}`} />
                                ))}
                            </div>
                        )}

                        {mode === 'login' && (
                            <p className="text-xs flex items-center gap-1.5 text-center mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                <Sparkles size={12} style={{ color: 'var(--color-gold)' }} className="shrink-0" />
                                Kenya&apos;s #1 dating app for real connections
                            </p>
                        )}
                    </motion.div>
                )}

                <AnimatePresence mode="wait">
                    {/* ========== FORGOT PASSWORD ========== */}
                    {mode === 'forgot' && (
                        <motion.div key="forgot" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
                            <form onSubmit={handleForgotPassword} className="space-y-3">
                                <p className="text-sm text-text-secondary text-center mb-4">
                                    Enter your email address and we&apos;ll send you a password reset link.
                                </p>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border text-sm" />
                                </div>
                                <button type="submit" disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm">
                                    <Mail size={18} />
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ========== STEP 1: Login / Credentials ========== */}
                    {(mode === 'login' || (isRegister && regStep === 1)) && (
                        <motion.div key="step1" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">

                            {/* Google Sign-In */}
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={googleLoading || loading}
                                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-text-primary bg-bg-card border border-border hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60 text-sm mb-4"
                            >
                                {googleLoading ? (
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                )}
                                {googleLoading ? 'Connecting...' : 'Continue with Google'}
                            </button>

                            <div className="flex items-center gap-3 px-2 mb-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-text-muted uppercase tracking-wider font-medium">or use email</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {/* Toggle Login/Register */}
                            <div className="mb-4">
                                <div className="flex rounded-2xl p-1 bg-surface">
                                    <button type="button" onClick={() => { setMode('login'); setRegStep(1); setError(''); setSuccess(''); }}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${mode === 'login' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
                                        <LogIn size={14} /> Sign In
                                    </button>
                                    <button type="button" onClick={() => { setMode('register'); setRegStep(1); setError(''); setSuccess(''); }}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${mode === 'register' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
                                        <UserPlus size={14} /> Register
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleStep1} className="space-y-3">
                                {/* Name (register) */}
                                <AnimatePresence mode="wait">
                                    {isRegister && (
                                        <motion.div key="name" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
                                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                                            <input type="text" placeholder="Your full name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                                                className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border text-sm" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Email */}
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border text-sm" />
                                </div>

                                {/* Password */}
                                <div className="relative">
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input type={showPassword ? 'text' : 'password'} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                                        className="w-full py-3.5 pl-12 pr-12 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border text-sm" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Password strength (register only) */}
                                {isRegister && password && (
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="flex-1 flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwdStrength.level ? pwdStrength.color : 'bg-border'}`} />
                                            ))}
                                        </div>
                                        <span className={`text-[10px] font-medium ${pwdStrength.level === 1 ? 'text-danger' : pwdStrength.level === 2 ? 'text-gold' : 'text-success'}`}>
                                            {pwdStrength.label}
                                        </span>
                                    </div>
                                )}

                                {/* Confirm password (register) */}
                                <AnimatePresence mode="wait">
                                    {isRegister && (
                                        <motion.div key="confirm" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                                            <input type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border text-sm" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Submit */}
                                <button type="submit" disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm">
                                    {isRegister ? <UserPlus size={18} /> : <Heart size={18} fill="currentColor" />}
                                    {loading ? (isRegister ? 'Creating...' : 'Signing In...') : (isRegister ? 'Continue' : 'Sign In & Find Matches')}
                                    <ArrowRight size={16} />
                                </button>

                                {!isRegister && (
                                    <p className="text-center">
                                        <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} className="text-xs text-primary font-medium hover:underline">
                                            Forgot your password?
                                        </button>
                                    </p>
                                )}

                                {/* Trust signals */}
                                <div className="flex items-center justify-center gap-4 pt-2">
                                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                        <Shield size={10} className="text-success" /> Encrypted
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                        <Users size={10} className="text-primary" /> 10K+ Members
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                        <CheckCircle size={10} className="text-gold" /> Verified
                                    </span>
                                </div>

                                <p className="text-center text-[10px] text-text-muted mt-3 px-4 leading-relaxed">
                                    By continuing, you agree to our{' '}
                                    <a href="https://genuinesugarmummies.co.ke/terms-of-service/" className="underline hover:text-primary">Terms of Service</a> and{' '}
                                    <a href="https://genuinesugarmummies.co.ke/privacy-policy/" className="underline hover:text-primary">Privacy Policy</a>
                                </p>
                            </form>
                        </motion.div>
                    )}

                    {/* ========== STEP 2: Gender Selection ========== */}
                    {isRegister && regStep === 2 && (
                        <motion.div key="step2" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm space-y-4">
                            <p className="text-sm text-text-secondary text-center mb-4">Select your gender to help us find the best matches for you</p>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { value: 'male', label: 'Male', desc: 'I am a man' },
                                    { value: 'female', label: 'Female', desc: 'I am a woman' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleGenderSelect(opt.value)}
                                        className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${gender === opt.value
                                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                            : 'border-border bg-bg-card hover:border-primary/30'
                                            }`}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${opt.value === 'male' ? 'bg-blue-500/10 text-blue-500' : 'bg-pink-500/10 text-pink-500'}`}>
                                            <User size={32} />
                                        </div>
                                        <span className="font-bold text-text-primary text-sm">{opt.label}</span>
                                        <span className="text-xs text-text-muted">{opt.desc}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ========== STEP 3: Role / Looking For ========== */}
                    {isRegister && regStep === 3 && (
                        <motion.div key="step3" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm space-y-4">
                            <p className="text-sm text-text-secondary text-center mb-4">What type of connection are you looking for?</p>
                            <div className="space-y-3">
                                {[
                                    { value: 'sugar_mummy', label: 'Sugar Mummy', desc: 'I want to connect with a Sugar Mummy', color: 'from-pink-500 to-orange-500' },
                                    { value: 'sugar_daddy', label: 'Sugar Daddy', desc: 'I want to connect with a Sugar Daddy', color: 'from-blue-500 to-purple-500' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleRoleSelect(opt.value)}
                                        className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${lookingFor === opt.value
                                            ? 'border-primary bg-primary/5 shadow-lg'
                                            : 'border-border bg-bg-card hover:border-primary/30'
                                            }`}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-white shadow-md shrink-0`}>
                                            <Heart size={24} fill="currentColor" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-bold text-text-primary text-sm block">{opt.label}</span>
                                            <span className="text-xs text-text-muted">{opt.desc}</span>
                                        </div>
                                        <Search size={16} className="text-text-muted shrink-0" />
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ========== STEP 4: Age + Location ========== */}
                    {isRegister && regStep === 4 && (
                        <motion.div key="step4" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm space-y-4">
                            <p className="text-sm text-text-secondary text-center mb-2">Just a few more details to complete your profile</p>

                            {/* Age */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Age</label>
                                <input
                                    type="number" min="18" max="80" placeholder="e.g. 25"
                                    value={age} onChange={(e) => setAge(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                                />
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Location</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <select
                                        value={location} onChange={(e) => setLocation(e.target.value)}
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm appearance-none"
                                    >
                                        <option value="">Select location...</option>
                                        {KENYAN_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <button
                                    type="button" onClick={detectLocation} disabled={detectingLocation}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                                >
                                    <Target size={14} className={detectingLocation ? 'animate-spin' : ''} />
                                    {detectingLocation ? 'Detecting location...' : 'Auto-detect my location'}
                                </button>
                            </div>

                            {/* Public profile toggle */}
                            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-bg-card">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Public Profile</p>
                                    <p className="text-xs text-text-muted">Show my profile in Members section</p>
                                </div>
                                <button
                                    type="button" onClick={() => setIsPublic(!isPublic)}
                                    className={`w-12 h-7 rounded-full transition-all relative ${isPublic ? 'bg-primary' : 'bg-border'}`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-bg-card shadow-sm transition-all ${isPublic ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Summary */}
                            <div className="p-4 rounded-2xl bg-surface space-y-2">
                                <p className="text-xs font-bold text-text-primary">Your Profile Summary</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-bg-card border border-border flex items-center gap-1.5">
                                        <User size={12} className={gender === 'male' ? 'text-blue-500' : 'text-pink-500'} />
                                        {gender === 'male' ? 'Male' : 'Female'}
                                    </span>
                                    <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-bg-card border border-border flex items-center gap-1.5">
                                        <Heart size={12} className="text-primary" fill="currentColor" />
                                        {lookingFor === 'sugar_mummy' ? 'Looking for Sugar Mummy' : 'Looking for Sugar Daddy'}
                                    </span>
                                    {age && (
                                        <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-bg-card border border-border flex items-center gap-1.5">
                                            <Calendar size={12} className="text-gold" />
                                            {age} years
                                        </span>
                                    )}
                                    {location && (
                                        <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-bg-card border border-border flex items-center gap-1.5">
                                            <MapPin size={12} className="text-primary" />
                                            {location}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Complete button */}
                            <button
                                onClick={handleCompleteRegistration} disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm"
                            >
                                <Heart size={18} fill="currentColor" />
                                {loading ? 'Creating Account...' : 'Create My Account'}
                                <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error / Success messages */}
                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-3 text-xs text-center text-white bg-danger/90 rounded-xl py-2.5 px-4 shadow-lg max-w-sm w-full">
                            {error}
                        </motion.p>
                    )}
                    {success && (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-3 text-xs text-center text-white bg-success/90 rounded-xl py-2.5 px-4 shadow-lg max-w-sm w-full">
                            {success}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg, #fff)' }}>
                <img
                    src="/gs.png"
                    alt="Loading"
                    style={{ width: 56, height: 56, objectFit: 'contain', animation: 'pulseZoom 1.2s ease-in-out infinite' }}
                />
                <style>{`@keyframes pulseZoom{0%,100%{transform:scale(.88);opacity:.6}50%{transform:scale(1.1);opacity:1}}`}</style>
            </div>
        }>
            <LoginPageInner />
        </Suspense>
    );
}
