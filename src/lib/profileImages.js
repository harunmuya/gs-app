import { localSeedRows } from '@/lib/localSeedMembers';

const seedRows = localSeedRows();

export const FALLBACK_PROFILE_IMAGES_BY_LABEL = {
    sugar_mummy: seedRows.filter((member) => member.profile_label === 'sugar_mummy').map((member) => member.avatar_url),
    sugar_daddy: seedRows.filter((member) => member.profile_label === 'sugar_daddy').map((member) => member.avatar_url),
    mistress: seedRows.filter((member) => member.profile_label === 'mistress').map((member) => member.avatar_url),
    toyboy: seedRows.filter((member) => member.profile_label === 'toyboy').map((member) => member.avatar_url),
};

export const FALLBACK_PROFILE_IMAGES = [
    ...FALLBACK_PROFILE_IMAGES_BY_LABEL.sugar_mummy,
    ...FALLBACK_PROFILE_IMAGES_BY_LABEL.mistress,
    ...FALLBACK_PROFILE_IMAGES_BY_LABEL.sugar_daddy,
    ...FALLBACK_PROFILE_IMAGES_BY_LABEL.toyboy,
];

function normalizeLabel(label = '') {
    const clean = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (clean.includes('daddy') || clean.includes('dad')) return 'sugar_daddy';
    if (clean.includes('mistress')) return 'mistress';
    if (clean.includes('mummy') || clean.includes('mum')) return 'sugar_mummy';
    if (clean.includes('toyboy') || clean.includes('sugarguy') || clean.includes('sugar_guy') || clean.includes('toboy')) return 'toyboy';
    return '';
}

function hashIndex(seed, length) {
    const text = String(seed || 'Member');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % length;
}

function initialsFallbackDataUri(seed = 'Member') {
    const initials = String(seed || 'Member')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'GS';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f97316"/><stop offset="1" stop-color="#7c2d12"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="330" r="150" fill="rgba(255,255,255,.85)"/><rect x="170" y="550" width="460" height="280" rx="140" fill="rgba(255,255,255,.85)"/><text x="400" y="915" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="800" fill="#fff">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function fallbackProfileImageSrc(seed = 'Member', label = '') {
    const labelKey = normalizeLabel(label) || normalizeLabel(seed);
    const pool = FALLBACK_PROFILE_IMAGES_BY_LABEL[labelKey] || FALLBACK_PROFILE_IMAGES;
    return pool[hashIndex(seed, pool.length)];
}

export function useProfileImageFallback(event, seed = 'Member', label = '') {
    const image = event?.currentTarget;
    if (!image) return;

    if (image.dataset.profileFallbackApplied === 'true') {
        image.onerror = null;
        image.src = initialsFallbackDataUri(seed);
        return;
    }

    image.dataset.profileFallbackApplied = 'true';
    image.src = fallbackProfileImageSrc(seed, label);
}
