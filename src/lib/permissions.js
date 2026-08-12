'use client';

/**
 * Device permissions, asked properly.
 *
 * The app used to call navigator.geolocation.getCurrentPosition() the moment a
 * member opened Discover, and getUserMedia() the moment a call screen mounted.
 * Both produce a bare OS dialog with no context — the member is asked for their
 * location by an app that has not said why, taps Deny, and the browser then
 * remembers that answer permanently. From then on Discover reports "Location
 * could not be detected" and there is no way back other than the OS settings
 * screen, which nothing points them to.
 *
 * Every app that gets this right asks twice: once in its own words, explaining
 * what the permission buys, and only then hands over to the OS. A member who
 * says no to the first prompt has cost nothing — the real permission is still
 * unasked, so they can be offered it again later. That is the whole reason the
 * pattern exists, and it is why this module never calls a browser permission API
 * without a caller having shown a rationale first.
 */

export const PERMISSIONS = {
    location: {
        id: 'location',
        title: 'Find members near you',
        why: 'We use your location to show who is close by and to sort matches by distance. Your exact position is never shown to other members. They only ever see a town and an approximate distance.',
        deniedHelp: 'Location is blocked for this app. Open your device Settings, find GS App, and allow Location. You can also just add your town in Profile instead.',
    },
    microphone: {
        id: 'microphone',
        title: 'Let them hear you',
        why: 'A voice or video call needs your microphone. It is used only while a call is connected, and never recorded.',
        deniedHelp: 'Microphone access is blocked. Open your device Settings, find GS App, and allow Microphone, then try the call again.',
    },
    camera: {
        id: 'camera',
        title: 'Turn on your camera',
        why: 'A video call or a live stream needs your camera. It is used only while you are on the call or broadcasting, and never recorded.',
        deniedHelp: 'Camera access is blocked. Open your device Settings, find GS App, and allow Camera, then try again.',
    },
    notifications: {
        id: 'notifications',
        title: 'Know when someone replies',
        why: 'Notifications tell you about new messages, calls and matches while the app is closed. You can turn them off at any time in Settings.',
        deniedHelp: 'Notifications are blocked. Open your device Settings, find GS App, and allow Notifications.',
    },
};

/**
 * What the OS currently thinks, without asking.
 *
 * Returns 'granted', 'denied', 'prompt', or 'unknown'. The Permissions API is
 * not universal — Safari has never implemented it for camera or microphone — so
 * 'unknown' is a normal answer and means "ask and find out", not an error.
 */
export async function permissionState(name) {
    if (typeof navigator === 'undefined') return 'unknown';

    if (name === 'notifications') {
        /*
          The Android shell answers this, not the WebView.

          `Notification.permission` inside a Capacitor WebView does not track the
          Android 13 POST_NOTIFICATIONS grant, so reading it there would report
          'granted' for a member who sees nothing on their phone, and the app
          would never offer to ask.
        */
        try {
            const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
                import('@capacitor/core'),
                import('@capacitor/local-notifications'),
            ]);
            if (Capacitor.isNativePlatform?.()) {
                const current = await LocalNotifications.checkPermissions();
                if (current?.display === 'granted') return 'granted';
                if (current?.display === 'denied') return 'denied';
                return 'prompt';
            }
        } catch { /* not a native build; the browser API answers below */ }

        if (typeof Notification === 'undefined') return 'unknown';
        return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    }

    if (!navigator.permissions?.query) return 'unknown';
    const queryName = { location: 'geolocation', microphone: 'microphone', camera: 'camera' }[name];
    if (!queryName) return 'unknown';
    try {
        const status = await navigator.permissions.query({ name: queryName });
        return status.state;
    } catch {
        // Firefox throws for camera/microphone rather than returning a state.
        return 'unknown';
    }
}

/**
 * Ask the OS for location.
 *
 * `precise` maps to enableHighAccuracy. The distinction is real and worth
 * offering: high accuracy engages GPS, which is slower and drains battery, and
 * on Android 12+ the OS itself shows a Precise/Approximate toggle in its dialog.
 * An app that never offers the choice leaves the member guessing which one they
 * agreed to.
 */
export function requestLocation({ precise = false, timeout = 15000 } = {}) {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({ ok: false, reason: 'unsupported' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                ok: true,
                precise,
                coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                },
            }),
            (error) => resolve({
                ok: false,
                // PERMISSION_DENIED is 1; the rest are transient and worth a retry.
                reason: error?.code === 1 ? 'denied' : 'unavailable',
                message: error?.message || '',
            }),
            { enableHighAccuracy: precise, timeout, maximumAge: precise ? 0 : 300000 },
        );
    });
}

/**
 * Ask for camera and/or microphone, and release the stream immediately.
 *
 * Requesting purely to establish the grant is deliberate: it means a call screen
 * can confirm access before it starts negotiating, instead of getting halfway
 * into a WebRTC handshake and then failing. The tracks are stopped so the
 * camera light does not stay on while the member reads a dialog.
 */
export async function requestMedia({ audio = true, video = false } = {}) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return { ok: false, reason: 'unsupported' };
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
        stream.getTracks().forEach((track) => track.stop());
        return { ok: true };
    } catch (error) {
        const name = error?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return { ok: false, reason: 'denied' };
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return { ok: false, reason: 'missing-device' };
        return { ok: false, reason: 'unavailable', message: error?.message || '' };
    }
}

/**
 * Ask for notifications on whichever platform this is running on.
 *
 * The Android shell is a Capacitor WebView. `Notification.requestPermission()`
 * there either does not exist or resolves without ever reaching the Android 13
 * POST_NOTIFICATIONS dialog, so the web path alone would report success on a
 * device that shows the member nothing. The native plugin is tried first and
 * the web API is the fallback for the browser.
 */
export async function requestNotifications() {
    try {
        const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
            import('@capacitor/core'),
            import('@capacitor/local-notifications'),
        ]);
        if (Capacitor.isNativePlatform?.()) {
            const result = await LocalNotifications.requestPermissions();
            return result?.display === 'granted' ? { ok: true } : { ok: false, reason: 'denied' };
        }
    } catch { /* not a native build; fall through to the browser API */ }

    if (typeof Notification === 'undefined') return { ok: false, reason: 'unsupported' };
    try {
        const result = await Notification.requestPermission();
        return result === 'granted' ? { ok: true } : { ok: false, reason: 'denied' };
    } catch {
        return { ok: false, reason: 'unavailable' };
    }
}

/**
 * Whether a rationale has already been shown and dismissed.
 *
 * Asking again on every screen is how an app trains people to tap Deny. One
 * refusal is remembered for a week; an explicit "not now" is respected rather
 * than treated as an invitation to ask on the next navigation.
 */
const DISMISS_KEY = 'gs_permission_dismissed';
const DISMISS_DAYS = 7;

export function wasDismissed(name) {
    if (typeof window === 'undefined') return false;
    try {
        const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
        const at = Number(all[name] || 0);
        return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
        return false;
    }
}

export function markDismissed(name) {
    if (typeof window === 'undefined') return;
    try {
        const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
        all[name] = Date.now();
        localStorage.setItem(DISMISS_KEY, JSON.stringify(all));
    } catch { /* storage full or blocked; asking again is not harmful */ }
}

export function clearDismissed(name) {
    if (typeof window === 'undefined') return;
    try {
        const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
        delete all[name];
        localStorage.setItem(DISMISS_KEY, JSON.stringify(all));
    } catch { /* nothing to clear */ }
}
