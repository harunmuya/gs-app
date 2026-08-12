import { NextResponse } from 'next/server';

export const API_VERSION = 'v1';

export const ERROR_CODES = {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND: 'NOT_FOUND',
    ACCOUNT_RESTRICTED: 'ACCOUNT_RESTRICTED',
    PACKAGE_REQUIRED: 'PACKAGE_REQUIRED',
    PACKAGE_EXPIRED: 'PACKAGE_EXPIRED',
    FEATURE_NOT_INCLUDED: 'FEATURE_NOT_INCLUDED',
    DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
    SERVER_MISCONFIGURED: 'SERVER_MISCONFIGURED',
    SERVER_ERROR: 'SERVER_ERROR',
};

export function apiOk(payload = {}, init = {}) {
    return NextResponse.json({
        ok: true,
        apiVersion: API_VERSION,
        generatedAt: new Date().toISOString(),
        ...payload,
    }, init);
}

export function apiError(code, message, status = 400, extra = {}) {
    return NextResponse.json({
        ok: false,
        apiVersion: API_VERSION,
        generatedAt: new Date().toISOString(),
        error: {
            code,
            message,
            ...extra,
        },
    }, { status });
}

export const ANDROID_PERMISSION_MATRIX = [
    {
        key: 'camera',
        android: 'android.permission.CAMERA',
        requestWhen: ['profile_photo_capture', 'message_camera_media', 'video_call', 'live_stream'],
        required: false,
    },
    {
        key: 'microphone',
        android: 'android.permission.RECORD_AUDIO',
        requestWhen: ['voice_note', 'voice_call', 'video_call', 'live_stream'],
        required: false,
    },
    {
        key: 'notifications',
        android: 'android.permission.POST_NOTIFICATIONS',
        requestWhen: ['after_login_notification_opt_in'],
        required: false,
    },
    {
        key: 'location',
        android: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'],
        requestWhen: ['nearby_discovery', 'current_location_profile_fill', 'distance_matching'],
        required: false,
    },
    {
        key: 'media',
        android: ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE'],
        requestWhen: ['profile_photo_upload', 'message_attachment', 'gif_and_sticker_picker', 'voice_note_playback'],
        required: false,
    },
    /*
      contacts and phone used to be listed here, for an invite_contacts screen,
      a trusted_contact_picker and a direct_phone_call flow. None of those
      exist. The manifest no longer declares either permission, and this list is
      meant to describe what the app actually asks for, not what it might one
      day want.
    */
];

export const API_ENDPOINTS = {
    bootstrap: '/api/v1/bootstrap',
    health: '/api/v1/health',
    entitlements: '/api/v1/entitlements',
    members: '/api/members',
    profiles: '/api/profiles',
    chat: '/api/chat',
    calls: '/api/calls',
    live: '/api/live',
    wallet: '/api/wallet',
    packages: '/api/packages',
    location: '/api/location',
    admin: '/api/admin',
};

export const LEGAL_VERSIONS = {
    terms: '2026-07-10',
    privacy: '2026-07-10',
    communityGuidelines: '2026-07-10',
    safety: '2026-07-10',
};
