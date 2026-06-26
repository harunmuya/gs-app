'use client';

import { Crown, Flame, ShieldCheck, Sparkles, Heart } from 'lucide-react';

export default function VerifiedBadge({ verified = false, badgeText = '', badge = '', size = 16, className = '' }) {
  // Normalize badge text
  const text = (badgeText || badge || (verified ? 'Verified' : '')).trim();
  if (!text) return null;

  const normalized = text.toLowerCase();

  // If it's the verified status, render the official orange GS verified badge PNG directly
  if (normalized === 'verified') {
    return (
      <img
        src="/gs-verified-badge.png"
        alt="GS Verified"
        width={size}
        height={size}
        className={`inline-block shrink-0 align-middle ${className}`}
        style={{ objectFit: 'contain' }}
        aria-label="GS Verified profile"
      />
    );
  }

  // Otherwise, render a gorgeous premium custom pill badge
  let icon = null;
  let styleClasses = '';
  const iconSize = Math.max(10, Math.floor(size * 0.7));

  switch (normalized) {
    case 'verified':
    case 'verified safe':
    case 'safe connect':
      icon = <ShieldCheck size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-sky-500/15 border border-sky-400/40 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.15)]';
      break;
    case 'silver':
    case 'silver member':
      icon = <Sparkles size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.2)]';
      break;
    case 'gold':
    case 'gold member':
      icon = <Crown size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-amber-600/15 border border-amber-500/40 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
      break;
    case 'diamond':
    case 'diamond vip':
    case 'vip':
    case 'vip member':
      icon = <Crown size={iconSize} className="shrink-0 fill-purple-400/20" />;
      styleClasses = 'bg-purple-500/15 border border-purple-400/40 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)] animate-pulse';
      break;
    case 'sugar mum':
    case 'sugar mummy':
    case 'pro mummies':
    case 'pro mummy':
      icon = <Heart size={iconSize} className="shrink-0 fill-pink-500/30" />;
      styleClasses = 'bg-pink-500/15 border border-pink-400/40 text-pink-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]';
      break;
    case 'sugar daddy':
      icon = <Flame size={iconSize} className="shrink-0 fill-violet-500/20" />;
      styleClasses = 'bg-violet-500/15 border border-violet-400/40 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.25)]';
      break;
    case 'trusted agency':
    case 'agency':
      icon = <ShieldCheck size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]';
      break;
    case 'popular member':
    case 'top member':
      icon = <Sparkles size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-orange-500/15 border border-orange-400/40 text-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.2)]';
      break;
    case 'staff':
      icon = <Crown size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-indigo-500/15 border border-indigo-400/40 text-indigo-400';
      break;
    default:
      // Generic gorgeous custom badge
      icon = <Sparkles size={iconSize} className="shrink-0" />;
      styleClasses = 'bg-gradient-to-r from-purple-500/15 to-rose-500/15 border border-purple-400/30 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.15)]';
      break;
  }

  // Calculate proportional padding & text size
  const paddingX = size > 24 ? 'px-3' : 'px-2';
  const paddingY = size > 24 ? 'py-1' : 'py-0.5';
  const fontSize = size > 24 ? 'text-[11px]' : 'text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${paddingX} ${paddingY} rounded-full ${fontSize} font-extrabold uppercase tracking-wider select-none shrink-0 align-middle ${styleClasses} ${className}`}
      aria-label={`${text} Badge`}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}

