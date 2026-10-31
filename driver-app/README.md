# LoadBalbin Driver & Agency App

The existing Android app serves Driver (`driver`) and Agency Owner (`agency`) accounts. The selected login mode only chooses the authentication endpoint; the server's database role and associated Driver or Agency profile determine which dashboard is opened. Admin accounts must use the Web Admin Panel.

## Android builds

From `driver-app`, install the declared dependencies if needed, then create the Android JavaScript bundle:

```powershell
npm install
npx expo export --platform android
```

For a local Android APK or AAB, build with the checked-in Gradle wrapper:

```powershell
Set-Location android
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

The generated files are under `android\app\build\outputs\apk\release` and `android\app\build\outputs\bundle\release`. The current release Gradle configuration uses the Android debug signing key for local testing. Before distribution through Google Play, configure a private production signing key in the local build environment; do not commit keystores or signing credentials.

Set `EXPO_PUBLIC_API_URL` to the intended backend API URL when producing a build for a specific environment. Do not use a production URL for test-account creation or test data.
