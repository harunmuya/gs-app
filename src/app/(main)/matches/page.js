'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, HeartHandshake, MapPin, MessageCircle, RefreshCw, BadgeCheck, UserCheck, Users } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from '@/components/VerifiedBadge';
import LiveNowStrip from '@/components/LiveNowStrip';
import BoostedMembersStrip from '@/components/BoostedMembersStrip';
import StoriesStrip from '@/components/StoriesStrip';
import { getProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';
import { distanceText as profileDistanceText } from '@/lib/geo';
import PermissionSheet from '@/components/PermissionSheet';

const VALID_PROFILE_LABELS = new Set(['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy']);

function formatProfileLabel(label) {
    if (label === 'sugar_mummy') return 'Sugar Mummy';
    if (label === 'sugar_daddy') return 'Sugar Daddy';
    if (label === 'mistress') return 'Mistress';
    if (label === 'toyboy') return 'Sugar Guy / Toyboy';
    return 'Member';
}

function defaultLookingFor(label) {
    if (label === 'sugar_mummy') return 'Sugar Guy / Toyboy';
    if (label === 'sugar_daddy') return 'Mistress';
    if (label === 'mistress') return 'Sugar Daddy';
    if (label === 'toyboy') return 'Sugar Mummy';
    return '';
}

function profileSummary(member) {
    const label = effectiveMemberLabel(member);
    const lookingFor = member?.lookingFor || defaultLookingFor(label);
    return `${formatProfileLabel(label)}${lookingFor ? ` - Looking for ${lookingFor}` : ''}`;
}

function getLocalMap(key) {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function effectiveMemberLabel(member) {
    const label = String(member?.profileLabel || member?.memberCategory || '').toLowerCase();
    if (VALID_PROFILE_LABELS.has(label)) return label;
    const looking = String(member?.lookingFor || member?.intentSummary || '').toLowerCase().replace(/[_-]+/g, ' ');
    if (looking.includes('sugar mummy')) return 'toyboy';
    if (looking.includes('mistress')) return 'sugar_daddy';
    if (looking.includes('sugar daddy')) return 'mistress';
    if (looking.includes('toyboy') || looking.includes('sugar guy')) return 'sugar_mummy';
    return label || 'member';
}

function relationshipFit(member, user, interactions) {
    let score = 45;
    const label = effectiveMemberLabel(member);
    if (targetLabelsForUser(user).has(label)) score += 22;
    const userLocation = String(user?.location || '').toLowerCase();
    const memberLocation = String(member.location || member.country || '').toLowerCase();
    if (userLocation && memberLocation && (memberLocation.includes(userLocation) || userLocation.includes(memberLocation))) score += 16;
    if (member.verified) score += 7;
    if (member.isBoosted) score += 18;
    if (member.intentSummary || member.wants) score += 8;
    if (member.ageRangePreference && user?.age) {
        const ages = member.ageRangePreference.match(/\d+/g)?.map(Number) || [];
        if (ages.length >= 2 && Number(user.age) >= ages[0] && Number(user.age) <= ages[1]) score += 10;
    }
    if (interactions.followed[member.id]) score += 10;
    if (interactions.likedIds.has(member.id)) score += 9;
    if ((member.totalProfileViews || 0) > 1000) score += 3;
    const seed = `${member.id}-${user?.email || ''}-fit`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    score += Math.abs(hash) % 8;
    return Math.max(50, Math.min(98, score));
}

function userProfileLabel(user) {
    const pref = String(user?.preference || '').toLowerCase();
    if (pref.startsWith('sugar_mummy')) return 'sugar_mummy';
    if (pref.startsWith('sugar_daddy')) return 'sugar_daddy';
    if (pref.startsWith('mistress')) return 'mistress';
    if (pref.startsWith('toyboy') || pref.startsWith('sugar_guy')) return 'toyboy';
    const label = String(user?.profile_label || user?.member_category || '').toLowerCase();
    if (VALID_PROFILE_LABELS.has(label)) return label;
    return 'sugar_mummy';
}

function targetLabelsForUser(user) {
    const label = userProfileLabel(user);
    if (label === 'sugar_mummy') return new Set(['toyboy', 'sugar_daddy']);
    if (label === 'toyboy') return new Set(['sugar_mummy', 'mistress']);
    if (label === 'sugar_daddy') return new Set(['mistress', 'sugar_mummy']);
    if (label === 'mistress') return new Set(['sugar_daddy', 'toyboy']);
    return new Set(['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy']);
}

function preferenceMixForUser(user) {
    const label = userProfileLabel(user);
    const pattern = ['primary', 'primary', 'primary', 'primary', 'secondary'];
    if (label === 'toyboy') return { primary: 'sugar_mummy', secondary: 'mistress', pattern };
    if (label === 'sugar_mummy') return { primary: 'toyboy', secondary: 'sugar_daddy', pattern };
    if (label === 'sugar_daddy') return { primary: 'mistress', secondary: 'sugar_mummy', pattern };
    if (label === 'mistress') return { primary: 'sugar_daddy', secondary: 'toyboy', pattern };
    return null;
}

function weightedPreferenceDeck(items, user) {
    const mix = preferenceMixForUser(user);
    if (!mix) return items;
    const primary = [];
    const secondary = [];
    const rest = [];
    items.forEach((item) => {
        const label = effectiveMemberLabel(item);
        if (label === mix.primary) primary.push(item);
        else if (label === mix.secondary) secondary.push(item);
        else rest.push(item);
    });
    const output = [];
    let primaryIndex = 0;
    let secondaryIndex = 0;
    let cycleIndex = 0;
    while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
        const slot = mix.pattern[cycleIndex % mix.pattern.length];
        if ((slot === 'primary' && primaryIndex < primary.length) || secondaryIndex >= secondary.length) {
            if (primaryIndex < primary.length) output.push(primary[primaryIndex++]);
            else if (secondaryIndex < secondary.length) output.push(secondary[secondaryIndex++]);
        } else if (secondaryIndex < secondary.length) output.push(secondary[secondaryIndex++]);
        else if (primaryIndex < primary.length) output.push(primary[primaryIndex++]);
        cycleIndex++;
    }
    return [...output, ...rest];
}

function memberPath(member, suffix = '') {
    if (member?.detailPath) return `${member.detailPath}${suffix}`;
    return member?.id ? `/members/${member.id}${suffix}` : '/members';
}


function reasonFor(member, user, interactions) {
    if (interactions.followed[member.id]) return 'You follow this profile';
    if (String(member.location || '').toLowerCase().includes(String(user?.location || '').toLowerCase()) && user?.location) return 'Strong location fit';
    if (member.intentSummary || member.wants) return 'Intent and profile details match your preference';
    if (member.verified) return 'Verified member with a complete profile';
    return 'Suggested from your dating preference';
}

export default function MatchesPage() {
    const { user, likes, matches, messages } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [followed, setFollowed] = useState({});
    const currentProfileLabel = userProfileLabel(user);
    const [locationTick, setLocationTick] = useState(0);
    const [askLocation, setAskLocation] = useState(false);
    const hasLocation = Boolean(user?.latitude && user?.longitude);

    /**
     * Store a position chosen from the permission sheet.
     *
     * Mirrors Discover's applyDeviceLocation, and fires the same
     * gs-location-updated event so the ranking below re-runs immediately rather
     * than waiting for a navigation.
     */
    async function saveMatchLocation(result) {
        setAskLocation(false);
        if (!result?.ok || !user?.id) return;
        const next = {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            geo_updated_at: new Date().toISOString(),
        };
        try {
            await fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, ...next }),
            });
        } catch { /* kept locally; the next load retries */ }
        window.dispatchEvent(new CustomEvent('gs-location-updated', {
            detail: { source: result.precise ? 'device' : 'approximate', location: next },
        }));
        setLocationTick((value) => value + 1);
    }

    useEffect(() => {
        function onLocationUpdated() {
            setLocationTick((value) => value + 1);
        }
        window.addEventListener('gs-location-updated', onLocationUpdated);
        return () => window.removeEventListener('gs-location-updated', onLocationUpdated);
    }, []);

    useEffect(() => {
        setLoading(true);
        setFollowed(getLocalMap('gscom_followed_members'));
        async function load() {
            try {
                // One request covering every target label. This previously fired
                // 1 + N parallel requests each pulling 240 rows — and the unlabelled
                // one was redundant, since `recommendations` filters to target
                // labels anyway. Only 40 cards are ever rendered.
                const targetLabels = Array.from(targetLabelsForUser(user) || []);
                const params = new URLSearchParams({ per_page: '120' });
                if (targetLabels.length) params.set('labels', targetLabels.join(','));
                const res = await fetch(`/api/members?${params.toString()}`, { cache: 'no-store' });
                const payload = await res.json().catch(() => ({}));
                const byId = new Map();
                (payload.members || []).forEach((member) => {
                    if (member?.id && !byId.has(member.id)) byId.set(member.id, member);
                });
                setMembers(Array.from(byId.values()));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [currentProfileLabel, user?.id, locationTick]);

    const interactions = useMemo(() => ({
        followed,
        likedIds: new Set((likes || []).map((item) => item.id || item.wpId)),
        messagedIds: new Set((messages || []).map((item) => item.memberId).filter(Boolean)),
    }), [followed, likes, messages]);

    const recommendations = useMemo(() => {
        const sorted = (members || [])
            .filter((member) => member.id !== user?.id)
            .filter((member) => targetLabelsForUser(user).has(effectiveMemberLabel(member)))
            .map((member) => ({ ...member, score: relationshipFit(member, user, interactions), reason: reasonFor(member, user, interactions) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 80);
        return weightedPreferenceDeck(sorted, user).slice(0, 40);
    }, [members, user, interactions]);

    return (
        <div className="px-4 py-4 pb-28 space-y-5">
            {askLocation && (
                <PermissionSheet
                    permission="location"
                    onResolved={saveMatchLocation}
                    onClose={() => setAskLocation(false)}
                />
            )}

            {/*
              Matches ranks by distance but had no way to ask for a location — it
              only listened for gs-location-updated, an event fired by Discover.
              A member who came straight here saw "Ranked by location" with no
              location and nothing offering to fix it.
            */}
            {!askLocation && !hasLocation && (
                <button
                    type="button"
                    onClick={() => setAskLocation(true)}
                    className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl p-3 text-left"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tint-primary">
                        <MapPin size={18} className="text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block type-body-strong text-text-primary">Sort matches by distance</span>
                        <span className="block type-caption text-text-muted">Choose precise or approximate — you decide how much to share.</span>
                    </span>
                </button>
            )}

            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-black text-text-primary">Smart Matches</h1>
                    <p className="text-xs text-text-muted">Ranked by location, preference, interactions, verification, and profile intent.</p>
                </div>
                <button onClick={() => window.location.reload()} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center" aria-label="Refresh"><RefreshCw size={18} /></button>
            </div>

            <StoriesStrip title="Match Stories" />
            <LiveNowStrip title="Matches Live Now" />
            <BoostedMembersStrip title="Boosted Matches" />

            <section className="grid grid-cols-3 gap-2">
                <Metric label="Suggested" value={recommendations.length} />
                <Metric label="Liked" value={likes.length} />
                <Metric label="Mutual" value={matches.length} />
            </section>

            {loading ? <div className="py-12 text-center text-primary font-black">Finding compatible users...</div> : recommendations.length === 0 ? (
                <div className="text-center py-16 space-y-3"><div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><HeartHandshake size={30} className="text-primary" /></div><h2 className="text-lg font-black text-text-primary">No matches yet</h2><p className="text-sm text-text-muted">Complete your profile and interact with members to improve recommendations.</p></div>
            ) : (
                <section className="space-y-3">
                    {recommendations.map((member, index) => (
                        <motion.article key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <div className="p-3 flex gap-3">
                                <Link href={memberPath(member)} className="w-20 h-24 rounded-2xl overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                                    <img src={getProfileImageSrc(member)} alt={member.name} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(event) => useProfileImageFallback(event, member.name, member.profileLabel, member.isSeedProfile)} />
                                </Link>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex items-center gap-1.5"><h2 className="font-black text-text-primary truncate">{member.name}</h2><VerifiedBadge verified={member.verified} size={16} /></div>
                                    <p className="text-xs text-text-muted truncate">{member.age ? `${member.age} - ` : ''}{member.location || 'Location hidden'}</p>
                                    <p className="text-xs font-bold text-text-primary truncate">{profileSummary(member)}</p>
                                    {(member.distanceText || profileDistanceText(user, member)) && <p className="text-xs font-bold text-primary truncate">{member.distanceText || profileDistanceText(user, member)}</p>}
                                    <p className="text-xs text-text-secondary line-clamp-2">{member.intentSummary || member.wants || member.bio || 'Compatible member suggestion.'}</p>
                                    <div className="flex flex-wrap gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary/10">{member.score}% fit</span>{member.isBoosted && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-secondary">Boosted</span>}<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-secondary bg-secondary/10">{member.reason}</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 border-t" style={{ borderColor: 'rgba(15,118,110,0.08)' }}>
                                <Link href={memberPath(member)} className="py-2 text-xs font-semibold text-primary flex items-center justify-center gap-1"><Eye size={14} /> View</Link>
                                <Link href={memberPath(member, '#message')} className="py-2 text-xs font-semibold text-sky-700 flex items-center justify-center gap-1"><MessageCircle size={14} /> Message</Link>
                                <Link href="/packages" className="py-2 text-xs font-semibold text-gold flex items-center justify-center gap-1"><BadgeCheck size={14} /> Pro</Link>
                            </div>
                        </motion.article>
                    ))}
                </section>
            )}
        </div>
    );
}

function Metric({ label, value }) {
    return <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><p className="text-lg font-black text-primary">{value}</p><p className="text-[10px] font-bold text-text-muted">{label}</p></div>;
}
