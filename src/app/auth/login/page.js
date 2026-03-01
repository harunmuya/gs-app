'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, ArrowRight, ArrowLeft, User, Mail, Heart, Lock, Eye, EyeOff,
    UserPlus, LogIn, MapPin, Target, Crown, Search
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

export default function LoginPage() {
    const { signIn, signUp, skipLogin } = useAuth();
    const router = useRouter();

    // Mode: login | register
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
    const [gender, setGender] = useState(''); // male | female
    const [lookingFor, setLookingFor] = useState(''); // sugar_mummy | sugar_daddy
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [isPublic, setIsPublic] = useState(true);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isRegister = mode === 'register';
    const totalSteps = 4;

    // Auto-detect location
    const detectLocation = () => {
        if (!navigator.geolocation) {
            setError('Location not supported on this device.');
            return;
        }
        setDetectingLocation(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const city = findNearestCity(pos.coords.latitude, pos.coords.longitude);
                setLocation(city);
                setDetectingLocation(false);
            },
            (err) => {
                console.warn('Geolocation error:', err);
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

    // Handle step 1 submission (login or first reg step)
    const handleStep1 = (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) { setError('Please enter your email'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email'); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }

        if (isRegister) {
            if (password !== confirmPassword) { setError('Passwords do not match'); return; }
            if (!displayName.trim()) { setError('Please enter your name'); return; }
            setRegStep(2); // Go to gender selection
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
            setError(err.message || 'Invalid credentials. Try again.');
            setLoading(false);
        }
    };

    // Handle step 2: gender
    const handleGenderSelect = (g) => {
        setGender(g);
        setError('');
        // Small delay for animation
        setTimeout(() => setRegStep(3), 300);
    };

    // Handle step 3: role/lookingFor
    const handleRoleSelect = (role) => {
        setLookingFor(role);
        setError('');
        setTimeout(() => {
            setRegStep(4);
            // Auto-detect location when reaching step 4
            detectLocation();
        }, 300);
    };

    // Handle step 4: age + location → complete registration
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
            router.push('/discover');
        } catch (err) {
            setError(err.message || 'Registration failed. Try again.');
            setLoading(false);
        }
    };

    const handleSkip = () => {
        skipLogin();
        router.push('/discover');
    };

    const goBack = () => {
        setError('');
        if (isRegister && regStep > 1) {
            setRegStep(regStep - 1);
        } else {
            setMode('login');
            setRegStep(1);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col bg-bg-dark overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-100 rounded-full blur-[120px] opacity-60" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50 rounded-full blur-[100px] opacity-50" />
                <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-orange-50 rounded-full blur-[80px] opacity-40" />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Logo */}
                <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center mb-6"
                >
                    <div className="relative mb-3">
                        <Logo size={64} />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-2 -right-2">
                            <Heart size={16} className="text-primary" fill="currentColor" />
                        </motion.div>
                    </div>
                    <h1 className="text-xl font-extrabold text-gradient mb-0.5 text-center">
                        {isRegister ? (regStep === 1 ? 'Create Account' : regStep === 2 ? 'About You' : regStep === 3 ? 'What Are You Looking For?' : 'Almost Done!') : 'Welcome Back'}
                    </h1>
                    <h2 className="text-base font-bold text-text-primary mb-1 text-center">Genuine Sugarmummies</h2>
                    {/* Step indicator for registration */}
                    {isRegister && regStep > 1 && (
                        <div className="flex items-center gap-1.5 mt-2">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={`h-1.5 rounded-full transition-all ${s <= regStep ? 'w-6 gradient-primary' : 'w-4 bg-black/10'}`} />
                            ))}
                        </div>
                    )}
                    {!isRegister && (
                        <p className="text-text-secondary text-xs flex items-center gap-1.5 text-center">
                            <Sparkles size={12} className="text-gold shrink-0" />
                            Kenya&apos;s #1 dating app for real connections
                        </p>
                    )}
                </motion.div>

                {/* Back button for steps 2+ */}
                {isRegister && regStep > 1 && (
                    <button onClick={goBack} className="absolute top-6 left-6 p-2 rounded-full bg-bg-card/80 backdrop-blur-sm shadow-sm z-10">
                        <ArrowLeft size={20} className="text-text-primary" />
                    </button>
                )}

                <AnimatePresence mode="wait">
                    {/* ========== STEP 1: Login / Credentials ========== */}
                    {(mode === 'login' || (isRegister && regStep === 1)) && (
                        <motion.div key="step1" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
                            {/* Toggle Login/Register */}
                            <div className="mb-4">
                                <div className="flex rounded-2xl p-1" style={{ background: 'var(--color-surface)' }}>
                                    <button type="button" onClick={() => { setMode('login'); setRegStep(1); setError(''); }}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${mode === 'login' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
                                        <LogIn size={14} /> Sign In
                                    </button>
                                    <button type="button" onClick={() => { setMode('register'); setRegStep(1); setError(''); }}
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
                                                className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Email */}
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm" />
                                </div>

                                {/* Password */}
                                <div className="relative">
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input type={showPassword ? 'text' : 'password'} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                                        className="w-full py-3.5 pl-12 pr-12 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Confirm password (register) */}
                                <AnimatePresence mode="wait">
                                    {isRegister && (
                                        <motion.div key="confirm" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                                            <input type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-black/8 text-sm" />
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
                                        <button type="button" className="text-xs text-primary font-medium hover:underline">Forgot your password?</button>
                                    </p>
                                )}

                                <div className="flex items-center gap-3 px-2 pt-1">
                                    <div className="flex-1 h-px bg-black/10" />
                                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">or</span>
                                    <div className="flex-1 h-px bg-black/10" />
                                </div>

                                <button type="button" onClick={handleSkip} disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-text-primary bg-surface hover:bg-surface-light transition-all active:scale-[0.98] border border-black/8 text-sm">
                                    <User size={18} /> Browse as Guest <ArrowRight size={16} />
                                </button>

                                <p className="text-center text-[10px] text-text-muted mt-4 px-4 leading-relaxed">
                                    By continuing, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>
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
                                    { value: 'male', label: 'Male', icon: '👨', desc: 'I am a man' },
                                    { value: 'female', label: 'Female', icon: '👩', desc: 'I am a woman' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleGenderSelect(opt.value)}
                                        className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${gender === opt.value
                                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                            : 'border-black/8 bg-bg-card hover:border-primary/30'
                                            }`}
                                    >
                                        <span className="text-5xl">{opt.icon}</span>
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
                                    { value: 'sugar_mummy', label: 'Sugar Mummy', icon: '💖', desc: 'I want to connect with a Sugar Mummy', color: 'from-pink-500 to-orange-500' },
                                    { value: 'sugar_daddy', label: 'Sugar Daddy', icon: '💙', desc: 'I want to connect with a Sugar Daddy', color: 'from-blue-500 to-purple-500' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleRoleSelect(opt.value)}
                                        className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${lookingFor === opt.value
                                            ? 'border-primary bg-primary/5 shadow-lg'
                                            : 'border-black/8 bg-bg-card hover:border-primary/30'
                                            }`}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-2xl shadow-md shrink-0`}>
                                            {opt.icon}
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
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 border border-black/8 text-sm"
                                />
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Location</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <select
                                        value={location} onChange={(e) => setLocation(e.target.value)}
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-black/8 text-sm appearance-none"
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
                                    {detectingLocation ? 'Detecting location...' : '📍 Auto-detect my location'}
                                </button>
                            </div>

                            {/* Public profile toggle */}
                            <div className="flex items-center justify-between p-4 rounded-2xl border border-black/8 bg-bg-card">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Public Profile</p>
                                    <p className="text-xs text-text-muted">Show my profile in Members section</p>
                                </div>
                                <button
                                    type="button" onClick={() => setIsPublic(!isPublic)}
                                    className={`w-12 h-7 rounded-full transition-all relative ${isPublic ? 'bg-primary' : 'bg-black/15'}`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-bg-card shadow-sm transition-all ${isPublic ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Summary */}
                            <div className="p-4 rounded-2xl bg-surface space-y-2">
                                <p className="text-xs font-bold text-text-primary">Your Profile Summary</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-bg-card border border-black/8">
                                        {gender === 'male' ? '👨 Male' : '👩 Female'}
                                    </span>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-bg-card border border-black/8">
                                        {lookingFor === 'sugar_mummy' ? '💖 Looking for Sugar Mummy' : '💙 Looking for Sugar Daddy'}
                                    </span>
                                    {age && <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-bg-card border border-black/8">🎂 {age} years</span>}
                                    {location && <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-bg-card border border-black/8">📍 {location}</span>}
                                </div>
                            </div>

                            {/* Complete button */}
                            <button
                                onClick={handleCompleteRegistration} disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm"
                            >
                                <Heart size={18} fill="currentColor" />
                                {loading ? 'Creating Account...' : 'Start Finding Matches'}
                                <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-3 text-xs text-center text-white bg-danger/90 rounded-xl py-2.5 px-4 shadow-lg max-w-sm w-full">
                            {error}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
