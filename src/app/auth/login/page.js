'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User, ArrowRight, Heart, Gem, Users, LogIn, UserPlus, LockKeyhole, KeyRound, ShieldCheck, Camera, AtSign, Calendar, MapPin, Phone, FileText, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { labelFromCoordinates } from '@/lib/geo';

const PREFERENCES = [
    { value: 'sugar_mummy_looking_for_toyboy', label: 'I am a Sugar Mummy', desc: 'Looking for a sugar guy / toyboy', icon: Heart, color: '#E11D48' },
    { value: 'sugar_daddy_looking_for_mistress', label: 'I am a Sugar Daddy', desc: 'Looking for an adult mistress', icon: Gem, color: '#0EA5E9' },
    { value: 'mistress_looking_for_sugar_daddy', label: 'I am a Mistress', desc: 'Looking for a sugar daddy', icon: Users, color: '#0F766E' },
    { value: 'toyboy_looking_for_sugar_mummy', label: 'I am a Sugar Guy / Toyboy', desc: 'Looking for a sugar mummy', icon: Heart, color: '#F59E0B' },
];

const LEGAL_LINKS = [
    { href: '/terms', label: 'Terms & Conditions' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/safety', label: 'Safety' },
    { href: '/community-guidelines', label: 'Rules' },
    { href: '/contact', label: 'Contact' },
];

function isComplete(account) {
    return Boolean((account?.avatar_url || account?.photos?.[0]) && account?.bio && account?.age && account?.location && (account?.phone_number || account?.phone));
}

function hardRedirect(path) {
    if (typeof window === 'undefined') return;
    window.location.assign(path);
    window.setTimeout(() => { window.location.href = path; }, 250);
}

function looksLikeEmail(value) {
    return /@/.test(String(value || ''));
}

function makeUsername(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20);
}

function cleanPhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').slice(0, 18);
}

export default function LoginPage() {
    const { user, signIn, signInExisting, requestPasswordReset, resetPassword } = useAuth();
    const photoInputRef = useRef(null);
    const [mode, setMode] = useState('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameTouched, setUsernameTouched] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [selectedPreference, setSelectedPreference] = useState('sugar_mummy_looking_for_toyboy');
    const [step, setStep] = useState(1);
    const [resetSent, setResetSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [detectedGeo, setDetectedGeo] = useState(null);
    const [geoBusy, setGeoBusy] = useState(false);
    const [geoAsked, setGeoAsked] = useState(false);

    useEffect(() => {
        try {
            const savedEmail = JSON.parse(localStorage.getItem('gscom_login_email') || 'null');
            if (savedEmail && !email) setEmail(savedEmail);
            if (new URLSearchParams(window.location.search).get('signed_out') === '1') {
                setNotice('You have been signed out.');
            }
            if (new URLSearchParams(window.location.search).get('deleted') === '1') {
                setNotice('Your account has been deleted from the database.');
            }
        } catch {}
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('signed_out') === '1') return;
        if (user) hardRedirect(isComplete(user) ? '/discover' : '/profile?complete=1');
    }, [user]);

    useEffect(() => {
        if (usernameTouched) return;
        setUsername(makeUsername(displayName));
    }, [displayName, usernameTouched]);

    function validEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function validPassword(value) {
        return String(value || '').length >= 6;
    }

    function validName(value) {
        const text = String(value || '').trim();
        return text.length >= 2 && !looksLikeEmail(text) && /[a-zA-Z]/.test(text) && !/^\d+$/.test(text);
    }

    function validUsername(value) {
        return /^[a-z0-9_]{3,20}$/.test(String(value || '').trim());
    }

    function validAge(value) {
        const number = Number(value);
        return Number.isInteger(number) && number >= 18 && number <= 80;
    }

    function validateProfileStep() {
        if (!profilePhoto) return 'Upload one clear profile photo.';
        if (!validName(displayName)) return 'Add your real first name or public name.';
        if (!validUsername(username)) return 'Username must be 3-20 letters, numbers, or underscores.';
        if (!validAge(age)) return 'Age must be between 18 and 80.';
        if (location.trim().length < 2) return 'Add your city or area.';
        if (cleanPhone(phone).replace(/\D/g, '').length < 7) return 'Add a valid phone number.';
        if (bio.trim().length < 12) return 'Write a short bio so members know you are real.';
        return '';
    }

    function validateCurrentSignupStep(targetStep = step) {
        if (targetStep === 1) {
            if (!validEmail(email.trim())) return 'Please enter a valid email.';
            if (!validPassword(password)) return 'Create a password with at least 6 characters.';
        }
        if (targetStep === 2 && !profilePhoto) return 'Upload one clear real profile photo.';
        if (targetStep === 3) {
            if (!validName(displayName)) return 'Add your real first name or public name.';
            if (!validUsername(username)) return 'Username must be 3-20 letters, numbers, or underscores.';
        }
        if (targetStep === 4) {
            if (!validAge(age)) return 'Age must be between 18 and 80.';
            if (cleanPhone(phone).replace(/\D/g, '').length < 7) return 'Add a valid phone number.';
        }
        if (targetStep === 5) {
            if (location.trim().length < 2) return 'Add your city or area.';
            if (bio.trim().length < 12) return 'Write a short bio so members know you are real.';
        }
        if (targetStep === 6 && !selectedPreference) return 'Choose the type of member you are.';
        return '';
    }

    function goToNextSignupStep(event) {
        event?.preventDefault?.();
        setError('');
        setNotice('');
        const message = validateCurrentSignupStep(step);
        if (message) { setError(message); return; }
        setStep((current) => Math.min(6, current + 1));
    }

    function handleProfilePhoto(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Choose a real image for your profile photo.');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                if (img.width < 180 || img.height < 180) {
                    setError('Upload a clear real photo, at least 180 by 180 pixels.');
                    return;
                }
                const canvas = document.createElement('canvas');
                const max = 720;
                let width = img.width;
                let height = img.height;
                if (width > max || height > max) {
                    if (width > height) {
                        height = Math.round(height * max / width);
                        width = max;
                    } else {
                        width = Math.round(width * max / height);
                        height = max;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                const sampleCanvas = document.createElement('canvas');
                sampleCanvas.width = 80;
                sampleCanvas.height = 80;
                const sampleContext = sampleCanvas.getContext('2d');
                sampleContext.drawImage(img, 0, 0, 80, 80);
                const pixels = sampleContext.getImageData(0, 0, 80, 80).data;
                const buckets = new Set();
                for (let i = 0; i < pixels.length; i += 64) {
                    buckets.add(`${pixels[i] >> 5}-${pixels[i + 1] >> 5}-${pixels[i + 2] >> 5}`);
                }
                if (buckets.size < 16) {
                    setError('That image looks blank or fake. Upload a clear real profile photo.');
                    return;
                }
                setProfilePhoto(canvas.toDataURL('image/webp', 0.82));
                setError('');
                setStep(3);
            };
            img.onerror = () => setError('Could not read that photo. Try another image.');
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    async function handleExistingSubmit(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        if (!validEmail(email.trim())) { setError('Please enter a valid email.'); return; }
        if (!validPassword(password)) { setError('Enter your password, at least 6 characters.'); return; }
        setLoading(true);
        try {
            const account = await signInExisting(email.trim(), password);
            hardRedirect(isComplete(account) ? '/discover' : '/profile?complete=1');
        } catch (err) {
            setError(err.message || 'Could not sign in.');
        } finally {
            setLoading(false);
        }
    }

    function handleCreateEmail(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        const message = validateCurrentSignupStep(1);
        if (message) { setError(message); return; }
        setStep(2);
    }

    async function detectSignupLocation({ quiet = false } = {}) {
        if (!navigator.geolocation) {
            if (!quiet) setError('Location is not supported on this device. Type your city or area manually.');
            return;
        }
        if (geoBusy) return;
        setGeoBusy(true);
        if (!quiet) {
            setError('');
            setNotice('Allow location permission so we can fill your real city or estate.');
        }
        navigator.geolocation.getCurrentPosition((position) => {
            const next = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                geo_updated_at: new Date().toISOString(),
            };
            const label = labelFromCoordinates(next.latitude, next.longitude);
            setDetectedGeo(next);
            if (label) setLocation((current) => current?.trim() ? current : label);
            setNotice(label ? `Location detected: ${label}.` : 'Location detected.');
            setGeoBusy(false);
        }, (err) => {
            if (!quiet) {
                if (err?.code === err.PERMISSION_DENIED) setError('Location permission was denied. Allow Location or type your city/estate manually.');
                else setError('Could not detect location. Type your city or estate manually.');
            }
            setGeoBusy(false);
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 });
    }

    useEffect(() => {
        if (mode !== 'signup' || step !== 5 || geoAsked || location.trim()) return;
        setGeoAsked(true);
        detectSignupLocation({ quiet: true });
    }, [mode, step, geoAsked, location]);

    function handleProfileSubmit(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        const message = validateCurrentSignupStep(step);
        if (message) { setError(message); return; }
        setStep((current) => Math.min(6, current + 1));
    }

    async function handleCreateAccount() {
        const message = validateProfileStep();
        if (message) { setStep(2); setError(message); return; }
        setLoading(true);
        setError('');
        setNotice('');
        try {
            await Promise.resolve(signIn(email.trim(), password, displayName.trim(), selectedPreference, {
                username: username.trim(),
                avatar_url: profilePhoto,
                photos: [profilePhoto],
                age: age.trim(),
                location: location.trim(),
                phone: cleanPhone(phone),
                phone_number: cleanPhone(phone),
                bio: bio.trim(),
                latitude: detectedGeo?.latitude,
                longitude: detectedGeo?.longitude,
                geo_updated_at: detectedGeo?.geo_updated_at,
                city: location.trim(),
            }));
            hardRedirect('/profile');
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSendReset(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        if (!validEmail(email.trim())) { setError('Enter the email on your account.'); return; }
        setLoading(true);
        try {
            await requestPasswordReset(email.trim());
            setResetSent(true);
            setNotice('Reset code sent to your email.');
        } catch (err) {
            setError(err.message || 'Could not send reset code.');
        } finally {
            setLoading(false);
        }
    }

    async function handleResetPassword(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        if (!/^\d{6}$/.test(resetCode.trim())) { setError('Enter the 6-digit reset code.'); return; }
        if (!validPassword(newPassword)) { setError('New password must be at least 6 characters.'); return; }
        setLoading(true);
        try {
            const account = await resetPassword(email.trim(), resetCode.trim(), newPassword);
            hardRedirect(isComplete(account) ? '/discover' : '/profile?complete=1');
        } catch (err) {
            setError(err.message || 'Could not reset password.');
        } finally {
            setLoading(false);
        }
    }

    function switchMode(nextMode) {
        setMode(nextMode);
        setStep(1);
        setResetSent(false);
        setError('');
        setNotice('');
    }

    return (
        <div className="min-h-dvh flex flex-col" style={{ background: '#ffffff' }}>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center pt-10 pb-4 px-6">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ background: 'var(--gradient-primary)' }} />
                    <Logo size={76} className="relative" />
                </div>
            </motion.div>

            <div className="flex-1 px-5 max-w-md mx-auto w-full pb-8">
                <div className="flex gap-1.5 mb-5 rounded-2xl p-1" style={{ background: 'rgba(155,44,94,0.04)', border: '1px solid rgba(155,44,94,0.1)' }}>
                    <button type="button" onClick={() => switchMode('signin')} className={`flex-1 rounded-xl py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${mode === 'signin' ? 'gradient-primary text-white' : 'text-text-muted'}`} style={mode === 'signin' ? { boxShadow: '0 4px 16px rgba(155,44,94,0.3)' } : {}}><LogIn size={14} /> Login</button>
                    <button type="button" onClick={() => switchMode('signup')} className={`flex-1 rounded-xl py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${mode === 'signup' ? 'gradient-primary text-white' : 'text-text-muted'}`} style={mode === 'signup' ? { boxShadow: '0 4px 16px rgba(155,44,94,0.3)' } : {}}><UserPlus size={14} /> Sign Up</button>
                    <button type="button" onClick={() => switchMode('forgot')} className={`flex-1 rounded-xl py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${mode === 'forgot' ? 'gradient-primary text-white' : 'text-text-muted'}`} style={mode === 'forgot' ? { boxShadow: '0 4px 16px rgba(155,44,94,0.3)' } : {}}><KeyRound size={14} /> Reset</button>
                </div>

                {notice && <p className="mb-4 rounded-2xl p-3 text-sm text-center font-bold" style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.15)' }}>{notice}</p>}
                {error && <p className="mb-4 rounded-2xl p-3 text-sm text-center font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>{error}</p>}

                {mode === 'signin' && (
                    <form onSubmit={handleExistingSubmit} className="space-y-3.5">
                        <LightField icon={Mail} value={email} onChange={(value) => { setEmail(value); setError(''); }} placeholder="Email address" type="email" autoFocus />
                        <LightField icon={LockKeyhole} value={password} onChange={(value) => { setPassword(value); setError(''); }} placeholder="Password" type="password" />
                        <label className="flex items-start gap-3 py-2 cursor-pointer">
                            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-[#9B2C5E]" />
                            <span className="text-xs text-text-muted leading-relaxed">I confirm I am 18+ and agree to the <Link href="/terms" className="text-primary underline">Terms</Link>, <Link href="/privacy" className="text-primary underline">Privacy</Link>, and <Link href="/community-guidelines" className="text-primary underline">Community Rules</Link></span>
                        </label>
                        <button disabled={loading || !agreedTerms} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>
                            {loading ? <Spinner /> : <>Login <ArrowRight size={20} /></>}
                        </button>
                        <button type="button" onClick={() => switchMode('forgot')} className="w-full py-2 text-xs font-bold text-text-muted">Forgot password?</button>
                    </form>
                )}

                {mode === 'forgot' && (
                    <form onSubmit={resetSent ? handleResetPassword : handleSendReset} className="space-y-3.5">
                        <LightField icon={Mail} value={email} onChange={(value) => { setEmail(value); setError(''); }} placeholder="Email on your account" type="email" autoFocus />
                        {resetSent && <LightField icon={ShieldCheck} value={resetCode} onChange={(value) => { setResetCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="6-digit reset code" inputMode="numeric" />}
                        {resetSent && <LightField icon={LockKeyhole} value={newPassword} onChange={(value) => { setNewPassword(value); setError(''); }} placeholder="New password" type="password" />}
                        <button disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>
                            {loading ? <Spinner /> : resetSent ? <>Reset Password <ArrowRight size={20} /></> : <>Send Reset Code <ArrowRight size={20} /></>}
                        </button>
                        {resetSent && <button type="button" onClick={handleSendReset} className="w-full py-2 text-xs font-bold text-text-muted">Send a new code</button>}
                    </form>
                )}

                {mode === 'signup' && (
                    <>
                        <div className="mb-4 rounded-2xl p-3" style={{ background: 'rgba(155,44,94,0.04)', border: '1px solid rgba(155,44,94,0.1)' }}>
                            <div className="flex items-center justify-between text-[11px] font-black text-text-muted">
                                <span>Step {step} of 6</span>
                                <span>{Math.round((step / 6) * 100)}%</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(155,44,94,0.08)' }}>
                                <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${Math.min(100, (step / 6) * 100)}%` }} />
                            </div>
                        </div>
                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.form key="create1" onSubmit={handleCreateEmail} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <LightField icon={Mail} value={email} onChange={(value) => { setEmail(value); setError(''); }} placeholder="Your real email address" type="email" autoFocus />
                                    <LightField icon={LockKeyhole} value={password} onChange={(value) => { setPassword(value); setError(''); }} placeholder="Create password (6+ chars)" type="password" />
                                    <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>Continue <ArrowRight size={20} /></button>
                                </motion.form>
                            ) : step === 2 ? (
                                <motion.form key="create2" onSubmit={goToNextSignupStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhoto} />
                                    <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition-all active:scale-[0.98]" style={{ background: 'var(--color-surface)', border: profilePhoto ? '2px solid rgba(155,44,94,0.4)' : '2px dashed rgba(155,44,94,0.2)' }}>
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: 'rgba(155,44,94,0.08)' }}>
                                            {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : <Camera size={30} className="text-primary" />}
                                        </div>
                                        <div>
                                            <p className="font-black text-text-primary">{profilePhoto ? 'Photo added ✓' : 'Add a real profile photo'}</p>
                                            <p className="text-xs text-text-muted mt-1">Clear face photos help real members trust your account.</p>
                                        </div>
                                    </button>
                                    <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>Continue <ArrowRight size={20} /></button>
                                    <button type="button" onClick={() => setStep(1)} className="w-full py-3 text-sm font-medium text-text-muted">← Back</button>
                                </motion.form>
                            ) : step === 3 ? (
                                <motion.form key="create3" onSubmit={handleProfileSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <LightField icon={User} value={displayName} onChange={(value) => { setDisplayName(value); setError(''); }} placeholder="Real first name or public name" autoFocus />
                                    <LightField icon={AtSign} value={username} onChange={(value) => { setUsernameTouched(true); setUsername(makeUsername(value)); setError(''); }} placeholder="Username" />
                                    <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>Continue <ArrowRight size={20} /></button>
                                    <button type="button" onClick={() => setStep(2)} className="w-full py-3 text-sm font-medium text-text-muted">← Back</button>
                                </motion.form>
                            ) : step === 4 ? (
                                <motion.form key="create4" onSubmit={handleProfileSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <LightField icon={Calendar} value={age} onChange={(value) => { setAge(value.replace(/\D/g, '').slice(0, 2)); setError(''); }} placeholder="Age (18+)" inputMode="numeric" autoFocus />
                                    <LightField icon={Phone} value={phone} onChange={(value) => { setPhone(cleanPhone(value)); setError(''); }} placeholder="Phone number" type="tel" />
                                    <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>Continue <ArrowRight size={20} /></button>
                                    <button type="button" onClick={() => setStep(3)} className="w-full py-3 text-sm font-medium text-text-muted">← Back</button>
                                </motion.form>
                            ) : step === 5 ? (
                                <motion.form key="create5" onSubmit={handleProfileSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <LightField icon={MapPin} value={location} onChange={(value) => { setLocation(value); setError(''); }} placeholder="City or area" autoFocus />
                                    <button type="button" onClick={() => detectSignupLocation()} disabled={geoBusy} className="w-full rounded-2xl px-4 py-3 text-sm font-black text-primary bg-primary/10 flex items-center justify-center gap-2 disabled:opacity-60">
                                        <MapPin size={16} /> {geoBusy ? 'Detecting location...' : detectedGeo ? 'Update detected location' : 'Detect my real location'}
                                    </button>
                                    <LightTextAreaField icon={FileText} value={bio} onChange={(value) => { setBio(value.slice(0, 240)); setError(''); }} placeholder="Short bio: who you are and what you want" />
                                    <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>Continue <ArrowRight size={20} /></button>
                                    <button type="button" onClick={() => setStep(4)} className="w-full py-3 text-sm font-medium text-text-muted">← Back</button>
                                </motion.form>
                            ) : (
                                <motion.div key="create6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3.5">
                                    <p className="text-sm font-bold text-text-muted text-center">Choose what describes you</p>
                                    <div className="space-y-2.5">
                                        {PREFERENCES.map((pref) => {
                                            const Icon = pref.icon;
                                            const selected = selectedPreference === pref.value;
                                            return (
                                                <button type="button" key={pref.value} onClick={() => setSelectedPreference(pref.value)} className="w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-[0.98]" style={{ background: selected ? `${pref.color}10` : 'var(--color-surface)', border: `2px solid ${selected ? pref.color : 'rgba(155,44,94,0.08)'}` }}>
                                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pref.color}15` }}><Icon size={22} style={{ color: pref.color }} /></div>
                                                    <div className="flex-1 text-left"><p className="font-bold text-text-primary text-sm">{pref.label}</p><p className="text-xs text-text-muted">{pref.desc}</p></div>
                                                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: selected ? pref.color : 'rgba(155,44,94,0.2)', background: selected ? pref.color : 'transparent' }}>{selected && <Check size={12} className="text-white" />}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <label className="flex items-start gap-3 py-2 cursor-pointer">
                                        <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-[#9B2C5E]" />
                                        <span className="text-xs text-text-muted leading-relaxed">I am 18+ and agree to the <Link href="/terms" className="text-primary underline">Terms</Link>, <Link href="/privacy" className="text-primary underline">Privacy</Link>, <Link href="/safety" className="text-primary underline">Safety</Link>, and <Link href="/community-guidelines" className="text-primary underline">Community Rules</Link></span>
                                    </label>
                                    <button type="button" onClick={handleCreateAccount} disabled={loading || !agreedTerms} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition-all active:scale-[0.98]" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(155,44,94,0.35)' }}>{loading ? <Spinner /> : <>Create Account <ArrowRight size={20} /></>}</button>
                                    <button type="button" onClick={() => setStep(5)} className="w-full py-3 text-sm font-medium text-text-muted">← Back</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                <div className="mt-8 space-y-3 text-center">
                    <div className="flex justify-center gap-2 text-[10px] font-black">
                        <span className="rounded-full px-3 py-1.5 bg-success/10 text-success">18+ only</span>
                        <span className="rounded-full px-3 py-1.5 bg-primary/10 text-primary">Manual verification</span>
                        <span className="rounded-full px-3 py-1.5 bg-danger/10 text-danger">Report abuse</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-text-muted">
                        By logging in or creating an account, you agree to our terms and safety rules. Verification badges are manually approved by admin.
                    </p>
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-bold">
                        {LEGAL_LINKS.map((item) => (
                            <Link key={item.href} href={item.href} className="text-primary hover:underline">
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function LightField({ icon: Icon, value, onChange, placeholder, type = 'text', autoFocus = false, inputMode, autoComplete }) {
    const fallbackAutoComplete = type === 'password'
        ? (placeholder.toLowerCase().includes('create') || placeholder.toLowerCase().includes('new') ? 'new-password' : 'current-password')
        : type === 'email' ? 'email' : 'off';
    return <div className="relative"><Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" /><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} inputMode={inputMode} autoComplete={autoComplete || fallbackAutoComplete} className="w-full rounded-2xl py-4 pl-12 pr-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 text-base font-medium shadow-card" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }} /></div>;
}

function LightTextAreaField({ icon: Icon, value, onChange, placeholder }) {
    return (
        <div className="relative">
            <Icon size={18} className="absolute left-4 top-5 text-text-muted" />
            <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="w-full rounded-2xl py-4 pl-12 pr-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 text-base font-medium shadow-card resize-none" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }} />
        </div>
    );
}

function Spinner() {
    return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
