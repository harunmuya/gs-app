'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Camera, Navigation, ChevronRight, LogOut, Trash2,
    Bookmark, Settings, Shield, HelpCircle, Phone, Eye, EyeOff,
    Bell, MapPin, Lock, Mail, X, Plus, ArrowLeft, Globe, Heart, Sun, Moon
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import UserAvatar from '@/components/UserAvatar';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const INTERESTS = [
    'Traveling', 'Cooking', 'Music', 'Movies', 'Sports', 'Art', 'Gaming',
    'Reading', 'Photography', 'Dancing', 'Fitness', 'Fashion', 'Tech',
    'Animals', 'Nature', 'Coffee', 'Wine', 'Foodie', 'Adventure', 'Spa'
];

export default function ProfilePage() {
    const {
        user, guest, profile, likes, matches, saved, settings,
        signOut, updateProfile, updateSettings, addPhoto, removePhoto, deleteAccount
    } = useAuth();
    const { location, requestLocation, loading: geoLoading } = useGeolocation();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [activeSection, setActiveSection] = useState(null); // null | 'edit' | 'photos' | 'saved' | 'settings' | 'privacy' | 'help' | 'contact'
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Edit fields
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [interests, setInterests] = useState([]);
    const [age, setAge] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setBio(profile.bio || '');
            setInterests(profile.interests || []);
            setAge(profile.age || '');
        }
    }, [profile]);

    // Guest view
    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <User size={40} className="text-text-muted" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Guest Mode</h2>
                <p className="text-text-secondary">Sign in to create your profile and save matches.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 text-center block">
                    Sign In / Create Account
                </Link>
            </div>
        );
    }

    const handleSaveProfile = () => {
        setSaving(true);
        updateProfile({ display_name: displayName, bio, interests, age });
        setTimeout(() => { setSaving(false); setActiveSection(null); }, 300);
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => addPhoto(ev.target.result);
        reader.readAsDataURL(file);
    };

    const toggleInterest = (interest) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else if (interests.length < 6) {
            setInterests([...interests, interest]);
        }
    };

    // Section Header
    const SectionHeader = ({ title, onBack }) => (
        <div className="flex items-center gap-3 mb-5">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
                <ArrowLeft size={18} className="text-text-secondary" />
            </button>
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        </div>
    );

    // ---- EDIT PROFILE ----
    if (activeSection === 'edit') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Edit Profile" onBack={() => setActiveSection(null)} />
                <div className="space-y-5">
                    <div>
                        <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-bg-input rounded-xl py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Your Name" />
                    </div>
                    <div>
                        <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Age</label>
                        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} min="18" max="99"
                            className="w-full bg-bg-input rounded-xl py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Your age" />
                    </div>
                    <div>
                        <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300}
                            className="w-full bg-bg-input rounded-xl py-3 px-4 text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Tell us about yourself..." />
                        <p className="text-[10px] text-text-muted text-right mt-1">{bio.length}/300</p>
                    </div>
                    <div>
                        <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">Interests (Max 6)</label>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS.map(i => (
                                <button key={i} onClick={() => toggleInterest(i)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${interests.includes(i) ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-white/10 text-text-secondary hover:border-white/20'}`}>
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving}
                        className="w-full py-3.5 rounded-2xl font-bold text-white gradient-primary disabled:opacity-50 shadow-lg shadow-primary/20">
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        );
    }

    // ---- PHOTOS ----
    if (activeSection === 'photos') {
        const photos = profile?.photos || [];
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="My Photos" onBack={() => setActiveSection(null)} />
                <p className="text-xs text-text-muted mb-4">Add up to 6 photos. First photo is your profile picture.</p>
                <div className="grid grid-cols-3 gap-2.5">
                    {photos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-surface group">
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => removePhoto(idx)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12} className="text-white" />
                            </button>
                            {idx === 0 && <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-primary px-1.5 py-0.5 rounded-full text-white font-bold">Profile</span>}
                        </div>
                    ))}
                    {photos.length < 6 && (
                        <button onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1.5 text-text-muted hover:border-primary/40 hover:text-primary transition-colors">
                            <Plus size={24} />
                            <span className="text-[10px] font-medium">Add</span>
                        </button>
                    )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>
        );
    }

    // ---- SAVED PROFILES ----
    if (activeSection === 'saved') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Saved Profiles" onBack={() => setActiveSection(null)} />
                {saved.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                        <Bookmark size={40} className="text-text-muted mx-auto" />
                        <p className="text-text-secondary text-sm">No saved profiles yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {saved.map(s => (
                            <Link key={s.wpId} href={`/discover/${s.wpId}`} className="flex items-center gap-3 p-3 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors">
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface shrink-0">
                                    {s.imageUrl ? <img src={s.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-text-muted" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-white truncate">{s.name}</h3>
                                    <p className="text-xs text-text-muted">{s.location || 'Kenya'}</p>
                                </div>
                                <ChevronRight size={16} className="text-text-muted shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ---- ACCOUNT SETTINGS ----
    if (activeSection === 'settings') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Account Settings" onBack={() => setActiveSection(null)} />
                <div className="space-y-3">
                    <ToggleItem icon={Globe} label="Public Profile" desc="Others can see your profile" value={settings.isPublic} onChange={(v) => updateSettings({ isPublic: v })} />
                    <ToggleItem icon={MapPin} label="Share Location" desc="Show your city to matches" value={settings.locationEnabled} onChange={(v) => { updateSettings({ locationEnabled: v }); if (v) requestLocation(); }} />
                    <ToggleItem icon={Bell} label="Notifications" desc="Get notified about matches" value={settings.notifications} onChange={(v) => updateSettings({ notifications: v })} />
                    <ToggleItem icon={Eye} label="Show Online Status" desc="Let others know you're active" value={settings.showOnline} onChange={(v) => updateSettings({ showOnline: v })} />
                    <ToggleItem icon={Mail} label="Email Notifications" desc="Receive email updates" value={settings.emailNotifications} onChange={(v) => updateSettings({ emailNotifications: v })} />
                </div>
            </div>
        );
    }

    // ---- PRIVACY & SECURITY ----
    if (activeSection === 'privacy') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Privacy & Security" onBack={() => setActiveSection(null)} />
                <div className="space-y-4">
                    <div className="bg-bg-card rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2"><Shield size={16} className="text-primary" /> Data Privacy</h3>
                        <p className="text-xs text-text-secondary leading-relaxed">Your data is stored locally on your device. We do not share your personal information with third parties.</p>
                    </div>
                    <div className="bg-bg-card rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Lock size={16} className="text-gold" /> Account Security</h3>
                        <p className="text-xs text-text-secondary leading-relaxed">Your account is secured with your email. Keep your email address private and don&apos;t share it with strangers.</p>
                    </div>
                    <div className="bg-bg-card rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><EyeOff size={16} className="text-accent" /> Profile Visibility</h3>
                        <p className="text-xs text-text-secondary leading-relaxed">Toggle your profile to private in Account Settings to hide from other users. Only matched users can see private profiles.</p>
                    </div>
                    <ToggleItem icon={Lock} label="Private Account" desc="Only matches can see your info" value={!settings.isPublic} onChange={(v) => updateSettings({ isPublic: !v })} />
                </div>
            </div>
        );
    }

    // ---- HELP ----
    if (activeSection === 'help') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Help" onBack={() => setActiveSection(null)} />
                <div className="space-y-3">
                    {[
                        { q: 'How do I find matches?', a: 'Swipe right on profiles you like. If the algorithm detects compatibility, you\'ll get a match!' },
                        { q: 'How do I contact a sugar mummy?', a: 'Open a profile and use the contact buttons (Telegram, SMS, Phone) at the bottom of the profile page.' },
                        { q: 'Are the profiles real?', a: 'All profiles come from our verified WordPress database. Look for the verified badge.' },
                        { q: 'How do I send a message?', a: 'Go to a profile or your Matches tab and tap "Send Message". Your message will be sent for moderation.' },
                        { q: 'How do I save a profile?', a: 'Tap the bookmark icon when viewing a profile. Saved profiles appear in your Account tab.' },
                        { q: 'Is my data safe?', a: 'Yes! Your data is stored locally on your device. We don\'t store passwords or sensitive data on servers.' },
                    ].map((faq, i) => (
                        <details key={i} className="bg-bg-card rounded-2xl border border-black/10 dark:border-white/10 group">
                            <summary className="p-4 text-sm font-semibold text-white cursor-pointer list-none flex items-center justify-between">
                                {faq.q}
                                <ChevronRight size={16} className="text-text-muted transition-transform group-open:rotate-90 shrink-0" />
                            </summary>
                            <p className="px-4 pb-4 text-xs text-text-secondary leading-relaxed">{faq.a}</p>
                        </details>
                    ))}
                </div>
            </div>
        );
    }

    // ---- CONTACT US ----
    if (activeSection === 'contact') {
        return (
            <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
                <SectionHeader title="Contact Us" onBack={() => setActiveSection(null)} />
                <div className="space-y-4">
                    <div className="bg-bg-card rounded-2xl p-5 border border-black/10 dark:border-white/10 text-center space-y-3">
                        <Logo size={50} />
                        <h3 className="text-lg font-bold text-white">Genuine Sugar Mummies</h3>
                        <p className="text-sm text-text-secondary">Kenya&apos;s #1 dating app for real connections</p>
                    </div>
                    <a href="tel:+254738871048" className="flex items-center gap-3 p-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center"><Phone size={18} className="text-success" /></div>
                        <div><p className="text-sm font-semibold text-white">Call Us</p><p className="text-xs text-text-muted">+254 738 871 048</p></div>
                    </a>
                    <a href="sms:+254738871048" className="flex items-center gap-3 p-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"><Mail size={18} className="text-blue-400" /></div>
                        <div><p className="text-sm font-semibold text-white">SMS</p><p className="text-xs text-text-muted">+254 738 871 048</p></div>
                    </a>
                    <a href="https://t.me/+254738871048" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors">
                        <div className="w-10 h-10 rounded-full bg-[#26A5E4]/20 flex items-center justify-center"><span className="text-lg">✈</span></div>
                        <div><p className="text-sm font-semibold text-white">Telegram</p><p className="text-xs text-text-muted">@MaryG Admin</p></div>
                    </a>
                </div>
            </div>
        );
    }

    // ---- MAIN PROFILE VIEW ----
    return (
        <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <User size={22} className="text-primary" />
                    <h1 className="text-xl font-bold text-text-primary">Account</h1>
                </div>
                <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center hover:bg-surface-light transition-colors" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                    {theme === 'dark' ? <Sun size={18} className="text-gold" /> : <Moon size={18} className="text-text-secondary" />}
                </button>
            </div>

            {/* Profile Card */}
            <div className="bg-bg-card rounded-3xl p-5 border border-black/10 dark:border-white/10 mb-5">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center ring-2 ring-primary/30 overflow-hidden shrink-0">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <UserAvatar name={profile?.display_name || 'U'} size={80} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-text-primary truncate">{profile?.display_name || 'User'}</h2>
                        <p className="text-xs text-text-muted truncate">{profile?.email}</p>
                        {profile?.bio && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{profile.bio}</p>}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface/60 rounded-xl py-2.5 text-center border border-black/10 dark:border-white/10">
                        <p className="text-xl font-bold text-gradient">{likes?.length || 0}</p>
                        <p className="text-[10px] text-text-muted">Likes</p>
                    </div>
                    <div className="flex-1 bg-surface/60 rounded-xl py-2.5 text-center border border-black/10 dark:border-white/10">
                        <p className="text-xl font-bold text-gradient">{matches?.length || 0}</p>
                        <p className="text-[10px] text-text-muted">Matches</p>
                    </div>
                    <div className="flex-1 bg-surface/60 rounded-xl py-2.5 text-center border border-black/10 dark:border-white/10">
                        <p className="text-xl font-bold text-gradient">{saved?.length || 0}</p>
                        <p className="text-[10px] text-text-muted">Saved</p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-2 mb-6">
                <MenuItem icon={User} label="Edit Profile" desc="Name, bio, interests" onClick={() => setActiveSection('edit')} />
                <MenuItem icon={Camera} label="My Photos" desc={`${profile?.photos?.length || 0}/6 photos`} onClick={() => setActiveSection('photos')} />
                <MenuItem icon={Bookmark} label="Saved Profiles" desc={`${saved?.length || 0} saved`} onClick={() => setActiveSection('saved')} />
                <MenuItem icon={Settings} label="Account Settings" desc="Public/private, location, notifications" onClick={() => setActiveSection('settings')} />
                <MenuItem icon={Shield} label="Privacy & Security" desc="Data, visibility, security" onClick={() => setActiveSection('privacy')} />
                <MenuItem icon={HelpCircle} label="Help" desc="FAQs and troubleshooting" onClick={() => setActiveSection('help')} />
                <MenuItem icon={Phone} label="Contact Us" desc="+254 738 871 048" onClick={() => setActiveSection('contact')} />
            </div>

            {/* Location */}
            <button onClick={requestLocation} disabled={geoLoading}
                className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors mb-6">
                <div className="flex items-center gap-2">
                    <Navigation size={16} className={location ? 'text-blue-400' : 'text-text-muted'} />
                    <span className="text-sm text-text-primary">{geoLoading ? 'Locating...' : location ? `📍 Location enabled` : 'Enable Location'}</span>
                </div>
                <ChevronRight size={16} className="text-text-muted" />
            </button>

            {/* Logout/Delete */}
            <div className="space-y-2.5">
                <button onClick={signOut} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-surface border border-black/10 dark:border-white/10 text-text-secondary hover:bg-surface-light font-medium transition-colors">
                    <LogOut size={16} /> Sign Out
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-danger/70 hover:bg-danger/10 hover:text-danger font-medium transition-colors">
                    <Trash2 size={16} /> Delete Account
                </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-bg-card rounded-3xl p-6 space-y-4 border border-white/10">
                        <h3 className="text-lg font-bold text-white text-center">Delete Account?</h3>
                        <p className="text-sm text-text-secondary text-center">This permanently deletes all your data — matches, likes, photos, and settings.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl text-text-secondary bg-surface hover:bg-surface-light font-medium">Cancel</button>
                            <button onClick={() => { deleteAccount(); setShowDeleteConfirm(false); router.push('/auth/login'); }} className="flex-1 py-3 rounded-xl text-white bg-danger hover:bg-danger/80 font-bold">Delete</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* App Version */}
            <p className="text-center text-[10px] text-text-muted mt-6 pb-4">
                Genuine Sugar Mummies · v2.1.0
            </p>
        </div>
    );
}

// ---- Reusable Components ----
function MenuItem({ icon: Icon, label, desc, onClick }) {
    return (
        <button onClick={onClick} className="w-full flex items-center gap-3.5 py-3.5 px-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10 hover:bg-surface transition-colors group text-left">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Icon size={18} className="text-text-secondary group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
                <p className="text-[11px] text-text-muted truncate">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
    );
}

function ToggleItem({ icon: Icon, label, desc, value, onChange }) {
    return (
        <div className="flex items-center gap-3.5 py-3.5 px-4 rounded-2xl bg-bg-card border border-black/10 dark:border-white/10">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shrink-0">
                <Icon size={18} className="text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
                <p className="text-[11px] text-text-muted">{desc}</p>
            </div>
            <button onClick={() => onChange(!value)}
                className={`w-12 h-7 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${value ? 'bg-primary' : 'bg-surface-light'}`}>
                <motion.div animate={{ x: value ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-6 h-6 rounded-full bg-white shadow-md" />
            </button>
        </div>
    );
}
