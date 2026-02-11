/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Calculate match score based on location proximity
 * Score: 0-100 (100 = same location, 0 = very far)
 */
export function calculateMatchScore(userCoords, profileCoords, maxDistanceKm = 100) {
    if (!userCoords || !profileCoords) return 50; // Default mid score

    const distance = haversineDistance(
        userCoords.lat || userCoords.latitude,
        userCoords.lng || userCoords.longitude,
        profileCoords.lat || profileCoords.latitude,
        profileCoords.lng || profileCoords.longitude
    );

    // Score inversely proportional to distance
    if (distance <= 5) return 100;
    if (distance >= maxDistanceKm) return 10;

    const score = Math.round(100 - (distance / maxDistanceKm) * 90);
    return Math.max(10, Math.min(100, score));
}

/**
 * Check if profile is within user's distance preference
 */
export function isWithinRange(userCoords, profileCoords, maxDistanceKm) {
    if (!userCoords || !profileCoords) return true; // If no location, include profile

    const distance = haversineDistance(
        userCoords.lat || userCoords.latitude,
        userCoords.lng || userCoords.longitude,
        profileCoords.lat || profileCoords.latitude,
        profileCoords.lng || profileCoords.longitude
    );

    return distance <= maxDistanceKm;
}
