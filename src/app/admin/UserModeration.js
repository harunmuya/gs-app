'use client';

import { useState } from 'react';
import {
    Ban, BadgeCheck, Check, Eye, Lock, ShieldCheck, Trash2, UserCog, X,
} from '@/components/icons';

/**
 * Moderation controls for one account.
 *
 * The API implements eleven actions the panel never exposed: approve_user,
 * approve_profile, ban_user, unban_user, suspend_user, hide_user, show_user,
 * lock_package, unlock_package, restore_user and revoke_verification. All of
 * them worked; none had a button. An administrator could see that an account
 * needed banning and had no way to do it from the panel.
 *
 * Actions are grouped by what they do rather than listed flat, and each one
 * states its current state so the button says what will happen rather than what
 * is true — "Ban" versus "Unban", not a toggle whose meaning you have to infer.
 *
 * Destructive actions confirm first. Deleting an account is not recoverable and
 * sits apart from the reversible ones for that reason.
 */

function ActionButton({ icon: Icon, label, onClick, tone = 'neutral', busy, title }) {
    const tones = {
        neutral: { background: 'var(--color-surface)', color: 'var(--color-text-secondary)' },
        positive: { background: 'color-mix(in srgb, var(--color-success-text) 12%, transparent)', color: 'var(--color-success-text)' },
        warning: { background: 'color-mix(in srgb, var(--accent-gift) 14%, transparent)', color: 'var(--accent-gift)' },
        danger: { background: 'color-mix(in srgb, var(--color-danger-text) 12%, transparent)', color: 'var(--color-danger-text)' },
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            title={title || label}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
            style={tones[tone]}
        >
            <Icon size={13} /> {label}
        </button>
    );
}

export default function UserModeration({ user, onAction, busy }) {
    const [confirming, setConfirming] = useState(null);

    const banned = Boolean(user.is_banned);
    const suspended = Boolean(user.is_suspended);
    const hidden = user.show_in_public === false;
    const locked = Boolean(user.package_locked);
    const approved = user.admin_approved !== false;
    const verified = Boolean(user.verified);
    const deleted = Boolean(user.account_deleted_at);

    // Confirmation is a second click on the same control rather than a modal:
    // it keeps the decision next to the row it applies to.
    const confirm = (key, run) => {
        if (confirming === key) { setConfirming(null); run(); return; }
        setConfirming(key);
        setTimeout(() => setConfirming((c) => (c === key ? null : c)), 4000);
    };

    return (
        <div className="space-y-2.5 border-t pt-2.5" style={{ borderColor: 'color-mix(in srgb, var(--color-text-muted) 20%, transparent)' }}>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-micro shrink-0 text-text-muted">Access</span>
                {banned
                    ? <ActionButton icon={Check} label="Unban" tone="positive" busy={busy} onClick={() => onAction('unban_user', 'Account unbanned')} />
                    : <ActionButton icon={Ban} label={confirming === 'ban' ? 'Confirm ban' : 'Ban'} tone="danger" busy={busy} onClick={() => confirm('ban', () => onAction('ban_user', 'Account banned'))} />}
                {suspended
                    ? <ActionButton icon={Check} label="Lift suspension" tone="positive" busy={busy} onClick={() => onAction('restore_user', 'Suspension lifted')} />
                    : <ActionButton icon={X} label={confirming === 'susp' ? 'Confirm suspend' : 'Suspend'} tone="warning" busy={busy} onClick={() => confirm('susp', () => onAction('suspend_user', 'Account suspended'))} />}
                {deleted && <ActionButton icon={Check} label="Restore account" tone="positive" busy={busy} onClick={() => onAction('restore_user', 'Account restored')} />}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-micro shrink-0 text-text-muted">Listing</span>
                {hidden
                    ? <ActionButton icon={Eye} label="Show in discovery" tone="positive" busy={busy} onClick={() => onAction('show_user', 'Profile now listed')} />
                    : <ActionButton icon={Eye} label="Hide from discovery" busy={busy} onClick={() => onAction('hide_user', 'Profile hidden')} />}
                {/*
                  approve_user does more than its name suggests: it verifies,
                  approves, unhides, unbans, unsuspends AND sets the package
                  tier. The tier defaults to 'basic' when none is sent — so
                  calling it without one silently downgrades a Silver or Gold
                  member and grants them basic starting credits. The current tier
                  is passed explicitly so approving never changes what they paid
                  for.
                */}
                {!approved && (
                    <ActionButton
                        icon={Check}
                        label="Approve & verify"
                        tone="positive"
                        busy={busy}
                        title="Approves, verifies and unhides the account, keeping its current package"
                        onClick={() => onAction('approve_user', 'Account approved and verified', { subscriptionTier: user.subscription_tier || 'free' })}
                    />
                )}
                <ActionButton icon={UserCog} label="Approve profile" busy={busy} onClick={() => onAction('approve_profile', 'Profile approved')} title="Mark the profile content as reviewed" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-micro shrink-0 text-text-muted">Package</span>
                {locked
                    ? <ActionButton icon={Check} label="Unlock package" tone="positive" busy={busy} onClick={() => onAction('unlock_package', 'Package unlocked')} />
                    : <ActionButton icon={Lock} label="Lock package" tone="warning" busy={busy} onClick={() => onAction('lock_package', 'Package locked')} />}
                {verified && <ActionButton icon={ShieldCheck} label={confirming === 'unver' ? 'Confirm revoke' : 'Revoke verification'} tone="warning" busy={busy} onClick={() => confirm('unver', () => onAction('revoke_verification', 'Verification revoked'))} />}
                {!verified && <ActionButton icon={BadgeCheck} label="Mark verified" tone="positive" busy={busy} onClick={() => onAction('approve_verification', 'Account verified')} />}
            </div>

            {/* Kept apart: everything above is reversible, this is not. */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-micro shrink-0 text-text-muted">Permanent</span>
                <ActionButton
                    icon={Trash2}
                    label={confirming === 'del' ? 'Confirm. This cannot be undone' : 'Delete forever'}
                    tone="danger"
                    busy={busy}
                    onClick={() => confirm('del', () => onAction('delete_user_forever', 'Account deleted permanently'))}
                />
            </div>
        </div>
    );
}

/** Compact state badges, so the row reads at a glance. */
export function UserStateBadges({ user }) {
    const states = [
        user.is_banned && { label: 'Banned', tone: 'var(--color-danger-text)' },
        user.is_suspended && { label: 'Suspended', tone: 'var(--accent-gift)' },
        user.account_deleted_at && { label: 'Deleted', tone: 'var(--color-danger-text)' },
        user.show_in_public === false && { label: 'Hidden', tone: 'var(--color-text-muted)' },
        user.package_locked && { label: 'Package locked', tone: 'var(--accent-gift)' },
        user.admin_approved === false && { label: 'Unapproved', tone: 'var(--accent-gift)' },
        user.verified && { label: 'Verified', tone: 'var(--color-success-text)' },
    ].filter(Boolean);

    if (!states.length) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {states.map((s) => (
                <span
                    key={s.label}
                    className="rounded-full px-2 py-0.5 type-micro font-semibold"
                    style={{ background: `color-mix(in srgb, ${s.tone} 12%, transparent)`, color: s.tone }}
                >
                    {s.label}
                </span>
            ))}
        </div>
    );
}
