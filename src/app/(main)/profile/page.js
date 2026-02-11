'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Navigation, Camera, Save, Trash2, LogOut, ChevronRight, Sliders, Plus, X, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import Logo from '@/components/Logo';

const INTERESTS_LIST = [
    'Traveling', 'Cooking', 'Music', 'Movies', 'Sports', 'Art', 'Gaming',
    'Reading', 'Photography', 'Dancing', 'Fitness', 'Fashion', 'Tech',
    'Animals', 'Nature', 'Coffee', 'Wine', 'Foodie'
];

export default function ProfilePage() {
    const { user, guest, profile, signOut, updateProfile, deleteAccount, supabase } = useAuth();
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
                <button
                    onClick={signOut}
                    className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20"
                >
                    Sign In / Create Account
                </button>
            </div>
        );
    }

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef(null);

    // Profile Fields
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [images, setImages] = useState([]);
    const [interests, setInterests] = useState([]);
    const [orientation, setOrientation] = useState('');

    // Preferences
    const [minAge, setMinAge] = useState(18);
    const [maxAge, setMaxAge] = useState(60);
    const [maxDistance, setMaxDistance] = useState(100);
    const [genderPref, setGenderPref] = useState('both');
    const [prefsChanged, setPrefsChanged] = useState(false);

    // Stats
    const [stats, setStats] = useState({ likes: 0, matches: 0 });

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setBio(profile.bio || '');
            setImages(profile.images || (profile.avatar_url ? [profile.avatar_url] : []));
            setInterests(profile.interests || []);
            setOrientation(profile.orientation || '');
        }
    }, [profile]);

    useEffect(() => {
        if (user) {
            fetchPreferences();
            fetchStats();
        }
    }, [user]);

    const fetchPreferences = async () => {
        if (!user || !supabase) return;
        try {
            const { data } = await supabase
                .from('preferences')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (data) {
                setMinAge(data.min_age || 18);
                setMaxAge(data.max_age || 60);
                setMaxDistance(data.max_distance_km || 100);
                setGenderPref(data.gender_preference || 'both');
            }
        } catch (err) { }
    };

    const fetchStats = async () => {
        if (!user || !supabase) return;
        try {
            const [likesRes, matchesRes] = await Promise.all([
                supabase.from('likes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('matches').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            ]);
            setStats({
                likes: likesRes.count || 0,
                matches: matchesRes.count || 0,
            });
        } catch (err) { }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await updateProfile({
                display_name: displayName,
                bio,
                images,
                interests,
                orientation,
                avatar_url: images[0] || null
            });
            setEditing(false);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePreferences = async () => {
        if (!user || !supabase) return;
        setSaving(true);
        try {
            await supabase.from('preferences').upsert({
                user_id: user.id,
                min_age: minAge,
                max_age: maxAge,
                max_distance_km: maxDistance,
                gender_preference: genderPref,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
            setPrefsChanged(false);
        } catch (err) {
            console.error('Prefs save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            await deleteAccount();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Optimistic UI update? No, wait for upload.
        setSaving(true);
        try {
            // Check if bucket exists, if not, maybe fail gracefully or use different approach
            // For this demo, we assume 'avatars' bucket exists
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const newImages = [...images, publicUrl];
            setImages(newImages);

            // Auto save
            await updateProfile({
                images: newImages,
                avatar_url: newImages[0]
            });

        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading image. Make sure "avatars" bucket exists and is public.');
        } finally {
            setSaving(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = async (index) => {
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
        // Auto save
        await updateProfile({
            images: newImages,
            avatar_url: newImages[0] || null
        });
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

            {/* Profile Photos Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {/* Main Photo (Large) */}
                <div className="col-span-2 row-span-2 aspect-square relative rounded-3xl overflow-hidden bg-surface group card-shadow">
                    {images[0] ? (
                        <>
                            <img src={images[0]} alt="Main" className="w-full h-full object-cover" />
                            {editing && (
                                <button
                                    onClick={() => removeImage(0)}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-danger/80 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                            <User size={40} className="mb-2 opacity-50" />
                            <span className="text-xs">Main Photo</span>
                        </div>
                    )}
                </div>

                {/* Other Photos */}
                {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="aspect-square relative rounded-2xl overflow-hidden bg-surface group card-shadow" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                        {images[index] ? (
                            <>
                                <img src={images[index]} alt={`Photo ${index}`} className="w-full h-full object-cover" />
                                {editing && (
                                    <button
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-danger/80 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </>
                        ) : (
                            editing && (
                                <label className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-surface-light transition-colors">
                                    <Plus size={20} className="text-primary" />
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={saving}
                                    />
                                </label>
                            )
                        )}
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-around mb-6 px-2">
                <div className="flex-1 bg-surface/50 rounded-2xl py-3 mx-1 text-center border border-white/5">
                    <p className="text-2xl font-bold text-gradient">{stats.likes}</p>
                    <p className="text-xs text-text-muted">Likes</p>
                </div>
                <div className="flex-1 bg-surface/50 rounded-2xl py-3 mx-1 text-center border border-white/5">
                    <p className="text-2xl font-bold text-gradient">{stats.matches}</p>
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
                                <p className="text-xs text-text-muted">Photos, bio, interests</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-text-muted group-hover:translate-x-1 transition-transform" />
                    </button>
                )}
            </AnimatePresence>

            {/* Discovery Settings */}
            <div className="mt-6 space-y-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Discovery Settings</h3>

                <div className="bg-bg-card rounded-3xl p-5 border border-white/5 space-y-6">
                    {/* Age Range */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">Age Range</span>
                            <span className="text-primary font-bold">{minAge} – {maxAge}</span>
                        </div>
                        <div className="space-y-4 px-1">
                            <input
                                type="range"
                                min={18}
                                max={80}
                                value={maxAge}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (val > minAge) { setMaxAge(val); setPrefsChanged(true); }
                                }}
                                className="w-full accent-primary h-1 bg-surface rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Distance */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">Maximum Distance</span>
                            <span className="text-primary font-bold">{maxDistance} km</span>
                        </div>
                        <input
                            type="range"
                            min={5}
                            max={500}
                            step={5}
                            value={maxDistance}
                            onChange={(e) => { setMaxDistance(parseInt(e.target.value)); setPrefsChanged(true); }}
                            className="w-full accent-primary h-1 bg-surface rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Gender Preference */}
                    <div>
                        <span className="text-sm font-medium text-text-primary block mb-3">Show Me</span>
                        <div className="flex bg-bg-input p-1 rounded-xl">
                            {['men', 'women', 'both'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => { setGenderPref(opt); setPrefsChanged(true); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${genderPref === opt
                                            ? 'bg-sub-surface text-white shadow-md'
                                            : 'text-text-muted hover:text-text-secondary'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location */}
                    <button
                        onClick={requestLocation}
                        disabled={geoLoading}
                        className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-surface hover:bg-surface-light transition-colors border border-white/5"
                    >
                        <div className="flex items-center gap-2 text-text-primary">
                            <Navigation size={16} className={location ? 'text-blue-400' : 'text-text-muted'} />
                            <span className="text-sm">
                                {geoLoading ? 'Locating...' : location ? `${location.city || 'Current Location'}` : 'Enable Location'}
                            </span>
                        </div>
                        <ChevronRight size={16} className="text-text-muted" />
                    </button>

                    {prefsChanged && (
                        <button
                            onClick={handleSavePreferences}
                            disabled={saving}
                            className="w-full py-3 rounded-xl font-bold text-white gradient-primary disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    )}
                </div>
            </div>

            {/* Logout/Delete */}
            <div className="mt-8 space-y-3">
                <button
                    onClick={signOut}
                    className="w-full py-3.5 rounded-2xl bg-surface border border-white/5 text-text-secondary hover:bg-surface-light font-medium transition-colors"
                >
                    Sign Out
                </button>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3.5 rounded-2xl text-danger/70 hover:bg-danger/10 hover:text-danger font-medium transition-colors"
                >
                    Delete Account
                </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
                    <div className="w-full max-w-sm bg-bg-card rounded-3xl p-6 space-y-4 border border-white/10">
                        <h3 className="text-lg font-bold text-white text-center">Delete Account?</h3>
                        <p className="text-sm text-text-secondary text-center">
                            This will permanently delete all your data including matches, likes, and preferences.
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
