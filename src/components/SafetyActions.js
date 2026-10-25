'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, Check, Loader2, X } from '@/components/icons';
import { REPORT_REASONS } from '@/lib/blocks';

/**
 * Block and report, on a member's profile.
 *
 * Both were missing entirely: the only way to get away from somebody was to
 * message support on Telegram and wait for a person to act.
 *
 * They are shown as two plain actions rather than one combined "report and
 * block", because they answer different questions. Blocking is "I want this
 * person gone", which happens immediately and needs nobody's permission.
 * Reporting is "somebody should look at this", which does not require the
 * member to also hide the profile — though the form offers it, ticked, since
 * that is nearly always what someone reporting a scammer wants.
 *
 * Deliberately quiet styling. These sit at the bottom of a profile and should
 * be findable without being the loudest thing on a page about meeting someone.
 */
export default function SafetyActions({ memberId, memberName = 'this member', onBlocked }) {
    const [mode, setMode] = useState(null); // null | 'report' | 'confirmBlock'
    const [reason, setReason] = useState(REPORT_REASONS[0].id);
    const [detail, setDetail] = useState('');
    const [alsoBlock, setAlsoBlock] = useState(true);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState('');
    const [error, setError] = useState('');

    async function send(body) {
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/safety', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, targetId: memberId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'That did not go through.');
            return data;
        } finally {
            setBusy(false);
        }
    }

    async function block() {
        try {
            await send({ action: 'block' });
            setMode(null);
            setDone(`${memberName} is blocked. You will not see each other again.`);
            onBlocked?.();
        } catch (err) {
            setError(err.message);
        }
    }

    async function report() {
        try {
            const data = await send({ action: 'report', reason, detail, alsoBlock });
            setMode(null);
            setDone(data.blocked
                ? 'Report sent, and this member is blocked.'
                : 'Report sent. An administrator will review it.');
            if (data.blocked) onBlocked?.();
        } catch (err) {
            setError(err.message);
        }
    }

    if (done) {
        return (
            <p className="flex items-center gap-2 rounded-2xl p-3 type-caption text-text-secondary"
                style={{ background: 'var(--color-surface)' }}>
                <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                {done}
            </p>
        );
    }

    return (
        <section className="space-y-2">
            {error && (
                <p role="alert" className="type-caption text-danger">{error}</p>
            )}

            {mode === null && (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => { setError(''); setMode('confirmBlock'); }}
                        className="flex min-h-[44px] items-center gap-2 rounded-xl px-4 type-caption font-semibold text-text-secondary"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <Ban size={16} aria-hidden="true" /> Block
                    </button>
                    <button
                        type="button"
                        onClick={() => { setError(''); setMode('report'); }}
                        className="flex min-h-[44px] items-center gap-2 rounded-xl px-4 type-caption font-semibold text-text-secondary"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <AlertTriangle size={16} aria-hidden="true" /> Report
                    </button>
                </div>
            )}

            {mode === 'confirmBlock' && (
                <div className="space-y-3 rounded-2xl p-4" style={{ background: 'var(--color-surface)' }}>
                    <p className="type-caption text-text-secondary">
                        Block {memberName}? You will not see each other anywhere in the app,
                        and they are not told. You can undo this in Settings.
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button" onClick={block} disabled={busy}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 type-caption font-semibold text-white"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />}
                            Block
                        </button>
                        <button
                            type="button" onClick={() => setMode(null)} disabled={busy}
                            className="min-h-[44px] rounded-xl px-4 type-caption font-semibold text-text-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {mode === 'report' && (
                <div className="space-y-3 rounded-2xl p-4" style={{ background: 'var(--color-surface)' }}>
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="type-body-strong text-text-primary">Report {memberName}</h3>
                        <button type="button" onClick={() => setMode(null)} aria-label="Close report form">
                            <X size={18} className="text-text-muted" />
                        </button>
                    </div>

                    <label className="block space-y-1">
                        <span className="type-caption font-semibold text-text-secondary">What is wrong?</span>
                        <select
                            value={reason} onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-xl p-3 type-caption outline-none"
                            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                        >
                            {REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                    </label>

                    <label className="block space-y-1">
                        <span className="type-caption font-semibold text-text-secondary">Anything else? (optional)</span>
                        <textarea
                            value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={2000}
                            placeholder="What happened, and when."
                            className="w-full rounded-xl p-3 type-caption outline-none"
                            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                        />
                    </label>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
                        <span className="type-caption text-text-secondary">Also block them</span>
                    </label>

                    <button
                        type="button" onClick={report} disabled={busy}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 type-caption font-semibold text-white"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                        Send report
                    </button>
                </div>
            )}
        </section>
    );
}
