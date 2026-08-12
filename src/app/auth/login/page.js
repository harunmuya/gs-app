'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    Mail, User, Heart, Gem, Users, LockKeyhole, KeyRound, ShieldCheck,
    Camera, AtSign, Calendar, MapPin, Phone, FileText, Check, Loader2, X,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { labelFromCoordinates } from '@/lib/geo';
import { SUPPORT } from '@/lib/support';
import { AGE_RANGE } from '@/lib/copy';

/**
 * Authentication — one page, three modes.
 *
 * This replaces a seven-step signup wizard that spread account creation across
 * numbered screens with a progress bar. Wizards suit long, branching, or
 * unfamiliar processes; they are the wrong shape for six fields a person can
 * see at once, and every extra step is somewhere to abandon. Everything now
 * lives on one scrollable page:
 *
 *   signin  — email + password, with reset reachable inline
 *   signup  — one form, grouped Account / Profile / Looking for
 *   reset   — request a code, then set a new password, without leaving the page
 *
 * Field requirements mirror the server exactly (see accountCompletionError in
 * api/members/route.js): real name, age 18-80, city, phone of 7+ digits, and a
 * bio of at least 12 characters. Validating the same rules client-side means a
 * member is told what is wrong before a round trip, never after.
 */

const PREFERENCES = [
    { value: 'sugar_mummy_looking_for_toyboy', label: 'Sugar Mummy', desc: 'Looking for a sugar guy / toyboy', icon: Heart },
    { value: 'sugar_daddy_looking_for_mistress', label: 'Sugar Daddy', desc: 'Looking for an adult mistress', icon: Gem },
    { value: 'mistress_looking_for_sugar_daddy', label: 'Mistress', desc: 'Looking for a sugar daddy', icon: Users },
    { value: 'toyboy_looking_for_sugar_mummy', label: 'Sugar Guy / Toyboy', desc: 'Looking for a sugar mummy', icon: Heart },
];

const LEGAL_LINKS = [
    { href: '/terms', label: 'Terms' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/safety', label: 'Safety' },
    { href: '/community-guidelines', label: 'Rules' },
    { href: '/contact', label: 'Contact' },
];

function hardRedirect(path) {
    if (typeof window !== 'undefined') window.location.assign(path);
}

function makeUsername(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
}

function cleanPhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').slice(0, 20);
}

function cleanResetCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/* ------------------------------------------------------------------ */
/* Field primitives                                                     */
/* ------------------------------------------------------------------ */

function Field({ icon: Icon, label, hint, error, children, htmlFor }) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={htmlFor} className="flex items-center gap-1.5 type-caption font-semibold text-text-secondary">
                {Icon && <Icon size={13} className="text-text-muted" />}
                {label}
            </label>
            {children}
            {error
                ? <p className="type-caption text-danger" role="alert">{error}</p>
                : hint ? <p className="type-caption text-text-muted">{hint}</p> : null}
        </div>
    );
}

const inputClass =
    'w-full rounded-xl px-3.5 py-3 type-body text-text-primary placeholder:text-text-muted '
    + 'transition-colors focus:outline-none';

function inputStyle(invalid) {
    return {
        background: 'var(--color-bg-input)',
        border: `1px solid ${invalid ? 'var(--color-danger)' : 'rgba(20,16,26,0.10)'}`,
    };
}

function SubmitButton({ loading, children }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 type-body-strong text-white gradient-primary disabled:opacity-60"
        >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------ */

export default function LoginPage() {
    const { user, signIn, signInExisting, requestPasswordReset, resetPassword } = useAuth();
    const photoInputRef = useRef(null);

    const [mode, setMode] = useState('signin');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameTouched, setUsernameTouched] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [wants, setWants] = useState('');
    const [preference, setPreference] = useState('sugar_mummy_looking_for_toyboy');
    const [agreedTerms, setAgreedTerms] = useState(false);

    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetSent, setResetSent] = useState(false);

    const [detectedGeo, setDetectedGeo] = useState(null);
    const [geoBusy, setGeoBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('gscom_login_email') || 'null');
            if (saved) setEmail(saved);
            const params = new URLSearchParams(window.location.search);
            if (params.get('signed_out') === '1') setNotice('You have been signed out.');
            if (params.get('deleted') === '1') setNotice('Your account has been deleted.');
        } catch { /* storage unavailable */ }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('signed_out') === '1') return;
        if (user) hardRedirect('/discover');
    }, [user]);

    useEffect(() => {
        if (usernameTouched) return;
        setUsername(makeUsername(displayName));
    }, [displayName, usernameTouched]);

    function switchMode(next) {
        setMode(next);
        setError('');
        setNotice('');
        setFieldErrors({});
        setResetSent(false);
    }

    /* -------------------------------------------------------------- */
    /* Validation — mirrors accountCompletionError on the server        */
    /* -------------------------------------------------------------- */

    function validateSignup() {
        const errors = {};
        if (!validEmail(email)) errors.email = 'Enter a valid email address.';
        if (String(password).length < 6) errors.password = 'At least 6 characters.';
        if (displayName.trim().length < 2) errors.displayName = 'Enter your real profile name.';

        const ageNumber = Number(age);
        if (!Number.isInteger(ageNumber) || ageNumber < 18 || ageNumber > 80) {
            errors.age = AGE_RANGE;
        }
        if (location.trim().length < 2) errors.location = 'Enter your city or area.';
        if (cleanPhone(phone).replace(/\D/g, '').length < 7) errors.phone = 'Enter a reachable phone number.';
        if (bio.trim().length < 12) errors.bio = `A short bio is required (${bio.trim().length}/12 characters).`;
        if (!agreedTerms) errors.terms = 'You must accept the terms to continue.';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }

    /* -------------------------------------------------------------- */
    /* Handlers                                                         */
    /* -------------------------------------------------------------- */

    async function handleSignIn(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        const errors = {};
        if (!validEmail(email)) errors.email = 'Enter a valid email address.';
        if (String(password).length < 6) errors.password = 'Enter your password.';
        setFieldErrors(errors);
        if (Object.keys(errors).length) return;

        setLoading(true);
        try {
            await signInExisting(email.trim(), password);
            try { localStorage.setItem('gscom_login_email', JSON.stringify(email.trim())); } catch { /* ignore */ }
            hardRedirect('/discover');
        } catch (err) {
            setError(err.message || 'Could not sign in.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSignUp(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        if (!validateSignup()) {
            setError('Please correct the highlighted fields.');
            return;
        }

        setLoading(true);
        try {
            const extras = {
                username: username.trim() || makeUsername(displayName),
                age: age.trim(),
                location: location.trim(),
                city: location.trim(),
                phone: cleanPhone(phone),
                phone_number: cleanPhone(phone),
                bio: bio.trim(),
                latitude: detectedGeo?.latitude,
                longitude: detectedGeo?.longitude,
                geo_updated_at: detectedGeo?.geo_updated_at,
            };
            if (wants.trim()) extras.wants = wants.trim();
            if (profilePhoto) {
                extras.avatar_url = profilePhoto;
                extras.photos = [profilePhoto];
            }
            await Promise.resolve(signIn(email.trim(), password, displayName.trim(), preference, extras));
            try { localStorage.setItem('gscom_login_email', JSON.stringify(email.trim())); } catch { /* ignore */ }
            hardRedirect('/packages?welcome=1&tier=basic');
        } catch (err) {
            setError(err.message || 'Could not create your account.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSendReset(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        if (!validEmail(email)) {
            setFieldErrors({ email: 'Enter the email on your account.' });
            return;
        }
        setFieldErrors({});
        setLoading(true);
        try {
            await requestPasswordReset(email.trim());
            setResetSent(true);
            setNotice('We sent a 6-digit code to your email.');
        } catch (err) {
            setError(err.message || 'Could not send the reset code.');
        } finally {
            setLoading(false);
        }
    }

    async function handleResetPassword(event) {
        event.preventDefault();
        setError('');
        setNotice('');
        const code = cleanResetCode(resetCode);
        setResetCode(code);
        const errors = {};
        if (!/^\d{6}$/.test(code)) errors.resetCode = 'Enter the 6-digit code.';
        if (String(newPassword).length < 6) errors.newPassword = 'At least 6 characters.';
        setFieldErrors(errors);
        if (Object.keys(errors).length) return;

        setLoading(true);
        try {
            await resetPassword(email.trim(), code, newPassword);
            hardRedirect('/discover');
        } catch (err) {
            setError(err.message || 'Could not reset your password.');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Detect the member's city or area and fill the field.
     *
     * Two things were wrong before. `enableHighAccuracy: false` asks the device for
     * a coarse network fix, which in practice can land kilometres away — for a
     * feature whose whole purpose is naming your area, that is the wrong trade.
     * And the coordinates were resolved against a 31-entry offline table, so
     * anyone outside a listed town got a place name that was simply incorrect.
     *
     * Now: a high-accuracy fix, then a real reverse geocode on the server, with the
     * offline table only as a last resort. If nothing resolves, the field is left
     * for the member to type rather than filled with a guess.
     */
    async function detectLocation() {
        if (!navigator.geolocation) {
            setError('Location is not available on this device. Type your city instead.');
            return;
        }
        if (geoBusy) return;

        setGeoBusy(true);
        setError('');
        setNotice('Finding your location…');

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0, // never reuse a stale fix for this
                });
            });

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            setDetectedGeo({
                latitude,
                longitude,
                accuracy,
                geo_updated_at: new Date().toISOString(),
            });

            const res = await fetch(
                `/api/location?action=reverse&lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`
            );
            const data = await res.json().catch(() => ({}));
            const label = data?.label || labelFromCoordinates(latitude, longitude);

            if (label) {
                setLocation(label);
                setFieldErrors((current) => ({ ...current, location: undefined }));
                setNotice(
                    accuracy && accuracy > 2000
                        ? `Set to ${label}. Your device gave a rough fix — edit it if that is not right.`
                        : `Location set to ${label}.`
                );
            } else {
                setNotice('');
                setError('We could not name your area. Please type your city.');
            }
        } catch (err) {
            const denied = err && err.code === 1;
            setNotice('');
            setError(denied
                ? 'Location permission was blocked. Type your city instead.'
                : 'Could not read your location. Type your city instead.');
        } finally {
            setGeoBusy(false);
        }
    }

    function handlePhoto(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Choose an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onload = () => {
                if (img.width < 180 || img.height < 180) {
                    setError('Use a clear photo at least 180 x 180 pixels.');
                    return;
                }
                const max = 720;
                let { width, height } = img;
                if (width > max || height > max) {
                    if (width > height) { height = Math.round(height * max / width); width = max; }
                    else { width = Math.round(width * max / height); height = max; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                setProfilePhoto(canvas.toDataURL('image/webp', 0.82));
                setError('');
            };
            img.onerror = () => setError('Could not read that image.');
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    /* -------------------------------------------------------------- */

    const isSignIn = mode === 'signin';
    const isSignUp = mode === 'signup';
    const isReset = mode === 'reset';

    return (
        <main className="min-h-dvh px-4 py-8" style={{ background: 'var(--app-bg)' }}>
            <div className="mx-auto w-full max-w-md space-y-5">

                <header className="space-y-3 text-center">
                    <div className="flex justify-center"><Logo size={54} /></div>
                    <h1 className="type-title text-text-primary">
                        {isSignIn ? 'Welcome back' : isSignUp ? 'Create your account' : 'Reset your password'}
                    </h1>
                    <p className="type-body text-text-secondary">
                        {isSignIn && 'Sign in to continue to your matches.'}
                        {isSignUp && 'A verified community for adults over 18.'}
                        {isReset && 'We will email you a 6-digit code.'}
                    </p>
                </header>

                {/* Two modes only. Reset is reached from a link inside sign-in,
                    not promoted to a peer tab — it is a recovery path, not a
                    destination, and a third tab implies otherwise. */}
                {!isReset && (
                    <div
                        role="tablist"
                        aria-label="Account access"
                        className="grid grid-cols-2 gap-1 rounded-xl p-1"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        {[['signin', 'Sign in'], ['signup', 'Create account']].map(([value, label]) => (
                            <button
                                key={value}
                                role="tab"
                                type="button"
                                aria-selected={mode === value}
                                onClick={() => switchMode(value)}
                                className={`min-h-[44px] rounded-lg px-3 type-body-strong transition-colors ${
                                    mode === value ? 'text-white gradient-primary' : 'text-text-secondary'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {(error || notice) && (
                    <div
                        role="status"
                        className="flex items-start gap-2 rounded-xl px-3.5 py-3 type-caption"
                        style={{
                            background: error ? 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)' : 'color-mix(in srgb, var(--color-success-text) 10%, transparent)',
                            color: error ? 'var(--color-danger)' : 'var(--color-success)',
                        }}
                    >
                        {error ? <X size={14} className="mt-0.5 shrink-0" /> : <Check size={14} className="mt-0.5 shrink-0" />}
                        <span>{error || notice}</span>
                    </div>
                )}

                <div className="rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--elevation-2)' }}>

                    {/* ---------------- Sign in ---------------- */}
                    {isSignIn && (
                        <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                            <Field icon={Mail} label="Email" htmlFor="email" error={fieldErrors.email}>
                                <input
                                    id="email" type="email" autoComplete="email" inputMode="email"
                                    value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className={inputClass} style={inputStyle(fieldErrors.email)}
                                />
                            </Field>

                            <Field icon={LockKeyhole} label="Password" htmlFor="password" error={fieldErrors.password}>
                                <input
                                    id="password" type="password" autoComplete="current-password"
                                    value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Your password"
                                    className={inputClass} style={inputStyle(fieldErrors.password)}
                                />
                            </Field>

                            <SubmitButton loading={loading}>Sign in</SubmitButton>

                            <button
                                type="button"
                                onClick={() => switchMode('reset')}
                                className="min-h-[44px] w-full type-caption font-semibold text-primary"
                            >
                                Forgot your password?
                            </button>
                        </form>
                    )}

                    {/* ---------------- Reset (same page) ---------------- */}
                    {isReset && (
                        <div className="space-y-5">
                            <form onSubmit={handleSendReset} className="space-y-4" noValidate>
                                <Field icon={Mail} label="Account email" htmlFor="reset-email" error={fieldErrors.email}>
                                    <input
                                        id="reset-email" type="email" autoComplete="email" inputMode="email"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className={inputClass} style={inputStyle(fieldErrors.email)}
                                    />
                                </Field>
                                <SubmitButton loading={loading && !resetSent}>
                                    {resetSent ? 'Resend code' : 'Send reset code'}
                                </SubmitButton>
                            </form>

                            {/* Step two appears in place once the code is sent. */}
                            {resetSent && (
                                <form onSubmit={handleResetPassword} className="space-y-4 border-t pt-5" style={{ borderColor: 'rgba(20,16,26,0.08)' }} noValidate>
                                    <Field icon={KeyRound} label="6-digit code" htmlFor="reset-code" error={fieldErrors.resetCode}>
                                        <input
                                            id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                                            value={resetCode} onChange={(e) => setResetCode(cleanResetCode(e.target.value))}
                                            placeholder="123456"
                                            className={`${inputClass} tracking-[0.4em]`} style={inputStyle(fieldErrors.resetCode)}
                                        />
                                    </Field>
                                    <Field icon={LockKeyhole} label="New password" htmlFor="new-password" error={fieldErrors.newPassword} hint="At least 6 characters.">
                                        <input
                                            id="new-password" type="password" autoComplete="new-password"
                                            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                            className={inputClass} style={inputStyle(fieldErrors.newPassword)}
                                        />
                                    </Field>
                                    <SubmitButton loading={loading}>Set new password</SubmitButton>
                                </form>
                            )}

                            <button
                                type="button"
                                onClick={() => switchMode('signin')}
                                className="min-h-[44px] w-full type-caption font-semibold text-primary"
                            >
                                Back to sign in
                            </button>
                        </div>
                    )}

                    {/* ---------------- Create account ---------------- */}
                    {isSignUp && (
                        <form onSubmit={handleSignUp} className="space-y-6" noValidate>

                            <section className="space-y-4">
                                <h2 className="type-micro text-text-muted">Account</h2>

                                <Field icon={Mail} label="Email" htmlFor="su-email" error={fieldErrors.email} hint="Reset codes and account notices go here.">
                                    <input
                                        id="su-email" type="email" autoComplete="email" inputMode="email"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className={inputClass} style={inputStyle(fieldErrors.email)}
                                    />
                                </Field>

                                <Field icon={LockKeyhole} label="Password" htmlFor="su-password" error={fieldErrors.password} hint="At least 6 characters.">
                                    <input
                                        id="su-password" type="password" autoComplete="new-password"
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                        className={inputClass} style={inputStyle(fieldErrors.password)}
                                    />
                                </Field>
                            </section>

                            <section className="space-y-4 border-t pt-5" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                                <h2 className="type-micro text-text-muted">Your profile</h2>

                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full"
                                        style={{ background: 'var(--color-surface)' }}
                                    >
                                        {profilePhoto
                                            ? <img src={profilePhoto} alt="Your profile photo" className="h-full w-full object-cover"  loading="lazy" decoding="async" />
                                            : <Camera size={20} className="text-text-muted" />}
                                    </div>
                                    <div className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => photoInputRef.current?.click()}
                                            className="min-h-[44px] rounded-xl px-4 type-caption font-semibold text-primary"
                                            style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                                        >
                                            {profilePhoto ? 'Change photo' : 'Add a photo'}
                                        </button>
                                        <p className="mt-1 type-caption text-text-muted">Optional, but profiles with a photo get far more replies.</p>
                                    </div>
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                                </div>

                                <Field icon={User} label="Profile name" htmlFor="su-name" error={fieldErrors.displayName}>
                                    <input
                                        id="su-name" autoComplete="name"
                                        value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="e.g. Grace W."
                                        className={inputClass} style={inputStyle(fieldErrors.displayName)}
                                    />
                                </Field>

                                <Field icon={AtSign} label="Username" htmlFor="su-username" hint="Auto-filled from your name. You can change it.">
                                    <input
                                        id="su-username"
                                        value={username}
                                        onChange={(e) => { setUsernameTouched(true); setUsername(makeUsername(e.target.value)); }}
                                        className={inputClass} style={inputStyle(false)}
                                    />
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field icon={Calendar} label="Age" htmlFor="su-age" error={fieldErrors.age}>
                                        <input
                                            id="su-age" inputMode="numeric" maxLength={2}
                                            value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                            placeholder="18+"
                                            className={inputClass} style={inputStyle(fieldErrors.age)}
                                        />
                                    </Field>
                                    <Field icon={Phone} label="Phone" htmlFor="su-phone" error={fieldErrors.phone}>
                                        <input
                                            id="su-phone" type="tel" autoComplete="tel" inputMode="tel"
                                            value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))}
                                            placeholder="07xx xxx xxx"
                                            className={inputClass} style={inputStyle(fieldErrors.phone)}
                                        />
                                    </Field>
                                </div>

                                <Field icon={MapPin} label="City or area" htmlFor="su-location" error={fieldErrors.location}>
                                    <div className="flex gap-2">
                                        <input
                                            id="su-location" autoComplete="address-level2"
                                            value={location} onChange={(e) => setLocation(e.target.value)}
                                            placeholder="e.g. Westlands, Nairobi"
                                            className={inputClass} style={inputStyle(fieldErrors.location)}
                                        />
                                        <button
                                            type="button" onClick={detectLocation} disabled={geoBusy}
                                            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 type-caption font-semibold text-primary disabled:opacity-60"
                                            style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                                        >
                                            {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                            Detect
                                        </button>
                                    </div>
                                </Field>

                                <Field
                                    icon={FileText} label="Short bio" htmlFor="su-bio"
                                    error={fieldErrors.bio}
                                    hint={`${bio.trim().length}/12 characters minimum.`}
                                >
                                    <textarea
                                        id="su-bio" rows={3} maxLength={240}
                                        value={bio} onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell people who you are and what you enjoy."
                                        className={`${inputClass} resize-none`} style={inputStyle(fieldErrors.bio)}
                                    />
                                </Field>
                            </section>

                            <section className="space-y-3 border-t pt-5" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                                <h2 className="type-micro text-text-muted">I am a</h2>
                                <div role="radiogroup" aria-label="Profile type" className="grid gap-2">
                                    {PREFERENCES.map((item) => {
                                        const Icon = item.icon;
                                        const active = preference === item.value;
                                        return (
                                            <button
                                                key={item.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => setPreference(item.value)}
                                                className="flex min-h-[56px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors"
                                                style={{
                                                    background: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface)',
                                                    border: `1px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                                                }}
                                            >
                                                <Icon size={18} className={active ? 'text-primary' : 'text-text-muted'} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block type-body-strong text-text-primary">{item.label}</span>
                                                    <span className="block type-caption text-text-muted">{item.desc}</span>
                                                </span>
                                                {active && <Check size={16} className="shrink-0 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <Field icon={Heart} label="What are you looking for?" htmlFor="su-wants" hint="Optional.">
                                    <input
                                        id="su-wants"
                                        value={wants} onChange={(e) => setWants(e.target.value.slice(0, 240))}
                                        placeholder="e.g. Something genuine and discreet"
                                        className={inputClass} style={inputStyle(false)}
                                    />
                                </Field>
                            </section>

                            <div className="space-y-3 border-t pt-5" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                                <label className="flex items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={agreedTerms}
                                        onChange={(e) => setAgreedTerms(e.target.checked)}
                                        className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--color-primary)]"
                                    />
                                    <span className="type-caption text-text-secondary">
                                        I am 18 or older and I accept the{' '}
                                        <Link href="/terms" className="font-semibold text-primary">Terms</Link>{' and '}
                                        <Link href="/privacy" className="font-semibold text-primary">Privacy Policy</Link>.
                                    </span>
                                </label>
                                {fieldErrors.terms && <p className="type-caption text-danger" role="alert">{fieldErrors.terms}</p>}

                                <SubmitButton loading={loading}>Create account</SubmitButton>
                            </div>
                        </form>
                    )}
                </div>

                <div className="flex items-center justify-center gap-2 type-caption text-text-muted">
                    <ShieldCheck size={13} />
                    <span>Adults 18+ · Manually reviewed profiles</span>
                </div>

                <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {LEGAL_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className="type-caption text-text-muted hover:text-primary">
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/*
                  Support belongs on this screen more than on any other.

                  Somebody locked out of their account cannot reach the launcher
                  in the signed-in shell, and the policy pages are not where they
                  would think to look. One line, on the page where being stuck is
                  most likely.
                */}
                <p className="text-center type-caption text-text-muted">
                    Locked out or waiting on verification?{' '}
                    <a
                        href={SUPPORT.telegram.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary"
                    >
                        Message Admin Mary G on Telegram
                    </a>
                </p>
            </div>
        </main>
    );
}
