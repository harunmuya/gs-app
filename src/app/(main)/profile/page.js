'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Camera, Heart, Bookmark, Settings, ChevronRight, LogOut, Trash2, Pencil,
    Shield, HelpCircle, ChevronLeft, X, Mail, MapPin, Calendar, Star, Plus, Phone,
    MessageCircle, ShieldCheck, ShieldAlert, ImagePlus, Check, AlertCircle, Send,
    MessageSquare, Bell
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from '@/components/VerifiedBadge';
import EmailSubscribe from '@/components/EmailSubscribe';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Telegram SVG icon
function TelegramIcon({ size = 18, className = '' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    );
}

const MENU_ITEMS = [
    { key: 'profile', icon: User, label: 'My Profile' },
    { key: 'photos', icon: Camera, label: 'My Photos' },
    { key: 'verification', icon: ShieldCheck, label: 'Verify Profile' },
    { key: 'messages', icon: MessageSquare, label: 'Messages' },
    { key: 'saved', icon: Bookmark, label: 'Saved Profiles' },
    { key: 'settings', icon: Settings, label: 'Settings' },
    { key: 'contact', icon: Phone, label: 'Contact Us' },
    { key: 'help', icon: HelpCircle, label: 'Help & FAQ' },
];

export default function ProfilePage() {
    const router = useRouter();
    const { user, guest, profile, updateProfile, addPhoto, removePhoto, saved, signOut, deleteAccount, settings, updateSettings, verificationStatus, verifyProfile, clearVerification, messages, markMessagesRead } = useAuth();
    const [activeSection, setActiveSection] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({});
    const fileInputRef = useRef(null);
    const selfieInputRef = useRef(null);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center">
                    <User size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Account</h2>
                <p className="text-text-secondary">Sign in to manage your profile.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </Link>
            </div>
        );
    }

    if (!user) return null;

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => addPhoto(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSelfieUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = verifyProfile(ev.target.result);
            // verifyProfile handles state + messages
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const startEdit = () => {
        setEditMode(true);
        setEditData({
            display_name: user.display_name || '',
            bio: user.bio || '',
            interests: (user.interests || []).join(', '),
            age: user.age || '',
            orientation: user.orientation || '',
        });
    };

    const saveEdit = () => {
        updateProfile({
            display_name: editData.display_name,
            bio: editData.bio,
            interests: editData.interests.split(',').map(i => i.trim()).filter(Boolean),
            age: editData.age,
            orientation: editData.orientation,
        });
        setEditMode(false);
    };

    const unreadMessages = (messages || []).filter(m => !m.read).length;

    // ---- SECTION RENDERERS ----
    const renderSection = () => {
        switch (activeSection) {
            case 'profile': return renderProfileEdit();
            case 'photos': return renderPhotos();
            case 'verification': return renderVerification();
            case 'messages': return renderMessages();
            case 'saved': return renderSaved();
            case 'settings': return renderSettings();
            case 'contact': return renderContact();
            case 'help': return renderHelp();
            default: return null;
        }
    };

    // ---- Profile Edit ----
    const renderProfileEdit = () => (
        <div className="space-y-4">
            {editMode ? (
                <div className="space-y-3">
                    <InputField label="Display Name" value={editData.display_name} onChange={v => setEditData(p => ({ ...p, display_name: v }))} />
                    <InputField label="Bio" value={editData.bio} onChange={v => setEditData(p => ({ ...p, bio: v }))} multiline />
                    <InputField label="Interests" value={editData.interests} onChange={v => setEditData(p => ({ ...p, interests: v }))} placeholder="e.g. Travel, Dining, Music" />
                    <InputField label="Age" value={editData.age} onChange={v => setEditData(p => ({ ...p, age: v }))} />
                    <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex-1 py-3 rounded-2xl font-semibold text-white gradient-primary flex items-center justify-center gap-2">
                            <Check size={18} /> Save
                        </button>
                        <button onClick={() => setEditMode(false)} className="flex-1 py-3 rounded-2xl font-semibold text-text-secondary" style={{ background: 'var(--color-surface)' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <InfoRow icon={User} label="Name" value={user.display_name || 'Not set'} />
                        <InfoRow icon={Mail} label="Email" value={user.email || 'Not set'} />
                        <InfoRow icon={Calendar} label="Age" value={user.age || 'Not set'} />
                        <InfoRow icon={MapPin} label="Bio" value={user.bio || 'Not set'} />
                        {user.interests?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {user.interests.map((i, idx) => (
                                    <span key={idx} className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">{i}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={startEdit} className="w-full py-3 rounded-2xl font-semibold text-white gradient-primary flex items-center justify-center gap-2">
                        <Pencil size={16} /> Edit Profile
                    </button>
                </div>
            )}
        </div>
    );

    // ---- Photos ----
    const renderPhotos = () => {
        const photos = user.photos || [];
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group">
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => removePhoto(idx)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {photos.length < 6 && (
                        <button onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors"
                            style={{ background: 'var(--color-surface)', border: '2px dashed var(--color-border)' }}>
                            <Plus size={24} className="text-primary" />
                            <span className="text-[10px] text-text-muted font-medium">Add Photo</span>
                        </button>
                    )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <p className="text-xs text-text-muted text-center">Max 6 photos. First photo is your avatar.</p>
            </div>
        );
    };

    // ---- Verification ----
    const renderVerification = () => (
        <div className="space-y-4">
            <div className="rounded-2xl p-5 text-center space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                {verificationStatus === 'verified' ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                            <ShieldCheck size={32} className="text-success" />
                        </div>
                        <h3 className="text-lg font-bold text-success">Profile Verified ✓</h3>
                        <p className="text-sm text-text-secondary">Your identity has been confirmed. Other users can see your blue verification badge.</p>
                        <div className="flex justify-center"><VerifiedBadge size={28} verified={true} /></div>
                    </>
                ) : verificationStatus === 'processing' ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <Shield size={32} className="text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-primary">Verifying Identity...</h3>
                        <p className="text-sm text-text-secondary">Our AI is analyzing your selfie. This takes a few seconds.</p>
                        <div className="flex justify-center gap-1.5 py-2">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck size={32} className="text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">Get Verified</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Earn a blue verification badge to show you're real. Upload a selfie for our AI to verify your identity.
                        </p>

                        {/* Strict Rules */}
                        <div className="text-left rounded-xl p-3.5 space-y-2" style={{ background: 'var(--color-surface)' }}>
                            <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                <Shield size={12} className="text-primary" /> Verification Rules
                            </p>
                            <ul className="text-[11px] text-text-secondary space-y-1.5 list-none">
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className="text-success mt-0.5 shrink-0" />
                                    <span>You must have a <strong>profile photo</strong> uploaded first</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className="text-success mt-0.5 shrink-0" />
                                    <span>Upload a <strong>different selfie</strong> (not the same as profile photo)</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className="text-success mt-0.5 shrink-0" />
                                    <span>Selfie must clearly show your <strong>face</strong> with good lighting</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className="text-success mt-0.5 shrink-0" />
                                    <span>No <strong>masks, sunglasses</strong>, or face-obscuring items</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className="text-success mt-0.5 shrink-0" />
                                    <span>Minimum photo size: <strong>100×100 pixels</strong></span>
                                </li>
                            </ul>
                        </div>

                        {!(user.avatar_url || user.photos?.length > 0) && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10">
                                <AlertCircle size={16} className="text-gold shrink-0" />
                                <span className="text-xs text-gold font-medium">Upload a profile picture first (go to My Photos)</span>
                            </div>
                        )}
                        {verificationStatus === 'failed' && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10">
                                <ShieldAlert size={16} className="text-danger shrink-0 mt-0.5" />
                                <span className="text-xs text-danger font-medium">Verification denied. Please read the rules above and try again with a valid selfie.</span>
                            </div>
                        )}
                        <button
                            onClick={() => selfieInputRef.current?.click()}
                            disabled={!(user.avatar_url || user.photos?.length > 0)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white gradient-primary disabled:opacity-40 transition-all"
                        >
                            <ImagePlus size={18} /> Upload Selfie to Verify
                        </button>
                        <input ref={selfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieUpload} />
                    </>
                )}
            </div>
        </div>
    );

    // ---- Messages ----
    const renderMessages = () => {
        const msgs = messages || [];
        return (
            <div className="space-y-3">
                {msgs.length > 0 && unreadMessages > 0 && (
                    <button onClick={markMessagesRead} className="text-xs text-primary font-medium hover:underline">Mark all read</button>
                )}
                {msgs.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto">
                            <MessageSquare size={28} className="text-text-muted" />
                        </div>
                        <p className="text-sm text-text-muted">No messages yet</p>
                    </div>
                ) : (
                    msgs.map(msg => (
                        <div key={msg.id} className={`rounded-2xl p-4 transition-colors ${msg.read ? '' : 'card-shadow'}`} style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 flex items-center justify-center">
                                    {msg.senderImage ? (
                                        <img src={msg.senderImage} alt="" className="w-full h-full object-cover" />
                                    ) : msg.type === 'gs_support' ? (
                                        <ShieldCheck size={18} className="text-primary" />
                                    ) : msg.type === 'verification' ? (
                                        <ShieldCheck size={18} className="text-success" />
                                    ) : (
                                        <User size={18} className="text-text-muted" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-bold text-text-primary">{msg.sender}</span>
                                        {!msg.read && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                        <span className="text-[10px] text-text-muted ml-auto">{formatTime(msg.timestamp)}</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-0.5">{msg.title}</h4>
                                    <p className="text-xs text-text-secondary leading-relaxed">{msg.body}</p>
                                    {msg.profileId && (
                                        <Link href={`/discover/${msg.profileId}`} className="inline-block mt-2 text-[11px] text-primary font-semibold hover:underline">
                                            View Profile →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    // ---- Saved Profiles ----
    const renderSaved = () => (
        <div className="space-y-3">
            {(saved || []).length === 0 ? (
                <div className="text-center py-10 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mx-auto">
                        <Bookmark size={28} className="text-text-muted" />
                    </div>
                    <p className="text-sm text-text-muted">No saved profiles yet</p>
                </div>
            ) : (
                saved.map(p => (
                    <Link key={p.wpId} href={`/discover/${p.wpId}`}
                        className="flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-surface/50"
                        style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface shrink-0">
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <UserAvatar name={p.name} size={48} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-text-primary truncate">{p.name || 'Sugar Mummy'}</h4>
                            <p className="text-xs text-text-muted">{p.location || 'Kenya'}</p>
                        </div>
                        <ChevronRight size={18} className="text-text-muted" />
                    </Link>
                ))
            )}
        </div>
    );

    // ---- Settings ----
    const renderSettings = () => (
        <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <ToggleRow icon={Shield} label="Public Profile" checked={settings.isPublic} onChange={v => updateSettings({ isPublic: v })} />
                <ToggleRow icon={MapPin} label="Share Location" checked={settings.locationEnabled} onChange={v => updateSettings({ locationEnabled: v })} />
                <ToggleRow icon={Bell} label="Push Notifications" checked={settings.notifications} onChange={v => updateSettings({ notifications: v })} />
                <ToggleRow icon={Mail} label="Email Notifications" checked={settings.emailNotifications} onChange={v => updateSettings({ emailNotifications: v })} />
            </div>

            {/* Email Subscription */}
            <EmailSubscribe />

            <button onClick={() => { signOut(); router.push('/auth/login'); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-text-secondary transition-colors" style={{ background: 'var(--color-surface)' }}>
                <LogOut size={18} /> Sign Out
            </button>
            <button onClick={() => { if (confirm('Delete your account? All data will be lost.')) { deleteAccount(); router.push('/'); } }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-danger transition-colors" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <Trash2 size={18} /> Delete Account
            </button>
        </div>
    );

    // ---- Contact ----
    const renderContact = () => {
        const helpMsg = encodeURIComponent('Hi, I need help from the app');
        return (
            <div className="space-y-3">
                <ContactRow icon={<TelegramIcon size={20} className="text-white" />} label="Telegram" sub="@GSADMINMARYGAGENCY — Recommended" href={`https://t.me/GSADMINMARYGAGENCY?text=${helpMsg}`} color="#26A5E4" />
                <ContactRow icon={<Phone size={20} className="text-white" />} label="Phone Call" sub="+254 738 871 048" href="tel:+254738871048" color="#2ECC71" />
                <ContactRow icon={<MessageCircle size={20} className="text-white" />} label="SMS" sub="+254 738 871 048" href={`sms:+254738871048?body=${helpMsg}`} color="#34B7F1" />
                <ContactRow icon={<Mail size={20} className="text-white" />} label="Email" sub="genuinesugarmummies@gmail.com" href={`mailto:genuinesugarmummies@gmail.com?subject=Help&body=${helpMsg}`} color="#9333EA" />
            </div>
        );
    };

    // ---- Help ----
    const renderHelp = () => (
        <div className="space-y-3">
            <FaqItem q="How do I connect with a sugar mummy?" a="Browse profiles on Discover, like/comment on the ones you're interested in, then tap 'Request Connection' to contact our admin Mary G on Telegram for facilitation." />
            <FaqItem q="Are the profiles real?" a="All profiles are imported from genuinesugarmummies.co.ke — a real website with active posts and real user comments." />
            <FaqItem q="How does verification work?" a="Go to Account → Verify Profile and upload a clear selfie. If your selfie matches your profile picture, you'll receive a blue verification badge." />
            <FaqItem q="How do comments work?" a="Comments you post are sent to the website for admin moderation. Once approved, they appear publicly on the profile page." />
            <FaqItem q="How do I get a match?" a="Like profiles, and the algorithm will match you with sugar mummies based on compatibility, activity, and location." />
            <FaqItem q="Is my data private?" a="Your profile data is stored locally on your device. We don't share your information with third parties." />
        </div>
    );

    return (
        <div className="px-4 pt-4 pb-24">
            <AnimatePresence mode="wait">
                {activeSection ? (
                    <motion.div key="section" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                        {/* Section header */}
                        <div className="flex items-center gap-3 mb-5">
                            <button onClick={() => setActiveSection(null)} className="p-2 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                                <ChevronLeft size={20} className="text-text-primary" />
                            </button>
                            <h2 className="text-lg font-bold text-text-primary">
                                {MENU_ITEMS.find(m => m.key === activeSection)?.label || 'Back'}
                            </h2>
                        </div>
                        {renderSection()}
                    </motion.div>
                ) : (
                    <motion.div key="home" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                        {/* Profile Card */}
                        <div className="flex flex-col items-center py-6 space-y-3">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primary/20" style={{ background: 'var(--color-surface)' }}>
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserAvatar name={user.display_name} size={96} />
                                    )}
                                </div>
                                {verificationStatus === 'verified' && (
                                    <div className="absolute -bottom-1 -right-1">
                                        <VerifiedBadge size={26} verified={true} />
                                    </div>
                                )}
                            </div>
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-text-primary flex items-center gap-1.5 justify-center">
                                    {user.display_name || 'User'}
                                    {verificationStatus === 'verified' && <VerifiedBadge size={18} verified={true} />}
                                </h1>
                                <p className="text-sm text-text-muted">{user.email}</p>
                            </div>

                            {/* Quick stats */}
                            <div className="flex items-center gap-6 mt-2">
                                <StatBadge icon={Heart} label="Likes" value={(user && user.id) ? (getStored('gsm_likes', [])?.length || 0) : 0} />
                                <StatBadge icon={Star} label="Matches" value={(user && user.id) ? (getStored('gsm_matches', [])?.length || 0) : 0} />
                                <StatBadge icon={Bookmark} label="Saved" value={saved?.length || 0} />
                            </div>
                        </div>

                        {/* Menu */}
                        <div className="rounded-2xl overflow-hidden mt-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            {MENU_ITEMS.map((item, idx) => {
                                const Icon = item.icon;
                                const showBadge = item.key === 'messages' && unreadMessages > 0;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => setActiveSection(item.key)}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface/50"
                                        style={idx < MENU_ITEMS.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}
                                    >
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                                            <Icon size={18} className="text-primary" />
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-text-primary">{item.label}</span>
                                        {showBadge && (
                                            <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center">
                                                {unreadMessages > 9 ? '9+' : unreadMessages}
                                            </span>
                                        )}
                                        <ChevronRight size={18} className="text-text-muted" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Version */}
                        <p className="text-center text-[10px] text-text-muted mt-6">
                            Genuine Sugarmummies App · v3.1.0
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---- Helper Components ----
function getStored(key, fallback = null) {
    if (typeof window === 'undefined') return fallback;
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function InputField({ label, value, onChange, multiline, placeholder }) {
    const shared = "w-full rounded-xl p-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm";
    const style = { background: 'var(--color-bg-input)', border: 'var(--card-border)' };
    return (
        <div>
            <label className="text-xs text-text-muted font-medium mb-1 block">{label}</label>
            {multiline ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={shared} style={style} />
            ) : (
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={shared} style={style} />
            )}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2">
                <Icon size={14} className="text-text-muted" />
                <span className="text-xs text-text-muted">{label}</span>
            </div>
            <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">{value}</span>
        </div>
    );
}

function ToggleRow({ icon: Icon, label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3">
                <Icon size={18} className="text-text-muted" />
                <span className="text-sm font-medium text-text-primary">{label}</span>
            </div>
            <button onClick={() => onChange(!checked)}
                className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-surface-light'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

function StatBadge({ icon: Icon, label, value }) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-text-primary">{value}</span>
            <span className="text-[10px] text-text-muted flex items-center gap-1"><Icon size={10} /> {label}</span>
        </div>
    );
}

function ContactRow({ icon, label, sub, href, color }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-text-primary">{label}</h4>
                <p className="text-xs text-text-muted truncate">{sub}</p>
            </div>
            <ChevronRight size={18} className="text-text-muted" />
        </a>
    );
}

function FaqItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                <HelpCircle size={16} className="text-primary shrink-0" />
                <span className="flex-1 text-sm font-medium text-text-primary">{q}</span>
                <ChevronRight size={16} className={`text-text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && <p className="px-4 pb-3.5 text-xs text-text-secondary leading-relaxed">{a}</p>}
        </div>
    );
}

function formatTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
