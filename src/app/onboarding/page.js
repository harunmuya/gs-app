'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Heart, MapPin, Target, Calendar, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

const KENYAN_CITIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi',
    'Kitale', 'Nyeri', 'Machakos', 'Meru', 'Kiambu', 'Ruiru', 'Juja', 'Ngong',
    'Rongai', 'Karen', 'Westlands', 'Kilimani', 'Langata', 'Diani', 'Kilifi',
    'Naivasha', 'Nanyuki',
];

function findNearestCity(lat, lng) {
    const cities = [
        { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
        { name: 'Mombasa', lat: -4.0435, lng: 39.6682 },
        { name: 'Kisumu', lat: -0.1022, lng: 34.7617 },
    ];
    let nearest = 'Nairobi';
    let minDist = Infinity;
    for (const city of cities) {
        const d = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2));
        if (d < minDist) { minDist = d; nearest = city.name; }
    }
    return nearest;
}

export default function OnboardingPage() {
    const { user, loading, updateProfile, needsOnboarding } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(1); // 1=gender, 2=role, 3=age+location
    const [gender, setGender] = useState('');
    const [lookingFor, setLookingFor] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Redirect if not logged in or already onboarded
    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.replace('/auth/login');
            } else if (!needsOnboarding) {
                router.replace('/discover');
            }
        }
    }, [user, loading, needsOnboarding, router]);

    useEffect(() => {
        if (gender === 'male') setLookingFor('sugar_mummy');
        else if (gender === 'female') setLookingFor('sugar_daddy');
    }, [gender]);

    const detectLocation = () => {
        if (!navigator.geolocation) return;
        setDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation(findNearestCity(pos.coords.latitude, pos.coords.longitude));
                setDetectingLocation(false);
            },
            () => { setLocation('Nairobi'); setDetectingLocation(false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleGenderSelect = (g) => {
        setGender(g);
        setTimeout(() => setStep(2), 300);
    };

    const handleRoleSelect = (role) => {
        setLookingFor(role);
        setTimeout(() => { setStep(3); detectLocation(); }, 300);
    };

    const handleComplete = async () => {
        const ageNum = parseInt(age);
        if (!ageNum || ageNum < 18 || ageNum > 80) { setError('Please enter a valid age (18–80)'); return; }
        if (!location.trim()) { setError('Please select your location'); return; }
        setSaving(true);
        setError('');
        try {
            await updateProfile({ gender, lookingFor, age: ageNum, location, isPublic });
            router.replace('/discover');
        } catch (err) {
            setError('Failed to save profile. Please try again.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-bg">
                <img src="/gs.png" alt="Loading" className="w-16 h-16 object-contain animate-pulse-zoom" />
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex flex-col bg-bg overflow-hidden relative">
            {/* Background glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20" style={{ background: 'var(--color-primary)' }} />
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10" style={{ background: 'var(--color-gold)' }} />
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10">
                {/* Header */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex flex-col items-center mb-8"
                >
                    <img src="/gs.png" alt="GS" className="w-12 h-12 object-contain mb-3" />
                    <img src="/genuine-logo.png" alt="Genuine Sugarmummies" className="h-7 object-contain mb-2 dark:hidden" />
                    <img src="/genuine-logo-alt.png" alt="Genuine Sugarmummies" className="h-7 object-contain mb-2 hidden dark:block" />

                    <div className="flex items-center gap-1.5 mt-3">
                        <Sparkles size={14} className="text-gold" />
                        <span className="text-sm font-semibold text-text-primary">Complete Your Profile</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 text-center">Just a few quick steps to find your perfect match</p>

                    {/* Step indicators */}
                    <div className="flex items-center gap-2 mt-4">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`rounded-full transition-all duration-300 ${s <= step ? 'w-8 h-2 gradient-primary' : 'w-5 h-2 bg-border'}`} />
                        ))}
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Gender */}
                    {step === 1 && (
                        <motion.div key="gender" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full max-w-sm space-y-4">
                            <p className="text-center text-sm font-semibold text-text-primary mb-2">What is your gender?</p>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { value: 'male', label: 'Male', emoji: '👨', color: 'bg-blue-500/10 text-blue-500' },
                                    { value: 'female', label: 'Female', emoji: '👩', color: 'bg-pink-500/10 text-pink-500' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleGenderSelect(opt.value)}
                                        className={`flex flex-col items-center gap-3 p-7 rounded-3xl border-2 transition-all ${gender === opt.value ? 'border-primary bg-primary/5 shadow-lg' : 'border-border bg-bg-card hover:border-primary/40'}`}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${opt.color}`}>{opt.emoji}</div>
                                        <span className="font-bold text-text-primary">{opt.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Looking For */}
                    {step === 2 && (
                        <motion.div key="role" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full max-w-sm space-y-3">
                            <p className="text-center text-sm font-semibold text-text-primary mb-2">What are you looking for?</p>
                            {[
                                { value: 'sugar_mummy', label: 'Sugar Mummy', desc: 'Connect with a Sugar Mummy', emoji: '👩‍❤️‍👨', color: 'from-pink-500 to-rose-600' },
                                { value: 'sugar_daddy', label: 'Sugar Daddy', desc: 'Connect with a Sugar Daddy', emoji: '👨‍❤️‍👩', color: 'from-blue-500 to-indigo-600' },
                            ].map(opt => (
                                <motion.button
                                    key={opt.value}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleRoleSelect(opt.value)}
                                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${lookingFor === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-bg-card hover:border-primary/40'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-2xl shadow-md shrink-0`}>{opt.emoji}</div>
                                    <div>
                                        <span className="font-bold text-text-primary block">{opt.label}</span>
                                        <span className="text-xs text-text-muted">{opt.desc}</span>
                                    </div>
                                </motion.button>
                            ))}
                        </motion.div>
                    )}

                    {/* Step 3: Age + Location */}
                    {step === 3 && (
                        <motion.div key="details" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full max-w-sm space-y-4">
                            <p className="text-center text-sm font-semibold text-text-primary mb-2">Almost there!</p>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Age</label>
                                <input
                                    type="number" min="18" max="80" placeholder="e.g. 25"
                                    value={age} onChange={e => setAge(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Location</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <select
                                        value={location} onChange={e => setLocation(e.target.value)}
                                        className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm appearance-none"
                                    >
                                        <option value="">Select location...</option>
                                        {KENYAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <button
                                    type="button" onClick={detectLocation} disabled={detectingLocation}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                                >
                                    <Target size={14} className={detectingLocation ? 'animate-spin' : ''} />
                                    {detectingLocation ? 'Detecting...' : 'Auto-detect my location'}
                                </button>
                            </div>

                            {/* Profile visibility */}
                            <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-bg-card">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Public Profile</p>
                                    <p className="text-xs text-text-muted">Appear in Members section</p>
                                </div>
                                <button type="button" onClick={() => setIsPublic(!isPublic)} className={`w-12 h-7 rounded-full transition-all relative ${isPublic ? 'bg-primary' : 'bg-border'}`}>
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isPublic ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            {error && (
                                <p className="text-xs text-center text-white bg-danger/90 rounded-xl py-2.5 px-4">{error}</p>
                            )}

                            <button
                                onClick={handleComplete} disabled={saving}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <CheckCircle size={18} />
                                )}
                                {saving ? 'Setting up your profile...' : 'Start Finding Matches'}
                                {!saving && <ArrowRight size={16} />}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
