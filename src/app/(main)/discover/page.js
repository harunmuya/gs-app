'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Star, MapPin, MessageCircle, RefreshCw, Sparkles, Navigation, Database, SlidersHorizontal, ChevronDown, Flame, Zap, Award, Crown, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

// ---- Ultra-fast profile cache ----
const CACHE_KEY = 'gsm_profiles_v2';
const CACHE_TS = 'gsm_profiles_ts';
const TTL = 10 * 60 * 1000;

function getCache() {
    if (typeof window === 'undefined') return null;
    try {
        const ts = localStorage.getItem(CACHE_TS);
        if (ts && Date.now() - parseInt(ts) < TTL) {
            const d = localStorage.getItem(CACHE_KEY);
            return d ? JSON.parse(d) : null;
        }
    } catch { }
    return null;
}
function setCache(profiles) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(profiles));
        localStorage.setItem(CACHE_TS, String(Date.now()));
    } catch { }
}

// ---- Smart match scoring ----
function matchScore(p, coords, currentUser) {
    let s = 40;
    // Profile completeness
    if (p.imageUrl) s += 8;
    if (p.age) s += 5;
    if (p.location) s += 4;
    if (p.bio) s += 3;
    // Activity freshness
    if (p.daysSincePost < 3) s += 12;
    else if (p.daysSincePost < 7) s += 8;
    else if (p.daysSincePost < 14) s += 5;
    // Country match
    if (currentUser?.country && p.country && currentUser.country === p.country) s += 15;
    // Mutual interest match — profile type matches what user is looking for
    if (currentUser?.lookingFor && p.profileType === currentUser.lookingFor) s += 20;
    // Location proximity
    if (coords && p.coords) {
        const d = haversine(coords, p.coords);
        if (d < 10) s += 18; else if (d < 30) s += 12; else if (d < 50) s += 8; else if (d < 100) s += 4;
    }
    return Math.min(99, s);
}
function haversine(c1, c2) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (c2.latitude - c1.latitude) * toR;
    const dLon = (c2.longitude - c1.longitude) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.latitude * toR) * Math.cos(c2.latitude * toR) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}
function memberNumericId(id) {
    const value = String(id || '');
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return 900000000 + (Math.abs(hash) % 90000000);
}

function normalizeMemberForDiscover(member) {
    const profileType = member.profile_type || member.profile_label || member.member_category || (member.gender === 'male' ? 'sugar_daddy' : 'sugar_mummy');
    return {
        wpId: memberNumericId(member.id),
        memberId: member.id,
        source: 'member',
        detailHref: `/members/${member.id}`,
        name: member.display_name || member.name || 'Member',
        age: member.age || null,
        location: member.location || member.city || member.country || '',
        country: member.country || 'Kenya',
        bio: member.bio || member.description || '',
        excerpt: member.bio || member.description || '',
        imageUrl: member.avatar_url || member.avatarUrl || '',
        profileType,
        partnerType: member.looking_for || '',
        interests: Array.isArray(member.interests) ? member.interests : [],
        hobbies: Array.isArray(member.hobbies) ? member.hobbies : [],
        subscription: { plan: member.subscription_plan || member.subscription_tier || 'free' },
        verified: member.verification_status === 'verified' || member.verified,
        phoneMasked: member.phone_masked || '',
        date: member.created_at || new Date().toISOString(),
        daysSincePost: member.created_at ? Math.max(0, Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)) : 0,
        isMember: true,
    };
}

function stableProfileRank(item) {
    const value = String(item?.memberId || item?.wpId || item?.name || '');
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return Math.abs(hash);
}

function stableMixProfiles(items) {
    return [...items].sort((a, b) => stableProfileRank(a) - stableProfileRank(b));
}

function deterministicPhone(profile) {
    const seed = stableProfileRank(profile);
    const prefix = profile?.country === 'Uganda' ? '+256 7' : profile?.country === 'Tanzania' ? '+255 7' : '+254 7';
    const n = String(seed % 100000000).padStart(8, '0');
    return `${prefix}${n.slice(0, 1)}${n.slice(1, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)}`;
}

// Kenyan locations for filter
const KENYAN_LOCATIONS = [
    'All', 'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Ruiru', 'Kikuyu',
    'Thika', 'Naivasha', 'Kakamega', 'Kisii', 'Kitale', 'Athi River', 'Mlolongo',
    'Garissa', 'Malindi', 'Ngong', 'Rongai', 'Karen', 'Westlands', 'Kilimani',
    'Langata', 'South B', 'South C', 'Roysambu', 'Kasarani', 'Embakasi',
    'Juja', 'Kiambu', 'Nyeri', 'Machakos', 'Meru', 'Nanyuki', 'Diani',
    'Kilifi', 'Voi', 'Kericho', 'Homabay', 'Migori', 'Bomet', 'Webuye',
    'Wajir', 'Limuru', 'Lodwar', 'Mandera', 'Narok', 'Isiolo', 'Marsabit',
    'Lamu', 'Watamu', 'Bamburi', 'Nyali'
];

export default function DiscoverPage() {
    const { user, addLike, addMatch, addPass, isProfileSwiped, addSuperLike, clearSwipeHistory, blockedUsers, canUseFeature } = useAuth();
    const { location: userLocation, requestLocation } = useGeolocation();
    const router = useRouter();

    const [allProfiles, setAllProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [swipeDir, setSwipeDir] = useState(null);
    const [viewedAll, setViewedAll] = useState(false);
    const [dbTotal, setDbTotal] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const fetchingRef = useRef(false);

    // Filters
    const [filterLocation, setFilterLocation] = useState('All');
    const [filterAgeMin, setFilterAgeMin] = useState(18);
    const [filterAgeMax, setFilterAgeMax] = useState(70);

    // Touch swipe state
    const [touchStart, setTouchStart] = useState(null);
    const [touchDelta, setTouchDelta] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef(null);

    // Preload images
    const preloadedRef = useRef(new Set());
    const preloadImage = useCallback((url) => {
        if (!url || preloadedRef.current.has(url)) return;
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
    }, []);

    // FAST LOAD
    const loadProfiles = useCallback(async (forceRefresh = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            if (!forceRefresh) {
                const cached = getCache();
                if (cached && cached.length > 0) {
                    setAllProfiles(cached);
                    setDbTotal(cached.length);
                    setLoading(false);
                }
            }
            const res1 = await fetchWithTimeout('/api/profiles?page=1&per_page=50', 10000);
            if (!res1.ok) throw new Error('API failed');
            const data1 = await res1.json();
            const wpPage1 = data1.profiles || [];
            let memberProfiles = [];
            try {
                const membersRes = await fetchWithTimeout(`/api/members?userId=${user?.id || ''}`, 8000);
                if (membersRes.ok) {
                    const membersJson = await membersRes.json();
                    memberProfiles = (membersJson.members || [])
                        .filter((member) => (member.avatar_url || member.avatarUrl) && !member.is_banned)
                        .map(normalizeMemberForDiscover);
                }
            } catch (memberError) {
                console.warn('Member mix load failed:', memberError?.message || memberError);
            }
            const page1 = stableMixProfiles([...memberProfiles, ...wpPage1]);
            const totalPages = data1.totalPages || 1;
            const totalPosts = (data1.totalPosts || wpPage1.length) + memberProfiles.length;

            if (page1.length > 0) {
                setAllProfiles(page1);
                setDbTotal(totalPosts);
                setLoading(false);
                setCache(page1);
            }

            // Trickle load remaining pages sequentially in the background.
            // This prevents concurrent network congestion/timeouts and ensures page 1 loads instantly.
            if (totalPages > 1) {
                (async () => {
                    let currentProfiles = [...page1];
                    for (let p = 2; p <= totalPages; p++) {
                        // Delay 1.5s between page loads to keep network bandwidth fully free for image loads
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        try {
                            const res = await fetch(`/api/profiles?page=${p}&per_page=50`);
                            if (res.ok) {
                                const data = await res.json();
                                const pageProfiles = data.profiles || [];
                                if (pageProfiles.length > 0) {
                                    currentProfiles = [...currentProfiles, ...pageProfiles];
                                    
                                    // Keep unique
                                    const seen = new Set();
                                    const unique = currentProfiles.filter(item => {
                                        if (seen.has(item.wpId)) return false;
                                        seen.add(item.wpId);
                                        return true;
                                    });
                                    
                                    setAllProfiles(unique);
                                    setCache(unique);
                                }
                            }
                        } catch (e) {
                            console.warn(`Trickle prefetch failed for page ${p}:`, e);
                        }
                    }
                })();
            }
        } catch (err) {
            console.error('Profile load error:', err);
            if (allProfiles.length === 0) {
                const cached = getCache();
                if (cached && cached.length > 0) {
                    setAllProfiles(cached);
                    setDbTotal(cached.length);
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            fetchingRef.current = false;
        }
    }, [user?.id]);

    useEffect(() => { loadProfiles(); }, [loadProfiles]);

    // Filter + sort profiles
    const displayProfiles = useMemo(() => {
        let filtered = allProfiles.filter(p => !isProfileSwiped(p.wpId));

        // Block filter
        if (blockedUsers && blockedUsers.length > 0) {
            filtered = filtered.filter(p => !blockedUsers.includes(p.wpId));
        }

        // Exclude testimonial/review posts
        filtered = filtered.filter(p => !p.isTestimonial);

        // Strict Gender-based filter: show ONLY matching profileType (e.g. males looking for sugar mummies only see sugar mummies)
        if (user?.lookingFor) {
            filtered = filtered.filter(p => p.profileType === user.lookingFor);
        }

        // Location filter
        if (filterLocation !== 'All') {
            filtered = filtered.filter(p => p.location && p.location.toLowerCase().includes(filterLocation.toLowerCase()));
        }

        // Age filter
        filtered = filtered.filter(p => {
            if (!p.age) return true; // show profiles without age
            return p.age >= filterAgeMin && p.age <= filterAgeMax;
        });

        return filtered;
    }, [allProfiles, userLocation, isProfileSwiped, blockedUsers, filterLocation, filterAgeMin, filterAgeMax, user]);

    // Preload next 3 images
    useEffect(() => {
        displayProfiles.slice(0, 3).forEach(p => {
            if (p.imageUrl) preloadImage(p.imageUrl);
        });
    }, [displayProfiles, preloadImage]);

    // Do not auto-clear swipe history. Silent resets make the top card change without a user action.

    // Swipe handler
    const handleSwipe = useCallback((dir, profile) => {
        if (!profile) return;
        setSwipeDir(dir);
        if (dir === 'right') {
            addLike(profile).then(res => {
                if (res?.limitReached) {
                    router.push('/subscribe');
                } else {
                    const s = matchScore(profile, userLocation, user);
                    if (s >= 70) addMatch(profile, s);
                }
            });
        } else if (dir === 'up') {
            addSuperLike(profile).then(res => {
                if (res?.limitReached) {
                    router.push('/subscribe');
                } else {
                    addMatch(profile, Math.min(99, matchScore(profile, userLocation, user) + 10));
                }
            });
        } else {
            addPass(profile.wpId);
        }
        setTimeout(() => setSwipeDir(null), 300);
    }, [addLike, addMatch, addPass, addSuperLike, userLocation, user, router]);

    // Touch gesture handlers
    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!touchStart) return;
        const touch = e.touches[0];
        setTouchDelta({
            x: touch.clientX - touchStart.x,
            y: touch.clientY - touchStart.y,
        });
    };

    const handleTouchEnd = () => {
        if (!touchStart) return;
        const threshold = 80;
        const profile = displayProfiles[0];

        if (Math.abs(touchDelta.x) > threshold || Math.abs(touchDelta.y) > threshold) {
            if (touchDelta.y < -threshold && Math.abs(touchDelta.y) > Math.abs(touchDelta.x)) {
                handleSwipe('up', profile);
            } else if (touchDelta.x > threshold) {
                handleSwipe('right', profile);
            } else if (touchDelta.x < -threshold) {
                handleSwipe('left', profile);
            }
        }

        setTouchStart(null);
        setTouchDelta({ x: 0, y: 0 });
        setIsDragging(false);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        setViewedAll(false);
        clearSwipeHistory();
        loadProfiles(true);
    };

    const currentProfile = displayProfiles[0];
    const nextProfile = displayProfiles[1];

    // Generate blurred phone (stable per profile, before early returns to satisfy React hooks rules)
    const blurredPhoneRef = useRef('');
    if (currentProfile && (!blurredPhoneRef.current || blurredPhoneRef._lastId !== currentProfile.wpId)) {
        blurredPhoneRef.current = `+254 7${Math.floor(Math.random()*9)}${Math.floor(Math.random()*9)} ${Math.floor(Math.random()*9)}XX XXX`;
        blurredPhoneRef._lastId = currentProfile.wpId;
    }
    const blurredPhone = blurredPhoneRef.current;

    // LOADING
    if (loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <img
                    src="/gs.png"
                    alt="Loading"
                    className="w-16 h-16 object-contain animate-pulse-zoom"
                />
                <p className="text-sm text-text-muted">Loading profiles...</p>
            </div>
        );
    }

    // EMPTY
    if (!loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
                    <Database size={36} className="text-text-muted" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">No Profiles Available</h2>
                <p className="text-text-secondary text-sm">Check your internet connection and try again.</p>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Loading...' : 'Retry'}
                </button>
            </div>
        );
    }

    // If somehow still empty after reset, check if it's because of filters
    if (!currentProfile && allProfiles.length > 0) {
        const hasActiveFilter = filterLocation !== 'All' || filterAgeMin > 18 || filterAgeMax < 65;
        if (hasActiveFilter) {
            return (
                <div className="px-3 pt-1 pb-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Flame size={20} className="text-primary" />
                            <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${showFilters ? 'text-white bg-primary' : 'text-text-muted'}`}
                            style={!showFilters ? { background: 'var(--color-surface)' } : {}}>
                            <SlidersHorizontal size={10} /> Filter
                        </button>
                    </div>

                    {/* Show filter bar so user can change */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mb-3">
                                <div className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                                    <div>
                                        <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">Location</label>
                                        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-text-primary outline-none" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                                            <option value="All">All Locations</option>
                                            {[...new Set(allProfiles.map(p => p.location).filter(Boolean))].sort().map(loc => (
                                                <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                            <MapPin size={28} className="text-text-muted" />
                        </div>
                        <h2 className="text-lg font-bold text-text-primary">No profiles in this area</h2>
                        <p className="text-text-secondary text-sm">Try selecting a different location or adjusting your age filter.</p>
                        <button onClick={() => { setFilterLocation('All'); setFilterAgeMin(18); setFilterAgeMax(65); }}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                            <RefreshCw size={16} /> Clear Filters
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <img
                    src="/gs.png"
                    alt="Loading"
                    className="w-16 h-16 object-contain animate-pulse-zoom"
                />
                <p className="text-sm text-text-muted">Loading more profiles...</p>
            </div>
        );
    }

    const score = matchScore(currentProfile, userLocation, user);
    const isNearby = userLocation && currentProfile.coords && haversine(userLocation, currentProfile.coords) < 30;

    // Profile type helpers
    const PROFILE_LABELS = { sugar_mummy: 'Sugar Mummy', sugar_daddy: 'Sugar Daddy', toyboy: 'Toyboy', sugar_guy: 'Sugar Guy', young_lady: 'Young Lady', mistress: 'Mistress', cougar: 'Cougar' };
    const LABEL_GRADIENTS = { sugar_mummy: 'linear-gradient(135deg,#EC4899,#F43F5E)', sugar_daddy: 'linear-gradient(135deg,#3B82F6,#6366F1)', toyboy: 'linear-gradient(135deg,#F59E0B,#EF4444)', sugar_guy: 'linear-gradient(135deg,#10B981,#14B8A6)', young_lady: 'linear-gradient(135deg,#A855F7,#EC4899)', mistress: 'linear-gradient(135deg,#D946EF,#9333EA)', cougar: 'linear-gradient(135deg,#EF4444,#DC2626)' };
    const LOOKING_FOR_MAP = { sugar_mummy: 'Toyboy / Sugar Guy', sugar_daddy: 'Young Lady / Mistress', toyboy: 'Sugar Mummy', sugar_guy: 'Sugar Mummy', young_lady: 'Sugar Daddy', mistress: 'Sugar Daddy', cougar: 'Toyboy / Sugar Guy' };
    const COUNTRY_FLAGS = { Kenya: 'https://flagcdn.com/24x18/ke.png', Uganda: 'https://flagcdn.com/24x18/ug.png', Tanzania: 'https://flagcdn.com/24x18/tz.png', Zimbabwe: 'https://flagcdn.com/24x18/zw.png', Malawi: 'https://flagcdn.com/24x18/mw.png', Rwanda: 'https://flagcdn.com/24x18/rw.png', Burundi: 'https://flagcdn.com/24x18/bi.png', 'South Sudan': 'https://flagcdn.com/24x18/ss.png', Ethiopia: 'https://flagcdn.com/24x18/et.png', Nigeria: 'https://flagcdn.com/24x18/ng.png', Ghana: 'https://flagcdn.com/24x18/gh.png', 'South Africa': 'https://flagcdn.com/24x18/za.png' };

    const pType = currentProfile.profileType || (currentProfile.gender === 'male' ? 'sugar_daddy' : 'sugar_mummy');
    const pLabel = PROFILE_LABELS[pType] || 'Sugar Mummy';
    const pGrad = LABEL_GRADIENTS[pType] || LABEL_GRADIENTS.sugar_mummy;
    const pLooking = currentProfile.partnerType || LOOKING_FOR_MAP[pType] || 'Partner';

    // Calculate card transform from touch
    const dragX = isDragging ? touchDelta.x : 0;
    const dragY = isDragging ? Math.min(0, touchDelta.y) : 0;
    const dragRotate = isDragging ? touchDelta.x * 0.08 : 0;
    const showLikeIndicator = isDragging && touchDelta.x > 50;
    const showPassIndicator = isDragging && touchDelta.x < -50;
    const showSuperIndicator = isDragging && touchDelta.y < -50;

    return (
        <div className="px-3 pt-1 pb-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5A5F, #FF2D55)' }}>
                        <Flame size={16} className="text-white" />
                    </div>
                    <h1 className="text-lg font-extrabold text-text-primary">Discover</h1>
                    <span className="text-[10px] text-white/80 font-bold px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))', backdropFilter: 'blur(10px)' }}>
                        {displayProfiles.length} left
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                        style={showFilters ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' } : { background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                        <SlidersHorizontal size={10} /> Filters
                    </button>
                    {!userLocation && (
                        <button onClick={requestLocation} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                            <Navigation size={10} /> GPS
                        </button>
                    )}
                    <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-full transition-all" style={{ background: 'var(--color-surface)' }}>
                        <RefreshCw size={14} className={`text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div>
                                <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider block mb-1">Location</label>
                                <div className="relative">
                                    <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}
                                        className="w-full py-2 px-3 pr-8 rounded-xl text-xs font-medium text-text-primary appearance-none focus:outline-none" style={{ background: 'var(--color-surface)' }}>
                                        {KENYAN_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider block mb-1">Age Range: {filterAgeMin} – {filterAgeMax}</label>
                                <div className="flex gap-3 items-center">
                                    <input type="range" min={18} max={70} value={filterAgeMin} onChange={(e) => setFilterAgeMin(Math.min(Number(e.target.value), filterAgeMax - 1))} className="flex-1 accent-primary h-1" />
                                    <input type="range" min={18} max={70} value={filterAgeMax} onChange={(e) => setFilterAgeMax(Math.max(Number(e.target.value), filterAgeMin + 1))} className="flex-1 accent-primary h-1" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Card Stack */}
            <div className="relative w-full aspect-[3/4] max-h-[52vh] rounded-3xl overflow-hidden mb-2">
                {/* Next card preview */}
                {nextProfile && (
                    <div className="absolute inset-2 rounded-2xl overflow-hidden bg-surface" style={{ transform: 'scale(0.95)', opacity: 0.5 }}>
                        {nextProfile.imageUrl && <img src={nextProfile.imageUrl} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />}
                    </div>
                )}

                {/* Current Card */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={currentProfile.wpId}
                        ref={cardRef}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{
                            scale: 1, opacity: 1,
                            x: swipeDir === 'left' ? -400 : swipeDir === 'right' ? 400 : dragX,
                            y: swipeDir === 'up' ? -400 : dragY,
                            rotate: swipeDir === 'left' ? -20 : swipeDir === 'right' ? 20 : dragRotate,
                        }}
                        transition={isDragging ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-3xl overflow-hidden card-shadow touch-none"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <Link href={currentProfile.detailHref || `/discover/${currentProfile.wpId}`} className="block w-full h-full">
                            {currentProfile.imageUrl ? (
                                <img src={currentProfile.imageUrl} alt={currentProfile.name} loading="eager" draggable={false}
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { e.target.style.display = 'none'; }} referrerPolicy="no-referrer" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                    <UserAvatar name={currentProfile.name} size={120} />
                                </div>
                            )}

                            <div className="absolute inset-0 gradient-overlay" />

                            {/* Swipe indicators */}
                            {(swipeDir === 'right' || showLikeIndicator) && (
                                <div className="absolute top-8 left-6 px-5 py-2.5 rounded-2xl border-3 rotate-[-15deg] z-20" style={{ borderColor: '#10B981', background: 'rgba(16,185,129,0.25)', backdropFilter: 'blur(8px)' }}>
                                    <span style={{ color: '#10B981' }} className="text-2xl font-black">LIKE</span>
                                </div>
                            )}
                            {(swipeDir === 'left' || showPassIndicator) && (
                                <div className="absolute top-8 right-6 px-5 py-2.5 rounded-2xl border-3 rotate-[15deg] z-20" style={{ borderColor: '#EF4444', background: 'rgba(239,68,68,0.25)', backdropFilter: 'blur(8px)' }}>
                                    <span style={{ color: '#EF4444' }} className="text-2xl font-black">PASS</span>
                                </div>
                            )}
                            {(swipeDir === 'up' || showSuperIndicator) && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl border-3 z-20" style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.25)', backdropFilter: 'blur(8px)' }}>
                                    <span style={{ color: '#F59E0B' }} className="text-2xl font-black">SUPER</span>
                                </div>
                            )}

                            {/* Top badges */}
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                                <div className="flex items-center gap-1.5">
                                    {/* Profile type label — colorful gradient */}
                                    <span className="px-3 py-1.5 rounded-full text-[10px] font-black text-white tracking-wide shadow-lg"
                                        style={{ background: pGrad, boxShadow: `0 4px 15px ${pGrad.includes('#EC4899') ? 'rgba(236,72,153,0.4)' : 'rgba(99,102,241,0.4)'}` }}>
                                        {pLabel}
                                    </span>
                                    {isNearby && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold text-white" style={{ background: 'rgba(16,185,129,0.85)', backdropFilter: 'blur(8px)' }}>
                                            <Navigation size={8} /> Near
                                        </span>
                                    )}
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[10px] text-white font-bold" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {score}% Match
                                </span>
                            </div>

                            {/* Bottom Profile Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)' }}>
                                {/* Name + Age + Verified */}
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <h2 className="text-xl font-extrabold text-white">{currentProfile.name || 'Member'}</h2>
                                    {currentProfile.age && <span className="text-white/70 text-base font-medium">{currentProfile.age}</span>}
                                    <VerifiedBadge size={16} verified={true} />
                                    {currentProfile.subscription?.plan && currentProfile.subscription.plan !== 'free' && (
                                        <VerifiedBadge size={16} badgeText={currentProfile.subscription.plan} />
                                    )}
                                </div>

                                {/* Looking for */}
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Heart size={11} className="text-pink-400" />
                                    <span className="text-[11px] text-pink-300 font-semibold">Looking for {pLooking}</span>
                                </div>

                                {/* Location — always Kenya */}
                                {currentProfile.location && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <MapPin size={11} className="text-white/60" />
                                        <img src="https://flagcdn.com/24x18/ke.png" alt="KE" style={{ width: '14px', height: '10px', borderRadius: '1px' }} />
                                        <span className="text-xs text-white/70">{currentProfile.location}, Kenya</span>
                                    </div>
                                )}

                                {/* Interests / Hobbies tags */}
                                {currentProfile.interests && currentProfile.interests.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {(Array.isArray(currentProfile.interests) ? currentProfile.interests : []).slice(0, 4).map((t, i) => (
                                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white/90"
                                                style={{ background: ['rgba(236,72,153,0.25)','rgba(99,102,241,0.25)','rgba(16,185,129,0.25)','rgba(245,158,11,0.25)'][i%4], border: '1px solid rgba(255,255,255,0.1)' }}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* 📱 Phone Number */}
                                <button onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!canUseFeature('revealPhone')) router.push('/subscribe');
                                }}
                                    className="flex items-center gap-2 py-1.5 px-3 rounded-lg mt-1 transition-all active:scale-[0.98]"
                                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    <span className="text-[11px] text-amber-300 font-mono font-bold">
                                        {canUseFeature('revealPhone') ? deterministicPhone(currentProfile) : (currentProfile.phoneMasked || blurredPhone || "+2547*******")}
                                    </span>
                                    <span className="text-[8px] text-amber-400/60">{canUseFeature('revealPhone') ? 'Unlocked' : 'View number'}</span>
                                </button>
                            </div>
                        </Link>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Action Buttons — Premium styled */}
            <div className="flex items-center justify-center gap-4 py-2">
                {/* Pass */}
                <motion.button whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.05 }}
                    onClick={() => handleSwipe('left', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all"
                    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))', border: '2px solid rgba(239,68,68,0.3)', boxShadow: '0 4px 20px rgba(239,68,68,0.15)' }}>
                    <X size={26} className="text-red-400" />
                </motion.button>

                {/* Super Like */}
                <motion.button whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.1 }}
                    onClick={() => handleSwipe('up', currentProfile)}
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', boxShadow: '0 4px 25px rgba(245,158,11,0.4)' }}>
                    <Zap size={22} className="text-white" fill="white" />
                </motion.button>

                {/* Like */}
                <motion.button whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.05 }}
                    onClick={() => handleSwipe('right', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #EF4444)', boxShadow: '0 4px 25px rgba(236,72,153,0.4)' }}>
                    <Heart size={26} className="text-white" fill="white" />
                </motion.button>
            </div>

            {/* Swipe hint */}
            <p className="text-center text-[9px] text-text-muted mt-1 mb-1">
                ← Pass · ⭐ Super Like · ❤️ Like →
            </p>
        </div>
    );
}
