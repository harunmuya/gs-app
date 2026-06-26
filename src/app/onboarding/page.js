'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Heart, MapPin, Target, Calendar, ArrowRight, CheckCircle, Crown, Flame } from 'lucide-react';

const KENYAN_CITIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Ruiru', 'Kikuyu',
    'Thika', 'Naivasha', 'Kakamega', 'Kisii', 'Kitale', 'Athi River', 'Mlolongo',
    'Garissa', 'Malindi', 'Ngong', 'Rongai', 'Karen', 'Westlands', 'Kilimani',
    'Langata', 'South B', 'South C', 'Roysambu', 'Kasarani', 'Embakasi',
    'Juja', 'Kiambu', 'Nyeri', 'Machakos', 'Meru', 'Nanyuki', 'Diani',
    'Kilifi', 'Voi', 'Kericho', 'Homabay', 'Migori', 'Bomet', 'Webuye',
    'Wajir', 'Limuru', 'Lodwar', 'Mandera', 'Narok', 'Isiolo', 'Marsabit',
    'Lamu', 'Watamu', 'Bamburi', 'Nyali',
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

    const [step, setStep] = useState(1); // 1=gender, 2=I am a, 3=age+location+country, 4=interests+hobbies
    const [gender, setGender] = useState('');
    const [profileType, setProfileType] = useState('');
    const [lookingFor, setLookingFor] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [country, setCountry] = useState('Kenya');
    const [interests, setInterests] = useState('');
    const [hobbies, setHobbies] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const ONBOARD_COUNTRIES = ['Kenya','Uganda','Tanzania','Zimbabwe','Malawi','Rwanda','Burundi','South Sudan','Ethiopia','Nigeria','Ghana','South Africa','Other'];

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

    const LOOKING_FOR_MAP = {
        sugar_mummy: 'Toyboy / Sugar Guy',
        sugar_daddy: 'Young Lady / Mistress',
        toyboy: 'Sugar Mummy',
        sugar_guy: 'Sugar Mummy',
        young_lady: 'Sugar Daddy',
        mistress: 'Sugar Daddy',
    };

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

    const handleProfileTypeSelect = (type) => {
        setProfileType(type);
        // Auto-set lookingFor based on profile type
        if (type === 'sugar_mummy' || type === 'cougar') setLookingFor('toyboy');
        else if (type === 'sugar_daddy') setLookingFor('young_lady');
        else if (type === 'toyboy' || type === 'sugar_guy') setLookingFor('sugar_mummy');
        else if (type === 'young_lady' || type === 'mistress') setLookingFor('sugar_daddy');
        setTimeout(() => { setStep(3); detectLocation(); }, 300);
    };

    const handleCompleteStep3 = () => {
        const ageNum = parseInt(age);
        if (!ageNum || ageNum < 18 || ageNum > 80) { setError('Please enter a valid age (18–80)'); return; }
        if (!location.trim()) { setError('Please select your location'); return; }
        setError('');
        setStep(4);
    };

    const handleComplete = async () => {
        setSaving(true);
        setError('');
        try {
            const ageNum = parseInt(age);
            const parsedInterests = interests.split(',').map(i => i.trim()).filter(Boolean);
            const parsedHobbies = hobbies.split(',').map(h => h.trim()).filter(Boolean);

            await updateProfile({ 
                gender, 
                lookingFor, 
                profile_type: profileType,
                country,
                age: ageNum, 
                location, 
                interests: parsedInterests,
                hobbies: parsedHobbies,
                isPublic 
            });

            // Secure server-side validation & welcome sync
            if (user?.id) {
                await fetch('/api/welcome', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        email: user.email,
                        displayName: user.display_name,
                        extraData: {
                            gender,
                            lookingFor,
                            age: ageNum,
                            location,
                            interests: parsedInterests,
                            hobbies: parsedHobbies,
                            isPublic
                        }
                    })
                }).catch(err => console.warn('[Onboarding] Welcome API call failed:', err));
            }

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
                    <img src="/genuine-logo.png?v=5" alt="Genuine Sugarmummies" className="h-7 object-contain mb-2 dark:hidden" />
                    <img src="/genuine-logo-alt.png?v=5" alt="Genuine Sugarmummies" className="h-7 object-contain mb-2 hidden dark:block" />

                    <div className="flex items-center gap-1.5 mt-3">
                        <Crown size={14} className="text-gold" />
                        <span className="text-sm font-semibold text-text-primary">Complete Your Profile</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 text-center">Just a few quick steps to find your perfect match</p>

                    {/* Step indicators */}
                    <div className="flex items-center gap-2 mt-4">
                        {[1, 2, 3, 4].map(s => (
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
                                    { value: 'male', label: 'Male', color: 'bg-blue-500/10 text-blue-500' },
                                    { value: 'female', label: 'Female', color: 'bg-pink-500/10 text-pink-500' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleGenderSelect(opt.value)}
                                        className={`flex flex-col items-center gap-3 p-7 rounded-3xl border-2 transition-all ${gender === opt.value ? 'border-primary bg-primary/5 shadow-lg' : 'border-border bg-bg-card hover:border-primary/40'}`}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${opt.color}`}>
                                            <User size={32} />
                                        </div>
                                        <span className="font-bold text-text-primary">{opt.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: I Am A... */}
                    {step === 2 && (
                        <motion.div key="role" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full max-w-sm space-y-3">
                            <p className="text-center text-sm font-semibold text-text-primary mb-2">I am a...</p>
                            {(gender === 'female' ? [
                                { value: 'sugar_mummy', label: 'Sugar Mummy', desc: 'Looking for a Toyboy / Sugar Guy', color: 'from-pink-500 to-rose-600', icon: '👑' },
                                { value: 'cougar', label: 'Cougar', desc: 'Looking for a younger partner', color: 'from-red-500 to-orange-600', icon: '🔥' },
                                { value: 'young_lady', label: 'Young Lady', desc: 'Looking for a Sugar Daddy', color: 'from-purple-500 to-pink-500', icon: '💎' },
                                { value: 'mistress', label: 'Mistress', desc: 'Looking for a Sugar Daddy', color: 'from-fuchsia-500 to-purple-600', icon: '✨' },
                            ] : [
                                { value: 'toyboy', label: 'Toyboy', desc: 'Looking for a Sugar Mummy', color: 'from-amber-500 to-orange-600', icon: '🌟' },
                                { value: 'sugar_guy', label: 'Sugar Guy', desc: 'Looking for a Sugar Mummy', color: 'from-emerald-500 to-teal-600', icon: '💪' },
                                { value: 'sugar_daddy', label: 'Sugar Daddy', desc: 'Looking for a Young Lady / Mistress', color: 'from-blue-500 to-indigo-600', icon: '👔' },
                            ]).map(opt => (
                                <motion.button
                                    key={opt.value}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleProfileTypeSelect(opt.value)}
                                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${profileType === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-bg-card hover:border-primary/40'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-white shadow-md shrink-0 text-2xl`}>
                                        {opt.icon}
                                    </div>
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
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
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

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Country</label>
                                <select
                                    value={country} onChange={e => setCountry(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                                >
                                    {ONBOARD_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
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
                                onClick={handleCompleteStep3}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] text-sm"
                            >
                                <span>Next Details</span>
                                <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}

                    {/* Step 4: Interests + Hobbies */}
                    {step === 4 && (
                        <motion.div key="interests" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full max-w-sm space-y-4">
                            <p className="text-center text-sm font-semibold text-text-primary mb-2">Tell us about your interests & hobbies!</p>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Interests (comma-separated)</label>
                                <input
                                    type="text" placeholder="e.g. Travel, Movies, Dining Out"
                                    value={interests} onChange={e => setInterests(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary pl-1">Your Hobbies (comma-separated)</label>
                                <input
                                    type="text" placeholder="e.g. Reading, Hiking, Cooking"
                                    value={hobbies} onChange={e => setHobbies(e.target.value)}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                                />
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
