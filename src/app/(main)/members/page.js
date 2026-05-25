'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, MapPin, Grid, List, Crown, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

export default function MembersPage() {
    const { user, realProfilePool } = useAuth();
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
                    className="w-full py-2.5 pl-9 pr-4 rounded-xl text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--color-surface)' }}
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <img
                        src="/gs.png"
                        alt="Loading"
                        className="w-12 h-12 object-contain animate-pulse-zoom"
                    />
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
                                    {/* Available label */}
                                    <div className="absolute top-2 right-2">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white bg-black/40 backdrop-blur-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success" /> Available
                                        </span>
                                    </div>
                                    {/* Role label */}
                                    <div className="absolute top-2 left-2">
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ background: profile.profileType === 'sugar_daddy' ? 'rgba(59,130,246,0.85)' : 'rgba(236,72,153,0.85)' }}>
                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                            {profile.profileType === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mummy'}
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

                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-text-primary truncate flex items-center gap-1">
                                        {profile.name || 'Member'}
                                        {profile.age && <span className="text-text-muted text-xs font-normal">· {profile.age}</span>}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {profile.location && (
                                            <p className="text-xs text-text-muted flex items-center gap-1">
                                                <MapPin size={10} /> {profile.location}
                                            </p>
                                        )}
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium" style={{ background: profile.profileType === 'sugar_daddy' ? 'rgba(59,130,246,0.1)' : 'rgba(236,72,153,0.1)', color: profile.profileType === 'sugar_daddy' ? '#3b82f6' : '#ec4899' }}>
                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                            {profile.profileType === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mummy'}
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
