'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Camera, Heart, Bookmark, Settings, ChevronRight, LogOut, Trash2, Pencil,
    Shield, HelpCircle, ChevronLeft, X, Mail, MapPin, Calendar, Star, Plus, Phone,
    MessageCircle, ShieldCheck, ShieldAlert, ImagePlus, Check, AlertCircle, Send,
    MessageSquare, Bell, Crown, CreditCard, BarChart3, Eye, LifeBuoy, Search
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import TelegramIcon from '@/components/TelegramIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

const MENU_ITEMS = [
    { key: 'profile', icon: User, label: 'My Profile' },
    { key: 'photos', icon: Camera, label: 'My Photos' },
    { key: 'verification', icon: ShieldCheck, label: 'Verify Profile' },
    { key: 'messages', icon: MessageSquare, label: 'Messages' },
    { key: 'notifications', icon: Bell, label: 'Notifications' },
    { key: 'saved', icon: Bookmark, label: 'Saved Profiles' },
    { key: 'subscribe', icon: Crown, label: 'Membership Plans', link: '/subscribe' },
    { key: 'support', icon: LifeBuoy, label: 'Support & Help Desk', link: '/settings/support' },
    { key: 'settings', icon: Settings, label: 'Settings' },
    { key: 'contact', icon: Phone, label: 'Contact Us' },
    { key: 'help', icon: HelpCircle, label: 'FAQ' },
];

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, likes, matches, updateProfile, addPhoto, removePhoto, saved, signOut, deleteAccount, settings, updateSettings, verificationStatus, verifyProfile, clearVerification, messages, markMessagesRead, markSingleMessageRead, deleteMessage, subscription, conversations, getOrCreateConversation, deleteConversation } = useAuth();
    const [activeSection, setActiveSection] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({});
    const [selfieData, setSelfieData] = useState(null);
    const [idDocData, setIdDocData] = useState(null);
    const [expandedMessages, setExpandedMessages] = useState({});
    const [selectedMessage, setSelectedMessage] = useState(null);
    const fileInputRef = useRef(null);
    const selfieInputRef = useRef(null);
    const idDocInputRef = useRef(null);

    const handleMessageClick = async (msg) => {
        if (!msg.read) {
            await markSingleMessageRead(msg.id);
        }
        
        // If it is a notification with a profileId (real member match/message)
        if (msg.profileId) {
            const conv = conversations?.find(c => String(c.matchWpId) === String(msg.profileId));
            if (conv) {
                router.push(`/chat/${encodeURIComponent(conv.id)}`);
            } else {
                router.push(`/discover/${msg.profileId}`);
            }
            return;
        }

        // Clickable actions based on notification types
        if (msg.type === 'support') {
            router.push('/settings/support');
            return;
        } else if (msg.type === 'verification') {
            setActiveSection('verification');
            return;
        } else if (msg.type === 'upgrade' || msg.type === 'system') {
            setActiveSection('profile');
            return;
        } else if (msg.type === 'welcome') {
            router.push('/discover');
            return;
        } else if (msg.type === 'match' || msg.type === 'like') {
            router.push('/matches');
            return;
        }

        // Fallback: open the detail modal popup
        setSelectedMessage(msg);
    };


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
        reader.onload = (ev) => setSelfieData(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleIdDocUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setIdDocData(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSubmitVerification = async () => {
        if (!selfieData || !idDocData) return;
        await verifyProfile(selfieData, idDocData);
        setSelfieData(null);
        setIdDocData(null);
    };

    const startEdit = () => {
        setEditMode(true);
        setEditData({
            display_name: user.display_name || '',
            bio: user.bio || '',
            interests: (user.interests || []).join(', '),
            hobbies: (user.hobbies || []).join(', '),
            age: user.age || '',
            location: user.location || '',
            gender: user.gender || '',
            lookingFor: user.lookingFor || '',
            phone: user.phone || '',
        });
    };

    const saveEdit = () => {
        updateProfile({
            display_name: editData.display_name,
            bio: editData.bio,
            interests: typeof editData.interests === 'string' ? editData.interests.split(',').map(i => i.trim()).filter(Boolean) : (editData.interests || []),
            hobbies: typeof editData.hobbies === 'string' ? editData.hobbies.split(',').map(h => h.trim()).filter(Boolean) : (editData.hobbies || []),
            age: parseInt(editData.age) || null,
            location: editData.location,
            gender: editData.gender,
            lookingFor: editData.lookingFor,
            phone: editData.phone,
        });
        setEditMode(false);
    };

    const unreadConversations = (conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const unreadNotifications = (messages || []).filter(m => !m.read).length;

    // ---- SECTION RENDERERS ----
    const renderSection = () => {
        switch (activeSection) {
            case 'profile': return renderProfileEdit();
            case 'photos': return renderPhotos();
            case 'verification': return renderVerification();
            case 'messages': return renderMessages();
            case 'notifications': return renderNotifications();
            case 'saved': return renderSaved();
            case 'settings': return renderSettings();
            case 'contact': return renderContact();
            case 'help': return renderHelp();
            default: return null;
        }
    };

    // ---- Profile Edit ----
    const renderProfileEdit = () => {
        const formatGender = (g) => {
            if (g === 'male') return 'Male';
            if (g === 'female') return 'Female';
            if (g === 'other') return 'Other';
            return 'Not set';
        };

        const formatLookingFor = (l) => {
            if (l === 'sugar_mummy') return 'Sugar Mummy';
            if (l === 'sugar_daddy') return 'Sugar Daddy';
            return 'Not set';
        };

        return (
            <div className="space-y-4">
                {editMode ? (
                    <div className="space-y-3">
                        <InputField label="Display Name" value={editData.display_name} onChange={v => setEditData(p => ({ ...p, display_name: v }))} />
                        <InputField label="Bio" value={editData.bio} onChange={v => setEditData(p => ({ ...p, bio: v }))} multiline />
                        <InputField label="Interests" value={editData.interests} onChange={v => setEditData(p => ({ ...p, interests: v }))} placeholder="e.g. Travel, Dining, Music" />
                        <InputField label="Hobbies" value={editData.hobbies} onChange={v => setEditData(p => ({ ...p, hobbies: v }))} placeholder="e.g. Hiking, Cooking, Swimming" />
                        <InputField label="Age" value={editData.age} onChange={v => setEditData(p => ({ ...p, age: v }))} />
                        
                        {/* Location Select */}
                        <div className="space-y-1">
                            <label className="text-xs text-text-muted font-medium block">Location</label>
                            <select
                                value={editData.location}
                                onChange={e => setEditData(p => ({ ...p, location: e.target.value }))}
                                className="w-full rounded-xl p-3 bg-[var(--color-bg-input)] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                            >
                                <option value="">Select location...</option>
                                {KENYAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Gender Select */}
                        <div className="space-y-1">
                            <label className="text-xs text-text-muted font-medium block">Gender</label>
                            <select
                                value={editData.gender}
                                onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))}
                                className="w-full rounded-xl p-3 bg-[var(--color-bg-input)] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                            >
                                <option value="">Select gender...</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>

                        {/* Looking For Select */}
                        <div className="space-y-1">
                            <label className="text-xs text-text-muted font-medium block">Looking For</label>
                            <select
                                value={editData.lookingFor}
                                onChange={e => setEditData(p => ({ ...p, lookingFor: e.target.value }))}
                                className="w-full rounded-xl p-3 bg-[var(--color-bg-input)] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border text-sm"
                            >
                                <option value="">Select connection...</option>
                                <option value="sugar_mummy">Sugar Mummy</option>
                                <option value="sugar_daddy">Sugar Daddy</option>
                            </select>
                        </div>

                        <InputField label="Phone Number" value={editData.phone} onChange={v => setEditData(p => ({ ...p, phone: v }))} placeholder="e.g. +254 712 345 678" />

                        <div className="flex gap-2 pt-2">
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
                            <InfoRow icon={MapPin} label="Location" value={user.location || 'Not set'} />
                            <InfoRow icon={Heart} label="Gender" value={formatGender(user.gender)} />
                            <InfoRow icon={Search} label="Looking For" value={formatLookingFor(user.lookingFor)} />
                            <InfoRow icon={Phone} label="Phone" value={user.phone || 'Not set'} />
                            <InfoRow icon={Shield} label="Bio" value={user.bio || 'Not set'} />
                            {user.interests?.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Interests</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.interests.map((i, idx) => (
                                            <span key={idx} className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">{i}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {user.hobbies?.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Hobbies</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.hobbies.map((h, idx) => (
                                            <span key={idx} className="px-2.5 py-1 text-xs font-medium rounded-full bg-gold/10 text-gold">{h}</span>
                                        ))}
                                    </div>
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
    };

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
                        <div className="flex justify-center gap-2 flex-wrap">
                            <VerifiedBadge size={28} verified={true} />
                            {subscription && subscription.plan && subscription.plan !== 'free' && (
                                <VerifiedBadge size={28} badgeText={subscription.plan} />
                            )}
                            {user.customBadge && user.customBadge.toLowerCase() !== 'verified' && user.customBadge.toLowerCase() !== subscription?.plan?.toLowerCase() && (
                                <VerifiedBadge size={28} badgeText={user.customBadge} />
                            )}
                        </div>
                    </>
                ) : verificationStatus === 'pending_review' ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
                            <Shield size={32} className="text-gold" />
                        </div>
                        <h3 className="text-lg font-bold text-gold">⏳ Under Review</h3>
                        <p className="text-sm text-text-secondary">Your verification submission is being reviewed by our team. This usually takes 24-48 hours.</p>
                        <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-gold rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-xs text-text-muted">You will be notified once your verification is approved.</p>
                    </>
                ) : verificationStatus === 'processing' ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <Shield size={32} className="text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-primary">Processing...</h3>
                        <p className="text-sm text-text-secondary">Analyzing your documents. Please wait.</p>
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
                            Earn a verified badge by uploading a selfie <strong>and</strong> a valid ID/passport. Our team will review your submission.
                        </p>

                        {/* Verification Steps */}
                        <div className="text-left rounded-xl p-3.5 space-y-2" style={{ background: 'var(--color-surface)' }}>
                            <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                <Shield size={12} className="text-primary" /> Requirements
                            </p>
                            <ul className="text-[11px] text-text-secondary space-y-1.5 list-none">
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className={`mt-0.5 shrink-0 ${(user.avatar_url || user.photos?.length > 0) ? 'text-success' : 'text-text-muted'}`} />
                                    <span>Profile photo uploaded</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className={`mt-0.5 shrink-0 ${selfieData ? 'text-success' : 'text-text-muted'}`} />
                                    <span>Clear selfie showing your face</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                    <Check size={10} className={`mt-0.5 shrink-0 ${idDocData ? 'text-success' : 'text-text-muted'}`} />
                                    <span>Valid ID or passport photo</span>
                                </li>
                            </ul>
                        </div>

                        {!(user.avatar_url || user.photos?.length > 0) && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10">
                                <AlertCircle size={16} className="text-gold shrink-0" />
                                <span className="text-xs text-gold font-medium">Upload a profile picture first (My Photos)</span>
                            </div>
                        )}
                        {verificationStatus === 'failed' && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10">
                                <ShieldAlert size={16} className="text-danger shrink-0 mt-0.5" />
                                <span className="text-xs text-danger font-medium">Verification denied. Please try again with a valid selfie and ID/passport.</span>
                            </div>
                        )}

                        {/* Step 1: Selfie */}
                        <div className="text-left space-y-2">
                            <p className="text-xs font-bold text-text-primary">Step 1: Upload Selfie</p>
                            {selfieData ? (
                                <div className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                                    <img src={selfieData} alt="selfie" className="w-12 h-12 rounded-lg object-cover" />
                                    <span className="text-xs text-success font-medium flex-1">Selfie uploaded ✓</span>
                                    <button onClick={() => setSelfieData(null)} className="text-danger"><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => selfieInputRef.current?.click()}
                                    disabled={!(user.avatar_url || user.photos?.length > 0)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-primary disabled:opacity-40 transition-all"
                                    style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }}
                                >
                                    <Camera size={16} /> Take or Upload Selfie
                                </button>
                            )}
                        </div>

                        {/* Step 2: ID Document */}
                        <div className="text-left space-y-2">
                            <p className="text-xs font-bold text-text-primary">Step 2: Upload ID / Passport</p>
                            {idDocData ? (
                                <div className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                                    <img src={idDocData} alt="ID" className="w-12 h-12 rounded-lg object-cover" />
                                    <span className="text-xs text-success font-medium flex-1">ID document uploaded ✓</span>
                                    <button onClick={() => setIdDocData(null)} className="text-danger"><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => idDocInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-primary transition-all"
                                    style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }}
                                >
                                    <CreditCard size={16} /> Upload ID or Passport Photo
                                </button>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmitVerification}
                            disabled={!selfieData || !idDocData}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white gradient-primary disabled:opacity-40 transition-all"
                        >
                            <ShieldCheck size={18} /> Submit for Verification
                        </button>

                        <input ref={selfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieUpload} />
                        <input ref={idDocInputRef} type="file" accept="image/*" className="hidden" onChange={handleIdDocUpload} />
                        <p className="text-[10px] text-text-muted">Your documents are reviewed by our team and are never shared with other users.</p>
                    </>
                )}
            </div>
        </div>
    );

    // ---- Messages ----
    const renderMessages = () => {
        const convs = conversations || [];
        return (
            <div className="space-y-3">
                {convs.length === 0 ? (
                    <div className="text-center py-12 px-6 space-y-4 rounded-3xl border border-border" style={{ background: 'var(--color-bg-card)' }}>
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <MessageSquare size={24} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-text-primary">No messages yet</p>
                            <p className="text-xs text-text-secondary">Start a conversation from a member's profile or matches tab.</p>
                        </div>
                    </div>
                ) : (
                    convs.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => router.push(`/chat/${encodeURIComponent(conv.id)}`)}
                            className={`rounded-2xl p-4 transition-all cursor-pointer border ${
                                conv.unreadCount > 0 
                                    ? 'card-shadow border-primary/20 bg-primary/5 ring-1 ring-primary/5' 
                                    : 'border-border bg-bg-card'
                            }`}
                            style={{ 
                                background: 'var(--color-bg-card)',
                                borderColor: conv.unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-border)'
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-2xl overflow-hidden bg-surface flex items-center justify-center border border-border">
                                        {conv.matchImage ? (
                                            <img src={conv.matchImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <UserAvatar name={conv.matchName} size={44} />
                                        )}
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-bg" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-xs text-text-primary truncate ${conv.unreadCount > 0 ? 'font-black' : 'font-bold'}`}>
                                            {conv.matchName || 'Unknown'}
                                        </span>
                                        <span className="text-[10px] text-text-muted">
                                            {formatTime(conv.lastMessageAt)}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                                        {conv.lastMessage || 'Start a conversation…'}
                                    </p>
                                </div>
                                <div className="shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={async () => {
                                            if (confirm('Delete this entire chat conversation? This action cannot be undone.')) {
                                                await deleteConversation(conv.id);
                                            }
                                        }}
                                        className="p-2 rounded-xl bg-danger/10 hover:bg-danger/25 text-danger transition-colors"
                                        title="Delete conversation"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    // ---- Notifications ----
    const renderNotifications = () => {
        const msgs = (messages || []).filter(m => !m.profileId);
        return (
            <div className="space-y-3">
                {msgs.length > 0 && msgs.some(m => !m.read) && (
                    <button onClick={markMessagesRead} className="text-xs text-primary font-medium hover:underline">Mark all read</button>
                )}
                {msgs.length === 0 ? (
                    <div className="text-center py-12 px-6 space-y-4 rounded-3xl border border-border" style={{ background: 'var(--color-bg-card)' }}>
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Bell size={24} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-text-primary">No notifications yet</p>
                            <p className="text-xs text-text-secondary">Updates on matches, verifications, and approvals will appear here.</p>
                        </div>
                    </div>
                ) : (
                    msgs.map(msg => (
                        <div
                            key={msg.id}
                            onClick={() => handleMessageClick(msg)}
                            className={`rounded-2xl p-4 transition-all cursor-pointer ${
                                msg.read 
                                    ? 'bg-opacity-50 opacity-90' 
                                    : 'card-shadow border-primary/20 bg-primary/5 ring-1 ring-primary/5'
                            }`}
                            style={{ 
                                background: 'var(--color-bg-card)', 
                                border: msg.read ? 'var(--card-border)' : '1px solid var(--color-primary)' 
                            }}
                        >
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
                                        {!msg.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />}
                                        <span className="text-[10px] text-text-muted ml-auto">{formatTime(msg.timestamp)}</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-0.5">{msg.title}</h4>
                                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                                        {msg.body}
                                    </p>
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
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserAvatar name={p.name} size={48} />}
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
            <FaqItem q="Is my data private?" a="Your profile data is securely stored with Supabase (encrypted at rest). We never share your personal information with third parties." />
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
                            </div>
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 justify-center flex-wrap">
                                    {user.display_name || 'User'}
                                    {verificationStatus === 'verified' && <VerifiedBadge size={18} verified={true} />}
                                    {subscription && subscription.plan && subscription.plan !== 'free' && (
                                        <VerifiedBadge size={18} badgeText={subscription.plan} />
                                    )}
                                    {user.customBadge && user.customBadge.toLowerCase() !== 'verified' && user.customBadge.toLowerCase() !== subscription?.plan?.toLowerCase() && (
                                        <VerifiedBadge size={18} badgeText={user.customBadge} />
                                    )}
                                </h1>
                                <p className="text-sm text-text-muted">{user.email}</p>
                            </div>

                            {/* Quick stats */}
                            <div className="flex items-center gap-6 mt-2">
                                <StatBadge icon={Heart} label="Likes" value={likes?.length || 0} />
                                <StatBadge icon={Star} label="Matches" value={matches?.length || 0} />
                                <StatBadge icon={Bookmark} label="Saved" value={saved?.length || 0} />
                            </div>
                        </div>

                        {/* Menu */}
                        <div className="rounded-2xl overflow-hidden mt-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            {MENU_ITEMS.map((item, idx) => {
                                const Icon = item.icon;
                                const itemBadgeCount = item.key === 'messages' ? unreadConversations : item.key === 'notifications' ? unreadNotifications : 0;
                                const showBadge = itemBadgeCount > 0;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => item.link ? router.push(item.link) : setActiveSection(item.key)}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface/50"
                                        style={idx < MENU_ITEMS.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}
                                    >
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                                            <Icon size={18} className="text-primary" />
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-text-primary">{item.label}</span>
                                        {showBadge && (
                                            <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center">
                                                {itemBadgeCount > 9 ? '9+' : itemBadgeCount}
                                            </span>
                                        )}
                                        <ChevronRight size={18} className="text-text-muted" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Version */}
                        <p className="text-center text-[10px] text-text-muted mt-6">
                            Genuine Sugarmummies App · v4.0.0
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Message Detail Modal */}
            <AnimatePresence>
                {selectedMessage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedMessage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', duration: 0.4 }}
                            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border bg-bg-card relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setSelectedMessage(null)}
                                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-surface transition-colors"
                            >
                                <X size={18} className="text-text-secondary" />
                            </button>

                            {/* Sender Info Header */}
                            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-surface shrink-0 flex items-center justify-center border border-border">
                                    {selectedMessage.senderImage ? (
                                        <img src={selectedMessage.senderImage} alt="" className="w-full h-full object-cover" />
                                    ) : ['GS Support', 'GS Verification', 'GS Admin', 'GS support', 'GS verification'].includes(selectedMessage.sender) ? (
                                        <ShieldCheck size={24} className="text-primary" />
                                    ) : (
                                        <User size={24} className="text-text-muted" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h3 className="text-sm font-bold text-text-primary truncate">{selectedMessage.sender}</h3>
                                        {['GS Support', 'GS Verification', 'GS Admin', 'GS support', 'GS verification'].includes(selectedMessage.sender) && (
                                            <VerifiedBadge size={14} verified={true} badgeText="Admin" />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-text-muted mt-0.5">{formatTime(selectedMessage.timestamp)}</p>
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h4 className="text-base font-black text-text-primary">{selectedMessage.title}</h4>
                                    <div className="rounded-2xl p-4 text-sm leading-relaxed text-text-primary bg-bg-secondary border border-border">
                                        {selectedMessage.body}
                                    </div>
                                </div>

                                {selectedMessage.profileId && (
                                    <Link
                                        href={`/discover/${selectedMessage.profileId}`}
                                        onClick={() => setSelectedMessage(null)}
                                        className="w-full py-2.5 rounded-xl font-semibold text-center text-xs text-white gradient-primary flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                                    >
                                        <User size={14} /> View Member Profile
                                    </Link>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        onClick={async () => {
                                            if (confirm('Delete this message? This action is permanent.')) {
                                                await deleteMessage(selectedMessage.id);
                                                setSelectedMessage(null);
                                            }
                                        }}
                                        className="flex-1 py-3 rounded-2xl font-semibold text-danger flex items-center justify-center gap-1.5 text-xs border border-danger/10 hover:bg-danger/5 active:scale-95 transition-all"
                                    >
                                        <Trash2 size={15} /> Delete Message
                                    </button>
                                    <button
                                        onClick={() => setSelectedMessage(null)}
                                        className="flex-1 py-3 rounded-2xl font-semibold text-text-secondary flex items-center justify-center text-xs active:scale-95 transition-all"
                                        style={{ background: 'var(--color-surface)' }}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
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
