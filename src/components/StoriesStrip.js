'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Heart, Loader2, Lock, Plus, X } from '@/components/icons';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/lib/useEntitlements';
import { POLL } from '@/lib/usePolling';

/** Must match STORY_MEDIA_LIMIT_BYTES in api/activity — the server is the real gate. */
const STORY_MEDIA_LIMIT_BYTES = 8 * 1024 * 1024;

function timeLeft(expiresAt) {
    const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.ceil(diff / 3600000);
    return hours <= 1 ? '<1h' : `${hours}h`;
}

function storyPhoto(story) {
    return story.user?.avatar_url || story.user?.photos?.[0] || story.media_url || '';
}

export default function StoriesStrip({ title = 'Stories' }) {
    const { user } = useAuth();
    // Posting a story is Silver and Gold only. api/activity gates it on the
    // effective tier (canUseActivity), not on a feature flag, so this mirrors
    // that check rather than borrowing a flag that merely happens to agree.
    // Anyone may read the strip; only the composer is gated.
    const { tierId, loading: entitlementsLoading } = useEntitlements(user?.id);
    const canPost = tierId === 'silver' || tierId === 'gold';
    const [stories, setStories] = useState([]);
    const [activeStory, setActiveStory] = useState(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');
    const fileRef = useRef(null);

    async function loadStories() {
        try {
            const res = await fetch(`/api/activity?type=stories&userId=${encodeURIComponent(user?.id || '')}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok) setStories(data.stories || []);
        } catch {}
    }

    useEffect(() => {
        loadStories();
        const timer = window.setInterval(loadStories, POLL.stories);
        return () => window.clearInterval(timer);
    }, [user?.id]);

    async function createStory(file) {
        if (!user?.id) {
            setStatus('Sign in to create a story.');
            return;
        }
        // Check the size before reading the file. Base64 inflates it by about a
        // third, so a 10MB clip becomes a 13MB request body that the server will
        // reject anyway — after the member has waited through the encode and the
        // upload. Catching it here costs nothing and explains itself.
        if (file && file.size > STORY_MEDIA_LIMIT_BYTES) {
            setStatus(`That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Stories are limited to 8MB — try a shorter video or a smaller photo.`);
            return;
        }

        setUploading(true);
        setStatus('');
        try {
            let mediaUrl = '';
            let mediaType = 'text';
            if (file) {
                mediaType = file.type.startsWith('video/') ? 'video' : 'image';
                mediaUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.onerror = () => reject(new Error('That file could not be read. Try a different photo or video.'));
                    reader.readAsDataURL(file);
                });
            }
            const res = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_story', userId: user.id, mediaUrl, mediaType, caption }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Story failed.');
            setCaption('');
            await loadStories();
        } catch (error) {
            setStatus(error.message || 'Story failed.');
        } finally {
            setUploading(false);
        }
    }

    async function openStory(story) {
        setActiveStory(story);
        if (!user?.id || story.viewedByMe || story.user_id === user.id) return;
        try {
            const res = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'view_story', userId: user.id, storyId: story.id }),
            });
            if (res.ok) {
                const nextStory = { ...story, viewedByMe: true, viewCount: Number(story.viewCount || 0) + 1 };
                setActiveStory(nextStory);
                setStories((items) => items.map((item) => item.id === story.id ? nextStory : item));
            }
            await loadStories();
        } catch {}
    }

    async function toggleLike(story) {
        if (!user?.id) return;
        try {
            const res = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'like_story', userId: user.id, storyId: story.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const liked = data.liked !== false;
                const nextStory = {
                    ...story,
                    likedByMe: liked,
                    likeCount: Math.max(0, Number(story.likeCount || 0) + (liked ? 1 : -1)),
                };
                setActiveStory(nextStory);
                setStories((items) => items.map((item) => item.id === story.id ? nextStory : item));
                await loadStories();
            }
        } catch {}
    }

    const mine = stories.filter((story) => story.user_id === user?.id);
    const visible = [...mine, ...stories.filter((story) => story.user_id !== user?.id)];

    return (
        <section className="rounded-2xl p-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1 text-sm font-bold text-text-primary"><Camera size={15} className="text-primary" /> {title}</h2>
                {uploading && <Loader2 size={14} className="animate-spin text-primary" />}
            </div>
            {canPost ? (
                <div className="mb-2 flex gap-2">
                    <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Story caption" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--color-surface)' }} />
                    <button type="button" onClick={() => createStory(null)} className="h-11 rounded-xl bg-primary/10 px-3 text-xs font-semibold text-primary">Text</button>
                    <button type="button" onClick={() => fileRef.current?.click()} className="h-11 rounded-xl bg-primary px-3 text-xs font-semibold text-white inline-flex items-center gap-1"><Plus size={14} /> Story</button>
                    <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { createStory(event.target.files?.[0] || null); event.target.value = ''; }} />
                </div>
            ) : !entitlementsLoading && user?.id ? (
                <Link href="/packages" className="mb-2 flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--color-surface)' }}>
                    <Lock size={14} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 type-caption text-text-secondary">Posting a 24-hour story is included with Silver and Gold.</span>
                    <span className="shrink-0 type-micro font-bold text-primary">Upgrade</span>
                </Link>
            ) : null}
            {status && <p className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{status}</p>}
            {visible.length === 0 ? (
                <p className="text-xs text-text-muted">No active stories yet. Add a 24-hour update to appear here.</p>
            ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {visible.map((story) => (
                        <button key={story.id} type="button" onClick={() => openStory(story)} className="w-20 shrink-0 space-y-1 text-center">
                            <div className="relative mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                                <div className="h-full w-full overflow-hidden rounded-full bg-white">
                                    {storyPhoto(story) ? <img src={storyPhoto(story)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <UserAvatar name={story.user?.display_name || 'Story'} size={62} />}
                                </div>
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold text-white">{timeLeft(story.expires_at)}</span>
                            </div>
                            <p className="truncate text-[10px] font-semibold text-text-secondary">{story.user_id === user?.id ? 'Your story' : story.user?.display_name || 'Member'}</p>
                        </button>
                    ))}
                </div>
            )}

            {activeStory && (
                <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-center justify-center">
                    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gray-950 text-white">
                        <button onClick={() => setActiveStory(null)} className="absolute right-3 top-3 z-10 h-11 w-11 rounded-full bg-black/50 flex items-center justify-center" aria-label="Close story"><X size={18} /></button>
                        <div className="min-h-[460px] flex flex-col">
                            <div className="flex items-center gap-2 p-3">
                                <UserAvatar name={activeStory.user?.display_name || 'Member'} src={storyPhoto(activeStory)} size={38} />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold">{activeStory.user?.display_name || 'Member'}</p>
                                    <p className="text-[10px] text-white/60">{timeLeft(activeStory.expires_at)} left</p>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center bg-black">
                                {activeStory.media_type === 'video'
                                    ? <video src={activeStory.media_url} controls autoPlay className="max-h-[520px] w-full object-contain" />
                                    : activeStory.media_url
                                        ? <img src={activeStory.media_url} alt="" className="max-h-[520px] w-full object-contain"  loading="lazy" decoding="async" />
                                        : <p className="px-6 text-center text-xl font-black">{activeStory.caption}</p>}
                            </div>
                            {activeStory.caption && activeStory.media_url && <p className="p-3 text-sm font-bold">{activeStory.caption}</p>}
                            <div className="flex items-center justify-between gap-2 p-3">
                                <button onClick={() => toggleLike(activeStory)} className={`rounded-2xl px-4 py-2 text-xs font-semibold inline-flex items-center gap-1 ${activeStory.likedByMe ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'}`}><Heart size={14} /> {activeStory.likeCount || 0}</button>
                                <span className="text-xs font-bold text-white/70">{activeStory.viewCount || 0} views</span>
                            </div>
                            {activeStory.user_id === user?.id && (
                                <div className="max-h-32 overflow-auto border-t border-white/10 p-3 text-xs">
                                    <p className="mb-2 font-black">Viewed by</p>
                                    {(activeStory.viewers || []).length === 0 ? <p className="text-white/60">No views yet.</p> : activeStory.viewers.map((row) => <p key={row.id || row.viewer_id} className="py-1 text-white/75">{row.viewer?.display_name || 'Member'} {row.viewer?.username ? `@${row.viewer.username}` : ''}</p>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
