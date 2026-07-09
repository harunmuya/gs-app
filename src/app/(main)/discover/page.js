'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Eye, Heart, HeartHandshake, LocateFixed, MapPin, MessageCircle, Phone, Radio, RefreshCw, Sparkles, X } from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';
import BoostedMembersStrip from '@/components/BoostedMembersStrip';
import StoriesStrip from '@/components/StoriesStrip';
import { useAuth } from '@/contexts/AuthContext';
import { fallbackProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';
import { displayDistanceKm, distanceText as profileDistanceText } from '@/lib/geo';

const CACHE_KEY = 'gsk_app_discover_deck_v16';
const CURRENT_CARD_KEY = 'gsk_app_discover_current_card_v1';
const OLD_CACHE_KEYS = ['gscom_discover_deck_v3', 'gsk_app_discover_deck_v3', 'gsk_app_discover_deck_v4', 'gsk_app_discover_deck_v5', 'gsk_app_discover_deck_v6', 'gsk_app_discover_deck_v7', 'gsk_app_discover_deck_v8', 'gsk_app_discover_deck_v9', 'gsk_app_discover_deck_v10', 'gsk_app_discover_deck_v11', 'gsk_app_discover_deck_v12', 'gsk_app_discover_deck_v13', 'gsk_app_discover_deck_v14', 'gsk_app_discover_deck_v15'];
const CACHE_LIMIT = 80;
const DECK_PAGE_SIZE = 20;
const VALID_PROFILE_LABELS = new Set(['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy']);

function tier(user) {
    return String(user?.subscription_tier || user?.subscriptionTier || 'free').toLowerCase();
}

function packageAccess(user) {
    const current = tier(user);
    const active = current !== 'free' && !user?.package_locked;
    return {
        active,
        tier: current,
        canBrowseDetails: true,
        canRevealPhone: active && ['silver', 'gold', 'diamond'].includes(current),
        swipeLimit: !active || current === 'free' ? 10 : current === 'basic' ? 30 : 999999,
        likeLimit: !active || current === 'free' ? 5 : current === 'basic' ? 10 : current === 'silver' ? 50 : 999999,
        superLikeLimit: !active || current === 'free' ? 0 : current === 'basic' ? 5 : current === 'silver' ? 100 : 999999,
    };
}

function formatLabel(value) {
    if (value === 'sugar_mummy') return 'Sugar Mummy';
    if (value === 'sugar_daddy') return 'Sugar Daddy';
    if (value === 'mistress') return 'Mistress';
    if (value === 'toyboy') return 'Sugar Guy / Toyboy';
    return String(value || 'Member').split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function compactText(member) {
    return [member.intentSummary, member.wants, member.neededQualities, member.excerpt].filter(Boolean)[0] || member.bio || 'Looking for a genuine, respectful connection.';
}

function presenceTone(member) {
    if (member.isOnline) return 'bg-success';
    const seen = member.lastSeenAt ? Date.now() - new Date(member.lastSeenAt).getTime() : Infinity;
    if (seen < 24 * 60 * 60 * 1000) return 'bg-amber-400';
    return 'bg-gray-300';
}

function distanceKm(a, b) {
    if (!a || !b) return null;
    const lat1 = Number(a.latitude);
    const lon1 = Number(a.longitude);
    const lat2 = Number(b.latitude);
    const lon2 = Number(b.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const toRad = (value) => value * Math.PI / 180;
    const radius = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(radius * 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - s1 - s2)));
}

function locationLabelFromCoords(latitude, longitude) {
    const places = [
        { name: 'Nairobi', lat: -1.2921, lng: 36.8219, r: 0.3 },
        { name: 'Mombasa', lat: -4.0435, lng: 39.6682, r: 0.22 },
        { name: 'Kisumu', lat: -0.0917, lng: 34.7680, r: 0.18 },
        { name: 'Nakuru', lat: -0.3031, lng: 36.0800, r: 0.18 },
        { name: 'Eldoret', lat: 0.5143, lng: 35.2698, r: 0.18 },
        { name: 'Thika', lat: -1.0396, lng: 37.0900, r: 0.12 },
        { name: 'Kampala', lat: 0.3476, lng: 32.5825, r: 0.3 },
        { name: 'Dar es Salaam', lat: -6.7924, lng: 39.2083, r: 0.3 },
    ];
    const match = places.find((place) => Math.sqrt((latitude - place.lat) ** 2 + (longitude - place.lng) ** 2) < place.r);
    return match?.name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

function liveDuration(startedAt) {
    const started = startedAt ? new Date(startedAt).getTime() : 0;
    if (!started || Number.isNaN(started)) return '0:00';
    const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const mins = Math.floor(seconds / 60);
    return `${mins}:${String(seconds % 60).padStart(2, '0')}`;
}

function userProfileLabel(user) {
    const pref = String(user?.preference || '').toLowerCase();
    // Check prefix FIRST — 'sugar_mummy_looking_for_toyboy' starts with 'sugar_mummy', not 'toyboy'
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
    if (label === 'sugar_daddy') return new Set(['sugar_mummy', 'mistress']);
    if (label === 'mistress') return new Set(['sugar_daddy', 'toyboy']);
    return null;
}

function targetLabelArrayForUser(user) {
    const targets = targetLabelsForUser(user);
    return targets ? Array.from(targets) : [];
}

function preferenceMixForUser(user) {
    const label = userProfileLabel(user);
    // Toyboy: 80% Sugar Mummies, 20% Mistresses
    if (label === 'toyboy') return { primary: 'sugar_mummy', secondary: 'mistress', pattern: ['primary', 'primary', 'primary', 'primary', 'secondary'] };
    // Sugar Mummy: 80% Toyboys/SugarGuys, 20% Sugar Daddies
    if (label === 'sugar_mummy') return { primary: 'toyboy', secondary: 'sugar_daddy', pattern: ['primary', 'primary', 'primary', 'primary', 'secondary'] };
    // Sugar Daddy: 70% Mistresses, 30% Sugar Mummies
    if (label === 'sugar_daddy') return { primary: 'mistress', secondary: 'sugar_mummy', pattern: ['primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'secondary', 'secondary', 'secondary'] };
    // Mistress: 90% Sugar Daddies, 10% Toyboys/SugarGuys
    if (label === 'mistress') return { primary: 'sugar_daddy', secondary: 'toyboy', pattern: ['primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'secondary'] };
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
        } else if (secondaryIndex < secondary.length) {
            output.push(secondary[secondaryIndex++]);
        } else if (primaryIndex < primary.length) {
            output.push(primary[primaryIndex++]);
        }
        cycleIndex++;
    }
    return [...output, ...rest];
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

function memberPath(member, suffix = '') {
    if (member?.detailPath) return `${member.detailPath}${suffix}`;
    return member?.id ? `/members/${member.id}${suffix}` : '/members';
}

function normalizeMember(member) {
    const label = member.profileLabel || member.memberCategory || 'member';
    const source = member.source || (member.isSeedProfile ? 'seed' : 'member');
    const swipePrefix = source === 'member' ? 'member' : 'seed';
    return {
        ...member,
        id: member.id,
        source,
        swipeKey: `${swipePrefix}:${member.id}`,
        detailPath: member.detailPath || (member.id ? `/members/${member.id}` : '/members'),
        avatarUrl: member.avatarUrl || member.photos?.[0] || '',
        profileLabel: label,
        sortDate: member.createdAt || member.lastSeenAt || '',
        latitude: member.latitude || member.lat || null,
        longitude: member.longitude || member.lng || null,
    };
}

function compactCachedMember(member) {
    return {
        id: member.id,
        source: member.source,
        wpId: member.wpId,
        swipeKey: member.swipeKey,
        detailPath: member.detailPath,
        name: member.name,
        avatarUrl: member.avatarUrl,
        bio: member.bio,
        excerpt: member.excerpt,
        age: member.age,
        location: member.location,
        country: member.country,
        city: member.city,
        profileLabel: member.profileLabel,
        memberCategory: member.memberCategory,
        lookingFor: member.lookingFor,
        intentSummary: member.intentSummary,
        wants: member.wants,
        neededQualities: member.neededQualities,
        ageRangePreference: member.ageRangePreference,
        interests: Array.isArray(member.interests) ? member.interests.slice(0, 5) : [],
        verified: member.verified,
        phone: member.phone,
        phoneMasked: member.phoneMasked,
        phoneLocked: member.phoneLocked,
        createdAt: member.createdAt,
        sortDate: member.sortDate,
        lastSeenAt: member.lastSeenAt,
        latitude: member.latitude,
        longitude: member.longitude,
        randomRank: member.randomRank,
        isOnline: member.isOnline,
        isBoosted: member.isBoosted,
        boostExpiresAt: member.boostExpiresAt,
        boostScore: member.boostScore,
    };
}

function writeDeckCache(members, user) {
    if (typeof sessionStorage === 'undefined' || !members.length) return;
    try {
        const compactMembers = members.slice(0, CACHE_LIMIT).map(compactCachedMember);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ members: compactMembers, profileLabel: userProfileLabel(user), cachedAt: Date.now() }));
    } catch {
        try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    }
}

function profileFitsUser(member, user) {
    const targets = targetLabelsForUser(user);
    if (!targets) return true;
    const label = effectiveMemberLabel(member);
    if (!label || label === 'member') return false;
    return targets.has(label);
}

function matchScore(member, user) {
    let score = 54;
    const userLocation = String(user?.location || '').toLowerCase();
    const memberLocation = String(member.location || member.country || '').toLowerCase();
    if (userLocation && memberLocation && (memberLocation.includes(userLocation) || userLocation.includes(memberLocation))) score += 18;
    if (member.verified) score += 8;
    if (member.isBoosted) score += 22;
    if (member.intentSummary || member.wants || member.excerpt) score += 6;
    if (profileFitsUser(member, user)) score += 14;
    if (member.source === 'wp') score += 3;
    const seed = `${member.swipeKey}-${user?.email || ''}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    score += Math.abs(hash) % 9;
    return Math.max(50, Math.min(98, score));
}

export default function DiscoverPage() {
    const router = useRouter();
    const { user, guest, addLike, addSuperLike, addMatch, addPass, isProfileSwiped, clearSwipeHistory, addMessage, updateProfile, updateSettings } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState(null);
    const [notice, setNotice] = useState('');
    const [liveStreams, setLiveStreams] = useState([]);
    const [geo, setGeo] = useState(null);
    const [filter, setFilter] = useState('all');
    const [nextPage, setNextPage] = useState(1);
    const [hasMoreProfiles, setHasMoreProfiles] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dismissedSwipeKeys, setDismissedSwipeKeys] = useState(() => new Set());
    const [pinnedSwipeKey, setPinnedSwipeKey] = useState(() => {
        if (typeof sessionStorage === 'undefined') return '';
        try { return sessionStorage.getItem(CURRENT_CARD_KEY) || ''; } catch { return ''; }
    });
    const fetched = useRef(false);
    const swiping = useRef(false);
    const loadingPageRef = useRef(false);
    const access = packageAccess(user);
    const currentProfileLabel = userProfileLabel(user);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-14, 14]);
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    async function loadDeckPage(pageNumber = 1, { replace = false } = {}) {
        if (loadingPageRef.current) return;
        loadingPageRef.current = true;
        setLoadingMore(!replace);
        try {
            const labels = targetLabelArrayForUser(user);
            const requests = labels.length ? labels : ['all'];
            const payloads = await Promise.all(requests.map(async (label) => {
                const memberParams = new URLSearchParams({ per_page: String(DECK_PAGE_SIZE), page: String(pageNumber) });
                if (label !== 'all') memberParams.set('label', label);
                if (user?.id) memberParams.set('viewer_id', user.id);
                const res = await fetch(`/api/members?${memberParams.toString()}`, { cache: 'no-store' });
                return res.json().catch(() => ({}));
            }));
            const incoming = payloads.flatMap((payload) => payload.members || [])
                .filter((member) => String(member.id) !== String(user?.id || ''))
                .map(normalizeMember);
            setHasMoreProfiles(incoming.length >= DECK_PAGE_SIZE);
            setNextPage(pageNumber + 1);
            setMembers((currentMembers) => {
                const byKey = new Map();
                if (!replace) currentMembers.forEach((item) => item?.swipeKey && byKey.set(item.swipeKey, item));
                incoming.forEach((item) => {
                    if (item.swipeKey && !byKey.has(item.swipeKey)) {
                        let hash = 0;
                        const seed = `${item.swipeKey}-${user?.id || user?.email || 'guest'}`;
                        for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
                        byKey.set(item.swipeKey, { ...item, randomRank: Math.abs(hash % 10000) / 10000 });
                    }
                });
                return Array.from(byKey.values()).sort((a, b) => (a.randomRank || 0) - (b.randomRank || 0));
            });
            if (!incoming.length && pageNumber === 1) setNotice('Profiles are temporarily unavailable. Pulling fresh profiles again shortly.');
        } catch {
            setNotice('Profiles are temporarily unavailable.');
        } finally {
            loadingPageRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        try {
            OLD_CACHE_KEYS.forEach((key) => sessionStorage.removeItem(key));
            const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
            if (cached?.members?.length && cached.profileLabel === currentProfileLabel) {
                setMembers(cached.members);
                setNextPage(Math.floor(cached.members.length / DECK_PAGE_SIZE) + 1);
                setHasMoreProfiles(true);
                setLoading(false);
                fetched.current = true;
            } else {
                fetched.current = false;
            }
        } catch {}
    }, [currentProfileLabel]);

    useEffect(() => {
        writeDeckCache(members, user);
    }, [members, user]);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        setNextPage(1);
        setHasMoreProfiles(true);
        loadDeckPage(1, { replace: true });
    }, [access.canRevealPhone, user?.id, currentProfileLabel]);

    useEffect(() => {
        async function loadLiveStreams() {
            try {
                const res = await fetch('/api/live');
                const data = await res.json().catch(() => ({}));
                if (res.ok) setLiveStreams(data.streams || []);
            } catch {}
        }
        loadLiveStreams();
        const timer = window.setInterval(loadLiveStreams, 15000);
        return () => window.clearInterval(timer);
    }, []);

    async function requestNearby() {
        if (!user?.id) { router.push('/auth/login'); return; }
        if (!navigator.geolocation) {
            setNotice('Location is not supported on this device.');
            return;
        }
        if (navigator.permissions?.query) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                if (permission.state === 'denied') {
                    setNotice('Location is blocked for this browser. Open site settings, allow Location, then tap Use Location again.');
                    return;
                }
            } catch {}
        }
        setNotice('Requesting your device location...');
        navigator.geolocation.getCurrentPosition(async (position) => {
            const next = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                geo_updated_at: new Date().toISOString(),
            };
            const label = locationLabelFromCoords(next.latitude, next.longitude);
            setGeo(next);
            setFilter('nearby');
            updateProfile?.({
                ...next,
                location: user.location || label,
                city: user.city || label,
            });
            updateSettings?.({ locationEnabled: true, liveLocation: true });
            setNotice(`Nearby matching is on from this device: ${label}.`);
            try {
                const res = await fetch('/api/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, ...next }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) setNotice(data.error || 'Location was found but could not be saved. Try again.');
            } catch {}
        }, (error) => {
            if (error?.code === error.PERMISSION_DENIED) setNotice('Location permission was denied. Allow Location for this site in your browser settings, then tap Use Location again.');
            else if (error?.code === error.TIMEOUT) setNotice('Location timed out. Turn on GPS/location services and try again.');
            else setNotice('Could not read this device location. Check location services and try again.');
        }, { enableHighAccuracy: true, maximumAge: 5 * 60 * 1000, timeout: 15000 });
    }

    const available = useMemo(() => {
        const compatible = members
            .filter((member) => member.swipeKey !== `member:${user?.id}`)
            .filter((member) => profileFitsUser(member, user))
            .filter((member) => {
                if (filter === 'online') return member.isOnline || (member.lastSeenAt && Date.now() - new Date(member.lastSeenAt).getTime() < 5 * 60 * 1000);
                if (filter === 'nearby') {
                    const memberDistance = member.distanceKm ?? displayDistanceKm(geo || user, member);
                    if (memberDistance !== null) return memberDistance <= 100;
                    const userLocation = String(user?.location || '').toLowerCase();
                    const memberLocation = String(member.location || member.city || member.country || '').toLowerCase();
                    return Boolean(userLocation && memberLocation && (memberLocation.includes(userLocation) || userLocation.includes(memberLocation)));
                }
                return true;
            })
            .filter((member) => !dismissedSwipeKeys.has(member.swipeKey))
            .filter((member) => !isProfileSwiped(member.swipeKey));
        // Fallback: if no compatible profiles after all filters, relax non-gender filters but KEEP gender filtering
        const pool = compatible.length ? compatible : members
            .filter((member) => member.swipeKey !== `member:${user?.id}`)
            .filter((member) => profileFitsUser(member, user))
            .filter((member) => !dismissedSwipeKeys.has(member.swipeKey))
            .filter((member) => !isProfileSwiped(member.swipeKey));
        const sortedPool = pool
            .sort((a, b) => {
                if (pinnedSwipeKey) {
                    if (a.swipeKey === pinnedSwipeKey && b.swipeKey !== pinnedSwipeKey) return -1;
                    if (b.swipeKey === pinnedSwipeKey && a.swipeKey !== pinnedSwipeKey) return 1;
                }
                if (filter === 'nearby') {
                    const aDistance = a.distanceKm ?? displayDistanceKm(geo || user, a);
                    const bDistance = b.distanceKm ?? displayDistanceKm(geo || user, b);
                    if (aDistance !== null && bDistance !== null && aDistance !== bDistance) return aDistance - bDistance;
                }
                const scoreGap = matchScore(b, user) - matchScore(a, user);
                if (Math.abs(scoreGap) > 18) return scoreGap;
                return (a.randomRank || 0) - (b.randomRank || 0);
            });
        return weightedPreferenceDeck(sortedPool, user);
    }, [members, user, isProfileSwiped, filter, geo, pinnedSwipeKey, dismissedSwipeKeys]);

    const current = available[0];

    useEffect(() => {
        if (!current?.swipeKey || swiping.current) return;
        setPinnedSwipeKey(current.swipeKey);
        try { sessionStorage.setItem(CURRENT_CARD_KEY, current.swipeKey); } catch {}
    }, [current?.swipeKey]);

    useEffect(() => {
        if (loading || loadingMore || !hasMoreProfiles) return;
        if (available.length <= 4) loadDeckPage(nextPage);
    }, [available.length, hasMoreProfiles, loading, loadingMore, nextPage]);

    useEffect(() => {
        function onLocationUpdated(event) {
            const location = event.detail?.location;
            if (location?.latitude && location?.longitude) setGeo(location);
            setMembers([]);
            setDismissedSwipeKeys(new Set());
            sessionStorage.removeItem(CACHE_KEY);
            fetched.current = true;
            loadDeckPage(1, { replace: true });
        }
        window.addEventListener('gs-location-updated', onLocationUpdated);
        return () => window.removeEventListener('gs-location-updated', onLocationUpdated);
    }, [user?.id, currentProfileLabel]);

    function normalizedForAuth(member) {
        return {
            wpId: member.swipeKey,
            id: member.source === 'member' ? member.id : null,
            name: member.name,
            imageUrl: member.avatarUrl,
            location: member.location,
            age: member.age,
            excerpt: compactText(member),
            verified: member.verified,
            date: member.createdAt,
            score: matchScore(member, user),
            source: member.source,
        };
    }

    function finishSwipe() {
        window.setTimeout(() => {
            x.set(0);
            setDirection(null);
            swiping.current = false;
        }, 240);
    }

    function beginSwipe(nextDirection) {
        if (!current || swiping.current) return false;
        if (guest || !user) { router.push('/auth/login'); return false; }
        swiping.current = true;
        setPinnedSwipeKey('');
        try { sessionStorage.removeItem(CURRENT_CARD_KEY); } catch {}
        setNotice('');
        setDirection(nextDirection);
        return true;
    }

    function dismissSwipeKey(key) {
        if (!key) return;
        setDismissedSwipeKeys((items) => {
            const next = new Set(items);
            next.add(key);
            return next;
        });
    }

    function stopSwipeWithPackageNotice(result, fallback = 'Your daily quota has exhausted. Pay for a package to unlock unlimited access.') {
        setNotice(result?.error || fallback);
        x.set(0);
        swiping.current = false;
        setDirection(null);
        window.setTimeout(() => router.push(result?.redirectTo || '/packages'), 900);
    }

    async function handleLike() {
        const target = current;
        if (!beginSwipe('right')) return;
        const profile = normalizedForAuth(target);
        let result;
        try { result = await addLike(profile); } catch { result = { ok: false, error: 'Action failed. Choose a package or try again.', redirectTo: '/packages' }; }
        if (result && !result.ok) {
            stopSwipeWithPackageNotice(result);
            return;
        }
        dismissSwipeKey(target.swipeKey);
        const score = matchScore(target, user);
        if (score >= 93) addMatch(profile, score);
        addMessage?.({ type: 'like', sender: 'You', title: `You liked ${target.name}`, body: `${score}% compatibility. Keep interacting to turn this into a stronger match.`, memberId: target.id, senderImage: target.avatarUrl });
        finishSwipe();
    }

    async function handleSuperLike() {
        const target = current;
        if (!beginSwipe('right')) return;
        const profile = normalizedForAuth(target);
        let result;
        try { result = await addSuperLike(profile); } catch { result = { ok: false, error: 'Action failed. Choose a package or try again.', redirectTo: '/packages' }; }
        if (result && !result.ok) {
            stopSwipeWithPackageNotice(result);
            return;
        }
        dismissSwipeKey(target.swipeKey);
        const score = Math.min(99, matchScore(target, user) + 5);
        if (score >= 88) addMatch(profile, score);
        addMessage?.({ type: 'superlike', sender: 'You', title: `You super liked ${target.name}`, body: `${score}% compatibility. This profile was added to your priority interactions.`, memberId: target.id, senderImage: target.avatarUrl });
        finishSwipe();
    }

    async function handlePass() {
        const target = current;
        if (!beginSwipe('left')) return;
        let result;
        try { result = await addPass(target.swipeKey); } catch { result = { ok: false, error: 'Action failed. Choose a package or try again.', redirectTo: '/packages' }; }
        if (result && !result.ok) {
            stopSwipeWithPackageNotice(result);
            return;
        }
        dismissSwipeKey(target.swipeKey);
        finishSwipe();
    }

    async function handleView() {
        const target = current;
        if (!target) return;
        if (guest || !user) { router.push('/auth/login'); return; }
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'record_interaction', actorUserId: user.id, profileKey: target.swipeKey, kind: 'view', profileName: target.name, profileImage: target.avatarUrl, source: target.source }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setNotice(data.error || 'Your daily quota has exhausted. Pay for a package to unlock unlimited access.');
            window.setTimeout(() => router.push(data.redirectTo || '/packages'), 900);
            return;
        }
        router.push(target.detailPath);
    }

    async function handleMessage() {
        if (!current) return;
        if (guest || !user) { router.push('/auth/login'); return; }
        if (current.source === 'member' && current.id) {
            router.push(`/messages/${current.id}`);
            return;
        }
        if (current.source === 'wp') setNotice('This featured profile is view-only. Open a member account to start chat.');
        else setNotice('Open this profile first to choose the best action.');
        window.setTimeout(() => router.push(current.detailPath || '/members'), 900);
    }

    function handleRefresh() {
        clearSwipeHistory();
        setDismissedSwipeKeys(new Set());
        sessionStorage.removeItem(CACHE_KEY);
        setNotice('Swipe history cleared.');
        window.setTimeout(() => window.location.reload(), 250);
    }

    if (loading) return (
        <div className="px-4 py-4 pb-28 space-y-4">
            <div className="relative w-full max-w-sm mx-auto skeleton-card" style={{ aspectRatio: '3/4' }}>
                <div className="absolute inset-0 rounded-[22px] bg-surface skeleton-shimmer" />
                <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
                    <div className="h-7 w-48 rounded-xl bg-primary/10 skeleton-shimmer" />
                    <div className="flex gap-2">
                        <div className="h-5 w-24 rounded-full bg-primary/8 skeleton-shimmer" />
                        <div className="h-5 w-20 rounded-full bg-primary/8 skeleton-shimmer" />
                    </div>
                    <div className="h-4 w-36 rounded-lg bg-primary/6 skeleton-shimmer" />
                </div>
            </div>
            <div className="flex justify-center gap-4 max-w-sm mx-auto">
                {[1,2,3,4,5].map(i => <div key={i} className="w-14 h-14 rounded-full bg-surface skeleton-shimmer" />)}
            </div>
            <p className="text-center text-xs text-text-muted">Finding your matches…</p>
        </div>
    );

    if (!current) {
        if (hasMoreProfiles || loadingMore) {
            return <div className="px-4 py-12 text-center space-y-4"><div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><Sparkles size={30} className="text-primary" /></div><h2 className="text-xl font-black text-text-primary">Loading More Profiles</h2><p className="text-sm text-text-muted">Finding the next compatible members for your preference.</p><button onClick={() => loadDeckPage(nextPage)} className="mx-auto px-5 py-3 rounded-2xl font-black text-white gradient-primary flex items-center gap-2"><RefreshCw size={17} /> Load More</button></div>;
        }
        return <div className="px-4 py-12 text-center space-y-4"><div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><Sparkles size={30} className="text-primary" /></div><h2 className="text-xl font-black text-text-primary">Today&apos;s Profiles Reviewed</h2><p className="text-sm text-text-muted">You have reviewed this batch. Load a fresh set or adjust filters.</p><button onClick={handleRefresh} className="mx-auto px-5 py-3 rounded-2xl font-black text-white gradient-primary flex items-center gap-2"><RefreshCw size={17} /> Load Fresh Profiles</button></div>;
    }

    const score = matchScore(current, user);
    const currentDistanceText = current.distanceText || profileDistanceText(geo || user, current);

    return (
        <div className="px-4 py-4 pb-28 space-y-4">
            {notice && <div className="rounded-2xl p-3 text-xs font-bold text-primary bg-primary/10">{notice}</div>}
            <StoriesStrip title="Discover Stories" />
            {liveStreams.length > 0 && <section className="card-premium p-3">
                <div className="section-header">
                    <h2 className="section-title"><Radio size={15} className="text-danger" /> Featured Live Now</h2>
                    <Link href="/live" className="section-link">Open</Link>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {liveStreams.slice(0, 8).map((stream) => {
                        const host = stream.host || {};
                        const photo = host.avatar_url || host.photos?.[0] || '';
                        return <Link key={stream.id} href={`/live/${stream.id}`} className="min-w-[148px] rounded-2xl p-2 text-white transition-all active:scale-[0.97]" style={{ background: '#1a1625' }}>
                            <div className="relative h-24 rounded-xl overflow-hidden bg-primary/20">{photo ? <img src={photo} alt="" className="h-full w-full object-cover" onError={(event) => useProfileImageFallback(event, host.display_name || 'Live')} /> : <UserAvatar name={host.display_name || 'Live'} size={52} />}<span className="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[9px] font-black pulse-glow" style={{ background: '#DC2626' }}>LIVE</span></div>
                            <p className="mt-2 truncate text-[11px] font-black">{stream.title || 'GS Live'}</p>
                            <p className="text-[10px] text-white/60">{stream.viewer_count || 0} watching · {liveDuration(stream.started_at)}</p>
                        </Link>;
                    })}
                </div>
            </section>}
            <BoostedMembersStrip title="Boosted In Discover" />
            <section className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                    ['all', 'All', null],
                    ['online', 'Online', null],
                    ['nearby', 'Nearby', null],
                ].map(([id, label]) => (
                    <button key={id} onClick={() => id === 'nearby' && !geo ? requestNearby() : setFilter(id)} className={`filter-pill ${filter === id ? 'filter-pill--active' : 'filter-pill--inactive'}`}>
                        {label}
                    </button>
                ))}
                <button onClick={requestNearby} className="filter-pill filter-pill--inactive inline-flex items-center gap-1">
                    <LocateFixed size={13} /> Use Location
                </button>
            </section>
            <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '3/4' }}>
                <AnimatePresence mode="wait">
                    <motion.article key={current.swipeKey} className="absolute inset-0 rounded-[22px] overflow-hidden card-shadow bg-white touch-pan-y cursor-pointer" onTap={handleView} onDoubleClick={handleView} style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.32} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) < 140) { x.set(0); return; } if (info.offset.x > 0) handleLike(); else handlePass(); }} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ x: direction === 'right' ? 260 : direction === 'left' ? -260 : 0, opacity: 0, transition: { duration: 0.22 } }}>
                        <img src={current.avatarUrl || fallbackProfileImageSrc(current.name)} alt={current.name} className="absolute inset-0 w-full h-full object-cover" onError={(event) => useProfileImageFallback(event, current.name)} />
                        <div className="absolute inset-0 swipe-card-gradient" />
                        <motion.div className="absolute top-7 left-5 px-5 py-2.5 rounded-2xl border-[3px] border-success text-success font-black text-2xl -rotate-12" style={{ opacity: likeOpacity, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(5,150,105,0.3)' }}>LIKE ✓</motion.div>
                        <motion.div className="absolute top-7 right-5 px-5 py-2.5 rounded-2xl border-[3px] border-danger text-danger font-black text-2xl rotate-12" style={{ opacity: nopeOpacity, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(220,38,38,0.3)' }}>PASS ✗</motion.div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white space-y-2">
                            <div className="flex items-center gap-2"><h2 className="text-2xl font-black truncate">{current.name}</h2>{current.age && <span className="text-lg opacity-85">{current.age}</span>}<VerifiedBadge verified={current.verified} size={19} /></div>
                            <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`w-3 h-3 rounded-full ring-2 ring-white/70 ${presenceTone(current)}`} /><span className="px-2 py-1 rounded-full bg-white/18 font-bold">{formatLabel(current.profileLabel)}</span>{current.lookingFor && <span className="px-2 py-1 rounded-full bg-white/18 font-bold">Looking for {current.lookingFor}</span>}<span className="px-2 py-1 rounded-full bg-white/18 font-bold">{score}% match</span>{current.source === 'wp' && <span className="px-2 py-1 rounded-full bg-white/18 font-bold">Featured</span>}</div>
                            {current.location && <p className="flex items-center gap-1 text-xs opacity-90"><MapPin size={13} /> {current.location}</p>}
                            {currentDistanceText && <p className="flex items-center gap-1 text-xs opacity-90"><LocateFixed size={13} /> {currentDistanceText}</p>}
                            <p className="text-sm leading-snug line-clamp-2 opacity-95">{compactText(current)}</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                {current.ageRangePreference && <p><b>Age:</b> {current.ageRangePreference}</p>}
                                {current.neededQualities && <p className="truncate"><b>Qualities:</b> {current.neededQualities}</p>}
                                {current.interests?.[0] && <p className="truncate"><b>Interest:</b> {current.interests[0]}</p>}
                                <p className="flex items-center gap-1 truncate"><Phone size={11} /> <span className="font-bold tracking-wide">{access.canRevealPhone ? (current.phone || current.phoneMasked || 'Hidden') : (current.phoneMasked || 'Hidden')}</span></p>
                            </div>
                        </div>
                    </motion.article>
                </AnimatePresence>
            </div>

            <div className="flex items-end justify-center gap-3 max-w-sm mx-auto pb-2 pt-1">
                <button onClick={handlePass} className="action-circle" style={{ background: 'rgba(220,38,38,0.08)' }}>
                    <X size={22} className="text-danger" />
                    <span className="action-circle-label text-danger">Pass</span>
                </button>
                <button onClick={handleView} className="action-circle" style={{ background: 'rgba(155,44,94,0.08)' }}>
                    <Eye size={19} className="text-primary" />
                    <span className="action-circle-label text-primary">View</span>
                </button>
                <button onClick={handleSuperLike} className="action-circle" style={{ background: 'rgba(212,160,60,0.12)', width: 62, height: 62 }}>
                    <HeartHandshake size={24} className="text-secondary" />
                    <span className="action-circle-label text-secondary">Super</span>
                </button>
                <button onClick={handleMessage} className="action-circle" style={{ background: 'rgba(59,130,246,0.08)' }}>
                    <MessageCircle size={19} className="text-accent" />
                    <span className="action-circle-label text-accent">Chat</span>
                </button>
                <button onClick={handleLike} className="action-circle" style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 16px rgba(155,44,94,0.3)' }}>
                    <Heart size={24} fill="white" className="text-white" />
                    <span className="action-circle-label text-primary">Like</span>
                </button>
            </div>

            <div className="text-center text-xs text-text-muted">{available.length} compatible profiles ready{loadingMore ? ' · loading more...' : hasMoreProfiles ? ' · more loading as you swipe' : ''}</div>
        </div>
    );
}

