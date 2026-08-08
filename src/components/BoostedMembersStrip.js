'use client';

import { POLL } from '@/lib/usePolling';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket } from '@/components/icons';
import VerifiedBadge from '@/components/VerifiedBadge';
import { getProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';
import { useAuth } from '@/contexts/AuthContext';

function memberPath(member) {
    if (member?.detailPath) return member.detailPath;
    return member?.id ? '/members/' + member.id : '/members';
}

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
    const label = member?.profileLabel || member?.memberCategory || '';
    const lookingFor = member?.lookingFor || defaultLookingFor(label);
    return `${formatProfileLabel(label)}${lookingFor ? ` - Looking for ${lookingFor}` : ''}`;
}

export default function BoostedMembersStrip({ title = 'Boosted Members', limit = 8 }) {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);

    useEffect(() => {
        let alive = true;
        async function loadBoosted() {
            try {
                const query = new URLSearchParams({ boosted: '1', per_page: String(limit) });
                if (user?.id) query.set('viewer_id', user.id);
                const res = await fetch(`/api/members?${query.toString()}`);
                const data = await res.json().catch(() => ({}));
                if (alive && res.ok) setMembers((data.members || []).filter((member) => String(member.id) !== String(user?.id || '')));
            } catch {}
        }
        loadBoosted();
        const timer = window.setInterval(loadBoosted, POLL.boosted);
        return () => { alive = false; window.clearInterval(timer); };
    }, [limit, user?.id]);

    if (!members.length) return null;

    return (
        <section className="card-premium p-3">
            <div className="section-header">
                <h2 className="section-title"><Rocket size={15} className="text-secondary" /> {title}</h2>
                <Link href="/members" className="section-link">See all</Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {members.slice(0, limit).map((member) => (
                    <Link key={member.id} href={memberPath(member)} className="min-w-[136px] space-y-1.5 rounded-2xl p-2 transition-all active:scale-[0.97]" style={{ background: 'var(--color-surface)' }}>
                        <div className="relative h-32 overflow-hidden rounded-xl bg-primary/10">
                            <img
                                src={getProfileImageSrc(member)}
                                alt=""
                                className="h-full w-full object-cover"
                                style={{ opacity: 1 }}
                                loading="lazy"
                                decoding="async"
                                onError={(event) => useProfileImageFallback(event, member.name, member.profileLabel, member.isSeedProfile)}
                            />
                            <span className="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[9px] font-semibold text-white gradient-primary" style={{ boxShadow: '0 2px 8px rgba(155,44,94,0.3)' }}>BOOST</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1">
                            <p className="truncate text-xs font-semibold text-text-primary">{member.name}</p>
                            <VerifiedBadge verified={member.verified} size={12} />
                        </div>
                        <p className="truncate text-[10px] text-text-muted">{profileSummary(member)}</p>
                        <p className="truncate text-[10px] text-primary font-bold">{member.location || 'Featured now'}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
