package ke.co.genuinesugarmummies.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.List;

/**
 * The shell around the web app.
 *
 * Two things were wrong here, and together they meant device permissions did
 * not work in the installed app at all.
 *
 * It asked for everything at launch. Camera, microphone, location, contacts,
 * phone and notifications were all requested in onCreate, before the member had
 * seen a single screen or been told why any of it was wanted. A wall of system
 * dialogs on first open is the reliable way to be denied, and on Android two
 * dismissals make the denial permanent. After that the web layer can ask
 * politely all it likes and no dialog will ever appear again. The app also
 * carried its own rationale sheets, built for exactly this, which the launch
 * burst rendered pointless by asking first.
 *
 * And nothing bridged the WebView. The app loads the site from a remote URL, so
 * when that page calls getUserMedia or navigator.geolocation the request
 * arrives at the WebView, not at Android. Unless the host application answers
 * it, the WebView denies it silently. The page sees a rejected promise, the
 * member sees a camera that does not turn on, and Android never records a
 * denial because it was never asked.
 *
 * So: nothing is requested at launch, and the permission a page asks for is
 * translated into the Android permission behind it, at the moment it is needed.
 */
public class MainActivity extends BridgeActivity {

    /** Set while a WebView request is waiting on an Android dialog. */
    private PermissionRequest pendingMediaRequest;
    private String pendingGeolocationOrigin;
    private GeolocationPermissions.Callback pendingGeolocationCallback;

    private static final int MEDIA_REQUEST = 6201;
    private static final int LOCATION_REQUEST = 6202;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        super.onCreate(savedInstanceState);

        /*
          Answer the WebView's permission questions instead of letting them fall
          on the floor. BridgeWebChromeClient is extended rather than replaced so
          Capacitor keeps its own file chooser and dialog handling.
        */
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    List<String> needed = new ArrayList<>();
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            addIfMissing(needed, Manifest.permission.CAMERA);
                        } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            addIfMissing(needed, Manifest.permission.RECORD_AUDIO);
                        }
                    }

                    if (needed.isEmpty()) {
                        // Android already agreed, so the page can have it.
                        request.grant(request.getResources());
                        return;
                    }

                    pendingMediaRequest = request;
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        needed.toArray(new String[0]),
                        MEDIA_REQUEST
                    );
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                pendingMediaRequest = null;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                boolean granted = has(Manifest.permission.ACCESS_FINE_LOCATION)
                    || has(Manifest.permission.ACCESS_COARSE_LOCATION);

                if (granted) {
                    callback.invoke(origin, true, false);
                    return;
                }

                pendingGeolocationOrigin = origin;
                pendingGeolocationCallback = callback;
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    },
                    LOCATION_REQUEST
                );
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == MEDIA_REQUEST) {
            /*
              Grant only if every permission asked for came back granted. A
              partial grant on a video call, camera without microphone, produces
              a call nobody can hear, which is harder to diagnose than a refusal.
            */
            boolean allGranted = results.length > 0;
            for (int result : results) {
                if (result != PackageManager.PERMISSION_GRANTED) allGranted = false;
            }
            if (pendingMediaRequest != null) {
                if (allGranted) pendingMediaRequest.grant(pendingMediaRequest.getResources());
                else pendingMediaRequest.deny();
                pendingMediaRequest = null;
            }
            return;
        }

        if (requestCode == LOCATION_REQUEST) {
            boolean anyGranted = false;
            for (int result : results) {
                if (result == PackageManager.PERMISSION_GRANTED) anyGranted = true;
            }
            if (pendingGeolocationCallback != null) {
                // Coarse alone is a real answer, so any grant counts here.
                pendingGeolocationCallback.invoke(pendingGeolocationOrigin, anyGranted, false);
                pendingGeolocationCallback = null;
                pendingGeolocationOrigin = null;
            }
            return;
        }

        super.onRequestPermissionsResult(requestCode, permissions, results);
    }

    private boolean has(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void addIfMissing(List<String> permissions, String permission) {
        if (!has(permission) && !permissions.contains(permission)) permissions.add(permission);
    }
}
