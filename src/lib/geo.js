export const KNOWN_PLACES = [
    { name: 'Nairobi', aliases: ['nairobi'], latitude: -1.2921, longitude: 36.8219 },
    { name: 'Westlands, Nairobi', aliases: ['westlands'], latitude: -1.2676, longitude: 36.8108 },
    { name: 'Kilimani, Nairobi', aliases: ['kilimani', 'yaya'], latitude: -1.2929, longitude: 36.7820 },
    { name: 'Kasarani, Nairobi', aliases: ['kasarani', 'mwiki'], latitude: -1.2257, longitude: 36.8962 },
    { name: 'Rongai, Nairobi', aliases: ['rongai', 'ongata rongai'], latitude: -1.3953, longitude: 36.7598 },
    { name: 'Karen, Nairobi', aliases: ['karen'], latitude: -1.3197, longitude: 36.7064 },
    { name: 'Ruiru', aliases: ['ruiru'], latitude: -1.1466, longitude: 36.9615 },
    { name: 'Kitengela', aliases: ['kitengela'], latitude: -1.4763, longitude: 36.9585 },
    { name: 'Embakasi, Nairobi', aliases: ['embakasi', 'donholm', 'pipeline'], latitude: -1.3133, longitude: 36.8968 },
    { name: 'Kawangware, Nairobi', aliases: ['kawangware', 'lavington'], latitude: -1.2833, longitude: 36.7500 },
    { name: 'Mombasa', aliases: ['mombasa', 'nyali', 'likoni', 'bamburi'], latitude: -4.0435, longitude: 39.6682 },
    { name: 'Kisumu', aliases: ['kisumu'], latitude: -0.0917, longitude: 34.7680 },
    { name: 'Nakuru', aliases: ['nakuru', 'naivasha'], latitude: -0.3031, longitude: 36.0800 },
    { name: 'Eldoret', aliases: ['eldoret'], latitude: 0.5143, longitude: 35.2698 },
    { name: 'Thika', aliases: ['thika', 'ruiru', 'juja'], latitude: -1.0396, longitude: 37.0900 },
    { name: 'Machakos', aliases: ['machakos', 'athi river', 'kitengela'], latitude: -1.5177, longitude: 37.2634 },
    { name: 'Meru', aliases: ['meru'], latitude: 0.0463, longitude: 37.6559 },
    { name: 'Kakamega', aliases: ['kakamega'], latitude: 0.2827, longitude: 34.7519 },
    { name: 'Kampala', aliases: ['kampala', 'entebbe'], latitude: 0.3476, longitude: 32.5825 },
    { name: 'Dar es Salaam', aliases: ['dar es salaam', 'dar', 'daressalaam'], latitude: -6.7924, longitude: 39.2083 },
    { name: 'Arusha', aliases: ['arusha'], latitude: -3.3869, longitude: 36.6830 },
    { name: 'Dodoma', aliases: ['dodoma'], latitude: -6.1630, longitude: 35.7516 },
    { name: 'Kigali', aliases: ['kigali'], latitude: -1.9441, longitude: 30.0619 },
    { name: 'Bujumbura', aliases: ['bujumbura'], latitude: -3.3614, longitude: 29.3599 },
    { name: 'Juba', aliases: ['juba'], latitude: 4.8594, longitude: 31.5713 },
    { name: 'Addis Ababa', aliases: ['addis ababa', 'addis'], latitude: 8.9806, longitude: 38.7578 },
    { name: 'Lagos', aliases: ['lagos', 'ikotun'], latitude: 6.5244, longitude: 3.3792 },
    { name: 'Accra', aliases: ['accra'], latitude: 5.6037, longitude: -0.1870 },
    { name: 'Johannesburg', aliases: ['johannesburg', 'joburg'], latitude: -26.2041, longitude: 28.0473 },
    { name: 'Cape Town', aliases: ['cape town'], latitude: -33.9249, longitude: 18.4241 },

    /*
      Added from the places members have actually entered, not from a guess at
      which towns matter.

      Only 22 of 148 accounts carry coordinates, so 95 rely on this lookup to
      produce a distance at all. It could not place 20 of them, including Nyeri,
      Kisii and Kericho, which are county capitals. Those members saw no distance
      on any card and were excluded from Nearby entirely, which reads as the
      feature being broken rather than as missing data.

      The slug form (transnzoia-kitale) comes from the old WordPress category
      import. The West African cities are members who signed up from outside
      Kenya; placing them honestly is better than showing nothing.
    */
    { name: 'Nyeri', aliases: ['nyeri'], latitude: -0.4201, longitude: 36.9476 },
    { name: 'Kisii', aliases: ['kisii'], latitude: -0.6817, longitude: 34.7667 },
    { name: 'Kericho', aliases: ['kericho'], latitude: -0.3689, longitude: 35.2861 },
    { name: 'Homa Bay', aliases: ['homa bay', 'homabay'], latitude: -0.5273, longitude: 34.4571 },
    { name: 'Isiolo', aliases: ['isiolo'], latitude: 0.3546, longitude: 37.5822 },
    { name: 'Malindi', aliases: ['malindi'], latitude: -3.2192, longitude: 40.1169 },
    { name: 'Kitale', aliases: ['kitale', 'transnzoia', 'trans nzoia'], latitude: 1.0157, longitude: 35.0062 },
    { name: 'Ngong', aliases: ['ngong'], latitude: -1.3526, longitude: 36.6558 },
    { name: 'Mlolongo', aliases: ['mlolongo'], latitude: -1.3872, longitude: 36.9276 },
    { name: 'Utawala, Nairobi', aliases: ['utawala'], latitude: -1.2833, longitude: 36.9500 },
    { name: 'Kenol, Murang\'a', aliases: ['kenol'], latitude: -0.9833, longitude: 37.1333 },
    { name: 'Githunguri', aliases: ['githunguri'], latitude: -1.0500, longitude: 36.7667 },
    { name: 'Karuri, Kiambu', aliases: ['karuri'], latitude: -1.1667, longitude: 36.7167 },
    { name: 'Kikima, Makueni', aliases: ['kikima'], latitude: -1.6167, longitude: 37.5000 },
    { name: 'Konza, Machakos', aliases: ['konza'], latitude: -1.7500, longitude: 37.1167 },
    { name: 'Kikuyu, Kiambu', aliases: ['kikuyu'], latitude: -1.2465, longitude: 36.6636 },
    { name: 'Kiambu', aliases: ['kiambu'], latitude: -1.1714, longitude: 36.8356 },

    // Members outside Kenya.
    { name: 'Abuja', aliases: ['abuja'], latitude: 9.0765, longitude: 7.3986 },
    { name: 'Effiduase, Ashanti', aliases: ['effiduase'], latitude: 6.8500, longitude: -1.4000 },
];

function isNairobiMetro(coords = {}) {
    const name = String(coords.placeName || '').toLowerCase();
    if (name.includes('nairobi') || ['thika', 'ruiru', 'kitengela', 'machakos'].some((item) => name.includes(item))) return true;
    const lat = Number(coords.latitude ?? coords.lat);
    const lng = Number(coords.longitude ?? coords.lng);
    return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= -1.75 && lat <= -0.9
        && lng >= 36.55 && lng <= 37.35;
}

export function distanceKm(a, b) {
    if (!a || !b) return null;
    const lat1 = Number(a.latitude ?? a.lat);
    const lon1 = Number(a.longitude ?? a.lng);
    const lat2 = Number(b.latitude ?? b.lat);
    const lon2 = Number(b.longitude ?? b.lng);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const toRad = (value) => value * Math.PI / 180;
    const radius = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.max(1, Math.round(radius * 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - s1 - s2))));
}

export function displayDistanceKm(a, b) {
    const raw = distanceKm(a, b);
    if (!raw) return null;
    if (isNairobiMetro(a) && isNairobiMetro(b)) return Math.min(raw, 30);
    return raw;
}

export function inferCoordinates(value = '') {
    const text = String(value || '').toLowerCase();
    if (!text) return null;
    const matches = KNOWN_PLACES.flatMap((place, placeIndex) => place.aliases
        .filter((alias) => text.includes(alias))
        .map((alias) => ({ place, placeIndex, aliasLength: alias.length })));
    const match = matches.sort((a, b) => (b.aliasLength - a.aliasLength) || (a.placeIndex - b.placeIndex))[0]?.place;
    return match ? { latitude: match.latitude, longitude: match.longitude, approximate: true, placeName: match.name } : null;
}

/**
 * Nearest known place to a coordinate, or '' when nothing is genuinely close.
 *
 * This is the offline fallback for reverse geocoding — `/api/location?action=reverse`
 * is the accurate path. Two bugs were fixed here:
 *
 *  1. It measured distance as `sqrt(dLat² + dLng²)` on raw degrees. A degree of
 *     longitude is not a degree of latitude — it shrinks by cos(latitude) — so the
 *     comparison was geometrically wrong. It now uses the real haversine distance.
 *  2. Anything beyond ~9 km was labelled "<nearest place> area", with no upper
 *     bound. A member in Nyeri was told "Meru area", roughly 100 km away. It now
 *     returns '' beyond 25 km rather than asserting a place that is simply wrong —
 *     an empty field the member fills in is better than a confident falsehood.
 */
export function labelFromCoordinates(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

    const here = { latitude: lat, longitude: lng };
    let nearest = null;
    let nearestKm = Infinity;

    for (const place of KNOWN_PLACES) {
        const km = distanceKm(here, place);
        if (km !== null && km < nearestKm) {
            nearestKm = km;
            nearest = place;
        }
    }

    if (!nearest) return '';
    if (nearestKm <= 8) return nearest.name;
    if (nearestKm <= 25) return `${nearest.name} area`;
    return '';
}

export function coordinatesForProfile(profile = {}) {
    if (!profile || typeof profile !== 'object') return null;
    const lat = Number(profile.latitude ?? profile.lat);
    const lng = Number(profile.longitude ?? profile.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { latitude: lat, longitude: lng, approximate: false };
    }
    return inferCoordinates([profile.location, profile.city, profile.country].filter(Boolean).join(' '));
}

export function distanceText(viewer, profile) {
    const viewerCoords = coordinatesForProfile(viewer);
    const profileCoords = coordinatesForProfile(profile);
    const km = displayDistanceKm(viewerCoords, profileCoords);
    if (!km) return '';
    return `${viewerCoords?.approximate || profileCoords?.approximate ? 'about ' : ''}${km} km away`;
}
