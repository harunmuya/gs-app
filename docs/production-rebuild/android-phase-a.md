# Android Phase A Plan

The current Android app is a Capacitor wrapper pointing at `https://genuine-sugarmummies-app.vercel.app`. This is not the final architecture requested.

## Implemented Now

1. Android package: `ke.co.genuinesugarmummies.app`.
2. Capacitor entry activity: `ke.co.genuinesugarmummies.app.MainActivity`.
3. Manifest permissions: internet, notifications, camera, microphone, audio settings, coarse location, and fine location.

## Required Before Android Can Be Called Complete

1. Native login and secure session storage.
2. Native onboarding and profile photo upload.
3. Native permission request flows for camera, microphone, notification, and location.
4. Native discovery, members, matches, profile details, messages, packages, and account settings screens.
5. Native voice-note recording and playback.
6. Native call/live permission and media session handling.
7. Push notifications through Firebase Cloud Messaging or an equivalent approved provider.
8. Offline cache for profile lists and conversations.
9. Removal of the hard dependency on Capacitor `server.url`.

Background location is intentionally not added until there is a clear, user-visible feature that requires it and Google Play compliant disclosure.

