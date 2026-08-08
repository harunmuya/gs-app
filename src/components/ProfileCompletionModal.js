'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { PRECISE_POSITION_OPTIONS, resolvePlaceName } from '@/lib/placeName';
import {
    User, MapPin, Phone, FileText, Heart, Sparkles, Calendar,
    ArrowRight, ArrowLeft, Check, X, Target, Star,
} from '@/components/icons';

const LOOKING_FOR_OPTIONS = [
    { value: 'sugar_mummy_looking_for_toyboy', label: 'I am a Sugar Mummy', desc: 'Looking for a sugar guy / toyboy', color: '#E11D48' },
    { value: 'sugar_daddy_looking_for_mistress', label: 'I am a Sugar Daddy', desc: 'Looking for an adult mistress', color: '#0EA5E9' },
    { value: 'mistress_looking_for_sugar_daddy', label: 'I am a Mistress', desc: 'Looking for a sugar daddy', color: '#0F766E' },
    { value: 'toyboy_looking_for_sugar_mummy', label: 'I am a Sugar Guy / Toyboy', desc: 'Looking for a sugar mummy', color: '#F59E0B' },
];

function cleanPhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').slice(0, 18);
}

function getMissingSteps(profile, preference) {
    const steps = [];
    if (!profile?.bio || String(profile.bio).trim().length < 5) {
        steps.push('bio');
    }
    if (!profile?.age || Number(profile.age) < 18) {
        steps.push('age');
    }
    if (!profile?.location || String(profile.location).trim().length < 2) {
        steps.push('location');
    }
    if (!profile?.phone_number && !profile?.phone) {
        steps.push('phone');
    }
    if (!profile?.wants || String(profile.wants).trim().length < 3) {
        steps.push('wants');
    }
    if (!preference) {
        steps.push('looking_for');
    }
    return steps;
}

function isProfileReady(profile, preference) {
    return Boolean(
        profile?.bio && String(profile.bio).trim().length >= 5 &&
        profile?.age && Number(profile.age) >= 18 &&
        profile?.location && String(profile.location).trim().length >= 2 &&
        (profile?.phone_number || profile?.phone)
    );
}

export default function ProfileCompletionModal() {
    const { user, profile, preference, updateProfile, updatePreference } = useAuth();

    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form values
    const [bio, setBio] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [wants, setWants] = useState('');
    const [neededQualities, setNeededQualities] = useState('');
    const [ageRange, setAgeRange] = useState('');
    const [selectedPreference, setSelectedPreference] = useState('');
    const [geoBusy, setGeoBusy] = useState(false);

    // Calculate missing steps
    const missingSteps = getMissingSteps(profile, preference);

    useEffect(() => {
        if (!user || dismissed) return;
        // Show modal if profile has missing required fields
        if (missingSteps.length > 0) {
            // small delay so the page renders first
            const timer = setTimeout(() => setVisible(true), 600);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [user, profile, preference, dismissed]);

    // Pre-fill from existing profile
    useEffect(() => {
        if (!profile) return;
        if (profile.bio) setBio(profile.bio);
        if (profile.age) setAge(String(profile.age));
        if (profile.location) setLocation(profile.location);
        if (profile.phone_number || profile.phone) setPhone(profile.phone_number || profile.phone);
        if (profile.wants) setWants(profile.wants);
        if (profile.needed_qualities) setNeededQualities(profile.needed_qualities);
        if (profile.age_range_preference) setAgeRange(profile.age_range_preference);
    }, [profile]);

    useEffect(() => {
        if (preference) setSelectedPreference(preference);
    }, [preference]);

    function detectLocation() {
        if (!navigator.geolocation || geoBusy) return;
        setGeoBusy(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const label = await resolvePlaceName(pos.coords.latitude, pos.coords.longitude);
                if (label) setLocation(label);
                else setError('We could not name your area. Please type your city.');
                setGeoBusy(false);
            },
            () => {
                setError('Could not detect location. Type your city manually.');
                setGeoBusy(false);
            },
            PRECISE_POSITION_OPTIONS
        );
    }

    // Build active steps (only missing ones + extras)
    const STEP_DEFS = [
        {
            key: 'bio',
            title: 'Tell us about yourself',
            subtitle: 'A short bio helps members know you\'re real',
            icon: FileText,
            color: 'var(--color-primary)',
        },
        {
            key: 'age',
            title: 'How old are you?',
            subtitle: 'Age must be 18 or above',
            icon: Calendar,
            color: '#E11D48',
        },
        {
            key: 'location',
            title: 'Where are you located?',
            subtitle: 'Your city, town, or estate',
            icon: MapPin,
            color: '#059669',
        },
        {
            key: 'phone',
            title: 'Your phone number',
            subtitle: 'So verified members can reach you',
            icon: Phone,
            color: '#0EA5E9',
        },
        {
            key: 'wants',
            title: 'What are you looking for?',
            subtitle: 'Describe the kind of connection you want',
            icon: Heart,
            color: '#F59E0B',
        },
        {
            key: 'looking_for',
            title: 'Choose your category',
            subtitle: 'Which type of member are you?',
            icon: Target,
            color: '#7C3AED',
        },
    ];

    const activeSteps = STEP_DEFS.filter(s => missingSteps.includes(s.key));
    // Add extras (wants, qualities, age range) if not already missing
    const extrasToAdd = ['wants'].filter(k => !missingSteps.includes(k) && (!profile?.[k === 'wants' ? 'wants' : k]));
    extrasToAdd.forEach(k => {
        const def = STEP_DEFS.find(s => s.key === k);
        if (def && !activeSteps.find(s => s.key === k)) activeSteps.push(def);
    });

    if (activeSteps.length === 0 || !visible) return null;

    const step = activeSteps[Math.min(currentStep, activeSteps.length - 1)];
    const progress = activeSteps.length > 0 ? ((currentStep + 1) / activeSteps.length) * 100 : 100;

    function getStepValue() {
        switch (step.key) {
            case 'bio': return bio;
            case 'age': return age;
            case 'location': return location;
            case 'phone': return phone;
            case 'wants': return wants;
            case 'looking_for': return selectedPreference;
            default: return '';
        }
    }

    function validateStep() {
        switch (step.key) {
            case 'bio':
                if (bio.trim().length < 12) return 'Write a short bio (at least 12 characters).';
                break;
            case 'age':
                const n = Number(age);
                if (!Number.isInteger(n) || n < 18 || n > 80) return 'Age must be between 18 and 80.';
                break;
            case 'location':
                if (location.trim().length < 2) return 'Add your city or area.';
                break;
            case 'phone':
                if (cleanPhone(phone).replace(/\D/g, '').length < 7) return 'Add a valid phone number.';
                break;
            case 'wants':
                if (wants.trim().length < 3) return 'Describe what you\'re looking for.';
                break;
            case 'looking_for':
                if (!selectedPreference) return 'Choose your category.';
                break;
        }
        return '';
    }

    async function handleNext() {
        setError('');
        setSuccess('');
        const msg = validateStep();
        if (msg) { setError(msg); return; }

        setSaving(true);
        try {
            // Save current step
            const patch = {};
            switch (step.key) {
                case 'bio': patch.bio = bio.trim(); break;
                case 'age': patch.age = age.trim(); break;
                case 'location':
                    patch.location = location.trim();
                    patch.city = location.trim();
                    break;
                case 'phone':
                    patch.phone_number = cleanPhone(phone);
                    patch.phone = cleanPhone(phone);
                    break;
                case 'wants':
                    patch.wants = wants.trim();
                    if (neededQualities.trim()) patch.needed_qualities = neededQualities.trim();
                    if (ageRange.trim()) patch.age_range_preference = ageRange.trim();
                    break;
                case 'looking_for':
                    await updatePreference(selectedPreference);
                    break;
            }

            if (Object.keys(patch).length > 0) {
                await updateProfile(patch);
            }

            if (currentStep < activeSteps.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                // All done
                setSuccess('Profile complete! Welcome aboard.');
                setTimeout(() => {
                    setVisible(false);
                    setDismissed(true);
                }, 800);
            }
        } catch (err) {
            setError(err.message || 'Could not save. Try again.');
        } finally {
            setSaving(false);
        }
    }

    function handleBack() {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
        setError('');
    }

    function handleDismiss() {
        setDismissed(true);
        setVisible(false);
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                >
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="w-full max-w-md mx-auto overflow-hidden"
                        style={{
                            background: '#ffffff',
                            borderRadius: '28px 28px 0 0',
                            maxHeight: '92dvh',
                            boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
                        }}
                    >
                        {/* Progress bar */}
                        <div className="h-1.5" style={{ background: 'rgba(194, 30, 86,0.1)' }}>
                            <motion.div
                                className="h-full rounded-r-full"
                                style={{ background: 'var(--gradient-primary)' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.4 }}
                            />
                        </div>

                        {/* Header */}
                        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${step.color}15` }}>
                                    <step.icon size={22} style={{ color: step.color }} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-gray-900">{step.title}</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">{step.subtitle}</p>
                                </div>
                            </div>
                            <button onClick={handleDismiss} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Step counter */}
                        <div className="px-6 pb-3">
                            <p className="text-[11px] font-bold text-gray-400">Step {currentStep + 1} of {activeSteps.length}</p>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-4" style={{ minHeight: 180 }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={step.key}
                                    initial={{ x: 30, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -30, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {step.key === 'bio' && (
                                        <textarea
                                            value={bio}
                                            onChange={(e) => { setBio(e.target.value); setError(''); }}
                                            placeholder="Tell members about yourself — who you are, what makes you special..."
                                            rows={4}
                                            autoFocus
                                            className="w-full rounded-2xl p-4 text-sm resize-none outline-none transition-all"
                                            style={{ background: '#f8f9fa', border: '2px solid transparent', borderColor: error ? '#DC2626' : 'transparent' }}
                                            onFocus={(e) => e.target.style.borderColor = step.color}
                                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                        />
                                    )}

                                    {step.key === 'age' && (
                                        <input
                                            type="number"
                                            value={age}
                                            onChange={(e) => { setAge(e.target.value); setError(''); }}
                                            placeholder="Your age (18-80)"
                                            min={18}
                                            max={80}
                                            autoFocus
                                            className="w-full rounded-2xl p-4 text-sm outline-none transition-all"
                                            style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                            onFocus={(e) => e.target.style.borderColor = step.color}
                                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                        />
                                    )}

                                    {step.key === 'location' && (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={location}
                                                onChange={(e) => { setLocation(e.target.value); setError(''); }}
                                                placeholder="Your city, town, or estate"
                                                autoFocus
                                                className="w-full rounded-2xl p-4 text-sm outline-none transition-all"
                                                style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                                onFocus={(e) => e.target.style.borderColor = step.color}
                                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            />
                                            <button
                                                type="button"
                                                onClick={detectLocation}
                                                disabled={geoBusy}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                                                style={{ color: step.color, background: `${step.color}10` }}
                                            >
                                                <MapPin size={14} />
                                                {geoBusy ? 'Detecting...' : 'Auto-detect my location'}
                                            </button>
                                        </div>
                                    )}

                                    {step.key === 'phone' && (
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => { setPhone(e.target.value); setError(''); }}
                                            placeholder="e.g. 0712345678"
                                            autoFocus
                                            className="w-full rounded-2xl p-4 text-sm outline-none transition-all"
                                            style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                            onFocus={(e) => e.target.style.borderColor = step.color}
                                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                        />
                                    )}

                                    {step.key === 'wants' && (
                                        <div className="space-y-3">
                                            <textarea
                                                value={wants}
                                                onChange={(e) => { setWants(e.target.value); setError(''); }}
                                                placeholder="What kind of person are you looking for? What matters to you?"
                                                rows={3}
                                                autoFocus
                                                className="w-full rounded-2xl p-4 text-sm resize-none outline-none transition-all"
                                                style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                                onFocus={(e) => e.target.style.borderColor = step.color}
                                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            />
                                            <input
                                                type="text"
                                                value={neededQualities}
                                                onChange={(e) => setNeededQualities(e.target.value)}
                                                placeholder="Needed qualities (e.g. honest, caring, serious)"
                                                className="w-full rounded-2xl p-4 text-sm outline-none transition-all"
                                                style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                                onFocus={(e) => e.target.style.borderColor = step.color}
                                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            />
                                            <input
                                                type="text"
                                                value={ageRange}
                                                onChange={(e) => setAgeRange(e.target.value)}
                                                placeholder="Preferred age range (e.g. 25-40)"
                                                className="w-full rounded-2xl p-4 text-sm outline-none transition-all"
                                                style={{ background: '#f8f9fa', border: '2px solid transparent' }}
                                                onFocus={(e) => e.target.style.borderColor = step.color}
                                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            />
                                        </div>
                                    )}

                                    {step.key === 'looking_for' && (
                                        <div className="space-y-2">
                                            {LOOKING_FOR_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => { setSelectedPreference(opt.value); setError(''); }}
                                                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                                                    style={{
                                                        background: selectedPreference === opt.value ? `${opt.color}12` : '#f8f9fa',
                                                        border: `2px solid ${selectedPreference === opt.value ? opt.color : 'transparent'}`,
                                                    }}
                                                >
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${opt.color}18` }}>
                                                        <Heart size={16} style={{ color: opt.color }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-900">{opt.label}</p>
                                                        <p className="text-xs text-gray-500">{opt.desc}</p>
                                                    </div>
                                                    {selectedPreference === opt.value && (
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: opt.color }}>
                                                            <Check size={14} className="text-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Error / Success */}
                        {error && (
                            <div className="px-6 pb-3">
                                <p className="text-xs font-bold text-red-600 bg-red-50 rounded-xl p-2.5 text-center">{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="px-6 pb-3">
                                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl p-2.5 text-center flex items-center justify-center gap-1.5">
                                    <Sparkles size={14} /> {success}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="px-6 pb-8 pt-2 flex items-center gap-3">
                            {currentStep > 0 && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:bg-gray-100"
                                    style={{ background: '#f3f4f6' }}
                                >
                                    <ArrowLeft size={20} className="text-gray-600" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 transition-all active:scale-[0.98]"
                                style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(194, 30, 86,0.35)' }}
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : currentStep < activeSteps.length - 1 ? (
                                    <>Save & Continue <ArrowRight size={20} /></>
                                ) : (
                                    <>Finish <Check size={20} /></>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
