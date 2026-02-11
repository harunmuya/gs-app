'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Navigation, ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import Logo from '@/components/Logo';
import Link from 'next/link';

const INTERESTS_LIST = [
    'Traveling', 'Cooking', 'Music', 'Movies', 'Sports', 'Art', 'Gaming',
    'Reading', 'Photography', 'Dancing', 'Fitness', 'Fashion', 'Tech',
    'Animals', 'Nature', 'Coffee', 'Wine', 'Foodie'
];

export default function ProfilePage() {
    const { user, guest, profile, likes, matches, signOut, updateProfile, deleteAccount } = useAuth();
    const { location, requestLocation, loading: geoLoading } = useGeolocation();

    // Guest view
    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <User size={40} className="text-text-muted" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Guest Mode</h2>
                    <p className="text-text-secondary">
                        Sign in to create your profile, save matches, and contact sugar mummies.
                    </p>
                </div>
                <Link
                    href="/auth/login"
                    className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 text-center block"
                >
                    Sign In / Create Account
                </Link>
            </div>
        );
    }

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Profile Fields
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [interests, setInterests] = useState([]);
    const [orientation, setOrientation] = useState('');

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setBio(profile.bio || '');
            setInterests(profile.interests || []);
            setOrientation(profile.orientation || '');
        }
    }, [profile]);

    const handleSaveProfile = () => {
        setSaving(true);
        try {
            updateProfile({
                display_name: displayName,
                bio,
                interests,
                orientation,
            });
            setEditing(false);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = () => {
        deleteAccount();
        setShowDeleteConfirm(false);
    };

    const toggleInterest = (interest) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else {
            if (interests.length < 5) {
                setInterests([...interests, interest]);
            }
        }
    };

    return (
        <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <User size={24} className="text-primary" />
                <h1 className="text-xl font-bold text-text-primary">Profile</h1>
            </div>

            {/* Avatar & name */}
            <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-3 ring-2 ring-primary/30">
                    <User size={40} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-white">
                    {profile?.display_name || profile?.email?.split('@')[0] || 'User'}
                </h2>
                <p className="text-sm text-text-muted">{profile?.email}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-around mb-6 px-2">
                <div className="flex-1 bg-surface/50 rounded-2xl py-3 mx-1 text-center border border-white/5">
                    <p className="text-2xl font-bold text-gradient">{likes?.length || 0}</p>
                    <p className="text-xs text-text-muted">Likes</p>
                </div>
                <div className="flex-1 bg-surface/50 rounded-2xl py-3 mx-1 text-center border border-white/5">
                    <p className="text-2xl font-bold text-gradient">{matches?.length || 0}</p>
                    <p className="text-xs text-text-muted">Matches</p>
                </div>
            </div>

            {/* Edit Profile Form */}
            <AnimatePresence mode="wait">
                {editing ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 bg-bg-card p-5 rounded-3xl border border-white/5"
                    >
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full bg-bg-input rounded-xl py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Your Name"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">Bio</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={3}
                                    maxLength={300}
                                    className="w-full bg-bg-input rounded-xl py-3 px-4 text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Tell us about yourself..."
                                />
                            </div>
                        </div>

                        {/* Interests */}
                        <div>
                            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">Interests (Max 5)</label>
                            <div className="flex flex-wrap gap-2">
                                {INTERESTS_LIST.map(interest => (
                                    <button
                                        key={interest}
                                        onClick={() => toggleInterest(interest)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${interests.includes(interest)
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-surface border-white/10 text-text-secondary hover:border-white/20'
                                            }`}
                                    >
                                        {interest}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Orientation */}
                        <div>
                            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">Orientation</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Queer', 'Other'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setOrientation(opt)}
                                        className={`py-2 rounded-xl text-xs font-medium transition-colors border ${orientation === opt
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-surface border-white/10 text-text-secondary hover:border-white/20'
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl font-bold text-white gradient-primary disabled:opacity-50 shadow-lg shadow-primary/20"
                            >
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="px-6 py-3 rounded-xl text-text-muted bg-surface hover:bg-surface-light font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <button
                        onClick={() => setEditing(true)}
                        className="w-full flex items-center justify-between py-4 px-5 rounded-3xl bg-bg-card border border-white/5 hover:bg-surface transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <User size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-text-primary group-hover:text-primary transition-colors">Edit Profile</h3>
                                <p className="text-xs text-text-muted">Bio, interests, orientation</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-text-muted group-hover:translate-x-1 transition-transform" />
                    </button>
                )}
            </AnimatePresence>

            {/* Location */}
            <div className="mt-6">
                <button
                    onClick={requestLocation}
                    disabled={geoLoading}
                    className="w-full flex items-center justify-between py-4 px-5 rounded-3xl bg-bg-card border border-white/5 hover:bg-surface transition-colors"
                >
                    <div className="flex items-center gap-2 text-text-primary">
                        <Navigation size={16} className={location ? 'text-blue-400' : 'text-text-muted'} />
                        <span className="text-sm">
                            {geoLoading ? 'Locating...' : location ? `${location.city || 'Current Location'}` : 'Enable Location'}
                        </span>
                    </div>
                    <ChevronRight size={16} className="text-text-muted" />
                </button>
            </div>

            {/* Logout/Delete */}
            <div className="mt-8 space-y-3">
                <button
                    onClick={() => { signOut(); }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-surface border border-white/5 text-text-secondary hover:bg-surface-light font-medium transition-colors"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-danger/70 hover:bg-danger/10 hover:text-danger font-medium transition-colors"
                >
                    <Trash2 size={16} />
                    Delete Account
                </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
                    <div className="w-full max-w-sm bg-bg-card rounded-3xl p-6 space-y-4 border border-white/10">
                        <h3 className="text-lg font-bold text-white text-center">Delete Account?</h3>
                        <p className="text-sm text-text-secondary text-center">
                            This will permanently delete all your saved data including matches, likes, and preferences.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 rounded-xl text-text-secondary bg-surface hover:bg-surface-light font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                className="flex-1 py-3 rounded-xl text-white bg-danger hover:bg-danger/80 font-bold"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
