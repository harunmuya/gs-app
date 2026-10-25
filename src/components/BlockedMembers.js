'use client';

import { useEffect, useState } from 'react';
import { Ban, Loader2 } from '@/components/icons';

/**
 * The blocked list, in Settings.
 *
 * Blocking tells the member they can undo it here, so here has to exist. A
 * block that cannot be found again is not reversible in any way the member can
 * act on, and they would have to ask support to undo their own decision.
 *
 * Loaded when the panel opens rather than with the profile, because most
 * members never block anyone and the list is usually empty.
 */
export default function BlockedMembers() {
    const [state, setState] = useState({ status: 'loading', blocks: [], error: '' });
    const [working, setWorking] = useState('');

    async function load() {
        try {
            const res = await fetch('/api/safety', { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not load your blocked list.');
            setState({ status: 'ready', blocks: data.blocks || [], error: '' });
        } catch (err) {
            setState({ status: 'error', blocks: [], error: err.message });
        }
    }

    useEffect(() => { load(); }, []);

    async function unblock(memberId) {
        setWorking(memberId);
        try {
            const res = await fetch('/api/safety', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unblock', targetId: memberId }),
            });
            if (!res.ok) throw new Error('Could not unblock.');
            // Drop it locally rather than refetching: the row is gone either way
            // and a reload would flash the whole list.
            setState((s) => ({ ...s, blocks: s.blocks.filter((b) => b.memberId !== memberId) }));
        } catch (err) {
            setState((s) => ({ ...s, error: err.message }));
        } finally {
            setWorking('');
        }
    }

    if (state.status === 'loading') {
        return (
            <p className="flex items-center gap-2 type-caption text-text-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading blocked members…
            </p>
        );
    }

    if (state.status === 'error') {
        return <p className="type-caption text-danger">{state.error}</p>;
    }

    if (!state.blocks.length) {
        return <p className="type-caption text-text-muted">You have not blocked anyone.</p>;
    }

    return (
        <ul className="space-y-2">
            {state.error && <li className="type-caption text-danger">{state.error}</li>}
            {state.blocks.map((block) => (
                <li key={block.memberId} className="flex items-center gap-3">
                    <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        {block.avatarUrl
                            ? <img src={block.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                            : <Ban size={14} className="text-text-muted" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate type-caption text-text-primary">{block.name}</span>
                    <button
                        type="button"
                        onClick={() => unblock(block.memberId)}
                        disabled={working === block.memberId}
                        className="min-h-[38px] shrink-0 rounded-xl px-3 type-caption font-semibold text-primary"
                        style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                    >
                        {working === block.memberId ? 'Unblocking…' : 'Unblock'}
                    </button>
                </li>
            ))}
        </ul>
    );
}
