'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Star, MapPin, MessageCircle, RefreshCw, Sparkles, Navigation, Database, SlidersHorizontal, ChevronDown } from 'lucide-react';
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

// ---- Match scoring ----
function matchScore(p, coords) {
    let s = 50;
    if (p.daysSincePost < 3) s += 25;
    else if (p.daysSincePost < 7) s += 20;
    else if (p.daysSincePost < 14) s += 15;
    else if (p.daysSincePost < 30) s += 10;
    if (p.commentCount >= 10) s += 15;
    else if (p.commentCount >= 5) s += 10;
    else if (p.commentCount >= 1) s += 5;
    if (p.imageUrl) s += 5;
    if (p.age) s += 5;
    if (p.location) s += 3;
    if (p.bio) s += 2;
    if (coords && p.coords) {
        const d = haversine(coords, p.coords);
        if (d < 10) s += 20; else if (d < 30) s += 15; else if (d < 50) s += 10; else if (d < 100) s += 5;
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

// Kenyan locations for filter
const KENYAN_LOCATIONS = ['All', 'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Westlands', 'Kilimani', 'Karen', 'Langata', 'Ruiru', 'Malindi', 'Nyeri', 'Machakos', 'Meru'];

export default function DiscoverPage() {
    const { user, guest, addLike, addMatch, addPass, isProfileSwiped, addSuperLike, clearSwipeHistory, blockedUsers } = useAuth();
    const { location: userLocation, requestLocation } = useGeolocation();
    const router = useRouter();

    const [allProfiles, setAllProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [swipeDir, setSwipeDir] = useState(null);
    const [viewedAll, setViewedAll] = useState(false);
    const [dbTotal, setDbTotal] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showGuestModal, setShowGuestModal] = useState(false);
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
            const page1 = data1.profiles || [];
            const totalPages = data1.totalPages || 1;
            const totalPosts = data1.totalPosts || page1.length;

            if (page1.length > 0) {
                setAllProfiles(page1);
                setDbTotal(totalPosts);
                setLoading(false);
                setCache(page1);
            }

            if (totalPages > 1) {
                const promises = [];
                for (let p = 2; p <= totalPages; p++) {
                    promises.push(
                        fetchWithTimeout(`/api/profiles?page=${p}&per_page=50`, 12000)
                            .then(r => r.ok ? r.json() : { profiles: [] })
                            .then(d => d.profiles || [])
                            .catch(() => [])
                    );
                }
                const results = await Promise.all(promises);
                const moreProfiles = results.flat();
                if (moreProfiles.length > 0) {
                    const all = [...page1, ...moreProfiles];
                    const seen = new Set();
                    const unique = all.filter(p => {
                        if (seen.has(p.wpId)) return false;
                        seen.add(p.wpId);
                        return true;
                    });
                    setAllProfiles(unique);
                    setDbTotal(totalPosts);
                    setCache(unique);
                }
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
    }, []);

    useEffect(() => { loadProfiles(); }, [loadProfiles]);

    // Filter + sort profiles
    const displayProfiles = useMemo(() => {
        let filtered = allProfiles.filter(p => !isProfileSwiped(p.wpId));

        // Block filter
        if (blockedUsers && blockedUsers.length > 0) {
            filtered = filtered.filter(p => !blockedUsers.includes(p.wpId));
        }

        // Gender-based filter: show only matching profileType
        if (user?.lookingFor) {
            filtered = filtered.filter(p => p.profileType === user.lookingFor || !p.profileType);
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

        // Sort by match score
        if (userLocation && filtered.length > 0) {
            return [...filtered].sort((a, b) => matchScore(b, userLocation) - matchScore(a, userLocation));
        }
        return filtered;
    }, [allProfiles, userLocation, isProfileSwiped, blockedUsers, filterLocation, filterAgeMin, filterAgeMax]);

    // Preload next 3 images
    useEffect(() => {
        displayProfiles.slice(0, 3).forEach(p => {
            if (p.imageUrl) preloadImage(p.imageUrl);
        });
    }, [displayProfiles, preloadImage]);

    // Auto-loop: when all profiles are exhausted, clear swipe history to show them again
    useEffect(() => {
        if (allProfiles.length > 0 && displayProfiles.length === 0 && !loading) {
            // Silently clear passes so profiles reappear
            clearSwipeHistory();
            setViewedAll(false);
        }
    }, [displayProfiles.length, allProfiles.length, loading, clearSwipeHistory]);

    // Swipe handler
    const handleSwipe = useCallback((dir, profile) => {
        if (!profile) return;
        // Guest restriction: require sign-in to interact
        if (guest && !user) {
            setShowGuestModal(true);
            return;
        }
        setSwipeDir(dir);
        if (dir === 'right') {
            addLike(profile).then(res => {
                if (res?.limitReached) {
                    router.push('/subscribe');
                } else {
                    const s = matchScore(profile, userLocation);
                    if (s >= 70) addMatch(profile, s);
                }
            });
        } else if (dir === 'up') {
            addSuperLike(profile).then(res => {
                if (res?.limitReached) {
                    router.push('/subscribe');
                } else {
                    addMatch(profile, Math.min(99, matchScore(profile, userLocation) + 10));
                }
            });
        } else {
            addPass(profile.wpId);
        }
        setTimeout(() => setSwipeDir(null), 300);
    }, [addLike, addMatch, addPass, addSuperLike, userLocation, guest, user, router]);

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

    // If somehow still empty after reset, show a loading spinner briefly
    if (!currentProfile && allProfiles.length > 0) {
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

    const score = matchScore(currentProfile, userLocation);
    const isNearby = userLocation && currentProfile.coords && haversine(userLocation, currentProfile.coords) < 30;

    // Calculate card transform from touch
    const dragX = isDragging ? touchDelta.x : 0;
    const dragY = isDragging ? Math.min(0, touchDelta.y) : 0;
    const dragRotate = isDragging ? touchDelta.x * 0.08 : 0;
    const showLikeIndicator = isDragging && touchDelta.x > 50;
    const showPassIndicator = isDragging && touchDelta.x < -50;
    const showSuperIndicator = isDragging && touchDelta.y < -50;

    return (
        <div className="px-4 pt-2 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                    <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface)' }}>
                        {displayProfiles.length} left
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${showFilters ? 'text-white bg-primary' : 'text-text-muted'}`}
                        style={!showFilters ? { background: 'var(--color-surface)' } : {}}>
                        <SlidersHorizontal size={10} /> Filter
                    </button>
                    {!userLocation && (
                        <button onClick={requestLocation} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-white transition-colors" style={{ background: 'var(--color-primary)', opacity: 0.9 }}>
                            <Navigation size={10} /> Location
                        </button>
                    )}
                    <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-full transition-colors" style={{ background: 'var(--color-surface)' }}>
                        <RefreshCw size={16} className={`text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-3"
                    >
                        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            {/* Location */}
                            <div>
                                <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">Location</label>
                                <div className="relative">
                                    <select
                                        value={filterLocation}
                                        onChange={(e) => setFilterLocation(e.target.value)}
                                        className="w-full py-2 px-3 pr-8 rounded-xl text-xs font-medium text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        style={{ background: 'var(--color-surface)' }}
                                    >
                                        {KENYAN_LOCATIONS.map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                </div>
                            </div>
                            {/* Age */}
                            <div>
                                <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">Age Range: {filterAgeMin} – {filterAgeMax}</label>
                                <div className="flex gap-3 items-center">
                                    <input type="range" min={18} max={70} value={filterAgeMin} onChange={(e) => setFilterAgeMin(Math.min(Number(e.target.value), filterAgeMax - 1))}
                                        className="flex-1 accent-primary h-1" />
                                    <input type="range" min={18} max={70} value={filterAgeMax} onChange={(e) => setFilterAgeMax(Math.max(Number(e.target.value), filterAgeMin + 1))}
                                        className="flex-1 accent-primary h-1" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Card Stack */}
            <div className="relative w-full aspect-[3/4] max-h-[65vh] rounded-3xl overflow-hidden mb-4">
                {/* Next card preview */}
                {nextProfile && (
                    <div className="absolute inset-2 rounded-2xl overflow-hidden bg-surface" style={{ transform: 'scale(0.95)', opacity: 0.6 }}>
                        {nextProfile.imageUrl && <img src={nextProfile.imageUrl} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />}
                    </div>
                )}

                {/* Current Card — touchable swipe */}
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
                        <Link href={`/discover/${currentProfile.wpId}`} className="block w-full h-full">
                            {currentProfile.imageUrl ? (
                                <img
                                    src={currentProfile.imageUrl}
                                    alt={currentProfile.name}
                                    loading="eager"
                                    draggable={false}
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                    <UserAvatar name={currentProfile.name} size={120} />
                                </div>
                            )}

                            <div className="absolute inset-0 gradient-overlay" />

                            {/* Swipe indicators */}
                            {(swipeDir === 'right' || showLikeIndicator) && (
                                <div className="absolute top-8 left-6 px-4 py-2 rounded-xl border-3 border-success rotate-[-15deg] z-20 bg-success/20">
                                    <span className="text-success text-2xl font-black">LIKE</span>
                                </div>
                            )}
                            {(swipeDir === 'left' || showPassIndicator) && (
                                <div className="absolute top-8 right-6 px-4 py-2 rounded-xl border-3 border-danger rotate-[15deg] z-20 bg-danger/20">
                                    <span className="text-danger text-2xl font-black">PASS</span>
                                </div>
                            )}
                            {(swipeDir === 'up' || showSuperIndicator) && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border-3 border-gold z-20 bg-gold/20">
                                    <span className="text-gold text-2xl font-black">SUPER</span>
                                </div>
                            )}

                            {/* Badges */}
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                                <div className="flex items-center gap-1.5">
                                    {isNearby && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/90 text-white text-[10px] font-bold">
                                            <Navigation size={9} /> Near You
                                        </span>
                                    )}
                                    {currentProfile.daysSincePost < 3 && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/90 text-white text-[10px] font-bold">
                                            <Sparkles size={9} /> New
                                        </span>
                                    )}
                                    {currentProfile.daysSincePost >= 3 && currentProfile.daysSincePost < 14 && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gold/90 text-white text-[10px] font-bold">
                                            <Star size={9} /> Featured
                                        </span>
                                    )}
                                </div>
                                <span className="px-2 py-1 rounded-full glass text-[10px] text-white font-bold">
                                    {score}% Match
                                </span>
                            </div>

                            {/* Bottom info */}
                            <div className="absolute bottom-0 left-0 right-0 p-5 profile-overlay-text">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: currentProfile.profileType === 'sugar_daddy' ? 'rgba(59,130,246,0.85)' : 'rgba(236,72,153,0.85)' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                        {currentProfile.profileType === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mummy'}
                                    </span>
                                    {currentProfile.isTestimonial && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-amber-500/85">
                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            Review
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-0.5 flex-wrap">
                                    {currentProfile.name || 'Sugar Mummy'}
                                    {currentProfile.age && <span className="text-white/70 text-lg font-normal">{currentProfile.age}</span>}
                                    <VerifiedBadge size={18} verified={true} />
                                    {currentProfile.subscription?.plan && currentProfile.subscription.plan !== 'free' && (
                                        <VerifiedBadge size={18} badgeText={currentProfile.subscription.plan} />
                                    )}
                                    {(() => {
                                        const badgeVal = (currentProfile.customBadge || currentProfile.custom_badge || '').trim();
                                        if (badgeVal && badgeVal.toLowerCase() !== 'verified' && badgeVal.toLowerCase() !== currentProfile.subscription?.plan?.toLowerCase()) {
                                            return <VerifiedBadge size={18} badgeText={badgeVal} />;
                                        }
                                        return null;
                                    })()}
                                </h2>
                                {currentProfile.location && (
                                    <div className="flex items-center gap-1 text-white/80 mb-1.5">
                                        <MapPin size={13} />
                                        <span className="text-sm">{currentProfile.location}</span>
                                    </div>
                                )}
                                {currentProfile.excerpt && (
                                    <p className="text-xs text-white/70 line-clamp-2">{currentProfile.excerpt}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                    {currentProfile.commentCount > 0 && (
                                        <span className="flex items-center gap-1 text-white/60 text-xs">
                                            <MessageCircle size={12} /> {currentProfile.commentCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Swipe hint */}
            <p className="text-center text-[10px] text-text-muted mb-3">
                ← Swipe left to pass · Swipe right to like → · ↑ Super like
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('left', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <X size={28} className="text-text-muted" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('up', currentProfile)}
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-gold text-white">
                    <Star size={24} fill="white" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('right', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg gradient-primary text-white">
                    <Heart size={28} fill="white" />
                </motion.button>
            </div>

            {/* Count */}
            <p className="text-center text-[10px] text-text-muted mt-3">
                {displayProfiles.length} of {allProfiles.length} profiles remaining
            </p>

            {/* Guest Sign-Up Modal */}
            <AnimatePresence>
                {showGuestModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
                        onClick={() => setShowGuestModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                                <Heart size={28} className="text-white" fill="white" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary mb-2">Create a Free Account</h3>
                            <p className="text-sm text-text-secondary mb-5">Sign up to like, match, and connect with profiles. It only takes 30 seconds!</p>
                            <button
                                onClick={() => router.push('/auth/login')}
                                className="w-full py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] text-sm mb-3"
                            >
                                Create Free Account
                            </button>
                            <button
                                onClick={() => setShowGuestModal(false)}
                                className="text-xs text-text-muted hover:text-text-primary"
                            >
                                Continue Browsing
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
