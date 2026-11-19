# Android app

The APK is a Trusted Web Activity (TWA): it opens
https://sportprogression.mn-platform.tech in Chrome, full screen, with the
app's own icon, splash and colours. It is the live site, so:

- every deploy of the site is in the app at once; build a new APK only when
  something in this folder changes (name, icon, colours, Android versions);
- Google sign-in and the strict session cookies work as on the web. A WebView
  wrapper would break both, which is why there is none, also not as fallback:
  without Chrome the app opens a Custom Tab.

| | |
| --- | --- |
| Package | `tech.mnplatform.sportprogression` (never change it: it is the app's identity) |
| Version | `1.0.<git commit count>`, versionCode `<git commit count>` |
| Android | 7.0 (API 24) and newer |

## Building

From GitHub: Actions tab, "Android", "Run workflow". It builds the APK
(`.github/workflows/android.yml`) and publishes it as a Release. The latest
one is always at

https://github.com/NielsLazaroms/SportProgression/releases/latest/download/iron-pulse.apk

The release key comes
from the repository secrets `ANDROID_KEYSTORE_B64` (the base64 of
`release.jks`) and `ANDROID_KEYSTORE_PASSWORD`; the build stops when they are
missing or when the key does not match `assetlinks.json`.

Locally it needs only Docker.

```bash
./android/build.sh
```

The signed APK lands in `android/dist/iron-pulse-1.0.<n>.apk`. Put it on the
phone and open it (allow "install unknown apps" for the file manager or
browser once).

## The release key

The first build makes `android/release.jks` and `android/keystore.properties`
(both git-ignored, like `k8s/secret.yaml`). **Back both up.** Android only
installs an update signed with the same key; with a lost key every user has to
uninstall and reinstall.

## Linking the site to the app

Chrome only hides the URL bar when the site vouches for the app:
`frontend/public/.well-known/assetlinks.json` lists the package and the SHA-256
fingerprint of the release key. `build.sh` prints the fingerprint and warns
when it is not in that file. The file reaches the site with a normal deploy
(`./k8s/deploy.sh`). Check it with

```bash
curl https://sportprogression.mn-platform.tech/.well-known/assetlinks.json
```

Without it the app still works, with a URL bar at the top.
