package ke.co.genuinesugarmummies.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int GS_PERMISSION_REQUEST = 6201;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        super.onCreate(savedInstanceState);
        requestDevicePermissions();
    }

    private void requestDevicePermissions() {
        List<String> permissions = new ArrayList<>();
        addPermissionIfNeeded(permissions, Manifest.permission.CAMERA);
        addPermissionIfNeeded(permissions, Manifest.permission.RECORD_AUDIO);
        addPermissionIfNeeded(permissions, Manifest.permission.ACCESS_FINE_LOCATION);
        addPermissionIfNeeded(permissions, Manifest.permission.ACCESS_COARSE_LOCATION);
        addPermissionIfNeeded(permissions, Manifest.permission.READ_CONTACTS);
        addPermissionIfNeeded(permissions, Manifest.permission.CALL_PHONE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addPermissionIfNeeded(permissions, Manifest.permission.POST_NOTIFICATIONS);
            addPermissionIfNeeded(permissions, Manifest.permission.READ_MEDIA_IMAGES);
            addPermissionIfNeeded(permissions, Manifest.permission.READ_MEDIA_VIDEO);
            addPermissionIfNeeded(permissions, Manifest.permission.READ_MEDIA_AUDIO);
        } else {
            addPermissionIfNeeded(permissions, Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), GS_PERMISSION_REQUEST);
        }
    }

    private void addPermissionIfNeeded(List<String> permissions, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(permission);
        }
    }
}
