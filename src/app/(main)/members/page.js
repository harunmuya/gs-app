'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, MapPin, Grid, List, Crown, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

export default function MembersPage() {
    const { user, guest, realProfilePool } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfiles() {
            try {
                const res = await fetch('/api/profiles?page=1&per_page=50');
                const data = await res.json();
                setProfiles(data.profiles || []);
            } catch {
                setProfiles(realProfilePool || []);
            } finally {
                setLoading(false);
            }
        }
        loadProfiles();
    }, [realProfilePool]);

    const filteredProfiles = useMemo(() => {
        if (!searchQuery.trim()) return profiles;
        const q = searchQuery.toLowerCase();
        return profiles.filter(p =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.location && p.location.toLowerCase().includes(q))
        );
    }, [profiles, searchQuery]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center">
                    <Users size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Members</h2>
                <p className="text-text-secondary">Sign in to see member profiles.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users size={22} className="text-primary" />
                    <h1 className="text-xl font-bold text-text-primary">Members</h1>
                    <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface)' }}>
                        {filteredProfiles.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-muted'}`}
                    >
                        <Grid size={16} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'text-text-muted'}`}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    type="text"
                    placeholder="Search by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2.5 pl-9 pr-4 rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--color-surface)' }}
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
                </div>
            ) : filteredProfiles.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                    <Users size={40} className="text-text-muted mx-auto" />
                    <p className="text-text-muted">No members found</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 gap-3">
                    {filteredProfiles.map((profile, idx) => (
                        <motion.div key={profile.wpId}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                        >
                            <Link href={`/discover/${profile.wpId}`}
                                className="block rounded-2xl overflow-hidden transition-transform active:scale-[0.98]"
                                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                            >
                                <div className="aspect-square relative">
                                    {profile.imageUrl ? (
                                        <img src={profile.imageUrl} alt={profile.name} className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                            <UserAvatar name={profile.name} size={60} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 gradient-card" />
                                    {/* Online indicator */}
                                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-success border-2 border-white" />
                                    {/* Role label */}
                                    <div className="absolute top-2 left-2">
                                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ background: user?.lookingFor === 'sugar_daddy' ? 'rgba(59,130,246,0.85)' : 'rgba(236,72,153,0.85)' }}>
                                            {user?.lookingFor === 'sugar_daddy' ? '💙 Sugar Daddy' : '💖 Sugar Mummy'}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                        <h3 className="text-sm font-bold text-white truncate flex items-center gap-1">
                                            {profile.name || 'Member'}
                                            {profile.age && <span className="text-white/70 text-xs font-normal">{profile.age}</span>}
                                        </h3>
                                        {profile.location && (
                                            <p className="text-[10px] text-white/70 flex items-center gap-0.5">
                                                <MapPin size={8} /> {profile.location}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="space-y-2">
                    {filteredProfiles.map((profile, idx) => (
                        <motion.div key={profile.wpId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                        >
                            <Link href={`/discover/${profile.wpId}`}
                                className="flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-surface/50"
                                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface shrink-0">
                                        {profile.imageUrl ? (
                                            <img src={profile.imageUrl} alt="" className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { e.target.style.display = 'none'; }} />
                                        ) : (
                                            <UserAvatar name={profile.name} size={48} />
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-text-primary truncate flex items-center gap-1">
                                        {profile.name || 'Member'}
                                        {profile.age && <span className="text-text-muted text-xs font-normal">· {profile.age}</span>}
                                        <VerifiedBadge size={14} />
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {profile.location && (
                                            <p className="text-xs text-text-muted flex items-center gap-1">
                                                <MapPin size={10} /> {profile.location}
                                            </p>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-medium" style={{ background: user?.lookingFor === 'sugar_daddy' ? 'rgba(59,130,246,0.1)' : 'rgba(236,72,153,0.1)', color: user?.lookingFor === 'sugar_daddy' ? '#3b82f6' : '#ec4899' }}>
                                            {user?.lookingFor === 'sugar_daddy' ? '💙 Sugar Daddy' : '💖 Sugar Mummy'}
                                        </span>
                                    </div>
                                </div>
                                {profile.daysSincePost < 7 && (
                                    <span className="text-[9px] font-bold text-white bg-success rounded-full px-1.5 py-0.5 shrink-0">
                                        NEW
                                    </span>
                                )}
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
